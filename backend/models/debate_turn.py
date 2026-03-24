from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey
from sqlalchemy.sql import func
from database import Base
import uuid


class DebateTurn(Base):
    __tablename__ = "debate_turns"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    proposal_id = Column(String, ForeignKey("proposals.id"), nullable=False)
    agent_name = Column(String, nullable=False)
    turn_order = Column(Integer, nullable=False)
    full_argument = Column(Text, nullable=False)
    one_liner = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
