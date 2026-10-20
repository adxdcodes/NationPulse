# NationPulse — Bill Q&A System (RAG + Gemini)

A Retrieval-Augmented Generation (RAG) pipeline that lets citizens ask
natural-language questions about Indian Parliamentary Bills and get an
answer grounded in the Bill's actual text, with source attribution.

Built using:
- **Embeddings**: `BAAI/bge-small-en-v1.5` (runs on CPU, ~90 MB)
- **Vector store**: Supabase pgvector (cloud PostgreSQL vector database)
- **LLM**: Gemini API (`gemini-3.5-flash-lite` by default, with automatic fallback)
- **Retrieval**: Dense search + Maximal Marginal Relevance (MMR) re-ranking
- **Query refinement**: LegalRAG-style relevance check loop

**Benchmark result** (14-question test set, 6 Bills, Gemini backend):
`cosine similarity mean = 0.855 ± 0.059`

---

## Quick start (5 minutes)

### 1. Install dependencies

Before running the QA module, configure the single `.env` file in the repository root as described in [`../README_ENV.md`](../README_ENV.md).

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Set your Gemini API key

Get a free key at https://aistudio.google.com/apikey, then either:

**Option A — the repository-root `.env` file (recommended):**
```
GEMINI_API_KEY="your-key-here"
```

**Option B — environment variable:**
```powershell
$env:GEMINI_API_KEY = "your-key-here"
```

### 3. Ingest Bill text

```powershell
# 50 Lok Sabha bills (synced to Supabase pgvector)
python src/ingest.py --csv data/lok_sabha_texts.csv

# Re-ingest from scratch at any time (safe — chunks are upserted by ID)
python src/ingest.py --csv data/sample_bill_texts.csv
```

### 4. Ask questions

**Interactive CLI:**
```powershell
python src/cli.py
```
```
Q: Is there a deadline for adapting existing state laws after the Kerala name change?
A: Yes... one year from the appointed day.

Q: LS-2026-153: What is the term length for a Chairperson?
# prefix bill_id to scope retrieval to a single Bill
```

**API server:**
```powershell
.\venv\Scripts\uvicorn.exe src.api:app --host 0.0.0.0 --port 8000 --reload
# or from src/:
cd src
..\venv\Scripts\uvicorn.exe api:app --port 8000
```

```powershell
# Health check
curl http://localhost:8000/api/bills/qa/health

# Ask a question
curl -X POST http://localhost:8000/api/bills/qa `
  -H "Content-Type: application/json" `
  -d '{"question": "What does the Tribunals Reforms Bill say about the National Tribunals Commission?"}'

# Scope to one bill
curl -X POST http://localhost:8000/api/bills/qa `
  -H "Content-Type: application/json" `
  -d '{"question": "How many new judges?", "bill_id": "LS-2026-128"}'
```

**API response format:**
```json
{
  "question": "...",
  "answer": "...\n\nSources: THE TRIBUNALS REFORMS BILL, 2026",
  "refined_query": null,
  "refinement_iterations": 1,
  "interaction_id": "7f8b9a2c-1234-5678-90ab-cdef12345678",
  "sources": [
    {"bill_id": "LS-2026-153", "bill_title": "...", "chunk_index": 2, "excerpt": "..."}
  ]
}
```

---

## Supabase Realtime Database Integration

NationPulse integrates with **Supabase** for real-time synchronization with the React client:
- **`qa_bills`**: QA-owned bill metadata, isolated from the main application `bills` table.
- **`qa_interactions`**: Persists citizen queries, answers, and citations with Supabase Realtime enabled for live feeds.
- **`qa_bill_discussions`**: Real-time citizen discussions and comments.

### 1. Set up the schema in Supabase
Run the provided SQL file in the **Supabase Dashboard -> SQL Editor**:
- `supabase_migrations/schema.sql`

### 2. Configure credentials in the repository-root `.env`
```env
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_SERVICE_KEY="your-service-role-key"   # used by backend for sync & persistence
SUPABASE_KEY="your-anon-key"
```

### 3. Sync bill metadata into Supabase
```powershell
# Sync all Lok Sabha bills into Supabase:
python src/sync_to_supabase.py --bills-csv data/raw/lok_sabha_bills.csv
```

### 3b. Vector store in Supabase (pgvector)
In the same Supabase project, run `supabase_migrations/schema.sql`, `supabase_migrations/002_pgvector_rag.sql`, and `supabase_migrations/003_service_role_privileges.sql` in the SQL Editor, in that order. The third migration grants the API's `service_role` the required access to QA tables and RPCs. These migrations create only QA-prefixed objects (`qa_bills`, `qa_interactions`, `qa_bill_discussions`, `qa_bill_chunks`, `qa_match_bill_chunks()`, and `qa_list_indexed_bills()`). They do not alter the main `bills` table or the main application RPC functions. The vector store also accepts the deployed unprefixed RPC aliases `match_bill_chunks()` and `list_indexed_bills()` for compatibility with databases that renamed the RPCs while retaining the QA tables.

For the 100k-row vector table, build the HNSW index using `supabase_migrations/004_vector_search_index.sql` through `psql` over a direct or Supavisor **session-mode** connection (port 5432), not the Dashboard SQL Editor. Dashboard queries have a 60-second limit, while this index build can take longer. The migration uses `CREATE INDEX CONCURRENTLY`, so do not run it inside a transaction. If a concurrent build was cancelled, inspect the index's `pg_index.indisvalid` value and drop it with `DROP INDEX CONCURRENTLY IF EXISTS public.idx_qa_bill_chunks_embedding_hnsw;` before retrying if it is invalid.

If `psql` is not installed, use the repository's Python runner instead: from the project root run `.\.venv\Scripts\python.exe Scripts\build_qa_vector_index.py`. Enter the **session-mode** pooler host and database user from Supabase Database → Connect; the runner asks for the password without displaying or saving it.
All chunks and embeddings are stored and searched directly in Supabase pgvector. QA ingestion and Q&A history use QA-owned tables; the QA `qa_bills` metadata table is intentionally separate from the main application `bills` table.

### 4. Supabase Endpoints in FastAPI
- `POST /api/bills/qa` — Answers question and saves interaction to Supabase.
- `GET /api/bills/qa/history` — Returns recent citizen Q&A history.
- `POST /api/bills/qa/{interaction_id}/feedback` — Submits citizen feedback (+1 or -1).
- `GET /api/bills` — Lists parliamentary bills.
- `GET /api/bills/qa/health` — Checks Supabase connectivity status and indexed chunk count.

---

## Project layout

```
nationpulse-qa/
├── ../.env                     # shared root environment file (never commit)
├── .gitignore
├── requirements.txt
├── configs/
│   └── rag_config.yaml         # All tuneable parameters (model, retrieval, chunking)
├── data/
│   ├── sample_bill_texts.csv   # 6 real Bills (pre-ingested)
│   ├── lok_sabha_texts.csv     # 50 Lok Sabha Bills (pre-ingested)
│   ├── qa_test_set.csv         # 14-question benchmark test set
│   └── raw/                    # Raw CSVs from sansad.in
├── src/
│   ├── gemini_generator.py     # Gemini API backend (auto key discovery + fallback)
│   ├── vector_store.py          # BGE embeddings + Supabase pgvector + MMR retrieval
│   ├── qa_pipeline.py            # Retrieve → relevance check → generate
│   ├── chunking.py               # Overlapping chunk splitter
│   ├── ingest.py                 # CLI: chunk & index Bills to Supabase
│   ├── cli.py                    # CLI: interactive Q&A
│   ├── api.py                    # FastAPI service (POST /api/bills/qa)
│   ├── evaluate_qa.py            # Cosine similarity + human eval benchmark
│   ├── visualize_qa_results.py   # Plots for the paper
│   ├── generator.py              # (fallback) local transformers backend
│   ├── ollama_generator.py       # (fallback) local Ollama backend
│   ├── generator_factory.py      # Backend selector
│   └── fetch_bill_texts.py       # Download & extract PDF text from sansad.in
├── outputs/
│   ├── qa_eval_results.csv       # Benchmark results (auto-generated)
│   └── plots/                    # Charts (auto-generated by visualize_qa_results.py)
├── supabase_migrations/          # Database schema & pgvector functions
└── tests/
    ├── test_gemini_generator.py   # Generator fallback tests
    └── test_qa_pipeline.py        # Pipeline accuracy + title matching tests
```

---

## Configuration (`configs/rag_config.yaml`)

Key settings you may want to change:

| Setting | Default | Notes |
|---|---|---|
| `generation.backend` | `gemini` | `gemini` / `ollama` / `transformers` |
| `generation.gemini_model` | `gemini-3.5-flash-lite` | First tried; falls back through newer models automatically |
| `generation.temperature` | `0.1` | Low = factual; raise for more creative answers |
| `generation.max_new_tokens` | `300` | Max answer length |
| `retrieval.top_k` | `5` | Chunks fed to the LLM per question |
| `retrieval.use_mmr` | `true` | MMR diversity re-ranking |
| `relevance_check.enabled` | `true` | LegalRAG query refinement loop |
| `relevance_check.max_refinement_iters` | `2` | Max retry loops (cuts API calls) |
| `embedding.model_name` | `BAAI/bge-small-en-v1.5` | CPU-friendly, strong English retrieval |

---

## Ingest your full dataset

To add more bills:

```powershell
# Download PDFs from sansad.in and extract text
cd src
python fetch_bill_texts.py `
    --input ..\data\raw\lok_sabha_bills.csv `
    --output ..\data\all_bill_texts.csv `
    --url-column billIntroducedFile `
    --title-column billName `
    --house-column source_house `
    --year-column billYear `
    --number-column billNumber `
    --limit 20   # remove for full run

# Ingest extracted text directly into Supabase pgvector
python ingest.py --csv ..\data\all_bill_texts.csv
```

---

## Evaluate for the paper

```powershell
# Semantic similarity only (fast, no manual work)
python src/evaluate_qa.py --test-csv data/qa_test_set.csv

# With human rating (interactive)
python src/evaluate_qa.py --test-csv data/qa_test_set.csv --human-eval

# Generate charts
python src/visualize_qa_results.py
```

Outputs to `outputs/qa_eval_results.csv` and `outputs/plots/`.

Current benchmark (Gemini backend, 14 questions, 6 Bills):
- **Cosine similarity: mean = 0.855, std = 0.059**

---

## Switch generation backend

**Gemini** (default, recommended — no GPU, highest accuracy):
```yaml
generation:
  backend: "gemini"
  gemini_model: "gemini-3.5-flash-lite"  # auto-falls-back to newer models
```
Set `GEMINI_API_KEY` in the repository-root `.env` or as an environment variable.

**Ollama** (local, no API cost):
```yaml
generation:
  backend: "ollama"
  ollama_model: "qwen2.5:3b-instruct"
```
Install Ollama from https://ollama.com/download, then `ollama pull qwen2.5:3b-instruct`.

**Transformers** (local, most control):
```yaml
generation:
  backend: "transformers"
  model_name: "Qwen/Qwen2.5-1.5B-Instruct"
  device: "cpu"
```

---

## How it works

1. **Ingest**: Bills are split into 800-char overlapping chunks, embedded with `bge-small-en-v1.5`, and stored in Supabase (`qa_bill_chunks` table).
2. **Retrieve**: Query is embedded, cosine-searched against Supabase pgvector (`qa_match_bill_chunks` RPC), then MMR re-ranked for diversity (`top_k=5` from a pool of 15).
3. **Relevance check**: (LegalRAG-style) Gemini checks if the retrieved chunks answer the question. If not, the query is rewritten and retrieval retried (up to 2 times).
4. **Generate**: Gemini produces a grounded answer from only the retrieved excerpts, with strict instructions not to hallucinate or blend facts across Bills.
5. **Source attribution**: Sources are appended deterministically from the chunk metadata (not generated by the LLM).

---

## Run tests

```powershell
python -m unittest discover -s tests
```

5 tests covering: Gemini fallback (503/timeout), pipeline scoping, relevance check resilience, and title matching accuracy.
