"""Admin-controlled processing: trigger PDF extraction or AI summarization
for exactly one bill, watch it live, cancel it mid-run. This deliberately
replaces "ingestion auto-triggers everything" — nothing gets processed
until an admin explicitly asks for it here.

Each job is one subprocess (the same pdf-pipeline/ai-pipeline CLIs used
for the automatic/scheduled path, just scoped with --bill-id), spawned
with sys.executable so it runs in the SAME venv as the API process — this
only works cleanly because that venv is shared across all four services
(see RUNBOOK.md); it deliberately does NOT import those services' code
directly, since they share generic module names (config.py, db.py,
pipeline.py) that would silently collide in one Python process — see
RUNBOOK.md for why that's a real, reproduced bug, not a hypothetical.

Job status tracking: the PARENT (this API process) is the sole source of
truth, via a background thread that blocks on the child's exit and
records the result — not the child self-reporting via a --job-id flag
back into its own row. This is deliberately more robust than the
self-report approach it replaced: a self-reporting child can only report
its own failure if it survives long enough to reach that code. Anything
that kills it earlier — a bad CLI argument, a missing dependency, an
import error, a crash before its own try/except is even entered — left
the row silently stuck at 'queued' forever under the old design. Watching
the exit code from the parent catches all of those uniformly, because it
doesn't depend on the child cooperating.
"""
import os
import signal
import subprocess
import sys
import threading
import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query

import config
from db import get_conn, checkout_conn, checkin_conn
from auth import require_admin
from urls import as_text_url

router = APIRouter(prefix="/admin", tags=["processing"])
logger = logging.getLogger(__name__)
_active_procs = {}  # job_id -> Popen; protects against killing a reused PID
_active_lock = threading.RLock()
_cancel_requested = set()


def _windows_verified_job_pid(pid: int, bill_id: int, job_type: str) -> bool:
    """Only allow cancelling a pre-restart Windows process when its command
    line confirms that it is the exact NationPulse pipeline and bill.
    Do not trust a database PID alone: Windows can reuse it.
    """
    script = (
        "$p = Get-CimInstance Win32_Process -Filter 'ProcessId = " + str(int(pid)) + "'; "
        "if ($p) { $p | Select-Object -ExpandProperty CommandLine | ConvertTo-Json -Compress }"
    )
    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True, text=True, timeout=8, check=False,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return False
        command = json.loads(result.stdout.strip())
        if not isinstance(command, str):
            return False
        import re
        bill_match = re.search(r"--bill-id(?:\s+|=)" + re.escape(str(bill_id)) + r"(?=\s|$)", command)
        pipeline_match = re.search(r"(?:^|[\s\"'])pipeline\.py(?:[\"']|\s|$)", command, re.I)
        type_match = ("--limit 50" in command if job_type == "pdf_extract" else "--provider" in command)
        return bool(bill_match and pipeline_match and type_match)
    except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
        logger.warning("Could not verify Windows PID %s: %s", pid, exc)
        return False


def _terminate_job_process(job_id: int, row: dict) -> None:
    """Terminate a verified pipeline process, including its Windows children.
    Missing/dead processes are treated as already stopped, never as HTTP 500.
    """
    pid = row["pid"]
    if not pid:
        return
    with _active_lock:
        proc = _active_procs.get(job_id)
    if proc is not None:
        if proc.pid != pid:
            raise HTTPException(409, "Stored job PID does not match its live process.")
        if proc.poll() is not None:
            return
    elif os.name == "nt":
        if not _windows_verified_job_pid(pid, row["bill_id"], row["job_type"]):
            # A stale PID may now belong to an unrelated application. Never kill it.
            raise HTTPException(409, "Cannot verify this job's process. It may have already exited; restart the API or check the job PID before retrying.")
    else:
        # A PID in the database alone is not proof of process ownership.
        raise HTTPException(409, "This job belongs to a previous API session; cannot safely signal an unverified PID.")

    if os.name == "nt":
        result = subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"],
                                capture_output=True, text=True, timeout=15, check=False)
        if result.returncode != 0:
            if proc is not None and proc.poll() is not None:
                return
            detail = (result.stderr or result.stdout).strip()
            if "not found" in detail.lower() or "not running" in detail.lower():
                return
            raise HTTPException(409, f"Windows could not stop the job: {detail[:300]}")
    else:
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        except OSError as exc:
            raise HTTPException(409, f"Could not stop the job process: {exc}") from exc



def _create_job_row(conn, bill_id: int, job_type: str, admin_id: int):
    """Returns the new job id, or None if one's already queued/running for
    this (bill, job_type) — the partial unique index in the schema is what
    actually enforces this; ON CONFLICT DO NOTHING just lets us detect it
    without a race between check-then-insert."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO processing_jobs (bill_id, job_type, status, requested_by)
            VALUES (%s, %s, 'queued', %s)
            ON CONFLICT DO NOTHING
            RETURNING id
        """, (bill_id, job_type, admin_id))
        row = cur.fetchone()
        return row["id"] if row else None


def _mark_job_finished(job_id: int, status: str, error_message: str = None):
    """Called from the watcher thread once a child process exits — the one
    place a job's terminal status actually gets written. Guarded so it
    never overwrites a job that was already resolved another way (e.g.
    /jobs/{id}/cancel got there first): only 'queued'/'running' rows are
    eligible to transition here.
    """
    conn = checkout_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE processing_jobs SET status = %s, error_message = %s, finished_at = now() "
                "WHERE id = %s AND status IN ('queued', 'running')",
                (status, (error_message or "")[:2000] or None, job_id),
            )
        conn.commit()
    finally:
        checkin_conn(conn)


def _watch_proc(job_id: int, proc: subprocess.Popen):
    """Runs in a daemon thread, one per active job. Blocks until the child
    exits, then records success/failure based on the real exit code —
    this is what makes job status accurate even when the child dies in a
    way it could never have self-reported (see module docstring)."""
    returncode = proc.wait()
    with _active_lock:
        cancelled = job_id in _cancel_requested
        _active_procs.pop(job_id, None)
    if cancelled:
        # Cancellation endpoint writes the terminal state and resets transient rows.
        return
    if returncode == 0:
        _mark_job_finished(job_id, "completed")
    else:
        _mark_job_finished(job_id, "failed", f"Process exited with code {returncode}. See job_{job_id}.log.")


def _spawn(job_id: int, bill_id: int, job_type: str, document_id: int | None = None):
    if job_type == "pdf_extract":
        cwd = config.PDF_PIPELINE_DIR
        cmd = [sys.executable, "pipeline.py", "--bill-id", str(bill_id), "--limit", "50"]
    else:
        cwd = config.AI_PIPELINE_DIR
        cmd = [sys.executable, "pipeline.py", "--bill-id", str(bill_id),
               "--limit", "1", "--provider", config.AI_PROVIDER]

    if document_id is not None:
        cmd.extend(["--document-id", str(document_id)])

    log_dir = Path(os.getenv("NATIONPULSE_LOG_DIR", str(Path(__file__).resolve().parents[2] / "logs"))).resolve() / "jobs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"job_{job_id}.log"
    logf = open(log_path, "w")

    popen_kwargs = {}
    if os.name == "posix":
        # Puts the child in its own process group so cancelling it can never
        # accidentally signal the API server itself. POSIX-only — passing
        # this on Windows raises ValueError immediately. Not needed on
        # Windows anyway: cancellation targets this exact PID directly
        # (os.kill maps SIGTERM to TerminateProcess there), never a group.
        popen_kwargs["start_new_session"] = True

    proc = subprocess.Popen(cmd, cwd=cwd, stdout=logf, stderr=subprocess.STDOUT, **popen_kwargs)

    # Parent-side, immediately after a successful spawn: this IS the
    # transition to 'running', not something the child reports back.
    conn = checkout_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE processing_jobs SET status = 'running', pid = %s, started_at = now() WHERE id = %s",
                (proc.pid, job_id),
            )
        conn.commit()
    finally:
        checkin_conn(conn)

    with _active_lock:
        _active_procs[job_id] = proc
    threading.Thread(target=_watch_proc, args=(job_id, proc), daemon=True).start()
    return proc.pid


def _spawn_or_fail(conn, job_id: int, bill_id: int, job_type: str, document_id: int | None = None):
    """Spawns the subprocess; if launching it fails for any reason (bad
    cwd, missing interpreter, permissions — before it's even running, so
    the watcher thread was never started), marks the job 'failed'
    immediately instead of leaving it stuck at 'queued' forever, which
    would otherwise permanently block every future attempt for this bill
    via the partial unique index.
    """
    try:
        _spawn(job_id, bill_id, job_type, document_id=document_id)
    except Exception as e:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE processing_jobs SET status = 'failed', error_message = %s, finished_at = now() WHERE id = %s",
                (str(e)[:2000], job_id),
            )
        conn.commit()
        raise HTTPException(status_code=500, detail=f"Could not start the pipeline subprocess: {e}")


@router.post("/bills/{bill_id}/process/pdf", status_code=202)
def process_pdf(bill_id: int, document_id: int | None = Query(default=None, gt=0), admin: dict = Depends(require_admin), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM bills WHERE id = %s", (bill_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Bill not found.")

    if document_id is not None:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM bill_documents WHERE id = %s AND bill_id = %s", (document_id, bill_id))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Document not found for this bill")
    job_id = _create_job_row(conn, bill_id, "pdf_extract", admin["id"])
    if job_id is None:
        raise HTTPException(status_code=409, detail="A PDF extraction job is already queued or running for this bill.")

    # The subprocess (and the watcher thread's checkout_conn) open their OWN
    # connections — this row must be visible to them, so commit now rather
    # than waiting for the request to finish.
    conn.commit()
    _spawn_or_fail(conn, job_id, bill_id, "pdf_extract", document_id=document_id)
    return {"jobId": job_id, "billId": bill_id, "jobType": "pdf_extract", "documentId": document_id, "status": "queued"}


@router.post("/bills/{bill_id}/process/ai", status_code=202)
def process_ai(bill_id: int, document_id: int | None = Query(default=None, gt=0), admin: dict = Depends(require_admin), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM bills WHERE id = %s", (bill_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Bill not found.")

    with conn.cursor() as cur:
        cur.execute("""SELECT id FROM bill_documents WHERE bill_id = %s
            AND extraction_status = 'done' AND length(trim(coalesce(extracted_text, ''))) > 0
            AND (%s::bigint IS NULL OR id = %s) ORDER BY id LIMIT 1""",
            (bill_id, document_id, document_id))
        if not cur.fetchone():
            raise HTTPException(status_code=409, detail="Selected document has no successfully extracted text")
    job_id = _create_job_row(conn, bill_id, "ai_summarize", admin["id"])
    if job_id is None:
        raise HTTPException(status_code=409, detail="An AI summarization job is already queued or running for this bill.")

    conn.commit()
    _spawn_or_fail(conn, job_id, bill_id, "ai_summarize", document_id=document_id)
    return {"jobId": job_id, "billId": bill_id, "jobType": "ai_summarize", "documentId": document_id, "status": "queued"}


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: int, admin: dict = Depends(require_admin), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT bill_id, job_type, pid, status FROM processing_jobs WHERE id = %s", (job_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found.")
        if row["status"] not in ("queued", "running"):
            raise HTTPException(status_code=400, detail=f"Job already {row['status']}, nothing to cancel.")

        # Record cancellation intent before stopping the process, so the
        # watcher cannot race to mark an intentionally stopped job as failed.
        with _active_lock:
            _cancel_requested.add(job_id)
        try:
            _terminate_job_process(job_id, row)
        except Exception:
            with _active_lock:
                _cancel_requested.discard(job_id)
            raise

        # Guarded the same way _mark_job_finished is — the watcher thread's
        # proc.wait() will also unblock once SIGTERM lands and may race to
        # write a status too; whichever write lands second is a no-op
        # against an already-terminal row, so cancelled can't be quietly
        # overwritten back to failed, or vice versa.
        cur.execute(
            "UPDATE processing_jobs SET status = 'cancelled', finished_at = now() "
            "WHERE id = %s AND status IN ('queued', 'running')",
            (job_id,),
        )

        # SIGTERM stops the subprocess immediately, mid-row — it never gets
        # to reach the code that would normally mark that row 'done' or
        # 'failed'. Left alone, that row sits in a transient state
        # ('downloading'/'extracting', or 'generating') forever: not
        # 'pending' or 'failed', so the normal claim queries skip it, AND
        # for AI content specifically, the partial unique index that
        # prevents double-processing would then block EVERY future attempt
        # to process this bill, permanently. Cancelling has to leave things
        # retriable, or "stop" quietly becomes "stop forever" — reset here.
        if row["job_type"] == "pdf_extract":
            cur.execute("""
                UPDATE bill_documents SET extraction_status = 'pending'
                WHERE bill_id = %s AND extraction_status IN ('downloading', 'extracting')
            """, (row["bill_id"],))
        else:
            cur.execute("""
                UPDATE bill_ai_content SET review_status = 'failed', error_message = 'Cancelled by admin.'
                WHERE bill_id = %s AND review_status = 'generating'
            """, (row["bill_id"],))

    # Flush the cancellation transaction before the UI's next jobs poll.
    conn.commit()
    return {"jobId": job_id, "status": "cancelled"}


@router.get("/bills/{bill_id}/jobs")
def bill_jobs(bill_id: int, admin: dict = Depends(require_admin), conn=Depends(get_conn)):
    """Full job history for one bill — what the admin UI polls while a job
    is running to show live status, and to decide which action buttons
    (Process / Cancel / Re-run) to show."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, job_type, status, pid, created_at, started_at, finished_at, error_message
            FROM processing_jobs WHERE bill_id = %s ORDER BY created_at DESC
        """, (bill_id,))
        jobs = cur.fetchall()

        cur.execute("""
            SELECT id, doc_type, source_url, extraction_status, extraction_method,
                   page_count, error_message, storage_path
            FROM bill_documents WHERE bill_id = %s ORDER BY doc_type
        """, (bill_id,))
        documents = [
            {**doc, "extracted_text_url": as_text_url(doc["storage_path"])}
            for doc in cur.fetchall()
        ]

        cur.execute("""
            SELECT id, source_doc_id, review_status, provider, model_version, generated_at, error_message
            FROM bill_ai_content WHERE bill_id = %s ORDER BY generated_at DESC LIMIT 5
        """, (bill_id,))
        ai_content = cur.fetchall()

    return {"jobs": jobs, "documents": documents, "aiContent": ai_content}


@router.get("/jobs")
def list_jobs(status: str = Query(default=None), admin: dict = Depends(require_admin), conn=Depends(get_conn)):
    """Cross-bill overview — 'what's running right now across the whole
    system', for a dashboard-style admin view."""
    where, params = "true", {}
    if status:
        where = "pj.status = %(status)s"
        params["status"] = status
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT pj.id, pj.bill_id, pj.job_type, pj.status, pj.created_at, pj.started_at,
                   pj.finished_at, pj.error_message, b.bill_number, b.bill_name
            FROM processing_jobs pj JOIN bills b ON b.id = pj.bill_id
            WHERE {where}
            ORDER BY pj.created_at DESC LIMIT 100
        """, params)
        rows = cur.fetchall()
    return {"items": rows}
