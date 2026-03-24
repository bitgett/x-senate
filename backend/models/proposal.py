from sqlalchemy import Column, String, DateTime, Text, Integer
from sqlalchemy.sql import func
from database import Base
import uuid


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(String, primary_key=True, default=lambda: f"XSEN-{uuid.uuid4().hex[:8].upper()}")
    project_id = Column(String, nullable=False, default="XSEN")
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    motivation = Column(Text)
    proposed_action = Column(Text)
    potential_risks = Column(Text)
    sentinel_analysis = Column(Text)
    source_data = Column(Text)  # JSON string of triggering messages
    status = Column(String, default="Draft")  # Draft | In_Senate | Rejected_Senate | In_Debate | Executed | Rejected
    approve_count = Column(Integer, default=0)
    reject_count = Column(Integer, default=0)
    snapshot_url = Column(String)
    tx_hash = Column(String)
    one_liner_opinions = Column(Text)  # JSON string
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
