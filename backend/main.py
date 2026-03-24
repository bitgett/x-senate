from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from api.proposals import router as proposals_router
from api.senate import router as senate_router
from api.debate import router as debate_router
from api.execute import router as execute_router
from api.uga import router as uga_router
from api.onchain import router as onchain_router
from api.staking import router as staking_router
from api.registry import router as registry_router
from agents.personas import get_all_personas

app = FastAPI(
    title="X-Senate API",
    description="The Agentic Governance Layer — Multi-AI Senate for DAO Governance",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(proposals_router)
app.include_router(senate_router)
app.include_router(debate_router)
app.include_router(execute_router)
app.include_router(uga_router)
app.include_router(onchain_router)
app.include_router(staking_router)
app.include_router(registry_router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def root():
    return {"name": "X-Senate", "version": "0.1.0", "status": "online"}


@app.get("/api/personas")
def get_personas():
    """Return Genesis 5 persona metadata for frontend."""
    personas = get_all_personas()
    return [
        {
            "name": p["name"],
            "emoji": p["emoji"],
            "tagline": p["tagline"],
            "color": p["color"],
        }
        for p in personas
    ]
