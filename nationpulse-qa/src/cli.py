"""
cli.py
------
Interactive command-line Q&A over indexed Bills, for quick testing
without standing up the API server.

Usage:
    python src/cli.py --config configs/rag_config.yaml
    or from src/:
    python cli.py
"""

import argparse
import os
import re
import sys

_src_dir = os.path.abspath(os.path.dirname(__file__))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

import yaml

from generator_factory import build_generator
from qa_pipeline import BillQAPipeline
from vector_store import build_vector_store


def find_config(path: str | None = None) -> str:
    if path and os.path.exists(path):
        return os.path.abspath(path)
    candidates = [
        path,
        os.path.join("configs", "rag_config.yaml"),
        os.path.join("..", "configs", "rag_config.yaml"),
        os.path.join(_src_dir, "..", "configs", "rag_config.yaml"),
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return os.path.abspath(c)
    raise FileNotFoundError("Could not find configs/rag_config.yaml")


def load_config(path: str) -> dict:
    resolved_path = find_config(path)
    with open(resolved_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main(config_path: str):
    config = load_config(config_path)
    print("Loading embedding model and vector store...")
    store = build_vector_store(config)
    backend = config["generation"].get("backend", "transformers")
    print(f"Loading generation model (backend: {backend})...")
    generator = build_generator(config)
    pipeline = BillQAPipeline(config, store, generator)

    print(f"\nReady. {store.count()} chunks indexed ({store.backend_name}). Type a question, or 'quit'.")
    print("Tip: prefix a question with 'bill_id: What...' to scope retrieval to one Bill, "
          "e.g. 'LS-2026-153: What is the term length for a Chairperson?'\n")
    while True:
        try:
            raw_input_text = input("Q: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting...")
            break
        if raw_input_text.lower() in {"quit", "exit"}:
            break
        if not raw_input_text:
            continue

        bill_id_filter = None
        question = raw_input_text
        if ":" in raw_input_text:
            possible_id, rest = raw_input_text.split(":", 1)
            possible_id = possible_id.strip()
            if re.match(r"^[A-Z]{2}-\d{4}-[A-Za-z0-9]+$", possible_id):
                bill_id_filter = possible_id
                question = rest.strip()

        result = pipeline.answer(question, bill_id_filter=bill_id_filter)
        print(f"\nA: {result['answer']}\n")
        if result["refined_query"]:
            print(f"(query was refined to: '{result['refined_query']}')")
        scope_note = f", scoped to {bill_id_filter}" if bill_id_filter else ""
        print(f"[{len(result['sources'])} source chunk(s){scope_note}, "
              f"{result['refinement_iterations']} retrieval iteration(s)]\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, default="configs/rag_config.yaml")
    args = parser.parse_args()
    main(args.config)
