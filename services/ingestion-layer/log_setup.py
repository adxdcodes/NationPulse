"""Shared project-level log configuration for this service."""
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = Path(os.getenv("NATIONPULSE_LOG_DIR", str(PROJECT_ROOT / "logs"))).resolve()

def configure(service: str):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(service)
    logger.setLevel(logging.INFO)
    if not any(getattr(h, "_np_service", None) == service for h in logger.handlers):
        fmt = logging.Formatter("%(asctime)s [%(levelname)s] [%(name)s] %(message)s")
        file_handler = RotatingFileHandler(LOG_DIR / f"{service}.log", maxBytes=10*1024*1024, backupCount=5, encoding="utf-8", delay=True)
        file_handler.setFormatter(fmt)
        file_handler._np_service = service
        logger.addHandler(file_handler)
        console = logging.StreamHandler(sys.stdout)
        console.setFormatter(fmt)
        console._np_service = service
        logger.addHandler(console)
    return logger
