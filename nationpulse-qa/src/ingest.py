"""
ingest.py
---------
Loads Bill records (bill_id, bill_title, bill_text) from a CSV, chunks
each Bill's text, and indexes the chunks into the Supabase pgvector
vector store for retrieval by qa_pipeline.py.

Expected input CSV columns: bill_id, bill_title, bill_text
(bill_text is the full extracted text of the Bill -- see the note in
README.md about fetching this from billIntroducedFile PDFs, since the
normalized Lok Sabha / Rajya Sabha CSVs only contain metadata, not text.)

Usage:
    python src/ingest.py --config configs/rag_config.yaml --csv data/sample_bill_texts.csv
    or from src/:
    python ingest.py --csv ../data/sample_bill_texts.csv
"""

import argparse
import os
import sys

_src_dir = os.path.abspath(os.path.dirname(__file__))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

import pandas as pd
import yaml

from chunking import chunk_bill
from vector_store import build_vector_store


def find_path(path: str) -> str:
    if os.path.exists(path):
        return os.path.abspath(path)
    candidates = [
        path,
        os.path.join(_src_dir, path),
        os.path.join(_src_dir, "..", path),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return path


def load_config(path: str) -> dict:
    resolved = find_path(path)
    with open(resolved, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main(config_path: str, csv_path: str):
    config = load_config(config_path)
    resolved_csv = find_path(csv_path)
    df = pd.read_csv(resolved_csv)

    required = {"bill_id", "bill_title", "bill_text"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Input CSV is missing required columns: {missing}")

    dupe_mask = df["bill_id"].duplicated(keep=False)
    if dupe_mask.any():
        dupe_ids = df.loc[dupe_mask, "bill_id"].unique()
        raise ValueError(
            f"Refusing to ingest: {len(dupe_ids)} bill_id(s) appear more than once "
            f"in {csv_path} (e.g. {list(dupe_ids[:5])}). Chunk IDs are derived from "
            f"bill_id, so duplicates will silently overwrite each other's chunks in "
            f"the vector store, corrupting the index. Deduplicate the input CSV "
            f"first."
        )

    store = build_vector_store(config)
    print(f"Ingesting into vector backend: {store.backend_name}")

    total_chunks = 0
    for _, row in df.iterrows():
        text = str(row.get("bill_text", "")).strip()
        if not text or text.lower() == "nan":
            continue
        chunks = chunk_bill(row["bill_id"], row["bill_title"], text, config)
        if not chunks:
            continue
        store.add_chunks(chunks)
        total_chunks += len(chunks)
        print(f"Indexed {row['bill_id']} ({row['bill_title'][:60]}...): {len(chunks)} chunks")

    print(f"\nDone. Indexed {total_chunks} chunks from {len(df)} Bill records "
          f"into '{store.backend_name}'.")
    print(f"Vector store now holds {store.count()} total chunks.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, default="configs/rag_config.yaml")
    parser.add_argument("--csv", type=str, required=True)
    args = parser.parse_args()
    main(args.config, args.csv)
