// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IXSenateStaking {
    function markAgentVoted(string memory agentName, string memory proposalId, bool approve) external;
    function markDirectVote(address voter) external;
    function getVotingPower(address staker) external view returns (uint256);
    function getEffectiveVP(address staker) external view returns (uint256);
    function snapshotForProposal(string memory proposalId) external;
    function getSnapshotVP(string memory proposalId, string memory agentName) external view returns (uint256);
}

interface IXSenateRegistry {
    function getStakingForProject(string memory projectId) external view returns (address);
    function isProjectActive(string memory projectId) external view returns (bool);
}

/**
 * @title XSenateGovernor
 * @notice Shared AI Governance Layer for X Layer — serves all registered projects.
 * @dev Implements the 4-phase governance flow:
 *      Phase 1: Sentinel registers proposals (with projectId)
 *      Phase 2: Genesis 5 AI agents vote (3/5 majority required)
 *      Phase 3: Relay debate hash recorded on-chain
 *      Phase 4: Approved proposals executed on-chain
 *
 *      Multi-project: Each proposal carries a projectId.
 *      The Registry resolves which XSenateStaking instance to use for VP/PoP.
 *      All projects share the same 5 AI agents — the Genesis 5 Senate.
 */
contract XSenateGovernor {

    // ─── Constants ────────────────────────────────────────────────
    uint8 public constant SENATE_THRESHOLD = 3;   // 3 out of 5 needed
    uint8 public constant GENESIS_COUNT    = 5;

    // ─── Registry Integration ─────────────────────────────────────
    IXSenateRegistry public registry;

    // ─── Enums ────────────────────────────────────────────────────
    enum ProposalStatus {
        Draft,
        InSenate,
        RejectedBySenate,
        InDebate,
        Executed,
        Cancelled
    }

    enum VoteChoice { Approve, Reject }

    // ─── Structs ──────────────────────────────────────────────────
    struct Proposal {
        string  proposalId;       // e.g. "AAVE-2026-001"
        string  projectId;        // e.g. "AAVE", "XSEN", "UNISWAP"
        string  title;
        string  ipfsHash;         // full proposal content on IPFS
        address sentinel;
        uint256 createdAt;
        uint256 executedAt;
        ProposalStatus status;
        uint8   approvals;
        uint8   rejections;
        string  debateIpfsHash;
        uint256 totalDelegatedVP;
    }

    struct AgentVote {
        string     agentName;
        VoteChoice choice;
        string     reason;
        uint256    timestamp;
        bool       exists;
    }

    struct Delegation {
        address delegator;
        string  agentName;
        uint256 votingPower;
        uint256 delegatedAt;
        bool    active;
    }

    // ─── State ────────────────────────────────────────────────────
    address public owner;

    // Genesis 5 registered agent addresses
    mapping(string => address) public agentAddresses;
    string[] public agentNames;

    // Proposals
    mapping(string => Proposal) public proposals;
    string[] public proposalIds;

    // Votes: proposalId => agentName => AgentVote
    mapping(string => mapping(string => AgentVote)) public senateVotes;

    // Delegations: delegator address => Delegation
    mapping(address => Delegation) public delegations;

    // Agent total delegated VP: agentName => total VP
    mapping(string => uint256) public agentTotalVP;

    // ─── Events ───────────────────────────────────────────────────
    event ProposalRegistered(
        string indexed proposalId,
        string indexed projectId,
        string title,
        address indexed sentinel,
        uint256 timestamp
    );

    event SenateVoteCast(
        string indexed proposalId,
        string indexed agentName,
        VoteChoice choice,
        string reason,
        uint256 timestamp
    );

    event ProposalStatusChanged(
        string indexed proposalId,
        ProposalStatus oldStatus,
        ProposalStatus newStatus,
        uint256 timestamp
    );

    event DebateRecorded(
        string indexed proposalId,
        string debateIpfsHash,
        uint256 timestamp
    );

    event ProposalExecuted(
        string indexed proposalId,
        string indexed projectId,
        string title,
        uint256 totalVP,
        uint256 timestamp
    );

    event VoteDelegated(
        address indexed delegator,
        string indexed agentName,
        uint256 votingPower,
        uint256 timestamp
    );

    event AgentRegistered(
        string indexed agentName,
        address indexed agentAddress,
        uint256 timestamp
    );

    event RegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    // ─── Modifiers ────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "XSenate: not owner");
        _;
    }

    modifier proposalExists(string memory proposalId) {
        require(proposals[proposalId].createdAt > 0, "XSenate: proposal not found");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────
    constructor(address _registry) {
        owner = msg.sender;
        if (_registry != address(0)) {
            registry = IXSenateRegistry(_registry);
        }
    }

    function setRegistry(address _registry) external onlyOwner {
        emit RegistryUpdated(address(registry), _registry);
        registry = IXSenateRegistry(_registry);
    }

    // ─── Agent Management ─────────────────────────────────────────

    /**
     * @notice Register a Genesis 5 agent with its wallet address.
     *         Agents are shared across ALL projects — one Senate, many projects.
     */
    function registerAgent(string memory agentName, address agentAddress) external onlyOwner {
        require(agentAddress != address(0), "XSenate: zero address");
        require(agentAddresses[agentName] == address(0), "XSenate: agent exists");

        agentAddresses[agentName] = agentAddress;
        agentNames.push(agentName);

        emit AgentRegistered(agentName, agentAddress, block.timestamp);
    }

    // ─── Phase 1: Sentinel — Proposal Registration ────────────────

    /**
     * @notice Register a governance proposal for a specific project.
     * @param proposalId  Unique ID e.g. "AAVE-2026-001"
     * @param projectId   Project identifier e.g. "AAVE", "XSEN"
     * @param title       Short proposal title
     * @param ipfsHash    IPFS hash of full proposal JSON
     */
    function registerProposal(
        string memory proposalId,
        string memory projectId,
        string memory title,
        string memory ipfsHash
    ) external {
        require(proposals[proposalId].createdAt == 0, "XSenate: proposal exists");
        require(bytes(proposalId).length > 0, "XSenate: empty id");
        require(bytes(projectId).length > 0,  "XSenate: empty projectId");
        require(bytes(title).length > 0,      "XSenate: empty title");

        proposals[proposalId] = Proposal({
            proposalId:      proposalId,
            projectId:       projectId,
            title:           title,
            ipfsHash:        ipfsHash,
            sentinel:        msg.sender,
            createdAt:       block.timestamp,
            executedAt:      0,
            status:          ProposalStatus.Draft,
            approvals:       0,
            rejections:      0,
            debateIpfsHash:  "",
            totalDelegatedVP: 0
        });
        proposalIds.push(proposalId);

        // Snapshot agent VP at proposal creation — prevents flash-stake attacks
        if (address(registry) != address(0)) {
            address stakingAddr = registry.getStakingForProject(projectId);
            if (stakingAddr != address(0)) {
                IXSenateStaking(stakingAddr).snapshotForProposal(proposalId);
            }
        }

        emit ProposalRegistered(proposalId, projectId, title, msg.sender, block.timestamp);
    }

    // ─── Phase 2: Senate Review — Agent Voting ────────────────────

    /**
     * @notice Submit proposal for senate review (Draft → InSenate)
     */
    function submitToSenate(string memory proposalId)
        external
        proposalExists(proposalId)
    {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Draft, "XSenate: not in Draft");

        ProposalStatus old = p.status;
        p.status = ProposalStatus.InSenate;
        emit ProposalStatusChanged(proposalId, old, p.status, block.timestamp);
    }

    /**
     * @notice Genesis 5 agent casts a senate vote.
     *         VP participation is marked in the project's staking contract via registry.
     * @param proposalId  The proposal being voted on
     * @param agentName   Agent name ("Guardian", "Merchant", etc.)
     * @param choice      0 = Approve, 1 = Reject
     * @param reason      One-line reason stored on-chain
     */
    function castSenateVote(
        string memory proposalId,
        string memory agentName,
        VoteChoice choice,
        string memory reason
    ) external proposalExists(proposalId) {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.InSenate, "XSenate: not in senate review");
        require(!senateVotes[proposalId][agentName].exists, "XSenate: already voted");

        senateVotes[proposalId][agentName] = AgentVote({
            agentName: agentName,
            choice:    choice,
            reason:    reason,
            timestamp: block.timestamp,
            exists:    true
        });

        if (choice == VoteChoice.Approve) {
            p.approvals++;
        } else {
            p.rejections++;
        }

        emit SenateVoteCast(proposalId, agentName, choice, reason, block.timestamp);

        // Notify the project's staking contract via registry → marks delegators as PoP participants
        if (address(registry) != address(0)) {
            address stakingAddr = registry.getStakingForProject(p.projectId);
            if (stakingAddr != address(0)) {
                try IXSenateStaking(stakingAddr).markAgentVoted(
                    agentName, proposalId, choice == VoteChoice.Approve
                ) {} catch {}
            }
        }

        // Auto-advance if threshold met
        if (p.approvals >= SENATE_THRESHOLD) {
            ProposalStatus old = p.status;
            p.status = ProposalStatus.InDebate;
            emit ProposalStatusChanged(proposalId, old, p.status, block.timestamp);
        } else if (p.rejections > GENESIS_COUNT - SENATE_THRESHOLD) {
            ProposalStatus old = p.status;
            p.status = ProposalStatus.RejectedBySenate;
            emit ProposalStatusChanged(proposalId, old, p.status, block.timestamp);
        }
    }

    // ─── Phase 3: Relay Debate ────────────────────────────────────

    /**
     * @notice Record the relay debate transcript IPFS hash on-chain.
     */
    function recordDebate(string memory proposalId, string memory debateIpfsHash)
        external
        proposalExists(proposalId)
    {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.InDebate, "XSenate: not in debate");

        p.debateIpfsHash = debateIpfsHash;
        emit DebateRecorded(proposalId, debateIpfsHash, block.timestamp);
    }

    // ─── Phase 4: Execution ───────────────────────────────────────

    /**
     * @notice Execute an approved proposal (InDebate → Executed)
     */
    function executeProposal(string memory proposalId)
        external
        proposalExists(proposalId)
    {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.InDebate, "XSenate: not ready to execute");
        require(p.approvals >= SENATE_THRESHOLD,     "XSenate: insufficient approvals");

        ProposalStatus old = p.status;
        p.status     = ProposalStatus.Executed;
        p.executedAt = block.timestamp;

        emit ProposalStatusChanged(proposalId, old, p.status, block.timestamp);
        emit ProposalExecuted(proposalId, p.projectId, p.title, p.totalDelegatedVP, block.timestamp);
    }

    // ─── Vote Delegation ──────────────────────────────────────────

    /**
     * @notice Delegate voting power to a Genesis 5 or UGA agent.
     */
    function delegateVote(string memory agentName, uint256 votingPower) external {
        require(votingPower > 0, "XSenate: zero VP");

        Delegation storage existing = delegations[msg.sender];
        if (existing.active) {
            agentTotalVP[existing.agentName] -= existing.votingPower;
        }

        delegations[msg.sender] = Delegation({
            delegator:   msg.sender,
            agentName:   agentName,
            votingPower: votingPower,
            delegatedAt: block.timestamp,
            active:      true
        });

        agentTotalVP[agentName] += votingPower;

        emit VoteDelegated(msg.sender, agentName, votingPower, block.timestamp);
    }

    /**
     * @notice Revoke your delegation.
     */
    function revokeDelegation() external {
        Delegation storage d = delegations[msg.sender];
        require(d.active, "XSenate: no active delegation");

        agentTotalVP[d.agentName] -= d.votingPower;
        d.active = false;
    }

    // ─── View Functions ───────────────────────────────────────────

    function getProposal(string memory proposalId)
        external view returns (Proposal memory)
    {
        return proposals[proposalId];
    }

    function getProposalCount() external view returns (uint256) {
        return proposalIds.length;
    }

    function getSenateVote(string memory proposalId, string memory agentName)
        external view returns (AgentVote memory)
    {
        return senateVotes[proposalId][agentName];
    }

    function getAgentVP(string memory agentName) external view returns (uint256) {
        return agentTotalVP[agentName];
    }

    function getMyDelegation() external view returns (Delegation memory) {
        return delegations[msg.sender];
    }

    function getAllProposalIds() external view returns (string[] memory) {
        return proposalIds;
    }

    function getAgentNames() external view returns (string[] memory) {
        return agentNames;
    }

    /**
     * @notice Get all proposal IDs for a specific project.
     */
    function getProposalIdsByProject(string memory projectId)
        external view returns (string[] memory)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < proposalIds.length; i++) {
            if (keccak256(bytes(proposals[proposalIds[i]].projectId)) == keccak256(bytes(projectId))) {
                count++;
            }
        }
        string[] memory result = new string[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < proposalIds.length; i++) {
            if (keccak256(bytes(proposals[proposalIds[i]].projectId)) == keccak256(bytes(projectId))) {
                result[idx++] = proposalIds[i];
            }
        }
        return result;
    }
}
