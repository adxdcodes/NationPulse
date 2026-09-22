"""Chains into the PDF and AI pipelines after ingestion finds new bills.

Deliberately a subprocess call, not an import — these are separate
services with their own dependency sets (pdfplumber/PyMuPDF for one,
provider SDKs for the other) that ingestion has no reason to also install.
Calling their existing CLIs keeps the three services genuinely independent:
each still works standalone, and this is just a convenience wrapper that
calls "python pipeline.py" for you.
"""
import logging
import subprocess
import sys

import config

log = logging.getLogger("ingestion")


def run_downstream(new_bill_count: int):
    if not config.TRIGGER_DOWNSTREAM:
        log.info("TRIGGER_DOWNSTREAM=false — skipping, the pipelines' own --loop polling will pick these up.")
        return
    if new_bill_count == 0:
        log.info("No new bills — nothing to trigger downstream.")
        return

    # Generous limit: every new bill has at most a handful of documents.
    limit = max(new_bill_count * 8, 50)

    log.info("Triggering PDF pipeline for up to %d documents...", limit)
    _run([sys.executable, "pipeline.py", "--limit", str(limit)], cwd=config.PDF_PIPELINE_DIR)

    log.info("Triggering AI pipeline (%s) for up to %d bills...", config.AI_PROVIDER, new_bill_count)
    _run([sys.executable, "pipeline.py", "--provider", config.AI_PROVIDER, "--limit", str(new_bill_count)],
         cwd=config.AI_PIPELINE_DIR)


def _run(cmd: list[str], cwd: str):
    try:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=3600)
        for line in result.stdout.splitlines():
            log.info("  | %s", line)
        for line in result.stderr.splitlines():
            log.info("  | %s", line)
        if result.returncode != 0:
            log.warning("%s exited with code %d", cmd, result.returncode)
    except FileNotFoundError:
        log.error("Could not find %s in %s — check PDF_PIPELINE_DIR/AI_PIPELINE_DIR in .env", cmd, cwd)
    except subprocess.TimeoutExpired:
        log.error("%s in %s timed out after 1 hour", cmd, cwd)
