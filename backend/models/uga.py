from sqlalchemy import Column, String, DateTime, Text, Integer, Float
from sqlalchemy.sql import func
from database import Base
import uuid


class UGA(Base):
    __tablename__ = "ugas"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_address = Column(String, nullable=False)
    agent_name = Column(String, nullable=False, unique=True)
    system_prompt = Column(Text, nullable=False)
    focus_area = Column(String)
    rank = Column(String, default="Bronze")  # Bronze | Silver | Gold
    delegated_vp = Column(Float, default=0.0)
    participation_rate = Column(Float, default=0.0)
    proposal_success_rate = Column(Float, default=0.0)
    score = Column(Float, default=0.0)
    created_at = Column(DateTime, server_default=func.now())
