import os
import threading
import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import config
from routers import bills, mps, digest, auth_router, comments, follows, admin, processing

app = FastAPI(title="NationPulse API", version="1.0.0")


def _reap_finished_job_processes():
    """Every subprocess spawned by routers/processing.py (PDF/AI jobs) is a
    direct child of this API process. On POSIX, once one exits the OS
    keeps it around as a zombie until something calls wait() on it —
    nothing else in this app does that, so this loop does, forever, in
    the background. Windows has no waitpid/WNOHANG equivalent here (the
    watcher thread in processing.py already reaps the child via
    Popen.wait(), which IS cross-platform) — this loop is a POSIX-only
    concern, so it simply doesn't run on Windows rather than crashing the
    app the first time it tries to touch os.WNOHANG, which doesn't exist
    there.
    """
    if os.name != "posix":
        return
    while True:
        try:
            os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            pass  # no children have exited since the last check — expected, not an error
        time.sleep(1)


threading.Thread(target=_reap_finished_job_processes, daemon=True).start()

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves pdf-pipeline's locally-extracted .txt files directly, so an admin
# can open one from the frontend without a separate authenticated download
# endpoint. Deliberately reuses config.PDF_PIPELINE_DIR — the same setting
# routers/processing.py already uses to spawn that service — rather than
# a second, independently-hardcoded path guess. Getting these two out of
# sync is exactly the class of bug that caused the original spawn failure
# this whole feature was built alongside fixing.
#
# Note this mount has no auth check (StaticFiles doesn't support adding
# one without replacing it entirely) — acceptable here because bill text
# is government legislation, not sensitive data, and paths are keyed by
# an unguessable content hash, but worth knowing if this is ever exposed
# outside a trusted admin network.
_text_dir = Path(config.PDF_PIPELINE_DIR) / "storage" / "text"
_text_dir.mkdir(parents=True, exist_ok=True)
app.mount("/files/pdf-pipeline/text", StaticFiles(directory=str(_text_dir)), name="extracted-text")

app.include_router(bills.router)
app.include_router(mps.router)
app.include_router(digest.router)
app.include_router(auth_router.router)
app.include_router(comments.router)
app.include_router(follows.router)
app.include_router(admin.router)
app.include_router(processing.router)


@app.get("/health")
def health():
    return {"status": "ok"}
