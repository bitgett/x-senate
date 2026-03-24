from sqlalchemy import Column, String, DateTime, Text, Integer
from sqlalchemy.sql import func
from database import Base
import uuid


class ChainRecord(Base):
    __tablename__ = "chain_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    proposal_id = Column(String, nullable=False)
    tx_hash = Column(String, nullable=False)
    block_number = Column(Integer)
    contract_address = Column(String)
    action = Column(String)
    snapshot_id = Column(String)
    snapshot_url = Column(String)
    created_at = Column(DateTime, server_default=func.now())
