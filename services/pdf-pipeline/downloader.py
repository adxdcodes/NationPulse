"""Fetches a PDF from a source URL with retries, backoff, and basic
validation (some sansad.in links 404 or return an HTML error page instead
of a PDF — we need to catch that instead of silently storing garbage).
"""
import time
import httpx

import config


class DownloadError(Exception):
    pass


def download_pdf(url: str) -> bytes:
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
            looks_like_pdf = body[:5] == b"%PDF-"
            if not looks_like_pdf and "pdf" not in content_type.lower():
                raise DownloadError(
                    f"Response doesn't look like a PDF (content-type={content_type!r}, "
                    f"first bytes={body[:20]!r})"
                )
            return body

        except (httpx.HTTPError, DownloadError) as e:
            last_error = e
            if attempt < config.MAX_RETRIES:
                time.sleep(config.REQUEST_DELAY_SECONDS * attempt)  # linear backoff
        finally:
            time.sleep(config.REQUEST_DELAY_SECONDS)  # politeness delay on every attempt

    raise DownloadError(f"Failed after {config.MAX_RETRIES} attempts: {last_error}")
