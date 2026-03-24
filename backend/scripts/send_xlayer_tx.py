"""
X Layer Real Transaction Script
Sends a minimal transaction on X Layer mainnet to generate a TX hash for hackathon submission.

Requirements:
  pip install web3

Usage:
  XLAYER_PRIVATE_KEY=0x... python scripts/send_xlayer_tx.py

X Layer:
  - Chain ID: 196
  - RPC: https://rpc.xlayer.tech
  - Explorer: https://www.oklink.com/xlayer
  - Native token: OKB (bridged ETH also usable for gas)
"""
import os
import sys

try:
    from web3 import Web3
except ImportError:
    print("Install web3: pip install web3")
    sys.exit(1)

XLAYER_RPC = "https://rpc.xlayer.tech"
XLAYER_CHAIN_ID = 196
XLAYER_EXPLORER = "https://www.oklink.com/xlayer/tx"

# Minimal governance registry data (identifies X-Senate)
XSENATE_MEMO = "X-Senate Governance v0.1 - Genesis 5 AI Agents"


def send_governance_registration_tx(private_key: str) -> dict:
    """
    Send a self-transfer transaction on X Layer mainnet with X-Senate memo data.
    This generates a real TX hash proving on-chain activity.
    """
    w3 = Web3(Web3.HTTPProvider(XLAYER_RPC))

    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to X Layer RPC: {XLAYER_RPC}")

    account = w3.eth.account.from_key(private_key)
    address = account.address
    balance = w3.eth.get_balance(address)
    balance_eth = w3.from_wei(balance, "ether")

    print(f"Wallet: {address}")
    print(f"Balance: {balance_eth} OKB")

    if balance == 0:
        print("\n⚠️  Wallet has no balance. Bridge OKB to X Layer first:")
        print("   https://www.okx.com/web3/bridge")
        return {}

    # Prepare self-transfer tx with memo
    nonce = w3.eth.get_transaction_count(address)
    gas_price = w3.eth.gas_price

    tx = {
        "from": address,
        "to": address,  # self-transfer (cheapest option)
        "value": 0,
        "data": w3.to_hex(text=XSENATE_MEMO),
        "gas": 30000,
        "gasPrice": gas_price,
        "nonce": nonce,
        "chainId": XLAYER_CHAIN_ID,
    }

    signed = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    tx_hash_hex = tx_hash.hex()

    print(f"\n✅ Transaction sent!")
    print(f"TX Hash: {tx_hash_hex}")
    print(f"Explorer: {XLAYER_EXPLORER}/{tx_hash_hex}")

    # Wait for confirmation
    print("\nWaiting for confirmation...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    print(f"Status: {'✅ Success' if receipt.status == 1 else '❌ Failed'}")
    print(f"Block: {receipt.blockNumber}")
    print(f"Gas used: {receipt.gasUsed}")

    return {
        "tx_hash": tx_hash_hex,
        "block_number": receipt.blockNumber,
        "explorer_url": f"{XLAYER_EXPLORER}/{tx_hash_hex}",
        "wallet": address,
        "status": "success" if receipt.status == 1 else "failed",
    }


if __name__ == "__main__":
    private_key = os.getenv("XLAYER_PRIVATE_KEY")
    if not private_key:
        print("Set XLAYER_PRIVATE_KEY environment variable")
        print("Example: XLAYER_PRIVATE_KEY=0x... python scripts/send_xlayer_tx.py")
        sys.exit(1)

    result = send_governance_registration_tx(private_key)
    if result:
        print(f"\n📋 Copy this TX hash for hackathon submission:")
        print(f"   {result['tx_hash']}")
