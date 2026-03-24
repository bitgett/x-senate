from pydantic import BaseModel
from typing import Optional


class SenateVoteResult(BaseModel):
    agent: str
    vote: str  # Approve | Reject
    reason: str
    chain_of_thought: str
    confidence: int


class UGACreate(BaseModel):
    wallet_address: str
    agent_name: str
    system_prompt: str
    focus_area: Optional[str] = None


class UGAOut(BaseModel):
    id: str
    wallet_address: str
    agent_name: str
    focus_area: Optional[str]
    rank: str
    delegated_vp: float
    score: float

    class Config:
        from_attributes = True


class DelegateRequest(BaseModel):
    delegator_wallet: str
    delegate_to: str  # agent name
    vp_amount: float
