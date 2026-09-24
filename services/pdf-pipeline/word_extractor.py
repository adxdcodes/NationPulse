"""DOCX direct extraction; legacy DOC conversion to PDF using LibreOffice.
For image-only Word documents, LibreOffice PDF conversion feeds the existing
page-by-page PDF OCR fallback. No Word macros are executed.
"""
import io
import os
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from extractor import extract_text, ExtractionResult

_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def extract_word(data: bytes, kind: str) -> ExtractionResult:
    if kind not in ("doc", "docx"):
        raise ValueError("Unsupported Word format")
    if kind == "docx":
        with ZipFile(io.BytesIO(data)) as archive:
            root = ET.fromstring(archive.read("word/document.xml"))
            paragraphs = []
            for para in root.iter(_NS + "p"):
                text = "".join(n.text or "" for n in para.iter(_NS + "t")).strip()
                if text:
                    paragraphs.append(text)
            text = "\n".join(paragraphs).strip()
            if len(text) >= 20:
                return ExtractionResult(text, "docx", 0, False)
    # Legacy DOC and scanned DOCX: render with LibreOffice and OCR the PDF.
    with tempfile.TemporaryDirectory(prefix="np_word_") as folder:
        source = Path(folder) / ("source." + kind)
        source.write_bytes(data)
        output = Path(folder) / "converted"
        output.mkdir()
        executable = os.getenv("LIBREOFFICE_CMD", "soffice")
        try:
            result = subprocess.run([executable, "-env:UserInstallation=file:///" +
                str(Path(folder) / "lo_profile").replace("\\", "/"),
                "--headless", "--convert-to", "pdf", "--outdir", str(output), str(source)],
                capture_output=True, text=True, timeout=180, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise RuntimeError("Word fallback needs LibreOffice (LIBREOFFICE_CMD): " + str(exc)) from exc
        pdfs = list(output.glob("*.pdf"))
        if result.returncode or not pdfs:
            raise RuntimeError("LibreOffice conversion failed: " + (result.stderr or result.stdout)[-600:])
        extracted = extract_text(pdfs[0].read_bytes())
        extracted.method = "word_to_pdf_" + extracted.method
        return extracted
