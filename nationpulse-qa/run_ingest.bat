@echo off
REM ============================================================
REM  NationPulse — Ingest Bills into the Vector Store
REM  Usage: run_ingest.bat [csv_path]
REM  Default CSV: data\lok_sabha_texts.csv
REM ============================================================
echo.
echo  NationPulse Bill Ingestion
echo  ===========================

set CSV=%1
if "%CSV%"=="" set CSV=data\lok_sabha_texts.csv

echo  Ingesting: %CSV%
echo.

call "%~dp0venv\Scripts\activate.bat"
"%~dp0venv\Scripts\python.exe" src\ingest.py --config configs\rag_config.yaml --csv %CSV%
pause
