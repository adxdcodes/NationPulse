"""Fetches a PDF from a source URL with retries, backoff, and basic
validation (some sansad.in links 404 or return an HTML error page instead
of a PDF — we need to catch that instead of silently storing garbage).
"""
import time
import httpx

import config


class DownloadError(Exception):
    pass


def download_document(url: str) -> tuple[bytes, str]:
    last_error = None
    headers = {"User-Agent": config.USER_AGENT}

    for attempt in range(1, config.MAX_RETRIES + 1):
        try:
            with httpx.Client(follow_redirects=True, timeout=config.REQUEST_TIMEOUT_SECONDS) as client:
                resp = client.get(url, headers=headers)
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            body = resp.content

            # sansad.in occasionally serves an HTML error/login page at a
            # 200 status for a broken link — content-type + magic-bytes
            # check catches what a status-code check alone would miss.
            import io, zipfile
            from urllib.parse import urlsplit
            path = urlsplit(str(resp.url)).path.lower()
            if body.startswith(b"%PDF-"):
                kind = "pdf"
            elif body.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
                kind = "doc"
            elif zipfile.is_zipfile(io.BytesIO(body)):
                with zipfile.ZipFile(io.BytesIO(body)) as archive:
                    if "word/document.xml" not in archive.namelist():
                        raise DownloadError("ZIP response is not a Word DOCX document")
                kind = "docx"
            else:
                raise DownloadError(f"Source returned unsupported content (type={content_type!r}, url={path!r})")
            return body, kind

        except (httpx.HTTPError, DownloadError) as e:
            last_error = e
            if attempt < config.MAX_RETRIES:
                time.sleep(config.REQUEST_DELAY_SECONDS * attempt)  # linear backoff
        finally:
            time.sleep(config.REQUEST_DELAY_SECONDS)  # politeness delay on every attempt

    raise DownloadError(f"Failed after {config.MAX_RETRIES} attempts: {last_error}")


def download_pdf(url: str) -> bytes:
    data, kind = download_document(url)
    if kind != "pdf":
        raise DownloadError(f"Expected PDF, received {kind}")
    return data
