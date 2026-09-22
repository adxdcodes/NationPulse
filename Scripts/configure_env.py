#!/usr/bin/env python3
"""Writes DATABASE_URL (and, for ingestion, the sibling-service paths) into
every service's .env file from a single source, so a Supabase connection
string only ever gets typed once.

Usage:
    python3 scripts/configure_env.py "postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"

Run from the repo root (the folder containing services/, api/, apps/).
Creates each .env from .env.example on first run; on later runs, updates
only the DATABASE_URL line (and the two path vars for ingestion) and
leaves every other setting — API keys, JWT secret, etc. — untouched.
"""
import re
import sys
from pathlib import Path

SERVICES = ["services/ingestion", "services/pdf-pipeline", "services/ai-pipeline", "api"]


def set_env_var(env_path: Path, key: str, value: str):
    lines = env_path.read_text().splitlines() if env_path.exists() else []
    pattern = re.compile(rf"^{re.escape(key)}=.*$")
    found = False
    for i, line in enumerate(lines):
        if pattern.match(line):
            lines[i] = f"{key}={value}"
            found = True
            break
    if not found:
        lines.append(f"{key}={value}")
    env_path.write_text("\n".join(lines) + "\n")


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/configure_env.py <DATABASE_URL>")
        sys.exit(1)

    db_url = sys.argv[1]
    root = Path(__file__).resolve().parent.parent

    for service in SERVICES:
        service_dir = root / service
        if not service_dir.is_dir():
            print(f"  skip  {service}/  (folder not found — check your layout matches the README)")
            continue

        env_path = service_dir / ".env"
        example_path = service_dir / ".env.example"
        if not env_path.exists() and example_path.exists():
            env_path.write_text(example_path.read_text())
            print(f"  new   {service}/.env  (created from .env.example)")

        set_env_var(env_path, "DATABASE_URL", db_url)
        print(f"  set   {service}/.env  DATABASE_URL")

    # Ingestion needs to know where its sibling services live on THIS
    # machine to chain into them — compute absolute paths instead of
    # leaving the relative-path defaults, which only work if you happen
    # to run ingestion from inside its own folder.
    ingestion_env = root / "services/ingestion/.env"
    if ingestion_env.exists():
        set_env_var(ingestion_env, "PDF_PIPELINE_DIR", str(root / "services/pdf-pipeline"))
        set_env_var(ingestion_env, "AI_PIPELINE_DIR", str(root / "services/ai-pipeline"))
        print("  set   services/ingestion/.env  PDF_PIPELINE_DIR, AI_PIPELINE_DIR (absolute paths)")

    print("\nDone. Every service now points at the same database.")
    print("Still manual, on purpose: AI provider keys (api-pipeline/.env) and JWT_SECRET (api/.env) —")
    print("those aren't shared secrets the same way a DB URL is, so this script won't touch them.")


if __name__ == "__main__":
    main()
