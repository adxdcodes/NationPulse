"""Admin-operated source PDF link checks. Independent of extraction/download."""
import time
from urllib.parse import urlparse
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from auth import require_admin
from db import get_conn

router=APIRouter(prefix="/admin",tags=["document-health"])
ALLOWED_HOSTS={"sansad.in","www.sansad.in","loksabha.nic.in","www.loksabha.nic.in","rajyasabha.nic.in","www.rajyasabha.nic.in"}

def _allowed(url):
    try:
        p=urlparse(url)
        return p.scheme=="https" and p.hostname and (p.hostname.lower() in ALLOWED_HOSTS or p.hostname.lower().endswith(".sansad.in")) and not p.username and not p.password and p.port in (None,443)
    except ValueError:
        return False

def verify_url(url):
    if not _allowed(url):
        return dict(link_status="blocked",http_status_code=None,request_method=None,content_type=None,
                    content_length=None,final_url=None,latency_ms=None,error_message="Unapproved source host or insecure URL")
    start=time.monotonic();method="HEAD";code=None;ct=None;final=None;length=None
    try:
        # Avoid arbitrary redirects to internal networks. No automatic redirect following.
        with httpx.Client(timeout=8,follow_redirects=False,headers={"User-Agent":"NationPulse/2.0 PDF-link-verifier"}) as client:
            current=url
            for _ in range(4):
                if not _allowed(current):
                    return dict(link_status="blocked",http_status_code=code,request_method=method,content_type=ct,
                                content_length=length,final_url=current,latency_ms=int((time.monotonic()-start)*1000),error_message="Redirect to unapproved host")
                resp=client.request(method,current,headers={"Range":"bytes=0-1023"} if method=="GET" else {})
                code=resp.status_code;ct=resp.headers.get("content-type","");final=str(resp.url)
                length=int(resp.headers["content-length"]) if resp.headers.get("content-length","").isdigit() else None
                if code in (301,302,303,307,308) and resp.headers.get("location"):
                    current=str(resp.url.join(resp.headers["location"]));continue
                if method=="HEAD" and (code in (405,501) or (code<400 and "pdf" not in ct.lower())):
                    method="GET";continue
                if code in (401,403):status="blocked"
                elif code==429:status="rate_limited"
                elif code in (404,410):status="broken"
                elif code>=500:status="server_error"
                elif code>=400:status="unknown"
                elif "pdf" in ct.lower() or (method=="GET" and resp.content.startswith(b"%PDF-")):status="available"
                else:status="invalid_content"
                return dict(link_status=status,http_status_code=code,request_method=method,content_type=ct,
                            content_length=length,final_url=final,latency_ms=int((time.monotonic()-start)*1000),error_message=None)
            return dict(link_status="unknown",http_status_code=code,request_method=method,content_type=ct,
                        content_length=length,final_url=final,latency_ms=int((time.monotonic()-start)*1000),error_message="Too many redirects")
    except httpx.TimeoutException as e:status="timeout"
    except httpx.HTTPError as e:status="unknown"
    return dict(link_status=status,http_status_code=code,request_method=method,content_type=ct,
                content_length=length,final_url=final,latency_ms=int((time.monotonic()-start)*1000),error_message=str(e)[:500])

@router.post("/documents/{document_id}/check-link")
def check_document(document_id:int, admin=Depends(require_admin),conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT id,source_url FROM bill_documents WHERE id=%s",(document_id,))
        doc=cur.fetchone()
        if not doc:raise HTTPException(404,"Document not found")
        result=verify_url(doc["source_url"])
        cur.execute("""INSERT INTO document_link_checks
            (document_id,link_status,http_status_code,request_method,content_type,content_length,final_url,latency_ms,error_message)
            VALUES (%(id)s,%(link_status)s,%(http_status_code)s,%(request_method)s,%(content_type)s,%(content_length)s,%(final_url)s,%(latency_ms)s,%(error_message)s)""",
            {"id":document_id,**result})
        cur.execute("""UPDATE bill_documents SET link_status=%(link_status)s,http_status_code=%(http_status_code)s,
            last_checked_at=now(),last_success_at=CASE WHEN %(link_status)s='available' THEN now() ELSE last_success_at END,
            response_content_type=%(content_type)s,final_url=%(final_url)s,link_error=%(error_message)s,
            check_attempts=check_attempts+1,last_check_latency_ms=%(latency_ms)s,updated_at=now() WHERE id=%(id)s""",
            {"id":document_id,**result})
    return {"documentId":document_id,**result}

@router.post("/bills/{bill_id}/check-links")
def check_bill_links(bill_id:int,limit:int=Query(10,ge=1,le=25),admin=Depends(require_admin),conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM bill_documents WHERE bill_id=%s ORDER BY id LIMIT %s",(bill_id,limit))
        ids=[row["id"] for row in cur.fetchall()]
    return {"items":[check_document(doc_id,admin,conn) for doc_id in ids]}
