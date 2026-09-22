"""Shared between routers/admin.py and routers/processing.py — one place
that knows how a locally-stored file's DB path maps to an HTTP URL the
frontend can open directly.
"""
import config


def as_text_url(storage_path: str):
    """Maps a locally-stored raw PDF's path to the URL of its extracted
    text sibling, served by the static mount in main.py. Both files are
    written under the same key (see pdf-pipeline/storage.py's build_key) —
    only the `raw`/`text` prefix and the extension differ — so this is a
    pure derivation, no extra DB column needed.

    Returns None for anything we can't map: S3-backed storage (not served
    locally), or a path that doesn't look like our local convention.
    """
    if not storage_path or storage_path.startswith("s3://"):
        return None
    normalized = storage_path.replace("\\", "/")
    marker = "/storage/raw/"
    if marker not in normalized:
        return None
    rel = normalized.split(marker, 1)[1]
    text_rel = rel.rsplit(".", 1)[0] + ".txt"
    return f"{config.PUBLIC_API_BASE_URL.rstrip('/')}/files/pdf-pipeline/text/{text_rel}"
