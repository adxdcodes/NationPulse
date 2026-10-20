# NationPulse: one environment file

NationPulse is configured through a single `.env` file at the repository root.

## Setup

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
notepad .env
```

**macOS/Linux:**
```bash
cp .env.example .env
${EDITOR:-nano} .env
```

Fill in the credentials and settings you actually use. The root `.env` is ignored by Git; do not commit or share it. Python services load it by absolute path, and Vite is configured to read the `VITE_*` values from the same file. Operating-system environment variables take precedence over values in `.env`.

## Shared settings

- `DATABASE_URL` is shared by the main API, ingestion, PDF and AI pipelines.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `SUPABASE_KEY` are used by the QA module. Use the service-role key only on the backend; never expose it through a `VITE_*` variable.
- `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, and `GEMINI_API_KEY_3` are rotated in order by the AI summarization pipeline for each Gemini API request. `GEMINI_API_KEY` remains available as a single-key fallback and for services that have not been updated to use rotation.
- `JWT_SECRET` must be changed to a long, random secret before deployment.
- `VITE_API_URL`, `VITE_QA_API_URL`, and `VITE_GOOGLE_CLIENT_ID` are frontend settings. Only variables prefixed with `VITE_` are exposed to the browser.

Settings whose defaults differ by service use service-specific names, such as `AI_REQUEST_TIMEOUT_SECONDS`, `INGESTION_REQUEST_TIMEOUT_SECONDS`, and `PDF_REQUEST_TIMEOUT_SECONDS`, so they can coexist in one file without duplicate keys.

Run `python Scripts/configure_env.py` to check that the root `.env` exists and required values are configured.
