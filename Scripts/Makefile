# Run from the repo root (the folder containing apps/, services/, api/, db/).
# One shared venv at the repo root — NOT nested inside api/ — so that
# `make ingest`, `make api`, etc. all resolve to the same Python
# interpreter regardless of which service folder the command actually
# runs in. Built from api/requirements.txt, which is the combined
# manifest for all four backend services.

ROOT  := $(shell pwd)
VENV  := $(ROOT)/.venv
PY    := $(VENV)/bin/python3
PIP   := $(VENV)/bin/pip

.PHONY: venv install migrate configure ingest ingest-rs ingest-ls api web

venv:
	python3 -m venv $(VENV)

install: venv
	$(PIP) install --upgrade pip
	$(PIP) install -r api/requirements.txt

# Usage: make configure DB_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"
configure:
	$(PY) scripts/configure_env.py "$(DB_URL)"

# Usage: DATABASE_URL="postgresql://...supabase..." make migrate
migrate:
	psql "$(DATABASE_URL)" -f db/migrations/001_initial_schema.sql

ingest:
	cd services/ingestion && $(PY) pipeline.py

ingest-rs:
	cd services/ingestion && $(PY) pipeline.py --house rs

ingest-ls:
	cd services/ingestion && $(PY) pipeline.py --house ls

api:
	cd api && $(PY) -m uvicorn main:app --reload --port 8000

web:
	cd apps/web && npm run dev
