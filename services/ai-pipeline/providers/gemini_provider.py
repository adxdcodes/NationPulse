"""Gemini via the generateContent REST API. Gemini's JSON-schema support
uses a restricted OpenAPI-3.0 subset (no "additionalProperties", etc.) —
_to_gemini_schema strips the parts it doesn't accept.
"""
import httpx

import config
from providers.base import AIProvider, ProviderError, safe_json_loads


def _to_gemini_schema(schema: dict) -> dict:
    """Recursively drop keys Gemini's schema validator rejects, keeping the
    parts (type/properties/items/enum/required/description) it does honor."""
    allowed = {"type", "properties", "items", "enum", "required", "description"}
    if isinstance(schema, dict):
        out = {}
        for k, v in schema.items():
            if k == "properties" and isinstance(v, dict):
                out[k] = {name: _to_gemini_schema(value) for name, value in v.items()}
                continue
            if k not in allowed:
                continue
            out[k] = _to_gemini_schema(v) if isinstance(v, (dict, list)) else v
        return out
    if isinstance(schema, list):
        return [_to_gemini_schema(v) for v in schema]
    return schema


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self, api_key: str = None, model: str = None, base_url: str = None):
        self.api_key = api_key or config.GEMINI_API_KEY
        self.model = model or config.GEMINI_MODEL
        self.base_url = base_url or config.GEMINI_BASE_URL
        if not self.api_key:
            raise ProviderError("GEMINI_API_KEY is not set.")

    def _call(self, system_prompt: str, user_prompt: str, schema: dict) -> tuple[dict, dict]:
        body = {
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": _to_gemini_schema(schema),
                "maxOutputTokens": config.MAX_OUTPUT_TOKENS,
            },
        }
        url = f"{self.base_url}/v1beta/models/{self.model}:generateContent"

        try:
            resp = httpx.post(url, json=body, params={"key": self.api_key},
                               timeout=config.REQUEST_TIMEOUT_SECONDS)
        except httpx.HTTPError as e:
            raise ProviderError(f"Network error calling Gemini: {e}")

        if resp.status_code != 200:
            raise ProviderError(f"Gemini API returned {resp.status_code}: {resp.text[:500]}")

        data = resp.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise ProviderError(f"Unexpected Gemini response shape: {data}")

        return safe_json_loads(text), data
