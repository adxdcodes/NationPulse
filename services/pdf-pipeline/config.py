"""Central configuration, loaded from environment variables (.env in dev)."""
import os
from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    return default if val is None else val.strip().lower() in ("1", "true", "yes", "on")


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/nationpulse")

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")  # "local" | "s3"
LOCAL_STORAGE_ROOT = os.getenv("LOCAL_STORAGE_ROOT", "./storage")

S3_BUCKET = os.getenv("S3_BUCKET", "")
S3_REGION = os.getenv("S3_REGION", "ap-south-1")

REQUEST_TIMEOUT_SECONDS = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))
REQUEST_DELAY_SECONDS = float(os.getenv("REQUEST_DELAY_SECONDS", "1.5"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
USER_AGENT = os.getenv("USER_AGENT", "NationPulseBot/1.0")

WORKER_THREADS = int(os.getenv("WORKER_THREADS", "4"))

OCR_ENABLED = _bool("OCR_ENABLED", True)
OCR_MAX_PAGES = int(os.getenv("OCR_MAX_PAGES", "0"))

# Below this character count, a "successfully" extracted PDF is treated as
# having no real text layer (i.e. scanned) and routed to OCR instead.
MIN_TEXT_LAYER_CHARS = int(os.getenv("MIN_TEXT_LAYER_CHARS", "40"))

# OCR tuning; OCR_MAX_PAGES=0 processes all pages that need OCR.
OCR_DPI = int(os.getenv('OCR_DPI', '200'))
OCR_LANGUAGE = os.getenv('OCR_LANGUAGE', 'eng')
TESSERACT_CMD = os.getenv('TESSERACT_CMD', '')
