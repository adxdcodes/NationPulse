"""Central configuration for the AI summarization pipeline."""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/nationpulse")

AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
GEMINI_MODEL_2 = os.getenv("GEMINI_MODEL_2", "")
GEMINI_MODEL_3 = os.getenv("GEMINI_MODEL_3", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Override for local testing against a fake server instead of the real API.
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com")

MAX_INPUT_CHARS = int(os.getenv("MAX_INPUT_CHARS", "45000"))
MAX_OUTPUT_TOKENS = int(os.getenv("MAX_OUTPUT_TOKENS", "2000"))
REQUEST_TIMEOUT_SECONDS = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "90"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_DELAY_SECONDS = float(os.getenv("RETRY_DELAY_SECONDS", "3"))

PROMPT_VERSION = os.getenv("PROMPT_VERSION", "v1")
