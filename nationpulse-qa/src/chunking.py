"""
chunking.py
-----------
Splits Bill text into overlapping chunks for embedding and retrieval,
and loads Bill records from the normalized CSV produced by the EDA/
preprocessing pipeline (nationpulse_bills_normalized.csv) plus the
full Bill text (fetched separately from billIntroducedFile PDFs --
see ingest.py).
"""

import re
from dataclasses import dataclass, field


@dataclass
class Chunk:
    chunk_id: str
    bill_id: str
    bill_title: str
    text: str
    chunk_index: int
    metadata: dict = field(default_factory=dict)


def split_into_chunks(
    text: str, chunk_size: int = 800, chunk_overlap: int = 150, min_chunk_size: int = 50
) -> list[str]:
    """Splits text into overlapping chunks, preferring paragraph/sentence
    boundaries over hard character cuts so chunks stay semantically coherent.
    """
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    # Prefer splitting on paragraph breaks, then sentences, then hard cuts.
    paragraphs = re.split(r"(?<=[.;])\s+(?=[A-Z0-9(])", text)

    chunks = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) + 1 <= chunk_size:
            current = f"{current} {para}".strip()
        else:
            if current:
                chunks.append(current)
            # start new chunk, carrying overlap from the end of the previous one
            overlap_text = current[-chunk_overlap:] if current else ""
            current = f"{overlap_text} {para}".strip()
            # If a single paragraph is longer than chunk_size, hard-split it.
            while len(current) > chunk_size:
                chunks.append(current[:chunk_size])
                current = current[chunk_size - chunk_overlap:]
    if current and len(current) >= min_chunk_size:
        chunks.append(current)
    elif current and chunks:
        chunks[-1] = f"{chunks[-1]} {current}".strip()

    return chunks


def chunk_bill(bill_id: str, bill_title: str, bill_text: str, config: dict) -> list[Chunk]:
    """Chunks a single Bill's text into Chunk objects ready for embedding."""
    raw_chunks = split_into_chunks(
        bill_text,
        chunk_size=config["chunking"]["chunk_size"],
        chunk_overlap=config["chunking"]["chunk_overlap"],
        min_chunk_size=config["chunking"]["min_chunk_size"],
    )
    return [
        Chunk(
            chunk_id=f"{bill_id}::chunk{i}",
            bill_id=bill_id,
            bill_title=bill_title,
            text=chunk_text,
            chunk_index=i,
            metadata={"bill_id": bill_id, "bill_title": bill_title, "chunk_index": i},
        )
        for i, chunk_text in enumerate(raw_chunks)
    ]
