@echo off
REM ============================================================
REM  Start the complete NationPulse stack (3 windows):
REM    Main API   -> http://localhost:8000
REM    QA / RAG   -> http://localhost:8001   (Pulse AI chatbot)
REM    Web (Vite) -> http://localhost:5173
REM  Run from the repo root. Main API expects .venv at the repo root;
REM  the QA service uses nationpulse-qa\venv (see run_api.bat).
REM ============================================================
cd /d "%~dp0"
start "NationPulse API" cmd /k "cd /d %~dp0api && %~dp0.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"
start "NationPulse QA (Pulse AI)" cmd /k "%~dp0nationpulse-qa\run_api.bat"
start "NationPulse Web" cmd /k "cd /d %~dp0apps\web && npm run dev"
