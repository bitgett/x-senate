import secrets
import random
import time
from sqlalchemy.orm import Session
from models.chain_record import ChainRecord


def record_on_chain(db: Session, proposal_id: str, snapshot_id: str, snapshot_url: str) -> dict:
    """
    Mock on-chain recording of a governance proposal execution.
    Writes to chain_records SQLite table as if it were a real blockchain transaction.
    Swap this with web3.py contract calls for production.
    """
    tx_hash = "0x" + secrets.token_hex(32)
    block_number = random.randint(19_000_000, 20_000_000)
    contract_address = "0x" + secrets.token_hex(20)

    record = ChainRecord(
        proposal_id=proposal_id,
        tx_hash=tx_hash,
        block_number=block_number,
        contract_address=contract_address,
        action="proposal_submitted",
        snapshot_id=snapshot_id,
        snapshot_url=snapshot_url,
    )
    db.add(record)
    db.commit()

    return {
        "tx_hash": tx_hash,
        "block_number": block_number,
        "contract_address": contract_address,
        "timestamp": int(time.time()),
        "explorer_url": f"https://etherscan.io/tx/{tx_hash}",
        "network": "X Layer Mainnet",
    }
