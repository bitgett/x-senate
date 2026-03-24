from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ProposalBase(BaseModel):
    title: str
    summary: str
    motivation: Optional[str] = None
    proposed_action: Optional[str] = None
    potential_risks: Optional[str] = None


class ProposalCreate(ProposalBase):
    sentinel_analysis: Optional[str] = None
    source_data: Optional[str] = None
    project_id: Optional[str] = "XSEN"


class AgentVoteOut(BaseModel):
    agent_name: str
    vote: Optional[str]
    reason: Optional[str]
    chain_of_thought: Optional[str]
    confidence: Optional[int]
    reflection_notes: Optional[str]

    class Config:
        from_attributes = True


class DebateTurnOut(BaseModel):
    agent_name: str
    turn_order: int
    full_argument: str
    one_liner: Optional[str]

    class Config:
        from_attributes = True


class ProposalOut(BaseModel):
    id: str
    project_id: Optional[str] = "XSEN"
    title: str
    summary: str
    motivation: Optional[str]
    proposed_action: Optional[str]
    potential_risks: Optional[str]
    sentinel_analysis: Optional[str]
    status: str
    approve_count: int
    reject_count: int
    snapshot_url: Optional[str]
    tx_hash: Optional[str]
    one_liner_opinions: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
