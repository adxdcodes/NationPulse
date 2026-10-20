@echo off
setlocal
cd /d "%~dp0"
REM ============================================================
REM  NationPulse Bill Q&A — Interactive CLI
REM  Usage: double-click or run from the project root
REM ============================================================
echo.
echo  NationPulse Bill Q^&A (Gemini + Supabase)
echo  ==========================================
echo  Type your question at the prompt.
echo  Prefix with "LS-2026-XXX: " to scope to one Bill.
echo  Type "quit" to exit.
echo.

call "%~dp0venv\Scripts\activate.bat"
"%~dp0venv\Scripts\python.exe" src\cli.py --config configs\rag_config.yaml
pause

