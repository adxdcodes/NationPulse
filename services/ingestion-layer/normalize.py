"""Turns one raw sansad.in bill record into the row shape `bills` expects.

Two things the source data does that need handling on the way in:
  - `billIntroducedDate` uses "YYYY-MM-DD HH:MM:SS.f" while `billAssentedDate`
    uses "DD/MM/YYYY" — different formats in the same record.
  - `actNo` (and occasionally other fields) carries trailing whitespace,
    e.g. "49 " — trimmed here so it doesn't create phantom "changes" later.
"""
import hashlib
import json
import re
from datetime import datetime

DOC_FIELD_MAP = {
    "billIntroducedFile": "introduced",
    "billPassedInLSFile": "passed_ls",
    "billPassedInRSFile": "passed_rs",
    "billPassedInBothHousesFile": "passed_both_houses",
    "errataFile": "errata",
    "reportFile": "report",
    "billGazettedFile": "gazetted",
    "billSynopsisFile": "synopsis",
}

_DATE_FORMATS = ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y")


def parse_date(value):
    if not value or not str(value).strip():
        return None
    text = str(value).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None  # unparsed formats surface as NULL rather than crashing the batch


def clean_str(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def normalize_bill(raw: dict) -> dict:
    return {
        "bill_number": clean_str(raw.get("billNumber")) or "",
        "bill_name": clean_str(raw.get("billName")) or "",
        "bill_type": clean_str(raw.get("billType")),
        "bill_category": clean_str(raw.get("billCategory")),
        "ministry_name": clean_str(raw.get("ministryName")),
        "bill_year": raw.get("billYear"),
        "introduced_house": clean_str(raw.get("billIntroducedInHouse")),
        "introduced_by": clean_str(raw.get("billIntroducedBy")),
        "introduced_date": parse_date(raw.get("billIntroducedDate")),
        "passed_ls_date": parse_date(raw.get("billPassedInLSDate")),
        "passed_rs_date": parse_date(raw.get("billPassedInRSDate")),
        "referred_to_committee_date": parse_date(raw.get("referredToCommitteeDate")),
        "report_presented_date": parse_date(raw.get("reportPresentedDate")),
        "act_no": clean_str(raw.get("actNo")),
        "act_year": raw.get("actYear"),
        "assented_date": parse_date(raw.get("billAssentedDate")),
        "status": clean_str(raw.get("status")) or "Unknown",
        "source_raw": json.dumps(raw, sort_keys=True),
    }


def content_hash(raw: dict) -> str:
    return hashlib.sha256(json.dumps(raw, sort_keys=True).encode()).hexdigest()


def extract_documents(raw: dict) -> list[tuple[str, str, str]]:
    """Returns [(doc_type, url, original_filename), ...] for every non-null
    file field on the raw record."""
    docs = []
    for field, doc_type in DOC_FIELD_MAP.items():
        url = raw.get(field)
        if not url:
            continue
        filename = re.sub(r"\?.*$", "", url.rsplit("/", 1)[-1])
        docs.append((doc_type, url, filename))
    return docs
