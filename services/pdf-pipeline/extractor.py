"""Extracts plain text from PDF bytes, with a three-tier fallback chain:

    1. pdfplumber  — best layout-aware extraction for normal text PDFs
    2. PyMuPDF     — faster, occasionally recovers text pdfplumber misses
    3. OCR         — for scanned/image-only PDFs with no text layer at all
       (older gazette notifications are frequently like this)

Returns an ExtractionResult with the method that succeeded, so callers can
record how much to trust the text (OCR output is noisier).
"""
import io
from dataclasses import dataclass

import pdfplumber
import pymupdf as fitz  # PyMuPDF (the "fitz" alias is deprecated upstream)

import config


@dataclass
class ExtractionResult:
    text: str
    method: str          # "pdfplumber" | "pymupdf" | "ocr" | "none"
    page_count: int
    no_text_layer: bool  # True if we had to fall back to OCR (or found nothing)


def _try_pdfplumber(data: bytes) -> tuple[str, int]:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = [p.extract_text() or "" for p in pdf.pages]
        return "\n\n".join(pages).strip(), len(pdf.pages)


def _try_pymupdf(data: bytes) -> tuple[str, int]:
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        pages = [page.get_text() or "" for page in doc]
        return "\n\n".join(pages).strip(), doc.page_count
    finally:
        doc.close()


def _try_ocr(data: bytes, page_count: int) -> str:
    from pdf2image import convert_from_bytes
    import pytesseract

    n_pages = min(page_count, config.OCR_MAX_PAGES)
    images = convert_from_bytes(data, first_page=1, last_page=n_pages)
    pages_text = [pytesseract.image_to_string(img) for img in images]
    return "\n\n".join(pages_text).strip()


def extract_text(data: bytes) -> ExtractionResult:
    page_count = 0

    try:
        text, page_count = _try_pdfplumber(data)
        if len(text) >= config.MIN_TEXT_LAYER_CHARS:
            return ExtractionResult(text=text, method="pdfplumber", page_count=page_count, no_text_layer=False)
    except Exception:
        text = ""

    try:
        text2, page_count2 = _try_pymupdf(data)
        page_count = page_count or page_count2
        if len(text2) >= config.MIN_TEXT_LAYER_CHARS:
            return ExtractionResult(text=text2, method="pymupdf", page_count=page_count, no_text_layer=False)
    except Exception:
        pass

    if config.OCR_ENABLED:
        try:
            ocr_text = _try_ocr(data, page_count or 1)
            if ocr_text.strip():
                return ExtractionResult(text=ocr_text, method="ocr", page_count=page_count, no_text_layer=True)
        except Exception:
            pass

    # Nothing worked — still record whatever pdfplumber/pymupdf found (even
    # if thin) so a human reviewer has something to look at, rather than
    # storing an empty string with no trace of why.
    return ExtractionResult(text=text or "", method="none", page_count=page_count, no_text_layer=True)
