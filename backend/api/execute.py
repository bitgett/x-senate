from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.proposal import Proposal
from models.agent_vote import AgentVote
from services.mock_snapshot import submit_proposal
from services.mock_chain import record_on_chain
from agents.reflection import run_reflection

router = APIRouter(prefix="/api/execute", tags=["execute"])


@router.post("/{proposal_id}")
async def execute_proposal(proposal_id: str, db: Session = Depends(get_db)):
    """Push proposal to mock Snapshot + record on-chain."""
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.status not in ("In_Debate",):
        raise HTTPException(status_code=400, detail=f"Cannot execute from status: {p.status}")

    proposal_dict = {
        "title": p.title,
        "summary": p.summary,
        "proposed_action": p.proposed_action,
    }

    # Mock Snapshot
    snapshot_result = submit_proposal(proposal_dict)

    # Mock on-chain record
    chain_result = record_on_chain(
        db=db,
        proposal_id=proposal_id,
        snapshot_id=snapshot_result["id"],
        snapshot_url=snapshot_result["url"],
    )

    # Update proposal
    p.status = "Executed"
    p.snapshot_url = snapshot_result["url"]
    p.tx_hash = chain_result["tx_hash"]
    db.commit()

    return {
        "proposal_id": proposal_id,
        "status": "Executed",
        "snapshot": snapshot_result,
        "chain": chain_result,
    }


@router.post("/reflect/{proposal_id}")
async def reflect_on_proposal(proposal_id: str, db: Session = Depends(get_db)):
    """Run post-vote recursive reflection for all agents."""
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    votes = db.query(AgentVote).filter(AgentVote.proposal_id == proposal_id).all()
    if not votes:
        raise HTTPException(status_code=400, detail="No agent votes found for this proposal")

    proposal_dict = {"title": p.title, "summary": p.summary}
    agent_votes = [
        {
            "agent_name": v.agent_name,
            "vote": v.vote,
            "reason": v.reason,
            "chain_of_thought": v.chain_of_thought,
        }
        for v in votes
    ]

    reflections = await run_reflection(proposal_dict, agent_votes)

    # Save reflection notes back to votes
    for vote in votes:
        if vote.agent_name in reflections:
            vote.reflection_notes = reflections[vote.agent_name]["reflection"]
    db.commit()

    return reflections
