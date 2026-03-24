// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IXSenateStakingForRegistry {
    function registerAgent(string memory agentName, uint256 bonusBPS) external;
    function setGovernor(address _governor) external;
    function fundRewardPool(uint256 amount) external;
}

interface IXTokenForRegistry {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title XSenateRegistry
 * @notice Permissionless on-chain directory for the X-Senate governance platform.
 *
 * Any project with an ERC20 token on X Layer can register to use:
 *   - Genesis 5 AI Senate (shared governor, 5 AI agents)
 *   - Independent staking pool (XSenateStaking deployed per-project)
 *   - Proof of Participation rewards
 *
 * HOW REGISTRATION WORKS:
 *   1. Project provides their token address and pays REGISTRATION_FEE XSEN
 *   2. Registry records the project with its pre-deployed staking contract
 *      (Staking deployment is done by the backend service — see /api/registry/projects)
 *   3. Governor uses registry to look up the correct staking contract per proposal
 *
 * XSEN PLATFORM FEE:
 *   All registration fees flow into the XSEN staking contract's ecosystemFund,
 *   boosting rewards for XSEN stakers.
 *
 * This contract is the core of X-Senate's Ecosystem Contribution to X Layer:
 *   every DAO or token project on X Layer can leverage the same AI governance infrastructure.
 */
contract XSenateRegistry {

    // ─── Constants ────────────────────────────────────────────────
    uint256 public constant REGISTRATION_FEE = 1000 * 1e18;  // 1000 XSEN
    uint256 public constant AGENT_BONUS_BPS  = 200;           // +2% for Genesis 5

    // ─── Structs ──────────────────────────────────────────────────
    struct ProjectInfo {
        string  projectId;        // Unique identifier, e.g. "AAVE", "UNISWAP"
        string  name;             // Human-readable project name
        address tokenAddress;     // Project's ERC20 token
        address stakingContract;  // XSenateStaking instance for this project
        address registrant;       // Who registered this project
        uint256 registeredAt;
        bool    active;
    }

    // ─── State ────────────────────────────────────────────────────
    address public owner;
    address public governor;          // Shared XSenateGovernor (all projects use this)
    address public xsenToken;         // XSEN ERC20 address (for fee collection)
    address public xsenStaking;       // XSEN staking contract (fee destination)

    mapping(string => ProjectInfo) public projects;
    string[] public projectIds;

    // ─── Genesis 5 agent names (registered automatically per project) ───
    string[5] private GENESIS_5 = ["Guardian", "Merchant", "Architect", "Diplomat", "Populist"];

    // ─── Events ───────────────────────────────────────────────────
    event ProjectRegistered(
        string indexed projectId,
        string name,
        address indexed tokenAddress,
        address indexed stakingContract,
        address registrant,
        uint256 timestamp
    );

    event ProjectDeactivated(string indexed projectId, uint256 timestamp);

    event RegistrationFeeCollected(
        string indexed projectId,
        address indexed payer,
        uint256 amount,
        uint256 timestamp
    );

    // ─── Modifiers ────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Registry: not owner");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────
    /**
     * @param _governor   The shared XSenateGovernor contract
     * @param _xsenToken  XSEN ERC20 token address
     * @param _xsenStaking XSEN staking contract (receives platform fees)
     */
    constructor(address _governor, address _xsenToken, address _xsenStaking) {
        owner       = msg.sender;
        governor    = _governor;
        xsenToken   = _xsenToken;
        xsenStaking = _xsenStaking;
    }

    // ─── Project Registration ─────────────────────────────────────

    /**
     * @notice Register a new project with its pre-deployed staking contract.
     *
     * PERMISSIONLESS: anyone with an X Layer token can register.
     *
     * Requirements:
     *   - projectId must be unique and non-empty
     *   - tokenAddress and stakingAddress must be non-zero
     *   - Caller must have approved 1000 XSEN to this contract
     *     (REGISTRATION_FEE flows to XSEN staking ecosystem fund)
     *
     * @param projectId      Unique identifier (uppercase, e.g. "AAVE")
     * @param name           Human-readable name
     * @param tokenAddress   Project's ERC20 token
     * @param stakingAddress Pre-deployed XSenateStaking instance for this token
     */
    function registerProject(
        string memory projectId,
        string memory name,
        address tokenAddress,
        address stakingAddress
    ) external {
        require(bytes(projectId).length > 0,   "Registry: empty projectId");
        require(bytes(name).length > 0,        "Registry: empty name");
        require(tokenAddress != address(0),    "Registry: zero token address");
        require(stakingAddress != address(0),  "Registry: zero staking address");
        require(projects[projectId].registeredAt == 0, "Registry: project exists");

        // Collect XSEN registration fee → XSEN ecosystem fund
        require(
            IXTokenForRegistry(xsenToken).transferFrom(msg.sender, xsenStaking, REGISTRATION_FEE),
            "Registry: fee transfer failed"
        );

        emit RegistrationFeeCollected(projectId, msg.sender, REGISTRATION_FEE, block.timestamp);

        _storeProject(projectId, name, tokenAddress, stakingAddress, msg.sender);
    }

    /**
     * @notice Register the native XSEN project (no fee — called once by owner at deploy time).
     *         Also used by owner to register projects on behalf of others (e.g. hackathon demo).
     */
    function registerNativeProject(
        string memory projectId,
        string memory name,
        address tokenAddress,
        address stakingAddress
    ) external onlyOwner {
        require(bytes(projectId).length > 0,  "Registry: empty projectId");
        require(tokenAddress != address(0),   "Registry: zero token address");
        require(stakingAddress != address(0), "Registry: zero staking address");
        require(projects[projectId].registeredAt == 0, "Registry: project exists");

        _storeProject(projectId, name, tokenAddress, stakingAddress, msg.sender);
    }

    /**
     * @notice Deactivate a project (emergency use / abuse prevention).
     */
    function deactivateProject(string memory projectId) external onlyOwner {
        require(projects[projectId].registeredAt > 0, "Registry: project not found");
        projects[projectId].active = false;
        emit ProjectDeactivated(projectId, block.timestamp);
    }

    // ─── Admin ────────────────────────────────────────────────────

    function setGovernor(address _governor) external onlyOwner {
        governor = _governor;
    }

    function setXsenStaking(address _xsenStaking) external onlyOwner {
        xsenStaking = _xsenStaking;
    }

    // ─── View Functions ───────────────────────────────────────────

    /**
     * @notice Get the staking contract address for a given project.
     *         Returns address(0) if project is not registered or inactive.
     */
    function getStakingForProject(string memory projectId) external view returns (address) {
        ProjectInfo storage p = projects[projectId];
        if (!p.active || p.registeredAt == 0) return address(0);
        return p.stakingContract;
    }

    function getProject(string memory projectId) external view returns (ProjectInfo memory) {
        return projects[projectId];
    }

    function getAllProjects() external view returns (ProjectInfo[] memory) {
        ProjectInfo[] memory result = new ProjectInfo[](projectIds.length);
        for (uint256 i = 0; i < projectIds.length; i++) {
            result[i] = projects[projectIds[i]];
        }
        return result;
    }

    function getProjectCount() external view returns (uint256) {
        return projectIds.length;
    }

    function isProjectActive(string memory projectId) external view returns (bool) {
        return projects[projectId].active && projects[projectId].registeredAt > 0;
    }

    // ─── Internal ─────────────────────────────────────────────────

    function _storeProject(
        string memory projectId,
        string memory name,
        address tokenAddress,
        address stakingAddress,
        address registrant
    ) internal {
        projects[projectId] = ProjectInfo({
            projectId:       projectId,
            name:            name,
            tokenAddress:    tokenAddress,
            stakingContract: stakingAddress,
            registrant:      registrant,
            registeredAt:    block.timestamp,
            active:          true
        });
        projectIds.push(projectId);

        emit ProjectRegistered(
            projectId,
            name,
            tokenAddress,
            stakingAddress,
            registrant,
            block.timestamp
        );
    }
}
