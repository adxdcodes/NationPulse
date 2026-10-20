#!/usr/bin/env python3
"""Validate the unified root .env configuration.

Run from any directory: python Scripts/configure_env.py
Create the root .env from .env.example first, then edit that single file.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env"
EXAMPLE = ROOT / ".env.example"

def main():
    if not ENV.exists():
        print("Root .env was not found.")
        if EXAMPLE.exists():
            print("Create it with: copy .env.example .env  (Windows)")
            print("            or: cp .env.example .env     (macOS/Linux)")
        sys.exit(1)
    required = ["DATABASE_URL", "JWT_SECRET"]
    values = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip('"\'')
    missing = [k for k in required if not values.get(k) or values[k].startswith("change-this")]
    if missing:
        print("Please configure these values in the root .env: " + ", ".join(missing))
        sys.exit(1)
    print(f"Unified environment file found: {ENV}")
    print("Python services and Vite are configured to read this root .env.")
    print("Ensure service-role keys and JWT_SECRET are never committed or shared.")

if __name__ == "__main__":
    main()
