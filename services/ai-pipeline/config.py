"""Central configuration for the AI summarization pipeline."""
import os
import threading
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/nationpulse")

AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
GEMINI_MODEL_2 = os.getenv("GEMINI_MODEL_2", "")
GEMINI_MODEL_3 = os.getenv("GEMINI_MODEL_3", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
_NUMBERED_GEMINI_KEYS = tuple(
    key for key in (
        os.getenv("GEMINI_API_KEY_1", "").strip(),
        os.getenv("GEMINI_API_KEY_2", "").strip(),
        os.getenv("GEMINI_API_KEY_3", "").strip(),
    ) if key
)
# Keep the legacy single key as a fallback for existing deployments.
GEMINI_API_KEYS = _NUMBERED_GEMINI_KEYS or ((GEMINI_API_KEY.strip(),) if GEMINI_API_KEY.strip() else ())
_gemini_key_lock = threading.Lock()
_gemini_key_index = 0


def next_gemini_api_key() -> str:
    """Return the next configured Gemini key in 1 → 2 → 3 order, safely across threads."""
    global _gemini_key_index
    if not GEMINI_API_KEYS:
        return ""
    with _gemini_key_lock:
        key = GEMINI_API_KEYS[_gemini_key_index % len(GEMINI_API_KEYS)]
        _gemini_key_index += 1
        return key

# Override for local testing against a fake server instead of the real API.
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com")

MAX_INPUT_CHARS = int(os.getenv("MAX_INPUT_CHARS", "45000"))
MAX_OUTPUT_TOKENS = int(os.getenv("MAX_OUTPUT_TOKENS", "2000"))
REQUEST_TIMEOUT_SECONDS = float(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", os.getenv("REQUEST_TIMEOUT_SECONDS", "90")))
MAX_RETRIES = int(os.getenv("AI_MAX_RETRIES", os.getenv("MAX_RETRIES", "3")))
RETRY_DELAY_SECONDS = float(os.getenv("AI_RETRY_DELAY_SECONDS", os.getenv("RETRY_DELAY_SECONDS", "3")))

PROMPT_VERSION = os.getenv("PROMPT_VERSION", "v1")
