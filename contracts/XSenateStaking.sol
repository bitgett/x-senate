// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IXToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title XSenateStaking
 * @notice Proof of Participation (PoP) staking for X-Senate governance.
 *
 * TIER TABLE:
 *  Flexible  | no lock  | 5%  APY | 1.0x VP
 *  Lock30    | 30 days  | 10% APY | 1.5x VP
 *  Lock90    | 90 days  | 20% APY | 2.0x VP
 *  Lock180   | 180 days | 35% APY | 3.0x VP
 *
 * AGENT SYSTEM:
 *  - Genesis 5: platform agents (no creator reward)
 *  - User Agents: anyone can register; creator earns 3% of delegator
 *    rewards from the ecosystem fund (delegator keeps 100%)
 *
 * SNAPSHOT VP:
 *  - Governor calls snapshotForProposal() at proposal creation
 *  - Voting uses snapshotted agent VP — prevents flash-stake attacks
 *
 * LEADERBOARD:
 *  - Top 3 agents by delegated VP earn 1st / 2nd / 3rd badges
 *  - Purely informational — no APY bonus for delegators
 */
contract XSenateStaking {

    // ─── Interfaces ───────────────────────────────────────────────
    IXToken public immutable xToken;
    address public governor;

    // ─── Constants ────────────────────────────────────────────────
    uint256 public constant MIN_STAKE           = 100 * 1e18;
    uint256 public constant BPS_DENOMINATOR     = 10000;
    uint256 public constant SECONDS_PER_YEAR    = 365 days;
    uint256 public constant CREATOR_BONUS_BPS   = 300; // 3% from ecosystem fund to agent creator

    uint256[4] public APY_BPS     = [500, 1000, 2000, 3500];
    uint256[4] public VP_MULT_X10 = [10, 15, 20, 30];
    uint256[4] public LOCK_SECS   = [0, 30 days, 90 days, 180 days];

    // ─── Enums ────────────────────────────────────────────────────
    enum StakeTier { Flexible, Lock30, Lock90, Lock180 }

    // ─── Structs ──────────────────────────────────────────────────
    struct StakePosition {
        uint256   id;
        address   owner;
        uint256   amount;
        StakeTier tier;
        uint256   lockEnd;
        uint256   stakedAt;
        uint256   lastRewardAt;
        uint256   accReward;
        string    delegatedAgent;
        bool      active;
    }

    struct AgentInfo {
        string  agentName;
        address creator;          // address(0) for Genesis agents
        bool    isGenesis;        // true = Genesis 5 platform agents
        uint256 totalDelegatedVP;
        uint256 delegatorCount;
        bool    votedThisEpoch;
        uint8   rank;             // 0=unranked, 1=1st, 2=2nd, 3=3rd
        uint256 accCreatorReward; // claimable by creator
    }

    struct EpochInfo {
        uint256 epochId;
        uint256 startTime;
        uint256 endTime;
        uint256 totalStaked;
        uint256 rewardPool;
        bool    finalized;
    }

    // ─── State ────────────────────────────────────────────────────
    address public owner;

    uint256 public nextPositionId;
    mapping(uint256 => StakePosition)    public positions;
    mapping(address => uint256[])        public userPositionIds;

    uint256 public totalStaked;
    uint256 public totalEffectiveVP;

    uint256 public currentEpoch;
    uint256 public epochStart;
    mapping(uint256 => EpochInfo)                        public epochs;
    mapping(uint256 => uint256)                          public epochRewardPool;
    mapping(uint256 => mapping(address => bool))         public participated;

    mapping(string => AgentInfo) public agents;
    string[] public registeredAgents;

    // Snapshot: proposalId => agentName => VP at proposal creation
    mapping(string => mapping(string => uint256)) public proposalAgentVP;

    uint256 public ecosystemFund;

    // ─── Events ───────────────────────────────────────────────────
    event Staked(address indexed staker, uint256 indexed positionId, uint256 amount, StakeTier tier, uint256 lockEnd);
    event Unstaked(address indexed staker, uint256 indexed positionId, uint256 amount, uint256 rewardForfeited);
    event RewardClaimed(address indexed staker, uint256 indexed positionId, uint256 reward);
    event CreatorRewardClaimed(string indexed agentName, address indexed creator, uint256 amount);
    event PositionDelegated(address indexed staker, uint256 indexed positionId, string agentName);
    event DelegationRevoked(address indexed staker, uint256 indexed positionId, string agentName);
    event AgentRegistered(string indexed agentName, address creator, bool isGenesis);
    event AgentVotedOnchain(string indexed agentName, string proposalId, bool approve);
    event AgentRankUpdated(string indexed agentName, uint8 rank);
    event EpochAdvanced(uint256 indexed newEpoch, uint256 totalStaked);
    event RewardPoolFunded(uint256 amount, uint256 epochId);
    event ProposalSnapshotted(string indexed proposalId);
    event DirectVoteMarked(address indexed voter);

    // ─── Modifiers ────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Staking: not owner");
        _;
    }

    modifier onlyGovernor() {
        require(msg.sender == governor || msg.sender == owner, "Staking: not governor");
        _;
    }

    modifier positionOwner(uint256 positionId) {
        require(positions[positionId].owner == msg.sender, "Staking: not position owner");
        require(positions[positionId].active, "Staking: position not active");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────
    constructor(address _xToken) {
        owner          = msg.sender;
        xToken         = IXToken(_xToken);
        epochStart     = block.timestamp;
        currentEpoch   = 1;
        nextPositionId = 1;
        epochs[1] = EpochInfo({
            epochId:     1,
            startTime:   block.timestamp,
            endTime:     block.timestamp + 30 days,
            totalStaked: 0,
            rewardPool:  0,
            finalized:   false
        });
    }

    // ─── Admin ────────────────────────────────────────────────────

    function setGovernor(address _governor) external onlyOwner {
        governor = _governor;
    }

    /**
     * @notice Register a Genesis 5 agent (onlyOwner, no creator reward).
     */
    function registerGenesisAgent(string memory agentName) external onlyOwner {
        require(bytes(agentName).length > 0, "Staking: empty name");
        if (bytes(agents[agentName].agentName).length == 0) {
            registeredAgents.push(agentName);
        }
        agents[agentName].agentName  = agentName;
        agents[agentName].creator    = address(0);
        agents[agentName].isGenesis  = true;
        emit AgentRegistered(agentName, address(0), true);
    }

    /**
     * @notice Register a User Agent — anyone can call.
     *         Creator earns 3% of delegator rewards from ecosystem fund.
     */
    function registerUserAgent(string memory agentName) external {
        require(bytes(agentName).length > 0, "Staking: empty name");
        require(bytes(agents[agentName].agentName).length == 0, "Staking: agent already exists");
        registeredAgents.push(agentName);
        agents[agentName].agentName = agentName;
        agents[agentName].creator   = msg.sender;
        agents[agentName].isGenesis = false;
        emit AgentRegistered(agentName, msg.sender, false);
    }

    /**
     * @notice Fund the current epoch reward pool + ecosystem fund.
     *         10% of funded amount goes to ecosystem fund for creator rewards.
     */
    function fundRewardPool(uint256 amount) external {
        require(xToken.transferFrom(msg.sender, address(this), amount), "Staking: transfer failed");
        uint256 forEcosystem = amount / 10;
        ecosystemFund += forEcosystem;
        uint256 forPool = amount - forEcosystem;
        epochRewardPool[currentEpoch] += forPool;
        epochs[currentEpoch].rewardPool += forPool;
        emit RewardPoolFunded(amount, currentEpoch);
    }

    // ─── Staking ──────────────────────────────────────────────────

    function stake(uint256 amount, StakeTier tier) external returns (uint256 positionId) {
        require(amount >= MIN_STAKE, "Staking: below minimum stake");
        require(xToken.transferFrom(msg.sender, address(this), amount), "Staking: transfer failed");

        uint256 tierIndex = uint256(tier);
        uint256 lockEnd   = (LOCK_SECS[tierIndex] > 0)
            ? block.timestamp + LOCK_SECS[tierIndex]
            : 0;

        positionId = nextPositionId++;
        positions[positionId] = StakePosition({
            id:             positionId,
            owner:          msg.sender,
            amount:         amount,
            tier:           tier,
            lockEnd:        lockEnd,
            stakedAt:       block.timestamp,
            lastRewardAt:   block.timestamp,
            accReward:      0,
            delegatedAgent: "",
            active:         true
        });

        userPositionIds[msg.sender].push(positionId);
        totalStaked      += amount;
        totalEffectiveVP += _effectiveVP(amount, tier);

        if (tier != StakeTier.Flexible) {
            participated[currentEpoch][msg.sender] = true;
        }

        emit Staked(msg.sender, positionId, amount, tier, lockEnd);
    }

    function unstake(uint256 positionId) external positionOwner(positionId) {
        StakePosition storage p = positions[positionId];
        bool earlyExit = (p.lockEnd > 0 && block.timestamp < p.lockEnd);

        uint256 forfeited = 0;
        if (!earlyExit) {
            _accrueReward(positionId);
        } else {
            forfeited   = p.accReward + _pendingReward(positionId);
            p.accReward = 0;
        }

        uint256 amount = p.amount;
        if (bytes(p.delegatedAgent).length > 0) {
            _removeDelegation(positionId);
        }

        totalStaked      -= amount;
        totalEffectiveVP -= _effectiveVP(amount, p.tier);
        p.active          = false;
        p.amount          = 0;

        require(xToken.transfer(msg.sender, amount), "Staking: transfer failed");
        emit Unstaked(msg.sender, positionId, amount, forfeited);
    }

    // ─── Delegation ───────────────────────────────────────────────

    function delegatePosition(uint256 positionId, string memory agentName)
        external positionOwner(positionId)
    {
        require(bytes(agentName).length > 0, "Staking: empty agent name");
        require(bytes(agents[agentName].agentName).length > 0, "Staking: agent not registered");

        StakePosition storage p = positions[positionId];
        if (bytes(p.delegatedAgent).length > 0) {
            _removeDelegation(positionId);
        }

        uint256 ep = _effectiveVP(p.amount, p.tier);
        p.delegatedAgent = agentName;
        agents[agentName].totalDelegatedVP += ep;
        agents[agentName].delegatorCount   += 1;

        participated[currentEpoch][msg.sender] = true;
        emit PositionDelegated(msg.sender, positionId, agentName);
    }

    function undelegatePosition(uint256 positionId) external positionOwner(positionId) {
        require(bytes(positions[positionId].delegatedAgent).length > 0, "Staking: not delegated");
        _removeDelegation(positionId);
    }

    // ─── Reward Claiming ──────────────────────────────────────────

    /**
     * @notice Claim staking reward for one position.
     *         Delegator receives 100%. If agent is a User Agent,
     *         3% additional is accrued to creator from ecosystem fund.
     */
    function claimReward(uint256 positionId) external positionOwner(positionId) {
        _claimPositionReward(positionId);
    }

    function claimAllRewards() external {
        uint256[] storage ids = userPositionIds[msg.sender];
        for (uint256 i = 0; i < ids.length; i++) {
            StakePosition storage p = positions[ids[i]];
            if (p.active && p.accReward + _pendingReward(ids[i]) > 0) {
                _claimPositionReward(ids[i]);
            }
        }
    }

    /**
     * @notice Agent creator claims their accumulated creator rewards.
     */
    function claimCreatorReward(string memory agentName) external {
        AgentInfo storage a = agents[agentName];
        require(a.creator == msg.sender, "Staking: not agent creator");
        require(a.accCreatorReward > 0, "Staking: no creator rewards");

        uint256 amount = a.accCreatorReward;
        a.accCreatorReward = 0;

        require(xToken.transfer(msg.sender, amount), "Staking: transfer failed");
        emit CreatorRewardClaimed(agentName, msg.sender, amount);
    }

    // ─── Snapshot VP (flash-vote protection) ─────────────────────

    /**
     * @notice Called by governor at proposal creation.
     *         Locks in current agent VP so staking/unstaking after
     *         proposal creation cannot affect the vote outcome.
     */
    function snapshotForProposal(string memory proposalId) external onlyGovernor {
        for (uint256 i = 0; i < registeredAgents.length; i++) {
            string memory name = registeredAgents[i];
            proposalAgentVP[proposalId][name] = agents[name].totalDelegatedVP;
        }
        emit ProposalSnapshotted(proposalId);
    }

    /**
     * @notice Returns snapshotted VP for an agent at proposal creation time.
     */
    function getSnapshotVP(string memory proposalId, string memory agentName)
        external view returns (uint256)
    {
        return proposalAgentVP[proposalId][agentName];
    }

    // ─── Participation Marking ────────────────────────────────────

    function markAgentVoted(string memory agentName, string memory proposalId, bool approve)
        external onlyGovernor
    {
        agents[agentName].votedThisEpoch = true;
        emit AgentVotedOnchain(agentName, proposalId, approve);
    }

    function markDirectVote(address voter) external onlyGovernor {
        participated[currentEpoch][voter] = true;
        emit DirectVoteMarked(voter);
    }

    // ─── Epoch Management ─────────────────────────────────────────

    function advanceEpoch() external {
        require(block.timestamp >= epochStart + 30 days, "Staking: epoch not ended");

        epochs[currentEpoch].finalized   = true;
        epochs[currentEpoch].totalStaked = totalStaked;

        currentEpoch += 1;
        epochStart    = block.timestamp;

        _updateAgentRanks();

        for (uint256 i = 0; i < registeredAgents.length; i++) {
            agents[registeredAgents[i]].votedThisEpoch = false;
        }

        epochs[currentEpoch] = EpochInfo({
            epochId:     currentEpoch,
            startTime:   block.timestamp,
            endTime:     block.timestamp + 30 days,
            totalStaked: totalStaked,
            rewardPool:  0,
            finalized:   false
        });

        emit EpochAdvanced(currentEpoch, totalStaked);
    }

    // ─── View Functions ───────────────────────────────────────────

    function getPosition(uint256 positionId) external view returns (StakePosition memory) {
        return positions[positionId];
    }

    function getUserPositions(address user) external view returns (StakePosition[] memory) {
        uint256[] storage ids = userPositionIds[user];
        StakePosition[] memory result = new StakePosition[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = positions[ids[i]];
        }
        return result;
    }

    function getEffectiveVP(address user) external view returns (uint256 vp) {
        uint256[] storage ids = userPositionIds[user];
        for (uint256 i = 0; i < ids.length; i++) {
            StakePosition storage p = positions[ids[i]];
            if (p.active) vp += _effectiveVP(p.amount, p.tier);
        }
    }

    function getTotalPendingRewards(address user) external view returns (uint256 total) {
        uint256[] storage ids = userPositionIds[user];
        for (uint256 i = 0; i < ids.length; i++) {
            StakePosition storage p = positions[ids[i]];
            if (p.active) total += p.accReward + _pendingReward(ids[i]);
        }
    }

    function getAgentInfo(string memory agentName) external view returns (AgentInfo memory) {
        return agents[agentName];
    }

    function getRegisteredAgents() external view returns (string[] memory) {
        return registeredAgents;
    }

    /**
     * @notice Agent leaderboard sorted by delegated VP desc.
     *         rank: 1=1st, 2=2nd, 3=3rd, 0=unranked
     */
    function getLeaderboard(uint256 limit) external view returns (AgentInfo[] memory board) {
        uint256 count = registeredAgents.length;
        if (limit == 0 || limit > count) limit = count;

        AgentInfo[] memory all = new AgentInfo[](count);
        for (uint256 i = 0; i < count; i++) {
            all[i] = agents[registeredAgents[i]];
        }
        // Insertion sort descending
        for (uint256 i = 1; i < count; i++) {
            AgentInfo memory key = all[i];
            int256 j = int256(i) - 1;
            while (j >= 0 && all[uint256(j)].totalDelegatedVP < key.totalDelegatedVP) {
                all[uint256(j + 1)] = all[uint256(j)];
                j--;
            }
            all[uint256(j + 1)] = key;
        }

        board = new AgentInfo[](limit);
        for (uint256 i = 0; i < limit; i++) {
            board[i] = all[i];
        }
    }

    function getCurrentEpoch() external view returns (EpochInfo memory) {
        return epochs[currentEpoch];
    }

    function hasParticipated(address staker) external view returns (bool) {
        return participated[currentEpoch][staker];
    }

    // ─── Internal ─────────────────────────────────────────────────

    function _effectiveVP(uint256 amount, StakeTier tier) internal view returns (uint256) {
        return (amount * VP_MULT_X10[uint256(tier)]) / 10;
    }

    function _pendingReward(uint256 positionId) internal view returns (uint256) {
        StakePosition storage p = positions[positionId];
        if (!p.active || p.amount == 0) return 0;
        uint256 elapsed = block.timestamp - p.lastRewardAt;
        return (p.amount * APY_BPS[uint256(p.tier)] * elapsed) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
    }

    function _accrueReward(uint256 positionId) internal {
        StakePosition storage p = positions[positionId];
        p.accReward   += _pendingReward(positionId);
        p.lastRewardAt = block.timestamp;
    }

    function _claimPositionReward(uint256 positionId) internal {
        StakePosition storage p = positions[positionId];
        require(p.active, "Staking: position not active");
        require(p.owner == msg.sender, "Staking: not owner");

        _accrueReward(positionId);
        uint256 reward = p.accReward;
        require(reward > 0, "Staking: no rewards");

        // PoP gate: Flexible must have voted or delegated
        if (p.tier == StakeTier.Flexible) {
            require(
                participated[currentEpoch][msg.sender],
                "Staking: must vote or delegate to earn rewards (PoP)"
            );
        }

        p.accReward = 0;

        // Pay delegator 100% from reward pool (or mint)
        if (reward <= epochRewardPool[currentEpoch]) {
            epochRewardPool[currentEpoch] -= reward;
            require(xToken.transfer(msg.sender, reward), "Staking: transfer failed");
        } else {
            xToken.mint(msg.sender, reward);
        }

        // If delegated to a User Agent, accrue 3% creator reward from ecosystem fund
        if (bytes(p.delegatedAgent).length > 0) {
            AgentInfo storage agent = agents[p.delegatedAgent];
            if (!agent.isGenesis && agent.creator != address(0)) {
                uint256 creatorReward = (reward * CREATOR_BONUS_BPS) / BPS_DENOMINATOR;
                if (creatorReward <= ecosystemFund) {
                    ecosystemFund -= creatorReward;
                    agent.accCreatorReward += creatorReward;
                }
            }
        }

        emit RewardClaimed(msg.sender, positionId, reward);
    }

    function _removeDelegation(uint256 positionId) internal {
        StakePosition storage p = positions[positionId];
        string memory agentName = p.delegatedAgent;
        uint256 ep = _effectiveVP(p.amount, p.tier);

        if (agents[agentName].totalDelegatedVP >= ep) {
            agents[agentName].totalDelegatedVP -= ep;
        }
        if (agents[agentName].delegatorCount > 0) {
            agents[agentName].delegatorCount -= 1;
        }

        emit DelegationRevoked(p.owner, positionId, agentName);
        p.delegatedAgent = "";
    }

    /**
     * @dev Update top 5 ranks by delegated VP. Called at epoch boundary.
     *      rank: 1=1st, 2=2nd, 3=3rd, 4=4th, 5=5th, 0=unranked
     */
    function _updateAgentRanks() internal {
        uint256 n = registeredAgents.length;
        if (n == 0) return;

        string[] memory sorted = new string[](n);
        for (uint256 i = 0; i < n; i++) sorted[i] = registeredAgents[i];

        for (uint256 i = 1; i < n; i++) {
            string memory key = sorted[i];
            int256 j = int256(i) - 1;
            while (j >= 0 && agents[sorted[uint256(j)]].totalDelegatedVP < agents[key].totalDelegatedVP) {
                sorted[uint256(j + 1)] = sorted[uint256(j)];
                j--;
            }
            sorted[uint256(j + 1)] = key;
        }

        for (uint256 i = 0; i < n; i++) {
            uint8 newRank = (i < 5) ? uint8(i + 1) : 0;
            agents[sorted[i]].rank = newRank;
            emit AgentRankUpdated(sorted[i], newRank);
        }
    }
}
