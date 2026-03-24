"""
XSenateRegistry contract interaction service.
Handles project registration and registry lookups.
"""
import json
import os
from pathlib import Path
from typing import Optional

try:
    from web3 import Web3
    WEB3_AVAILABLE = True
except ImportError:
    WEB3_AVAILABLE = False

XLAYER_RPC      = "https://rpc.xlayer.tech"
XLAYER_CHAIN_ID = 196
DEPLOY_INFO_PATH = Path(__file__).parent.parent / "contract_deployment.json"


def _load_deployment() -> Optional[dict]:
    if DEPLOY_INFO_PATH.exists():
        return json.loads(DEPLOY_INFO_PATH.read_text())
    return None


def _get_w3_and_registry():
    if not WEB3_AVAILABLE:
        return None, None
    deployment = _load_deployment()
    if not deployment:
        return None, None
    reg_addr = deployment.get("XSenateRegistry", {}).get("address")
    reg_abi  = deployment.get("abi", {}).get("XSenateRegistry")
    if not reg_addr or not reg_abi:
        return None, None
    w3 = Web3(Web3.HTTPProvider(XLAYER_RPC))
    if not w3.is_connected():
        return None, None
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(reg_addr),
        abi=reg_abi,
    )
    return w3, contract


def get_all_projects() -> Optional[list]:
    """Return all registered projects from the on-chain registry."""
    w3, contract = _get_w3_and_registry()
    if not w3 or not contract:
        return None
    try:
        raw = contract.functions.getAllProjects().call()
        result = []
        for p in raw:
            result.append({
                "project_id":       p[0],
                "name":             p[1],
                "token_address":    p[2],
                "staking_contract": p[3],
                "registrant":       p[4],
                "registered_at":    p[5],
                "active":           p[6],
            })
        return result
    except Exception as e:
        return {"error": str(e)}


def get_project(project_id: str) -> Optional[dict]:
    """Return info for a single project."""
    w3, contract = _get_w3_and_registry()
    if not w3 or not contract:
        return None
    try:
        p = contract.functions.getProject(project_id).call()
        if not p[0]:  # empty projectId means not found
            return None
        return {
            "project_id":       p[0],
            "name":             p[1],
            "token_address":    p[2],
            "staking_contract": p[3],
            "registrant":       p[4],
            "registered_at":    p[5],
            "active":           p[6],
        }
    except Exception as e:
        return {"error": str(e)}


def get_staking_for_project(project_id: str) -> Optional[str]:
    """Return the staking contract address for a project."""
    w3, contract = _get_w3_and_registry()
    if not w3 or not contract:
        return None
    try:
        addr = contract.functions.getStakingForProject(project_id).call()
        return addr if addr != "0x0000000000000000000000000000000000000000" else None
    except Exception as e:
        return None


def get_project_count() -> int:
    """Return total number of registered projects."""
    w3, contract = _get_w3_and_registry()
    if not w3 or not contract:
        return 0
    try:
        return contract.functions.getProjectCount().call()
    except Exception:
        return 0


async def register_project_onchain(
    project_id: str,
    name: str,
    token_address: str,
    staking_address: str,
) -> Optional[str]:
    """
    Register a project in the on-chain registry (owner registerNativeProject).
    Returns tx_hash or None on failure.

    Note: The staking contract must be deployed before calling this.
    The backend /api/registry/projects endpoint handles the full flow:
      1. Deploy XSenateStaking(tokenAddress)
      2. Register Genesis 5 agents in the new staking
      3. Call this function to register in the registry
    """
    private_key = os.getenv("XLAYER_PRIVATE_KEY")
    if not private_key or not WEB3_AVAILABLE:
        return None

    w3, contract = _get_w3_and_registry()
    if not w3 or not contract:
        return None

    try:
        account   = w3.eth.account.from_key(private_key)
        token_cs  = Web3.to_checksum_address(token_address)
        staking_cs = Web3.to_checksum_address(staking_address)

        nonce = w3.eth.get_transaction_count(account.address, "pending")
        tx = contract.functions.registerNativeProject(
            project_id, name, token_cs, staking_cs
        ).build_transaction({
            "from":     account.address,
            "nonce":    nonce,
            "gasPrice": w3.eth.gas_price,
            "chainId":  XLAYER_CHAIN_ID,
        })
        signed  = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return tx_hash.hex()
    except Exception as e:
        print(f"Registry registration failed: {e}")
        return None


async def deploy_project_staking(token_address: str) -> Optional[str]:
    """
    Deploy a new XSenateStaking instance for an external project's token.
    Returns the deployed staking contract address, or None on failure.
    """
    private_key = os.getenv("XLAYER_PRIVATE_KEY")
    if not private_key or not WEB3_AVAILABLE:
        return None

    deployment = _load_deployment()
    if not deployment:
        return None

    staking_abi      = deployment.get("abi", {}).get("XSenateStaking")
    staking_bytecode = deployment.get("bytecode", {}).get("XSenateStaking")
    governor_addr    = deployment.get("XSenateGovernor", {}).get("address")

    if not staking_abi or not staking_bytecode or not governor_addr:
        return None

    try:
        w3      = Web3(Web3.HTTPProvider(XLAYER_RPC))
        account = w3.eth.account.from_key(private_key)
        token_cs = Web3.to_checksum_address(token_address)

        Contract  = w3.eth.contract(abi=staking_abi, bytecode=staking_bytecode)
        nonce     = w3.eth.get_transaction_count(account.address, "pending")
        gas_price = w3.eth.gas_price

        tx = Contract.constructor(token_cs).build_transaction({
            "from":     account.address,
            "nonce":    nonce,
            "gasPrice": gas_price,
            "chainId":  XLAYER_CHAIN_ID,
        })
        signed  = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt.status != 1:
            return None

        staking_addr = receipt.contractAddress

        # Wire: setGovernor + register Genesis 5
        staking_contract = w3.eth.contract(address=staking_addr, abi=staking_abi)

        def send_tx(fn_name, *args):
            n = w3.eth.get_transaction_count(account.address, "pending")
            t = getattr(staking_contract.functions, fn_name)(*args).build_transaction({
                "from": account.address, "nonce": n,
                "gasPrice": w3.eth.gas_price, "chainId": XLAYER_CHAIN_ID,
            })
            s = w3.eth.account.sign_transaction(t, private_key)
            h = w3.eth.send_raw_transaction(s.raw_transaction)
            w3.eth.wait_for_transaction_receipt(h, timeout=60)

        send_tx("setGovernor", Web3.to_checksum_address(governor_addr))

        for agent in ["Guardian", "Merchant", "Architect", "Diplomat", "Populist"]:
            send_tx("registerAgent", agent, 200)

        return staking_addr

    except Exception as e:
        print(f"Staking deployment failed: {e}")
        return None
