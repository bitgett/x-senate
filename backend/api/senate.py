import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models.proposal import Proposal
from models.agent_vote import AgentVote
from agents.senate import run_senate_review_streaming

router = APIRouter(prefix="/api/senate", tags=["senate"])


@router.post("/review/{proposal_id}")
async def senate_review(proposal_id: str, db: Session = Depends(get_db)):
    """Run Senate review — streams each agent vote via SSE."""
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.status not in ("Draft",):
        raise HTTPException(status_code=400, detail=f"Proposal status is '{p.status}', cannot review")

    proposal_dict = {
        "title": p.title,
        "summary": p.summary,
        "motivation": p.motivation,
        "proposed_action": p.proposed_action,
        "potential_risks": p.potential_risks,
        "sentinel_analysis": p.sentinel_analysis,
    }

    p.status = "In_Senate"
    db.commit()

    async def event_stream():
        all_votes = []
        async for result in run_senate_review_streaming(proposal_dict):
            if result.get("type") == "tally":
                # Save tally and update proposal
                tally = result["tally"]
                p.approve_count = tally["approve_count"]
                p.reject_count = tally["reject_count"]
                p.status = result["status"]
                db.commit()
            else:
                # Save individual vote
                vote = AgentVote(
                    proposal_id=proposal_id,
                    agent_name=result["agent"],
                    vote=result["vote"],
                    reason=result["reason"],
                    chain_of_thought=result["chain_of_thought"],
                    confidence=result["confidence"],
                )
                db.add(vote)
                db.commit()
                all_votes.append(result)

            yield f"data: {json.dumps(result)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/votes/{proposal_id}")
def get_votes(proposal_id: str, db: Session = Depends(get_db)):
    votes = db.query(AgentVote).filter(AgentVote.proposal_id == proposal_id).all()
    return [
        {
            "agent_name": v.agent_name,
            "vote": v.vote,
            "reason": v.reason,
            "chain_of_thought": v.chain_of_thought,
            "confidence": v.confidence,
            "reflection_notes": v.reflection_notes,
        }
        for v in votes
    ]
