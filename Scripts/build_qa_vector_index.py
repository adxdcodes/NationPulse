r"""Create the QA HNSW index over a long-lived Supabase session connection.

Run with the repository virtual environment:
    .\.venv\Scripts\python.exe Scripts\build_qa_vector_index.py

Uses psycopg2 already installed for the API. The database password is entered
with getpass and is never written to the project or printed.
"""

from getpass import getpass
from pathlib import Path
import re
import sys

import psycopg2


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "nationpulse-qa" / "supabase_migrations" / "004_vector_search_index.sql"
INDEX_NAME = "idx_qa_bill_chunks_embedding_hnsw"


def main() -> int:
    print("Use the Supabase Database > Connect details for a direct or session-mode connection.")
    print("Use the session pooler host and port 5432 (not transaction mode / port 6543).")
    host = input("Session pooler host: ").strip()
    user = input("Database user (often postgres.<project-ref>): ").strip()
    password = getpass("Database password: ")
    if not host or not user or not password:
        print("Host, user, and password are required.", file=sys.stderr)
        return 2

    conn = None
    try:
        conn = psycopg2.connect(
            host=host,
            port=5432,
            dbname="postgres",
            user=user,
            password=password,
            sslmode="require",
            connect_timeout=20,
            application_name="nationpulse-qa-vector-index",
        )
        # CONCURRENTLY cannot run inside a transaction. Autocommit keeps each
        # migration statement independent while preserving this session's SET.
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                """SELECT phase,
                          round(100.0 * blocks_done / NULLIF(blocks_total, 0), 1)
                      FROM pg_stat_progress_create_index
                     WHERE relid = 'public.qa_bill_chunks'::regclass"""
            )
            active_build = cur.fetchone()
            if active_build:
                phase, percent = active_build
                progress = f" ({percent}% complete)" if percent is not None else ""
                print(f"An index build is already active: {phase}{progress}. Wait for it to finish, then rerun if needed.")
                return 1

            cur.execute(
                """SELECT i.indisvalid
                     FROM pg_index AS i
                    WHERE i.indexrelid = to_regclass(%s)""",
                (f"public.{INDEX_NAME}",),
            )
            index_row = cur.fetchone()
            if index_row and not index_row[0]:
                print("Removing an invalid index left by an earlier cancelled attempt...")
                cur.execute(f"DROP INDEX CONCURRENTLY IF EXISTS public.{INDEX_NAME}")
            elif index_row and index_row[0]:
                print("A valid HNSW index already exists; refreshing table statistics.")
                cur.execute("ANALYZE public.qa_bill_chunks")
                print("Done. The Q&A vector index is ready.")
                return 0

            sql = MIGRATION.read_text(encoding="utf-8")
            # The migration is intentionally simple SQL (no procedural blocks);
            # strip line comments before splitting so comment-only fragments
            # are not passed to psycopg2 as empty queries.
            sql = re.sub(r"--[^\r\n]*", "", sql)
            statements = [part.strip() for part in re.split(r";\s*", sql) if part.strip()]
            print("Building the HNSW index. This can take several minutes; keep this window open.")
            for statement in statements:
                cur.execute(statement)

        print("Done. The Q&A vector index is ready.")
        return 0
    except (psycopg2.Error, OSError) as exc:
        # Do not include the DSN or password in diagnostics.
        print(f"Index setup failed: {exc}", file=sys.stderr)
        print("If the index build was cancelled, rerun this script; it checks for and removes an invalid leftover index.", file=sys.stderr)
        return 1
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
