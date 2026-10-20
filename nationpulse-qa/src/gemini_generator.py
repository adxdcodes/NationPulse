"""
gemini_generator.py
--------------------
Alternative to generator.py (transformers) and ollama_generator.py,
backed by the Gemini API instead of a locally-hosted model.

Why this exists: local models (transformers on limited VRAM, or even
Ollama) hit real, recurring problems in this project — VRAM limits,
latency, small-model hallucination on precise legal facts (deadline
hedging, clause/article confusion, cross-document contamination). A
frontier hosted model sidesteps all of that, at the cost of needing an
API key, an internet connection, and per-request cost.

Setup:
    Set the API key as an environment variable or in the repository-root .env file:
    - In root .env file: GEMINI_API_KEY="your-key-here"
    - PowerShell:   $env:GEMINI_API_KEY = "your-key-here"
    - Windows perm: setx GEMINI_API_KEY "your-key-here"
    - Linux/Mac:    export GEMINI_API_KEY="your-key-here"
"""

import os
from pathlib import Path
import requests

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

DEFAULT_GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest",
]


def _find_gemini_api_key(config: dict) -> str | None:
    # 1. Environment variable
    key = os.environ.get("GEMINI_API_KEY")
    if key and key.strip():
        return key.strip()

    # 2. Config dictionary
    key = config.get("generation", {}).get("gemini_api_key")
    if key and key.strip():
        return key.strip()

    # 3. .env file in cwd, parent, or relative to this script
    repo_root_env = Path(__file__).resolve().parents[2] / ".env"
    search_paths = [
        str(repo_root_env),
        ".env",  # backward compatibility for running QA standalone
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
    ]
    for p in search_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("GEMINI_API_KEY="):
                            val = line.split("=", 1)[1].strip().strip("\"'")
                            if val:
                                return val
            except Exception:
                pass
    return None


class GeminiGenerator:
    def __init__(self, config: dict):
        gen_cfg = config.get("generation", {})
        configured_model = gen_cfg.get("gemini_model")
        fallback_models = [configured_model] if configured_model else []
        self.model_names = list(dict.fromkeys(fallback_models + DEFAULT_GEMINI_MODELS))
        self.model_name = self.model_names[0]
        self.temperature = gen_cfg.get("temperature", 0.1)
        self.top_p = gen_cfg.get("top_p", 0.9)
        self.max_new_tokens = gen_cfg.get("max_new_tokens", 300)

        self.api_key = _find_gemini_api_key(config)
        if not self.api_key:
            raise RuntimeError(
                "No Gemini API key found. Set it as an environment variable or in .env:\n"
                '  In .env:               GEMINI_API_KEY="your-key-here"\n'
                '  Windows (PowerShell):  $env:GEMINI_API_KEY = "your-key-here"\n'
                '  Mac/Linux:             export GEMINI_API_KEY="your-key-here"\n'
                "Get a free key at https://aistudio.google.com/apikey"
            )

    def _post_with_model(self, model_name: str, payload: dict):
        url = f"{API_BASE}/{model_name}:generateContent?key={self.api_key}"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key,
        }
        try:
            return requests.post(url, headers=headers, json=payload, timeout=25)
        except (requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout):
            raise RuntimeError(
                f"Could not reach the Gemini API or the request timed out for model '{model_name}' — "
                "checking fallback model."
            )

    def chat(self, system_prompt: str, user_prompt: str, max_new_tokens: int | None = None) -> str:
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": self.temperature,
                "topP": self.top_p,
                "maxOutputTokens": max_new_tokens or self.max_new_tokens,
            },
        }

        last_error = None
        for model_name in self.model_names:
            self.model_name = model_name
            try:
                resp = self._post_with_model(model_name, payload)
            except RuntimeError as exc:
                last_error = exc
                continue

            if resp.status_code == 404:
                last_error = RuntimeError(
                    f"Gemini model '{model_name}' was not found (HTTP 404). "
                    f"Trying fallback model..."
                )
                continue
            if resp.status_code == 400:
                raise RuntimeError(
                    f"Gemini API rejected the request (HTTP 400): {resp.text[:300]} "
                    f"— this usually means an invalid or malformed API key."
                )
            if resp.status_code == 429:
                last_error = RuntimeError(
                    f"Gemini API rate limit hit (HTTP 429) for '{model_name}'. "
                    f"Trying fallback model..."
                )
                continue
            if resp.status_code == 503:
                last_error = RuntimeError(
                    f"Gemini API temporarily unavailable on model '{model_name}' (HTTP 503). "
                    "Retrying with a fallback model."
                )
                continue
            try:
                resp.raise_for_status()
            except requests.exceptions.HTTPError:
                last_error = RuntimeError(
                    f"Gemini request failed for model '{model_name}' (HTTP {resp.status_code}): "
                    f"{resp.text[:300]}"
                )
                continue

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                reason = data.get("promptFeedback", {}).get("blockReason", "unknown")
                return f"[No answer generated — response was blocked, reason: {reason}]"

            parts = candidates[0].get("content", {}).get("parts", [])
            # Filter out reasoning/thought parts if separate thought blocks are present
            content_parts = [p for p in parts if not p.get("thought")]
            use_parts = content_parts if content_parts else parts
            text = "".join(p.get("text", "") for p in use_parts)
            return text.strip()

        if last_error is not None:
            raise last_error

        raise RuntimeError(
            "Gemini API returned no usable response from any configured model."
        )
