import json
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models.proposal import Proposal
from models.debate_turn import DebateTurn
from agents.relay import run_relay_debate

router = APIRouter(prefix="/api/debate", tags=["debate"])


@router.websocket("/ws/{proposal_id}")
async def debate_websocket(websocket: WebSocket, proposal_id: str):
    """WebSocket endpoint — streams relay debate turn-by-turn in real time."""
    await websocket.accept()
    db = SessionLocal()

    try:
        p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
        if not p:
            await websocket.send_json({"error": "Proposal not found"})
            await websocket.close()
            return

        if p.status != "In_Debate":
            await websocket.send_json({"error": f"Proposal must be In_Debate status, got: {p.status}"})
            await websocket.close()
            return

        proposal_dict = {
            "title": p.title,
            "summary": p.summary,
            "motivation": p.motivation,
            "proposed_action": p.proposed_action,
            "potential_risks": p.potential_risks,
            "sentinel_analysis": p.sentinel_analysis,
        }

        current_turn_data = {}

        async for event in run_relay_debate(proposal_dict):
            await websocket.send_json(event)

            if event["type"] == "turn_end":
                # Persist completed debate turn
                turn = DebateTurn(
                    proposal_id=proposal_id,
                    agent_name=event["agent_name"],
                    turn_order=event["turn_order"],
                    full_argument=event["full_argument"],
                    one_liner=event["one_liner"],
                )
                db.add(turn)
                db.commit()

            elif event["type"] == "summary":
                # Save one-liner opinions to proposal
                p.one_liner_opinions = json.dumps(event["one_liners"])
                db.commit()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
    finally:
        db.close()


@router.get("/turns/{proposal_id}")
def get_debate_turns(proposal_id: str, db: Session = Depends(get_db)):
    turns = (
        db.query(DebateTurn)
        .filter(DebateTurn.proposal_id == proposal_id)
        .order_by(DebateTurn.turn_order)
        .all()
    )
    return [
        {
            "agent_name": t.agent_name,
            "turn_order": t.turn_order,
            "full_argument": t.full_argument,
            "one_liner": t.one_liner,
        }
        for t in turns
    ]


@router.post("/start/{proposal_id}")
def start_debate(proposal_id: str, db: Session = Depends(get_db)):
    """Advance proposal status to In_Debate (if Senate approved)."""
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.status not in ("In_Senate",) and p.approve_count < 3:
        raise HTTPException(status_code=400, detail="Senate approval required (3/5 votes)")
    p.status = "In_Debate"
    db.commit()
    return {"ok": True, "status": p.status}
