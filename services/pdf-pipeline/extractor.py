"""Per-page PDF extraction: embedded text first, OCR for unreadable pages only.

Requires the pytesseract Python package AND a system Tesseract installation.
PyMuPDF renders pages directly; Poppler/pdf2image is not required here.
"""
import io
import logging
import re
from dataclasses import dataclass

import pdfplumber
import pymupdf as fitz

import config

log = logging.getLogger('pdf_pipeline')


@dataclass
class ExtractionResult:
    text: str
    method: str  # pdfplumber | pymupdf | ocr | hybrid | none
    page_count: int
    no_text_layer: bool  # True if at least one page required OCR or lacked text


def _readable_chars(value: str) -> int:
    return len(re.sub(r'\s+', '', value or ''))


def _plumber_pages(data: bytes) -> list[str]:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return [(p.extract_text() or '').strip() for p in pdf.pages]


def _ocr_page(page) -> str:
    import pytesseract
    from PIL import Image

    if config.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = config.TESSERACT_CMD
    pix = page.get_pixmap(dpi=config.OCR_DPI, alpha=False)
    image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    return pytesseract.image_to_string(image, lang=config.OCR_LANGUAGE).strip()


def extract_text(data: bytes) -> ExtractionResult:
    """Extract all pages; never silently report success for an OCR failure."""
    try:
        doc = fitz.open(stream=data, filetype='pdf')
    except Exception as exc:
        raise RuntimeError(f'Unable to open PDF: {exc}') from exc

    try:
        if doc.is_encrypted and not doc.authenticate(''):
            raise RuntimeError('PDF is encrypted and requires a password')
        count = doc.page_count
        if count == 0:
            raise RuntimeError('PDF has no pages')

        try:
            plumber = _plumber_pages(data)
        except Exception as exc:
            log.warning('pdfplumber extraction unavailable; trying PyMuPDF: %s', exc)
            plumber = []

        parts = []
        methods = set()
        ocr_count = 0
        missing = []
        threshold = max(1, config.MIN_TEXT_LAYER_CHARS)
        max_ocr = config.OCR_MAX_PAGES  # 0 = no page limit

        for index in range(count):
            page = doc[index]
            text = plumber[index] if index < len(plumber) else ''
            method = 'pdfplumber'
            if _readable_chars(text) < threshold:
                alternative = (page.get_text('text') or '').strip()
                if _readable_chars(alternative) > _readable_chars(text):
                    text, method = alternative, 'pymupdf'

            if _readable_chars(text) < threshold:
                if config.OCR_ENABLED and (max_ocr == 0 or ocr_count < max_ocr):
                    try:
                        recognized = _ocr_page(page)
                    except Exception as exc:
                        raise RuntimeError(
                            f'OCR failed on page {index + 1}/{count}: {exc}. '
                            'Check that Tesseract is installed and OCR_LANGUAGE is available.'
                        ) from exc
                    ocr_count += 1
                    if _readable_chars(recognized) > _readable_chars(text):
                        text, method = recognized, 'ocr'
                if _readable_chars(text) < threshold:
                    missing.append(index + 1)

            if text.strip():
                methods.add(method)
            parts.append(text.strip())

        if missing:
            log.warning('PDF pages with insufficient text after extraction: %s', missing)
        if max_ocr and len(missing) and ocr_count >= max_ocr:
            log.warning('OCR page limit (%d) reached; some pages may be incomplete', max_ocr)

        full_text = '\n\n'.join(f'--- Page {i + 1} ---\n{t}' for i, t in enumerate(parts) if t).strip()
        if not full_text:
            raise RuntimeError('No text could be extracted, including OCR fallback')
        if methods == {'ocr'}:
            method = 'ocr'
        elif 'ocr' in methods:
            method = 'hybrid'
        elif 'pdfplumber' in methods:
            method = 'pdfplumber' if methods == {'pdfplumber'} else 'hybrid'
        elif methods == {'pymupdf'}:
            method = 'pymupdf'
        else:
            method = 'none'
        log.info('PDF extraction: %d pages, OCR on %d, method=%s, %d characters', count, ocr_count, method, len(full_text))
        return ExtractionResult(full_text, method, count, bool(ocr_count or missing))
    finally:
        doc.close()
