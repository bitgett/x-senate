from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.uga import UGA
from schemas.agent import UGACreate, UGAOut, DelegateRequest

router = APIRouter(prefix="/api/uga", tags=["uga"])


@router.post("/register", response_model=UGAOut)
def register_uga(body: UGACreate, db: Session = Depends(get_db)):
    existing = db.query(UGA).filter(UGA.agent_name == body.agent_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Agent name already taken")

    uga = UGA(
        wallet_address=body.wallet_address,
        agent_name=body.agent_name,
        system_prompt=body.system_prompt,
        focus_area=body.focus_area,
        rank="Bronze",
    )
    db.add(uga)
    db.commit()
    db.refresh(uga)
    return uga


@router.get("/", response_model=list[UGAOut])
def list_ugas(db: Session = Depends(get_db)):
    return db.query(UGA).order_by(UGA.score.desc()).all()


@router.post("/delegate")
def delegate_votes(body: DelegateRequest, db: Session = Depends(get_db)):
    uga = db.query(UGA).filter(UGA.agent_name == body.delegate_to).first()
    if not uga:
        raise HTTPException(status_code=404, detail="Agent not found")

    uga.delegated_vp += body.vp_amount
    # Recalculate score
    uga.score = uga.delegated_vp * uga.participation_rate * (1 + uga.proposal_success_rate)

    # Rank upgrade logic
    all_ugas = db.query(UGA).order_by(UGA.delegated_vp.desc()).all()
    total = len(all_ugas)
    if total > 0:
        rank_index = next((i for i, u in enumerate(all_ugas) if u.id == uga.id), total - 1)
        percentile = rank_index / total
        if percentile <= 0.10:
            uga.rank = "Gold"
        elif percentile <= 0.30:
            uga.rank = "Silver"
        else:
            uga.rank = "Bronze"

    db.commit()
    db.refresh(uga)
    return {
        "agent_name": uga.agent_name,
        "delegated_vp": uga.delegated_vp,
        "rank": uga.rank,
        "score": uga.score,
    }
