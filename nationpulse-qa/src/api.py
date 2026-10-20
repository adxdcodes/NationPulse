"""
api.py
------
FastAPI service exposing the NationPulse Bill Q&A pipeline as an HTTP
endpoint, for the API layer (Layer 4) of the NationPulse architecture
to call from the React client (Layer 5).

Usage:
    uvicorn src.api:app --host 0.0.0.0 --port 8000
    or from src/:
    uvicorn api:app --host 0.0.0.0 --port 8000
"""

import os
import sys
from contextlib import asynccontextmanager

_src_dir = os.path.abspath(os.path.dirname(__file__))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from generator_factory import build_generator
from qa_pipeline import BillQAPipeline
from vector_store import BillVectorStore, VectorSearchTimeoutError, build_vector_store
from supabase_client import (
    save_qa_interaction,
    update_qa_feedback,
    get_recent_qa_history,
    get_bills_list,
    check_supabase_health,
)


def find_config(path: str | None = None) -> str:
    if path and os.path.exists(path):
        return os.path.abspath(path)
    candidates = [
        path,
        os.path.join("configs", "rag_config.yaml"),
        os.path.join("..", "configs", "rag_config.yaml"),
        os.path.join(_src_dir, "..", "configs", "rag_config.yaml"),
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return os.path.abspath(c)
    raise FileNotFoundError("Could not find configs/rag_config.yaml")


def load_config(path: str = "configs/rag_config.yaml") -> dict:
    resolved_path = find_config(path)
    with open(resolved_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


pipeline_state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    config = load_config()
    store = build_vector_store(config)
    generator = build_generator(config)
    pipeline_state["pipeline"] = BillQAPipeline(config, store, generator)
    pipeline_state["store"] = store
    pipeline_state["config"] = config
    yield
    pipeline_state.clear()


app = FastAPI(title="NationPulse Bill Q&A API", lifespan=lifespan)

_cors_origins = [
    o.strip()
    for o in os.getenv(
        "QA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=3, description="Citizen's question about a Bill")
    bill_id: str | None = Field(
        None, description="Optional: restrict retrieval to a single Bill"
    )
    bill_title: str | None = Field(
        None, max_length=500, description="Optional exact title scope for the selected Bill"
    )


class SourceChunk(BaseModel):
    bill_id: str | None
    bill_title: str | None
    chunk_index: int | None
    excerpt: str


class QuestionResponse(BaseModel):
    question: str
    answer: str
    refined_query: str | None
    refinement_iterations: int
    sources: list[SourceChunk]
    interaction_id: str | None = Field(
        None, description="Supabase UUID for tracking & feedback"
    )


class FeedbackRequest(BaseModel):
    rating: int = Field(..., description="1 for thumbs up, -1 for thumbs down")


@app.post("/api/bills/qa", response_model=QuestionResponse)
def ask_question(req: QuestionRequest):
    pipeline: BillQAPipeline = pipeline_state.get("pipeline")
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Pipeline not ready")
    try:
        result = pipeline.answer(
            req.question,
            bill_id_filter=req.bill_id,
            bill_title_filter=req.bill_title,
        )
    except VectorSearchTimeoutError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Persist interaction to Supabase (broadcasts via Supabase Realtime to connected React clients)
    interaction_id = None
    try:
        interaction_id = save_qa_interaction(
            question=result.get("question", req.question),
            answer=result.get("answer", ""),
            sources=result.get("sources", []),
            bill_id=req.bill_id,
            refined_query=result.get("refined_query"),
            refinement_iterations=result.get("refinement_iterations", 1),
        )
    except Exception:
        # Logging failure should never block returning the answer to the citizen
        pass

    result["interaction_id"] = interaction_id
    return result


@app.post("/api/bills/qa/{interaction_id}/feedback")
def submit_feedback(interaction_id: str, req: FeedbackRequest):
    """Update citizen feedback rating (+1 or -1) in Supabase."""
    success = update_qa_feedback(interaction_id, req.rating)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Could not update feedback (ensure Supabase is connected and ID is valid)",
        )
    return {"status": "ok", "interaction_id": interaction_id, "rating": req.rating}


@app.get("/api/bills/qa/history")
def qa_history(limit: int = 20):
    """Retrieve recent Q&A history from Supabase."""
    history = get_recent_qa_history(limit=limit)
    return {"history": history}


@app.get("/api/bills")
def list_bills(limit: int = 50, indexed_only: bool = False):
    """Retrieve parliamentary bills from Supabase.
    indexed_only=true -> only bills the Q&A endpoint can answer about."""
    bills = get_bills_list(limit=limit, indexed_only=indexed_only)
    return {"qa_bills": bills}


@app.get("/api/bills/qa/health")
def health():
    store: BillVectorStore = pipeline_state.get("store")
    return {
        "status": "ok",
        "vector_backend": store.backend_name if store else None,
        "indexed_chunks": store.count() if store else 0,
        "supabase": check_supabase_health(),
    }
