"""
evaluate_qa.py
--------------
Evaluates the NationPulse Bill Q&A system against a labeled test set of
(question, reference_answer) pairs, using the two-part methodology
described in the paper's Section V-D/E (RAG-Based Question Answering
Evaluation) and matching LegalRAG's [b13] own evaluation approach:

  1. Semantic similarity: cosine similarity between the generated
     answer's embedding and the reference answer's embedding (mean +
     std, exactly as reported in LegalRAG's Table IV).
  2. Human evaluation: a 1-5 correctness/quality rating per answer,
     collected interactively (matching the paper's human-evaluation
     rubric — see HUMAN_RATING_GUIDE below).

Produces the numbers to fill in your paper's Results section and
Table for the Q&A module, plus a per-question CSV you can include as
supplementary material.

Usage:
    python evaluate_qa.py --config ../configs/rag_config.yaml \
        --test-csv ../data/qa_test_set.csv --human-eval
"""

import argparse
import os
import sys

_src_dir = os.path.abspath(os.path.dirname(__file__))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

import numpy as np
import pandas as pd
import yaml
from sentence_transformers import SentenceTransformer

from generator_factory import build_generator
from qa_pipeline import BillQAPipeline
from vector_store import build_vector_store

HUMAN_RATING_GUIDE = """
Rate each answer 1-5 based on correctness and quality (same rubric used
by LegalRAG, your [b13] citation):
  1 - Incorrect and very poor quality
  2 - Mostly incorrect and poor quality
  3 - Partially correct and average quality
  4 - Mostly correct and good quality
  5 - Fully correct and excellent quality
"""


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


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))


def run_human_eval(question, generated, reference) -> int:
    print("\n" + "=" * 70)
    print(f"Q: {question}")
    print(f"\nREFERENCE (ground truth):\n{reference}")
    print(f"\nGENERATED (system output):\n{generated}")
    print(HUMAN_RATING_GUIDE)
    while True:
        raw = input("Your rating (1-5): ").strip()
        if raw in {"1", "2", "3", "4", "5"}:
            return int(raw)
        print("Please enter a number from 1 to 5.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, default="../configs/rag_config.yaml")
    parser.add_argument("--test-csv", type=str, required=True,
                         help="CSV with columns: question, reference_answer, "
                              "and optionally bill_id (to scope retrieval)")
    parser.add_argument("--output", type=str, default="../outputs/qa_eval_results.csv")
    parser.add_argument("--human-eval", action="store_true",
                         help="Also collect a 1-5 human rating per answer interactively")
    args = parser.parse_args()

    config = load_config(args.config)
    test_csv_path = find_path(args.test_csv)
    test_df = pd.read_csv(test_csv_path)

    required_cols = {"question", "reference_answer"}
    missing = required_cols - set(test_df.columns)
    if missing:
        raise ValueError(f"Test CSV is missing required columns: {missing}")

    print("Loading embedding model, vector store, and generator...")
    store = build_vector_store(config)
    generator = build_generator(config)
    pipeline = BillQAPipeline(config, store, generator)

    # Separate embedding model for scoring similarity — same model as
    # retrieval uses, so scores are in the same space as the paper reports.
    scorer_model = SentenceTransformer(
        config["embedding"]["model_name"], device=config["embedding"]["device"]
    )

    results = []
    for i, row in test_df.iterrows():
        question = row["question"]
        reference = row["reference_answer"]
        bill_id = row.get("bill_id") if "bill_id" in test_df.columns and pd.notna(row.get("bill_id")) else None

        print(f"\n[{i+1}/{len(test_df)}] {question}")
        result = pipeline.answer(question, bill_id_filter=bill_id)
        generated = result["answer"]

        gen_emb = scorer_model.encode(generated, normalize_embeddings=True)
        ref_emb = scorer_model.encode(reference, normalize_embeddings=True)
        sim = cosine_similarity(gen_emb, ref_emb)

        row_result = {
            "question": question,
            "bill_id": bill_id,
            "reference_answer": reference,
            "generated_answer": generated,
            "cosine_similarity": round(sim, 4),
            "num_sources": len(result["sources"]),
            "refinement_iterations": result["refinement_iterations"],
        }


        if args.human_eval:
            row_result["human_rating"] = run_human_eval(question, generated, reference)

        results.append(row_result)

    results_df = pd.DataFrame(results)
    results_df.to_csv(args.output, index=False)

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"n = {len(results_df)} questions")
    print(f"Cosine similarity: mean={results_df['cosine_similarity'].mean():.3f}, "
          f"std={results_df['cosine_similarity'].std():.3f}")
    if args.human_eval:
        print(f"Human rating (out of 5): mean={results_df['human_rating'].mean():.2f}")
        print(f"Human rating distribution:\n{results_df['human_rating'].value_counts().sort_index()}")
    print(f"\nFull per-question results written to {args.output}")
    print("\nUse the mean cosine similarity (± std) and mean human rating directly "
          "in your paper's Table IV-equivalent for RAG-Based Question Answering "
          "Results, matching the format LegalRAG [b13] uses.")


if __name__ == "__main__":
    main()
