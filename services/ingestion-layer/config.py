"""Central configuration for the ingestion service."""
import os
from pathlib import Path
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


def _repo_path(value: str) -> str:
    path = Path(value)
    return str(path if path.is_absolute() else (REPO_ROOT / path).resolve())


def _bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    return default if val is None else val.strip().lower() in ("1", "true", "yes", "on")


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/nationpulse")

SANSAD_BASE_URL = os.getenv("SANSAD_BASE_URL", "https://sansad.in")
REQUEST_TIMEOUT_SECONDS = float(os.getenv("INGESTION_REQUEST_TIMEOUT_SECONDS", os.getenv("REQUEST_TIMEOUT_SECONDS", "60")))
USER_AGENT = os.getenv("INGESTION_USER_AGENT", os.getenv("USER_AGENT", "NationPulseBot/1.0"))

# The two known-good endpoints, one per house. `size` is set generously
# above the real total so a single request returns the whole list — see
# the pagination note in README.md.
HOUSES = [
    {"house": "Rajya Sabha", "endpoint": "/api_rs/legislation/getBills",
     "size": int(os.getenv("RS_FETCH_SIZE", "2000"))},
    {"house": "Lok Sabha", "endpoint": "/api_rs/legislation/getBills",
     "size": int(os.getenv("LS_FETCH_SIZE", "5000"))},
]

TRIGGER_DOWNSTREAM = _bool("TRIGGER_DOWNSTREAM", True)
PDF_PIPELINE_DIR = _repo_path(os.getenv("PDF_PIPELINE_DIR", "services/pdf-pipeline"))
AI_PIPELINE_DIR = _repo_path(os.getenv("AI_PIPELINE_DIR", "services/ai-pipeline"))
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini")
