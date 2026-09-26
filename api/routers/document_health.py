"""Manual source-link checks. A 403 is access-restricted, NOT a broken document."""
import threading
import time
import uuid
from urllib.parse import urlparse
import httpx
from fastapi import APIRouter, Depends, HTTPException
from auth import require_admin
from db import get_conn, checkout_conn, checkin_conn

router = APIRouter(prefix="/admin", tags=["document-health"])
ALLOWED_HOSTS = {"sansad.in", "loksabha.nic.in", "rajyasabha.nic.in"}
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "Accept": "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*;q=0.8", "Accept-Language": "en-IN,en;q=0.9", "Referer": "https://sansad.in/"}
_lock = threading.Lock()
_batch = {"id": None, "status": "idle", "total": 0, "checked": 0, "results": {}, "error": None}

def _allowed(url):
    try:
        p = urlparse(url or "")
        h = (p.hostname or "").lower()
        return (p.scheme == "https" and (h in ALLOWED_HOSTS or any(h.endswith("."+base) for base in ALLOWED_HOSTS))
                and not p.username and not p.password and p.port in (None, 443))
    except (ValueError, TypeError):
        return False

def verify_url(url):
    start = time.monotonic()
    def result(status, code=None, method=None, ct=None, length=None, final=None, error=None):
        return dict(link_status=status, http_status_code=code, request_method=method,
                    content_type=ct, content_length=length, final_url=final,
                    latency_ms=int((time.monotonic()-start)*1000), error_message=error)
    if not _allowed(url):
        return result("blocked", error="Unapproved source host or insecure URL")
    current = url
    try:
        with httpx.Client(timeout=httpx.Timeout(15, connect=8), follow_redirects=False,
                          headers=HEADERS, trust_env=True) as client:
            for _ in range(6):
                if not _allowed(current):
                    return result("blocked", final=current, error="Redirect outside approved official hosts")
                # Stream only the initial bytes: avoid downloading full PDFs just to check links.
                with client.stream("GET", current, headers={"Range": "bytes=0-4095"}) as response:
                    code = response.status_code
                    ct = response.headers.get("content-type", "")
                    length_str = response.headers.get("content-length", "")
                    length = int(length_str) if length_str.isdigit() else None
                    final = str(response.url)
                    if code in (301, 302, 303, 307, 308):
                        location = response.headers.get("location")
                        if not location:
                            return result("unknown", code, "GET", ct, length, final, "Redirect without Location")
                        current = str(response.url.join(location))
                        continue
                    if code in (401, 403):
                        return result("blocked", code, "GET", ct, length, final,
                                      "Official server denied automated access; link may work in a browser")
                    if code == 429:
                        return result("rate_limited", code, "GET", ct, length, final, "Official server rate-limited checks")
                    if code in (404, 410):
                        return result("broken", code, "GET", ct, length, final, "Official server returned not found")
                    if code >= 500:
                        return result("server_error", code, "GET", ct, length, final, "Official server error")
                    if code >= 400:
                        return result("unknown", code, "GET", ct, length, final, "Unexpected HTTP error")
                    sample = b""
                    for chunk in response.iter_bytes():
                        sample += chunk
                        if len(sample) >= 4096:
                            break
                    lower = ct.lower()
                    pdf = sample.lstrip().startswith(b"%PDF-")
                    docx = sample.startswith(b"PK\x03\x04") and ("wordprocessingml" in lower or current.lower().split('?')[0].endswith('.docx'))
                    doc = sample.startswith(b"\xd0\xcf\x11\xe0")
                    if pdf or docx or doc:
                        return result("available", code, "GET", ct, length, final)
                    if "text/html" in lower or sample.lstrip().lower().startswith((b"<!doctype html", b"<html")):
                        return result("invalid_content", code, "GET", ct, length, final, "Returned an HTML page, not a document")
                    # Empty 2xx and opaque binary formats are inconclusive, not proof of a valid PDF.
                    return result("unknown", code, "GET", ct, length, final, "Successful response but document signature could not be confirmed")
            return result("unknown", final=current, error="Too many redirects")
    except httpx.TimeoutException as exc:
        return result("timeout", final=current, error=str(exc)[:400])
    except httpx.HTTPError as exc:
        return result("unknown", final=current, error=str(exc)[:400])

def _save_check(conn, document_id, checked):
    with conn.cursor() as cur:
        values = {"id": document_id, **checked}
        cur.execute("""INSERT INTO document_link_checks
            (document_id,link_status,http_status_code,request_method,content_type,content_length,final_url,latency_ms,error_message)
            VALUES (%(id)s,%(link_status)s,%(http_status_code)s,%(request_method)s,%(content_type)s,%(content_length)s,%(final_url)s,%(latency_ms)s,%(error_message)s)""", values)
        cur.execute("""UPDATE bill_documents SET link_status=%(link_status)s,http_status_code=%(http_status_code)s,
            last_checked_at=now(),last_success_at=CASE WHEN %(link_status)s='available' THEN now() ELSE last_success_at END,
            response_content_type=%(content_type)s,final_url=%(final_url)s,link_error=%(error_message)s,
            check_attempts=check_attempts+1,last_check_latency_ms=%(latency_ms)s,updated_at=now() WHERE id=%(id)s""", values)

def _check_one(conn, document_id):
    with conn.cursor() as cur:
        cur.execute("SELECT source_url FROM bill_documents WHERE id=%s", (document_id,))
        doc = cur.fetchone()
    if not doc:
        raise HTTPException(404, "Document not found")
    checked = verify_url(doc["source_url"])
    _save_check(conn, document_id, checked)
    return {"documentId": document_id, **checked}

@router.post("/documents/{document_id}/check-link")
def check_document(document_id: int, admin=Depends(require_admin), conn=Depends(get_conn)):
    return _check_one(conn, document_id)

@router.post("/bills/{bill_id}/check-links")
def check_bill_links(bill_id: int, admin=Depends(require_admin), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM bill_documents WHERE bill_id=%s ORDER BY id", (bill_id,))
        ids = [row["id"] for row in cur.fetchall()]
    return {"items": [_check_one(conn, doc_id) for doc_id in ids]}

def _run_batch(batch_id, ids):
    try:
        for doc_id in ids:
            with _lock:
                if _batch["id"] != batch_id or _batch["status"] == "cancelling":
                    _batch["status"] = "cancelled"
                    return
            conn = checkout_conn()
            try:
                checked = _check_one(conn, doc_id)
                conn.commit()
                status = checked["link_status"]
            except Exception:
                conn.rollback()
                status = "error"
            finally:
                checkin_conn(conn)
            with _lock:
                _batch["checked"] += 1
                _batch["results"][status] = _batch["results"].get(status, 0) + 1
            time.sleep(0.6)  # Be considerate of government servers.
        with _lock:
            _batch["status"] = "completed"
    except Exception as exc:
        with _lock:
            _batch["status"] = "failed"
            _batch["error"] = str(exc)[:500]

@router.post("/documents/check-all-links")
def check_all_links(admin=Depends(require_admin), conn=Depends(get_conn)):
    global _batch
    with _lock:
        if _batch["status"] in ("running", "cancelling"):
            raise HTTPException(409, "A global link check is already running")
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM bill_documents WHERE source_url IS NOT NULL AND btrim(source_url) <> '' ORDER BY id")
            ids = [r["id"] for r in cur.fetchall()]
        batch_id = str(uuid.uuid4())
        _batch = {"id": batch_id, "status": "running", "total": len(ids), "checked": 0, "results": {}, "error": None}
        threading.Thread(target=_run_batch, args=(batch_id, ids), daemon=True, name="nationpulse-link-check").start()
        return dict(_batch)

@router.get("/documents/check-all-links/status")
def all_links_status(admin=Depends(require_admin)):
    with _lock:
        return dict(_batch)

@router.post("/documents/check-all-links/cancel")
def cancel_all_links(admin=Depends(require_admin)):
    with _lock:
        if _batch["status"] == "running":
            _batch["status"] = "cancelling"
        return dict(_batch)
