import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.proposal import Proposal
from schemas.proposal import ProposalCreate, ProposalOut
from agents.sentinel import run_sentinel_scan

router = APIRouter(prefix="/api/proposals", tags=["proposals"])


@router.get("/", response_model=list[ProposalOut])
def list_proposals(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Proposal)
    if project_id:
        q = q.filter(Proposal.project_id == project_id)
    return q.order_by(Proposal.created_at.desc()).all()


@router.get("/{proposal_id}", response_model=ProposalOut)
def get_proposal(proposal_id: str, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return p


@router.post("/sentinel/scan")
def sentinel_scan(db: Session = Depends(get_db)):
    """Run Sentinel scan and optionally save a draft proposal."""
    result = run_sentinel_scan()

    if result.get("draft_proposal"):
        draft = result["draft_proposal"]
        proposal = Proposal(
            title=draft.get("title", "Untitled"),
            summary=draft.get("summary", ""),
            motivation=draft.get("motivation", ""),
            proposed_action=draft.get("proposed_action", ""),
            potential_risks=draft.get("potential_risks", ""),
            sentinel_analysis=draft.get("sentinel_analysis", ""),
            source_data=draft.get("source_data", ""),
            status="Draft",
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
        result["saved_proposal_id"] = proposal.id

    return result


@router.post("/", response_model=ProposalOut)
def create_proposal(body: ProposalCreate, db: Session = Depends(get_db)):
    """Manually create a proposal."""
    proposal = Proposal(**body.model_dump())
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


@router.delete("/{proposal_id}")
def delete_proposal(proposal_id: str, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    db.delete(p)
    db.commit()
    return {"ok": True}
