"""Discover free-tier-eligible text-generation models exposed to this API key.
models.list does NOT report pricing or remaining quota. Keep the allowlist aligned
with Google's current pricing documentation; configure real quotas in PostgreSQL.
"""
import logging
import httpx
import config

log = logging.getLogger("ai_pipeline")
# Order favors lighter models for large parliamentary documents.
FREE_TEXT_MODELS = (
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
)

def discover():
    """Intersect documented free candidates with models.list generateContent support.
    Raises if the list endpoint fails: never silently guess which models are available.
    """
    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY missing")
    url = config.GEMINI_BASE_URL.rstrip("/") + "/v1beta/models"
    available = set()
    page_token = None
    with httpx.Client(timeout=20) as client:
        while True:
            params = {"key": config.GEMINI_API_KEY, "pageSize": 1000}
            if page_token:
                params["pageToken"] = page_token
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            for item in data.get("models", []):
                methods = item.get("supportedGenerationMethods", [])
                if "generateContent" in methods:
                    available.add(item.get("name", "").removeprefix("models/"))
            page_token = data.get("nextPageToken")
            if not page_token:
                break
    result = [model for model in FREE_TEXT_MODELS if model in available]
    log.info("Discovered %d documented free-tier candidates exposed to this key: %s", len(result), ", ".join(result) or "none")
    return result
