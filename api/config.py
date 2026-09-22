"""Central configuration for the API service."""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/nationpulse")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))
JWT_ALGORITHM = "HS256"

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

DEFAULT_PAGE_SIZE = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
MAX_PAGE_SIZE = int(os.getenv("MAX_PAGE_SIZE", "100"))

# Sibling service directories, for spawning admin-triggered processing jobs.
# Defaults assume the api/ + services/{pdf-pipeline,ai-pipeline}/ layout
# from RUNBOOK.md — override in .env if yours differs.
PDF_PIPELINE_DIR = os.getenv("PDF_PIPELINE_DIR", "../services/pdf-pipeline")
AI_PIPELINE_DIR = os.getenv("AI_PIPELINE_DIR", "../services/ai-pipeline")
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini")

# The externally-reachable URL of THIS API — used to build links back to
# locally-stored files (extracted text) that the frontend can open
# directly. Must be set correctly once this isn't running on localhost.
PUBLIC_API_BASE_URL = os.getenv("PUBLIC_API_BASE_URL", "http://localhost:8000")

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
