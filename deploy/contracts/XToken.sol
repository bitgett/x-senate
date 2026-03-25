// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title XToken
 * @notice Governance token for X-Senate DAO
 * @dev Standard ERC20 with minting capability and team vesting.
 *      Used for staking, voting power, and governance rewards.
 *
 * Token Distribution (100M XSEN):
 *   40% → Community staking rewards & airdrop
 *   20% → DAO Treasury
 *   20% → Initial reward pool (epoch distribution)
 *   20% → Team (12-month vesting, 1-month cliff)
 */
contract XToken {

    // ─── ERC20 State ──────────────────────────────────────────────
    string  public name     = "X-Senate Token";
    string  public symbol   = "XSEN";
    uint8   public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ─── Access Control ───────────────────────────────────────────
    address public owner;
    address public stakingContract;   // only staking contract can mint rewards
    bool    public mintingEnabled = true;

    // ─── Vesting ──────────────────────────────────────────────────
    struct VestingSchedule {
        address beneficiary;
        uint256 total;      // total tokens to vest
        uint256 released;   // tokens already released
        uint256 start;      // vesting start timestamp
        uint256 cliff;      // cliff duration (seconds)
        uint256 duration;   // total vesting duration (seconds)
    }

    mapping(address => VestingSchedule) public vestingSchedules;
    address[] public vestingBeneficiaries;

    // ─── Events ───────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    event StakingContractSet(address indexed stakingContract);
    event VestingCreated(address indexed beneficiary, uint256 total, uint256 cliff, uint256 duration);
    event VestingReleased(address indexed beneficiary, uint256 amount);

    // ─── Modifiers ────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "XToken: not owner");
        _;
    }

    modifier onlyMinter() {
        require(
            msg.sender == owner || msg.sender == stakingContract,
            "XToken: not authorized minter"
        );
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────
    /**
     * @param initialSupply  Tokens minted to deployer (100_000_000 * 1e18 for 100M)
     */
    constructor(uint256 initialSupply) {
        owner = msg.sender;
        _mint(msg.sender, initialSupply);
    }

    // ─── ERC20 Core ───────────────────────────────────────────────
    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "XToken: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    // ─── Mint / Burn ──────────────────────────────────────────────

    /**
     * @notice Mint new tokens (owner or staking contract for rewards)
     */
    function mint(address to, uint256 amount) external onlyMinter {
        require(mintingEnabled, "XToken: minting disabled");
        _mint(to, amount);
        emit Mint(to, amount);
    }

    /**
     * @notice Burn tokens (for deflationary mechanics)
     */
    function burn(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "XToken: insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply            -= amount;
        emit Transfer(msg.sender, address(0), amount);
        emit Burn(msg.sender, amount);
    }

    // ─── Vesting ──────────────────────────────────────────────────

    /**
     * @notice Create a linear vesting schedule for a beneficiary.
     *         Tokens are transferred from owner to this contract and held.
     * @param beneficiary  Address that will receive the tokens
     * @param amount       Total tokens to vest
     * @param cliffSeconds Cliff duration in seconds (e.g. 30 days = 2592000)
     * @param durationSeconds Total vesting duration in seconds (e.g. 365 days = 31536000)
     */
    function createVesting(
        address beneficiary,
        uint256 amount,
        uint256 cliffSeconds,
        uint256 durationSeconds
    ) external onlyOwner {
        require(beneficiary != address(0), "XToken: zero address");
        require(amount > 0, "XToken: zero amount");
        require(durationSeconds > 0, "XToken: zero duration");
        require(cliffSeconds <= durationSeconds, "XToken: cliff > duration");
        require(vestingSchedules[beneficiary].total == 0, "XToken: vesting exists");
        require(balanceOf[msg.sender] >= amount, "XToken: insufficient balance");

        // Transfer tokens from owner to this contract to hold
        balanceOf[msg.sender]    -= amount;
        balanceOf[address(this)] += amount;
        emit Transfer(msg.sender, address(this), amount);

        vestingSchedules[beneficiary] = VestingSchedule({
            beneficiary: beneficiary,
            total:       amount,
            released:    0,
            start:       block.timestamp,
            cliff:       cliffSeconds,
            duration:    durationSeconds
        });
        vestingBeneficiaries.push(beneficiary);

        emit VestingCreated(beneficiary, amount, cliffSeconds, durationSeconds);
    }

    /**
     * @notice Release vested tokens to the caller.
     *         Calculates linearly vested amount minus already released.
     */
    function releaseVested() external {
        VestingSchedule storage v = vestingSchedules[msg.sender];
        require(v.total > 0, "XToken: no vesting schedule");

        uint256 releasable = _vestedAmount(v) - v.released;
        require(releasable > 0, "XToken: nothing to release");

        v.released += releasable;
        balanceOf[address(this)] -= releasable;
        balanceOf[msg.sender]    += releasable;
        emit Transfer(address(this), msg.sender, releasable);
        emit VestingReleased(msg.sender, releasable);
    }

    /**
     * @notice View how many tokens are releasable right now for a beneficiary.
     */
    function releasableAmount(address beneficiary) external view returns (uint256) {
        VestingSchedule storage v = vestingSchedules[beneficiary];
        if (v.total == 0) return 0;
        return _vestedAmount(v) - v.released;
    }

    // ─── Admin ────────────────────────────────────────────────────

    function setStakingContract(address _staking) external onlyOwner {
        stakingContract = _staking;
        emit StakingContractSet(_staking);
    }

    function disableMinting() external onlyOwner {
        mintingEnabled = false;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "XToken: zero address");
        owner = newOwner;
    }

    // ─── Internal ─────────────────────────────────────────────────
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "XToken: from zero address");
        require(to   != address(0), "XToken: to zero address");
        require(balanceOf[from] >= amount, "XToken: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "XToken: mint to zero address");
        totalSupply    += amount;
        balanceOf[to]  += amount;
        emit Transfer(address(0), to, amount);
    }

    function _vestedAmount(VestingSchedule storage v) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - v.start;
        if (elapsed < v.cliff) return 0;
        if (elapsed >= v.duration) return v.total;
        return (v.total * elapsed) / v.duration;
    }
}
