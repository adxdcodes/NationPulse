"""Authenticated, manual-only ingestion control. One run at a time per API worker.
Run FastAPI with a single worker for reliable in-memory process tracking.
No endpoint or CLI invocation starts PDF/AI pipelines.
"""
import os
import subprocess
import sys
import threading
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import require_admin
import config
from db import get_conn

router = APIRouter(prefix="/admin/ingestion", tags=["ingestion"])
_lock = threading.Lock()
_active = None
_history = deque(maxlen=10)
_seq = 0
INGESTION_DIR = Path(os.getenv("INGESTION_PIPELINE_DIR", str(Path(__file__).resolve().parents[2] / "services" / "ingestion-layer"))).resolve()
LOG_DIR = Path(os.getenv("NATIONPULSE_LOG_DIR", str(Path(__file__).resolve().parents[2] / "logs"))).resolve() / "ingestion_runs"

class StartRequest(BaseModel):
    house: str = "both"
    dry_run: bool = True


def _public(job):
    if not job:
        return None
    return {k: v for k, v in job.items() if k not in ("process", "log_file")}


def _watch(job):
    code = job["process"].wait()
    with _lock:
        job["finished_at"] = datetime.now(timezone.utc).isoformat()
        job["status"] = "completed" if code == 0 else "failed"
        job["exit_code"] = code

@router.get("/status")
def status(admin=Depends(require_admin), conn=Depends(get_conn)):
    with _lock:
        current = _public(_active)
        history = [_public(j) for j in reversed(_history)]
    with conn.cursor() as cur:
        cur.execute("SELECT house, last_total_bills, last_new_bills_count, last_run_at, last_run_status, last_run_note FROM ingestion_state ORDER BY house")
        rows = cur.fetchall()
    return {"active": current, "recent": history, "houses": [dict(row) for row in rows]}

@router.post("/start", status_code=202)
def start(payload: StartRequest, admin=Depends(require_admin)):
    global _active, _seq
    if payload.house not in ("both", "ls", "rs"):
        raise HTTPException(422, "house must be both, ls or rs")
    script = INGESTION_DIR / "pipeline.py"
    if not script.is_file():
        raise HTTPException(503, "Ingestion pipeline.py not found. Set INGESTION_PIPELINE_DIR.")
    with _lock:
        if _active and _active["status"] == "running":
            raise HTTPException(409, "An ingestion run is already in progress")
        _seq += 1
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        logfile = LOG_DIR / f"ingestion_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{_seq}.log"
        cmd = [sys.executable, str(script), "--house", payload.house]
        if payload.dry_run:
            cmd.append("--dry-run")
        with logfile.open("w", encoding="utf-8") as stream:
            proc = subprocess.Popen(cmd, cwd=str(INGESTION_DIR), stdout=stream, stderr=subprocess.STDOUT)
        job = {"id": _seq, "house": payload.house, "dry_run": payload.dry_run,
               "status": "running", "started_at": datetime.now(timezone.utc).isoformat(),
               "finished_at": None, "exit_code": None, "process": proc, "log_file": str(logfile)}
        _active = job
        _history.append(job)
        threading.Thread(target=_watch, args=(job,), daemon=True).start()
        return _public(job)

@router.get("/logs/{run_id}")
def logs(run_id: int, admin=Depends(require_admin)):
    with _lock:
        job = next((j for j in _history if j["id"] == run_id), None)
        if not job:
            raise HTTPException(404, "Run not found in this API session")
        log_path = job["log_file"]
    with open(log_path, "rb") as stream:
        stream.seek(0, 2)
        stream.seek(max(0, stream.tell() - 50000))
        raw = stream.read().decode("utf-8", errors="replace")
    return {"run": _public(job), "log": raw}
