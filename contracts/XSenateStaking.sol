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
 * @notice Proof of Participation (PoP) staking contract for X-Senate governance.
 *
 * MECHANICS:
 *  1. Stake XSEN tokens in one of 4 tiers to receive Voting Power (VP)
 *  2. Higher tiers = longer lockup = higher APY + VP multiplier
 *  3. Delegate VP to a Genesis 5 or UGA agent
 *  4. PoP gate: Lock30+ auto-qualifies; Flexible must vote/delegate actively
 *  5. Reward accrues per-second; claim any time (PoP gate enforced)
 *  6. Early unstake (within lockup) forfeits all accumulated rewards
 *
 * TIER TABLE:
 *  Flexible  | no lock  | 5%  APY | 1.0x VP
 *  Lock30    | 30 days  | 10% APY | 1.5x VP
 *  Lock90    | 90 days  | 20% APY | 2.0x VP
 *  Lock180   | 180 days | 35% APY | 3.0x VP
 *
 * REWARD FORMULA (per position, per second):
 *  reward = amount * APY_BPS[tier] * elapsed / (365 days * 10000)
 *
 * AGENT LEADERBOARD RANKS (by total delegated VP):
 *  Gold   — top 10% → +2% bonus APY
 *  Silver — top 30% → +1.5% bonus APY
 *  Bronze — rest    → +1% bonus APY
 */
contract XSenateStaking {

    // ─── Interfaces ───────────────────────────────────────────────
    IXToken public immutable xToken;
    address public governor;

    // ─── Constants ────────────────────────────────────────────────
    uint256 public constant MIN_STAKE        = 100 * 1e18;    // 100 XSEN minimum
    uint256 public constant BPS_DENOMINATOR  = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // Tier APY in basis points: Flexible=5%, Lock30=10%, Lock90=20%, Lock180=35%
    uint256[4] public APY_BPS     = [500, 1000, 2000, 3500];
    // VP multiplier * 10 to avoid decimals: 1.0x=10, 1.5x=15, 2.0x=20, 3.0x=30
    uint256[4] public VP_MULT_X10 = [10, 15, 20, 30];
    // Lock duration in seconds: 0, 30d, 90d, 180d
    uint256[4] public LOCK_SECS   = [0, 30 days, 90 days, 180 days];

    // Agent rank bonus BPS: Gold=200, Silver=150, Bronze=100
    uint256 public constant GOLD_BONUS_BPS   = 200;
    uint256 public constant SILVER_BONUS_BPS = 150;
    uint256 public constant BRONZE_BONUS_BPS = 100;

    // ─── Enums ────────────────────────────────────────────────────
    enum StakeTier { Flexible, Lock30, Lock90, Lock180 }

    enum AgentRank { Bronze, Silver, Gold }

    // ─── Structs ──────────────────────────────────────────────────
    struct StakePosition {
        uint256  id;
        address  owner;
        uint256  amount;
        StakeTier tier;
        uint256  lockEnd;          // 0 for Flexible
        uint256  stakedAt;
        uint256  lastRewardAt;
        uint256  accReward;        // accumulated unclaimed reward
        string   delegatedAgent;  // "" if not delegated
        bool     active;
    }

    struct AgentInfo {
        string    agentName;
        uint256   totalDelegatedVP;   // effective VP (with multiplier) delegated
        uint256   delegatorCount;
        bool      votedThisEpoch;
        AgentRank rank;
        uint256   bonusBPS;           // current bonus (from rank)
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

    // Positions
    uint256 public nextPositionId;
    mapping(uint256 => StakePosition)     public positions;
    mapping(address => uint256[])         public userPositionIds;

    // Aggregates
    uint256 public totalStaked;        // raw token amount staked
    uint256 public totalEffectiveVP;   // multiplier-adjusted VP

    // Participation: epoch => staker => participated
    uint256 public currentEpoch;
    uint256 public epochStart;
    mapping(uint256 => EpochInfo)                         public epochs;
    mapping(uint256 => uint256)                           public epochRewardPool;
    mapping(uint256 => mapping(address => bool))          public participated;

    // Agents
    mapping(string => AgentInfo) public agents;
    string[] public registeredAgents;

    // Ecosystem fund for bonus rewards
    uint256 public ecosystemFund;

    // ─── Events ───────────────────────────────────────────────────
    event Staked(address indexed staker, uint256 indexed positionId, uint256 amount, StakeTier tier, uint256 lockEnd);
    event Unstaked(address indexed staker, uint256 indexed positionId, uint256 amount, uint256 rewardForfeited);
    event RewardClaimed(address indexed staker, uint256 indexed positionId, uint256 reward, uint256 bonus);
    event PositionDelegated(address indexed staker, uint256 indexed positionId, string agentName);
    event DelegationRevoked(address indexed staker, uint256 indexed positionId, string agentName);
    event AgentRegistered(string indexed agentName, uint256 bonusBPS);
    event AgentVotedOnchain(string indexed agentName, string proposalId, bool approve);
    event AgentRankUpdated(string indexed agentName, AgentRank rank, uint256 bonusBPS);
    event EpochAdvanced(uint256 indexed newEpoch, uint256 totalStaked);
    event RewardPoolFunded(uint256 amount, uint256 epochId);
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
        owner        = msg.sender;
        xToken       = IXToken(_xToken);
        epochStart   = block.timestamp;
        currentEpoch = 1;
        nextPositionId = 1;
        epochs[1] = EpochInfo({
            epochId:    1,
            startTime:  block.timestamp,
            endTime:    block.timestamp + 30 days,
            totalStaked: 0,
            rewardPool: 0,
            finalized:  false
        });
    }

    // ─── Admin ────────────────────────────────────────────────────

    function setGovernor(address _governor) external onlyOwner {
        governor = _governor;
    }

    /**
     * @notice Register a Genesis 5 or UGA agent for delegation.
     */
    function registerAgent(string memory agentName, uint256 bonusBPS) external onlyOwner {
        require(bytes(agentName).length > 0, "Staking: empty name");
        if (bytes(agents[agentName].agentName).length == 0) {
            registeredAgents.push(agentName);
        }
        agents[agentName].agentName = agentName;
        agents[agentName].bonusBPS  = bonusBPS;
        agents[agentName].rank      = AgentRank.Bronze;
        emit AgentRegistered(agentName, bonusBPS);
    }

    /**
     * @notice Fund the current epoch reward pool (called by DAO treasury or deployer).
     */
    function fundRewardPool(uint256 amount) external {
        require(xToken.transferFrom(msg.sender, address(this), amount), "Staking: transfer failed");
        epochRewardPool[currentEpoch] += amount;
        epochs[currentEpoch].rewardPool += amount;
        ecosystemFund += amount / 10;  // 10% earmarked for bonus rewards
        emit RewardPoolFunded(amount, currentEpoch);
    }

    // ─── Staking ──────────────────────────────────────────────────

    /**
     * @notice Create a new stake position.
     * @param amount  Amount of XSEN to stake (min 100 XSEN)
     * @param tier    StakeTier: 0=Flexible, 1=Lock30, 2=Lock90, 3=Lock180
     */
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

        // Lock30+ positions auto-qualify for PoP
        if (tier != StakeTier.Flexible) {
            participated[currentEpoch][msg.sender] = true;
        }

        emit Staked(msg.sender, positionId, amount, tier, lockEnd);
    }

    /**
     * @notice Unstake a position.
     *         If lockup has not expired, all accumulated rewards are forfeited.
     */
    function unstake(uint256 positionId) external positionOwner(positionId) {
        StakePosition storage p = positions[positionId];

        bool earlyExit = (p.lockEnd > 0 && block.timestamp < p.lockEnd);

        // Accrue rewards before closing (only if not early exit)
        uint256 forfeited = 0;
        if (!earlyExit) {
            _accrueReward(positionId);
        } else {
            // Forfeit accumulated rewards on early exit
            forfeited = p.accReward + _pendingReward(positionId);
            p.accReward = 0;
        }

        uint256 amount = p.amount;

        // Revoke delegation if active
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

    /**
     * @notice Delegate a position's VP to an agent.
     *         Marks the staker as PoP participant for current epoch.
     */
    function delegatePosition(uint256 positionId, string memory agentName)
        external positionOwner(positionId)
    {
        require(bytes(agentName).length > 0, "Staking: empty agent name");

        StakePosition storage p = positions[positionId];

        // Remove previous delegation
        if (bytes(p.delegatedAgent).length > 0) {
            _removeDelegation(positionId);
        }

        uint256 ep = _effectiveVP(p.amount, p.tier);
        p.delegatedAgent = agentName;

        agents[agentName].totalDelegatedVP += ep;
        agents[agentName].delegatorCount   += 1;

        // Mark as PoP participant
        participated[currentEpoch][msg.sender] = true;

        emit PositionDelegated(msg.sender, positionId, agentName);
    }

    /**
     * @notice Revoke delegation on a specific position.
     */
    function undelegatePosition(uint256 positionId) external positionOwner(positionId) {
        require(bytes(positions[positionId].delegatedAgent).length > 0, "Staking: not delegated");
        _removeDelegation(positionId);
    }

    // ─── Reward Claiming ──────────────────────────────────────────

    /**
     * @notice Claim rewards for a single position.
     *         Flexible tier: must have participated (voted or delegated).
     *         Lock30+: always eligible.
     */
    function claimReward(uint256 positionId) external positionOwner(positionId) {
        _claimPositionReward(positionId);
    }

    /**
     * @notice Claim rewards for all active positions of the caller.
     */
    function claimAllRewards() external {
        uint256[] storage ids = userPositionIds[msg.sender];
        for (uint256 i = 0; i < ids.length; i++) {
            StakePosition storage p = positions[ids[i]];
            if (p.active && p.accReward + _pendingReward(ids[i]) > 0) {
                _claimPositionReward(ids[i]);
            }
        }
    }

    // ─── Participation Marking (Governor callbacks) ───────────────

    /**
     * @notice Called by governor when an agent casts a senate vote.
     *         Marks all delegators of that agent as PoP participants.
     */
    function markAgentVoted(string memory agentName, string memory proposalId, bool approve)
        external onlyGovernor
    {
        agents[agentName].votedThisEpoch = true;
        emit AgentVotedOnchain(agentName, proposalId, approve);
        // Note: individual delegator participation is set at delegatePosition()
        // For production full iteration, index delegators per agent
    }

    /**
     * @notice Called when a user votes directly (not via agent).
     */
    function markDirectVote(address voter) external onlyGovernor {
        participated[currentEpoch][voter] = true;
        emit DirectVoteMarked(voter);
    }

    // ─── Epoch Management ─────────────────────────────────────────

    /**
     * @notice Advance to next epoch (callable by anyone after epoch ends).
     */
    function advanceEpoch() external {
        require(block.timestamp >= epochStart + 30 days, "Staking: epoch not ended");

        epochs[currentEpoch].finalized   = true;
        epochs[currentEpoch].totalStaked = totalStaked;

        currentEpoch += 1;
        epochStart    = block.timestamp;

        // Reset agent vote tracking and recompute ranks
        _updateAgentRanks();

        for (uint256 i = 0; i < registeredAgents.length; i++) {
            agents[registeredAgents[i]].votedThisEpoch = false;
        }

        epochs[currentEpoch] = EpochInfo({
            epochId:    currentEpoch,
            startTime:  block.timestamp,
            endTime:    block.timestamp + 30 days,
            totalStaked: totalStaked,
            rewardPool: 0,
            finalized:  false
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

    /**
     * @notice Returns the sum of effective VP (with multiplier) for all active positions.
     */
    function getEffectiveVP(address user) external view returns (uint256 vp) {
        uint256[] storage ids = userPositionIds[user];
        for (uint256 i = 0; i < ids.length; i++) {
            StakePosition storage p = positions[ids[i]];
            if (p.active) {
                vp += _effectiveVP(p.amount, p.tier);
            }
        }
    }

    /**
     * @notice Returns total pending + accumulated reward across all active positions.
     */
    function getTotalPendingRewards(address user) external view returns (uint256 total) {
        uint256[] storage ids = userPositionIds[user];
        for (uint256 i = 0; i < ids.length; i++) {
            StakePosition storage p = positions[ids[i]];
            if (p.active) {
                total += p.accReward + _pendingReward(ids[i]);
            }
        }
    }

    function getAgentInfo(string memory agentName) external view returns (AgentInfo memory) {
        return agents[agentName];
    }

    function getRegisteredAgents() external view returns (string[] memory) {
        return registeredAgents;
    }

    /**
     * @notice UGA leaderboard — agents sorted by totalDelegatedVP descending.
     *         Returns up to `limit` entries.
     */
    function getLeaderboard(uint256 limit) external view
        returns (AgentInfo[] memory board)
    {
        uint256 count = registeredAgents.length;
        if (limit == 0 || limit > count) limit = count;

        // Copy to memory array then sort (insertion sort, small N is fine)
        AgentInfo[] memory all = new AgentInfo[](count);
        for (uint256 i = 0; i < count; i++) {
            all[i] = agents[registeredAgents[i]];
        }
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

    function getVotingPower(address staker) external view returns (uint256) {
        uint256[] storage ids = userPositionIds[staker];
        uint256 vp;
        for (uint256 i = 0; i < ids.length; i++) {
            if (positions[ids[i]].active) {
                vp += _effectiveVP(positions[ids[i]].amount, positions[ids[i]].tier);
            }
        }
        return vp;
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
        uint256 tierIdx = uint256(p.tier);
        return (p.amount * APY_BPS[tierIdx] * elapsed) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
    }

    function _accrueReward(uint256 positionId) internal {
        StakePosition storage p = positions[positionId];
        p.accReward    += _pendingReward(positionId);
        p.lastRewardAt  = block.timestamp;
    }

    function _claimPositionReward(uint256 positionId) internal {
        StakePosition storage p = positions[positionId];
        require(p.active, "Staking: position not active");
        require(p.owner == msg.sender, "Staking: not owner");

        _accrueReward(positionId);
        uint256 reward = p.accReward;
        require(reward > 0, "Staking: no rewards");

        // PoP gate for Flexible tier
        if (p.tier == StakeTier.Flexible) {
            require(
                participated[currentEpoch][msg.sender],
                "Staking: must vote or delegate to earn rewards (PoP)"
            );
        }

        p.accReward = 0;

        // Apply agent bonus if delegated
        uint256 bonus = 0;
        if (bytes(p.delegatedAgent).length > 0) {
            AgentInfo storage agent = agents[p.delegatedAgent];
            bonus = (reward * agent.bonusBPS) / BPS_DENOMINATOR;
        }

        uint256 total = reward + bonus;

        // Pay from reward pool if available, else mint
        if (total <= epochRewardPool[currentEpoch]) {
            epochRewardPool[currentEpoch] -= total;
            require(xToken.transfer(msg.sender, total), "Staking: transfer failed");
        } else {
            xToken.mint(msg.sender, total);
        }

        emit RewardClaimed(msg.sender, positionId, reward, bonus);
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
     * @dev Recompute Gold/Silver/Bronze ranks at epoch boundary.
     *      Gold = top 10%, Silver = top 30%, Bronze = rest.
     */
    function _updateAgentRanks() internal {
        uint256 n = registeredAgents.length;
        if (n == 0) return;

        uint256 goldCut   = n / 10;         // top 10%
        uint256 silverCut = (n * 3) / 10;   // top 30%
        if (goldCut == 0) goldCut = 1;

        // Simple sort by totalDelegatedVP
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
            AgentInfo storage a = agents[sorted[i]];
            if (i < goldCut) {
                a.rank     = AgentRank.Gold;
                a.bonusBPS = GOLD_BONUS_BPS;
            } else if (i < silverCut) {
                a.rank     = AgentRank.Silver;
                a.bonusBPS = SILVER_BONUS_BPS;
            } else {
                a.rank     = AgentRank.Bronze;
                a.bonusBPS = BRONZE_BONUS_BPS;
            }
            emit AgentRankUpdated(sorted[i], a.rank, a.bonusBPS);
        }
    }
}
