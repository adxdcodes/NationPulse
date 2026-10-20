@echo off
setlocal
cd /d "%~dp0"
REM ============================================================
REM  NationPulse Bill Q&A (RAG) - FastAPI Server
REM  Runs on port 8001 (main NationPulse API uses 8000)
REM ============================================================
echo.
echo  NationPulse Bill Q^&A API Server
echo  ==================================
echo  Starting at http://localhost:8001
echo  API docs: http://localhost:8001/docs
echo  Health:   http://localhost:8001/api/bills/qa/health
echo.
echo  Press Ctrl+C to stop the server.
echo.

call "%~dp0venv\Scripts\activate.bat"
set PYTHONPATH=%~dp0src
"%~dp0venv\Scripts\python.exe" -m uvicorn src.api:app --host 0.0.0.0 --port 8001 --reload
pause
