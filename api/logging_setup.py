"""Configure FastAPI/Uvicorn logging to project logs/ with rotation."""
import logging
import os
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler

LOG_DIR = Path(os.getenv("NATIONPULSE_LOG_DIR", str(Path(__file__).resolve().parents[1] / "logs"))).resolve()

def configure_api_logging():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] [%(name)s] %(message)s")
    # Configure each Uvicorn logger separately; the access logger is especially useful for API debugging.
    for name, filename in [("uvicorn", "api.log"), ("uvicorn.error", "api.log"), ("uvicorn.access", "api_access.log"), ("nationpulse", "api.log")]:
        logger = logging.getLogger(name)
        logger.setLevel(logging.INFO)
        if not any(getattr(h, "_np_log_file", None) == filename for h in logger.handlers):
            handler = RotatingFileHandler(LOG_DIR / filename, maxBytes=10*1024*1024, backupCount=5, encoding="utf-8", delay=True)
            handler.setFormatter(formatter)
            handler._np_log_file = filename
            logger.addHandler(handler)
    # App exception tracebacks (including FastAPI's exception handlers) are emitted by uvicorn.error.
