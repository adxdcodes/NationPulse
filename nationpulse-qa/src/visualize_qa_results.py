"""
visualize_qa_results.py
------------------------
Turns evaluate_qa.py's output CSV into publication-ready charts for
the paper's Results section, matching the visual style LegalRAG [b13]
uses in its own paper (per-question/per-domain bar charts, human
evaluation score interpretation).

Usage:
    python visualize_qa_results.py --results ../outputs/qa_eval_results.csv

Produces (in ../outputs/plots/):
    cosine_similarity_per_question.png
    human_rating_per_question.png       (only if human_rating column present)
    cosine_similarity_distribution.png
    mean_similarity_by_bill.png
    summary_table.png                    (mean/std as a compact image, for slides)
"""

import argparse
import os
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

sns.set_theme(style="whitegrid")
plt.rcParams["figure.dpi"] = 120


def shorten(text: str, width: int = 45) -> str:
    text = str(text)
    return text if len(text) <= width else text[: width - 3] + "..."


def plot_per_question_bar(df: pd.DataFrame, column: str, title: str, xlabel: str,
                            out_path: str, xlim: tuple[float, float] | None = None):
    df_sorted = df.sort_values(column)
    labels = [f"Q{i+1}: {shorten(q)}" for i, q in zip(df_sorted.index, df_sorted["question"])]

    plt.figure(figsize=(9, max(3, 0.45 * len(df_sorted))))
    colors = sns.color_palette("RdYlGn", n_colors=len(df_sorted))
    order = df_sorted[column].rank(method="first").astype(int) - 1
    bar_colors = [colors[i] for i in order]

    plt.barh(labels, df_sorted[column], color=bar_colors)
    plt.xlabel(xlabel)
    plt.title(title)
    if xlim:
        plt.xlim(*xlim)
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def plot_distribution(df: pd.DataFrame, column: str, title: str, xlabel: str, out_path: str):
    plt.figure(figsize=(7, 5))
    sns.histplot(df[column], bins=10, kde=True, color="#4C72B0")
    plt.axvline(df[column].mean(), color="red", linestyle="--",
                label=f"mean = {df[column].mean():.3f}")
    plt.xlabel(xlabel)
    plt.ylabel("Number of questions")
    plt.title(title)
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def plot_mean_by_bill(df: pd.DataFrame, out_path: str):
    if "bill_id" not in df.columns or df["bill_id"].isna().all():
        return
    grouped = df.groupby("bill_id")["cosine_similarity"].agg(["mean", "std", "count"]).reset_index()
    grouped = grouped.sort_values("mean")

    plt.figure(figsize=(8, max(3, 0.5 * len(grouped))))
    plt.barh(grouped["bill_id"], grouped["mean"], xerr=grouped["std"].fillna(0),
              color=sns.color_palette("crest", n_colors=len(grouped)))
    plt.xlabel("Mean cosine similarity")
    plt.title("Mean Cosine Similarity by Bill (± std)")
    plt.xlim(0, 1)
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def plot_summary_table(df: pd.DataFrame, out_path: str, has_human: bool):
    rows = [
        ["n (questions)", str(len(df))],
        ["Mean cosine similarity", f"{df['cosine_similarity'].mean():.3f}"],
        ["Std cosine similarity", f"{df['cosine_similarity'].std():.3f}"],
        ["Min / Max similarity", f"{df['cosine_similarity'].min():.3f} / {df['cosine_similarity'].max():.3f}"],
    ]
    if has_human:
        rows.append(["Mean human rating (/5)", f"{df['human_rating'].mean():.2f}"])
        rows.append(["Median human rating (/5)", f"{df['human_rating'].median():.1f}"])

    fig, ax = plt.subplots(figsize=(6, 0.5 * len(rows) + 1))
    ax.axis("off")
    table = ax.table(cellText=rows, colLabels=["Metric", "Value"],
                      cellLoc="left", colLoc="left", loc="center")
    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1, 1.8)
    for (r, c), cell in table.get_celld().items():
        if r == 0:
            cell.set_text_props(weight="bold")
            cell.set_facecolor("#4C72B0")
            cell.set_text_props(color="white", weight="bold")
    plt.title("NationPulse Bill Q&A — Evaluation Summary", pad=20)
    plt.tight_layout()
    plt.savefig(out_path, bbox_inches="tight")
    plt.close()


_src_dir = os.path.abspath(os.path.dirname(__file__))


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--results", type=str, default="outputs/qa_eval_results.csv")
    parser.add_argument("--out-dir", type=str, default="outputs/plots")
    args = parser.parse_args()

    results_file = find_path(args.results)
    if not os.path.exists(results_file):
        # Also check ../outputs/qa_eval_results.csv
        alt = os.path.join(_src_dir, "..", "outputs", "qa_eval_results.csv")
        if os.path.exists(alt):
            results_file = alt

    out_dir = args.out_dir
    if not os.path.isabs(out_dir):
        if os.path.exists(os.path.join(_src_dir, "..", "outputs")):
            out_dir = os.path.join(_src_dir, "..", out_dir)
        out_dir = os.path.abspath(out_dir)

    os.makedirs(out_dir, exist_ok=True)
    df = pd.read_csv(results_file)
    has_human = "human_rating" in df.columns and df["human_rating"].notna().any()

    plot_per_question_bar(
        df, "cosine_similarity",
        "Cosine Similarity to Reference Answer, per Question",
        "Cosine similarity", os.path.join(args.out_dir, "cosine_similarity_per_question.png"),
        xlim=(0, 1),
    )
    print("Wrote cosine_similarity_per_question.png")

    if has_human:
        plot_per_question_bar(
            df, "human_rating",
            "Human Evaluation Rating, per Question (1-5 scale)",
            "Human rating", os.path.join(args.out_dir, "human_rating_per_question.png"),
            xlim=(0, 5),
        )
        print("Wrote human_rating_per_question.png")

    plot_distribution(
        df, "cosine_similarity",
        "Distribution of Cosine Similarity Scores",
        "Cosine similarity", os.path.join(args.out_dir, "cosine_similarity_distribution.png"),
    )
    print("Wrote cosine_similarity_distribution.png")

    plot_mean_by_bill(df, os.path.join(args.out_dir, "mean_similarity_by_bill.png"))
    print("Wrote mean_similarity_by_bill.png (if bill_id column was present)")

    plot_summary_table(df, os.path.join(args.out_dir, "summary_table.png"), has_human)
    print("Wrote summary_table.png")

    print(f"\nAll charts written to {args.out_dir}/")


if __name__ == "__main__":
    main()
