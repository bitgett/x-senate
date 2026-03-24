"""
X-Senate Full Contract Suite Deployment — Multi-Tenant Platform
Deploys to X Layer Mainnet (chainId: 196) in correct order:

  1. XToken          — XSEN governance token (100M supply)
  2. XSenateStaking  — 4-tier PoP staking for XSEN
  3. XSenateGovernor — Shared AI governance (all projects use this)
  4. XSenateRegistry — Permissionless project directory + fee collector

Then wires everything:
  - XToken.setStakingContract(staking)
  - XSenateStaking.setGovernor(governor)
  - XSenateGovernor.setRegistry(registry)
  - XSenateRegistry.registerNativeProject("XSEN", ...)
  - Register Genesis 5 agents in XSEN staking + governor

Token Distribution (100M XSEN):
  - 20M → Initial reward pool (staking contract)
  - 20M → DAO Treasury
  - 20M → Team vesting (12-month, 1-month cliff)
  - 40M → Community (stays in deployer for airdrop/CEX)

Usage:
    pip install web3 py-solc-x
    python backend/scripts/deploy_contract.py
"""
import os
import sys
import json
from pathlib import Path

try:
    from web3 import Web3
    from solcx import compile_source, install_solc
except ImportError:
    print("Installing dependencies...")
    os.system(f"{sys.executable} -m pip install web3 py-solc-x -q")
    from web3 import Web3
    from solcx import compile_source, install_solc

XLAYER_RPC      = "https://rpc.xlayer.tech"
XLAYER_CHAIN_ID = 196
XLAYER_EXPLORER = "https://www.oklink.com/xlayer"
CONTRACTS_DIR   = Path(__file__).parent.parent.parent / "contracts"
BACKEND_DIR     = Path(__file__).parent.parent

# Token supply splits
TOTAL_SUPPLY        = 100_000_000 * 10**18
REWARD_POOL_AMOUNT  =  20_000_000 * 10**18   # 20M → staking reward pool
TREASURY_AMOUNT     =  20_000_000 * 10**18   # 20M → DAO treasury
TEAM_VEST_AMOUNT    =  20_000_000 * 10**18   # 20M → team vesting

TEAM_CLIFF_SECS     = 30  * 24 * 3600        # 1 month
TEAM_DURATION_SECS  = 365 * 24 * 3600        # 12 months

AGENT_BONUS_BPS     = 200
GENESIS_5 = ["Guardian", "Merchant", "Architect", "Diplomat", "Populist"]

DAO_TREASURY_ADDRESS = None  # Set to override; defaults to deployer (prototype)
TEAM_WALLET_ADDRESS  = None  # Set to override; defaults to deployer (prototype)


def load_env_key():
    env_path = BACKEND_DIR / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("XLAYER_PRIVATE_KEY="):
                return line.split("=", 1)[1].strip()
    return os.getenv("XLAYER_PRIVATE_KEY", "")


def compile_contracts():
    print("Installing Solc 0.8.20...")
    install_solc("0.8.20")

    sol_files = ["XToken.sol", "XSenateStaking.sol", "XSenateGovernor.sol", "XSenateRegistry.sol"]
    results = {}
    for sol_file in sol_files:
        name = sol_file.replace(".sol", "")
        source = (CONTRACTS_DIR / sol_file).read_text()
        print(f"Compiling {sol_file}...")
        compiled = compile_source(source, solc_version="0.8.20", output_values=["abi", "bin"])
        key = list(compiled.keys())[0]
        results[name] = {
            "abi":      compiled[key]["abi"],
            "bytecode": compiled[key]["bin"],
        }
        print(f"  OK - {len(compiled[key]['bin']) // 2} bytes")
    return results


def deploy_contract(w3, account, private_key, abi, bytecode, *args):
    Contract  = w3.eth.contract(abi=abi, bytecode=bytecode)
    nonce     = w3.eth.get_transaction_count(account.address, "pending")
    gas_price = w3.eth.gas_price

    tx = Contract.constructor(*args).build_transaction({
        "from":     account.address,
        "nonce":    nonce,
        "gasPrice": gas_price,
        "chainId":  XLAYER_CHAIN_ID,
    })

    signed  = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"  TX: {tx_hash.hex()}")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    assert receipt.status == 1, "Deployment failed!"
    print(f"  Deployed at: {receipt.contractAddress}  (block {receipt.blockNumber})")
    return receipt.contractAddress, tx_hash.hex()


def send_tx(w3, account, private_key, contract_instance, fn_name, *args):
    nonce     = w3.eth.get_transaction_count(account.address, "pending")
    gas_price = w3.eth.gas_price
    fn        = getattr(contract_instance.functions, fn_name)
    tx = fn(*args).build_transaction({
        "from":     account.address,
        "nonce":    nonce,
        "gasPrice": gas_price,
        "chainId":  XLAYER_CHAIN_ID,
    })
    signed  = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    assert receipt.status == 1, f"{fn_name} failed!"
    return tx_hash.hex()


def main():
    private_key = load_env_key()
    if not private_key:
        print("ERROR: XLAYER_PRIVATE_KEY not found in backend/.env")
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(XLAYER_RPC))
    if not w3.is_connected():
        print(f"ERROR: Cannot connect to {XLAYER_RPC}")
        sys.exit(1)

    account = w3.eth.account.from_key(private_key)
    balance = w3.eth.get_balance(account.address)
    print(f"Deployer : {account.address}")
    print(f"Balance  : {w3.from_wei(balance, 'ether'):.4f} OKB")
    print(f"Chain    : X Layer Mainnet (ID: {XLAYER_CHAIN_ID})\n")

    if balance == 0:
        print("ERROR: No OKB for gas. Bridge at https://www.okx.com/web3/bridge")
        sys.exit(1)

    treasury_addr = DAO_TREASURY_ADDRESS or account.address
    team_addr     = TEAM_WALLET_ADDRESS  or account.address

    # ── Compile ──────────────────────────────────────────────
    contracts = compile_contracts()
    print()

    # ── Deploy 1: XToken ─────────────────────────────────────
    print("1/4 Deploying XToken...")
    token_addr, token_tx = deploy_contract(
        w3, account, private_key,
        contracts["XToken"]["abi"],
        contracts["XToken"]["bytecode"],
        TOTAL_SUPPLY,
    )

    # ── Deploy 2: XSenateStaking (XSEN pool) ─────────────────
    print("\n2/4 Deploying XSenateStaking (XSEN)...")
    staking_addr, staking_tx = deploy_contract(
        w3, account, private_key,
        contracts["XSenateStaking"]["abi"],
        contracts["XSenateStaking"]["bytecode"],
        token_addr,
    )

    # ── Deploy 3: XSenateGovernor ────────────────────────────
    print("\n3/4 Deploying XSenateGovernor (shared)...")
    governor_addr, governor_tx = deploy_contract(
        w3, account, private_key,
        contracts["XSenateGovernor"]["abi"],
        contracts["XSenateGovernor"]["bytecode"],
        "0x0000000000000000000000000000000000000000",  # registry set after
    )

    # ── Deploy 4: XSenateRegistry ────────────────────────────
    print("\n4/4 Deploying XSenateRegistry...")
    registry_addr, registry_tx = deploy_contract(
        w3, account, private_key,
        contracts["XSenateRegistry"]["abi"],
        contracts["XSenateRegistry"]["bytecode"],
        governor_addr,
        token_addr,
        staking_addr,
    )

    # ── Wire contracts ────────────────────────────────────────
    print("\nWiring contracts...")

    token_contract    = w3.eth.contract(address=token_addr,    abi=contracts["XToken"]["abi"])
    staking_contract  = w3.eth.contract(address=staking_addr,  abi=contracts["XSenateStaking"]["abi"])
    governor_contract = w3.eth.contract(address=governor_addr, abi=contracts["XSenateGovernor"]["abi"])

    print("  XToken.setStakingContract(staking)...")
    send_tx(w3, account, private_key, token_contract, "setStakingContract", staking_addr)

    print("  XSenateStaking.setGovernor(governor)...")
    send_tx(w3, account, private_key, staking_contract, "setGovernor", governor_addr)

    print("  XSenateGovernor.setRegistry(registry)...")
    send_tx(w3, account, private_key, governor_contract, "setRegistry", registry_addr)

    # ── Register XSEN as native project ──────────────────────
    print("  XSenateRegistry.registerNativeProject('XSEN', ...)...")
    registry_contract = w3.eth.contract(address=registry_addr, abi=contracts["XSenateRegistry"]["abi"])
    send_tx(
        w3, account, private_key,
        registry_contract, "registerNativeProject",
        "XSEN", "X-Senate Native Token", token_addr, staking_addr
    )

    # ── Register Genesis 5 in XSEN staking ───────────────────
    print("  Registering Genesis 5 agents in XSEN staking...")
    for agent in GENESIS_5:
        send_tx(w3, account, private_key, staking_contract, "registerAgent", agent, AGENT_BONUS_BPS)
        print(f"    {agent}")

    # ── Token distribution ────────────────────────────────────
    print("\nToken distribution...")

    print(f"  Approving staking for 20M XSEN reward pool...")
    send_tx(w3, account, private_key, token_contract, "approve", staking_addr, REWARD_POOL_AMOUNT)

    print(f"  Funding XSEN staking reward pool (20M XSEN)...")
    send_tx(w3, account, private_key, staking_contract, "fundRewardPool", REWARD_POOL_AMOUNT)

    if treasury_addr.lower() != account.address.lower():
        print(f"  Sending 20M XSEN to DAO treasury: {treasury_addr}...")
        send_tx(w3, account, private_key, token_contract, "transfer", treasury_addr, TREASURY_AMOUNT)
    else:
        print(f"  DAO treasury = deployer (prototype). 20M held in deployer wallet.")

    if team_addr.lower() != account.address.lower():
        print(f"  Creating team vesting: 20M XSEN / 12mo / 1mo cliff -> {team_addr}...")
        send_tx(
            w3, account, private_key,
            token_contract, "createVesting",
            team_addr, TEAM_VEST_AMOUNT, TEAM_CLIFF_SECS, TEAM_DURATION_SECS
        )
    else:
        print(f"  Team wallet = deployer (prototype). 20M held in deployer wallet.")

    print(f"  40M XSEN community allocation in deployer wallet.")

    # ── Save deployment info ──────────────────────────────────
    deployment = {
        "deployer":  account.address,
        "chain":     "X Layer Mainnet",
        "chain_id":  XLAYER_CHAIN_ID,
        "XToken": {
            "address":  token_addr,
            "tx_hash":  token_tx,
            "explorer": f"{XLAYER_EXPLORER}/address/{token_addr}",
        },
        "XSenateStaking": {
            "address":  staking_addr,
            "tx_hash":  staking_tx,
            "explorer": f"{XLAYER_EXPLORER}/address/{staking_addr}",
        },
        "XSenateGovernor": {
            "address":  governor_addr,
            "tx_hash":  governor_tx,
            "explorer": f"{XLAYER_EXPLORER}/address/{governor_addr}",
        },
        "XSenateRegistry": {
            "address":  registry_addr,
            "tx_hash":  registry_tx,
            "explorer": f"{XLAYER_EXPLORER}/address/{registry_addr}",
        },
        "token_distribution": {
            "total_supply_XSEN":  100_000_000,
            "reward_pool_XSEN":    20_000_000,
            "dao_treasury_XSEN":   20_000_000,
            "team_vesting_XSEN":   20_000_000,
            "community_XSEN":      40_000_000,
        },
        "abi": {
            "XToken":          contracts["XToken"]["abi"],
            "XSenateStaking":  contracts["XSenateStaking"]["abi"],
            "XSenateGovernor": contracts["XSenateGovernor"]["abi"],
            "XSenateRegistry": contracts["XSenateRegistry"]["abi"],
        },
        "primary_tx_hash":          governor_tx,
        "primary_contract_address": governor_addr,
    }

    out_path = BACKEND_DIR / "contract_deployment.json"
    out_path.write_text(json.dumps(deployment, indent=2))

    # Update .env
    env_path = BACKEND_DIR / ".env"
    env = env_path.read_text()
    for key, val in [
        ("XLAYER_TOKEN_ADDRESS",    token_addr),
        ("XLAYER_STAKING_ADDRESS",  staking_addr),
        ("XLAYER_GOVERNOR_ADDRESS", governor_addr),
        ("XLAYER_REGISTRY_ADDRESS", registry_addr),
    ]:
        if key not in env:
            env += f"\n{key}={val}"
        else:
            lines = env.splitlines()
            env = "\n".join(
                f"{key}={val}" if line.startswith(f"{key}=") else line
                for line in lines
            )
    env_path.write_text(env)

    print("\n" + "="*65)
    print("DEPLOYMENT COMPLETE — X-Senate Multi-Tenant Platform")
    print("="*65)
    print(f"XToken          : {token_addr}")
    print(f"XSenateStaking  : {staking_addr}")
    print(f"XSenateGovernor : {governor_addr}")
    print(f"XSenateRegistry : {registry_addr}")
    print("="*65)
    print("\n--- HACKATHON SUBMISSION ---")
    print(f"Contract Address : {governor_addr}")
    print(f"TX Hash          : {governor_tx}")
    print(f"Explorer         : {XLAYER_EXPLORER}/address/{governor_addr}")
    print("="*65)
    print("\nAny X Layer project can now register at:")
    print(f"  POST /api/registry/projects")
    print(f"  (fee: 1000 XSEN — flows to XSEN staker ecosystem fund)")
    print("="*65)


if __name__ == "__main__":
    main()
