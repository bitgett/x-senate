from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey
from sqlalchemy.sql import func
from database import Base
import uuid


class AgentVote(Base):
    __tablename__ = "agent_votes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    proposal_id = Column(String, ForeignKey("proposals.id"), nullable=False)
    agent_name = Column(String, nullable=False)
    vote = Column(String)  # Approve | Reject
    reason = Column(Text)
    chain_of_thought = Column(Text)
    confidence = Column(Integer)
    reflection_notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
