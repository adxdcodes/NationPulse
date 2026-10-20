"""
ollama_generator.py
--------------------
Alternative to generator.py's LLMGenerator, backed by a local Ollama
server instead of loading the model directly through `transformers`.

Why: raw `transformers` inference on CPU (or a small/no GPU) is slow —
often a few tokens/second for a 1.5B-3B model, meaning a several
-hundred-token answer can take a minute or more. Ollama runs the same
kind of model quantized (GGUF) via llama.cpp, which is typically 5-10x
faster for the same model size on the same hardware.

Setup (one-time, outside this project):
    1. Install Ollama: https://ollama.com/download (Windows/Mac/Linux)
    2. Pull a model, e.g.:  ollama pull qwen2.5:1.5b-instruct
    3. Ollama runs a local server automatically at http://localhost:11434

This class implements the exact same `.chat(system_prompt, user_prompt,
max_new_tokens=None) -> str` interface as generator.LLMGenerator, so
qa_pipeline.py, cli.py, and api.py don't need to change — only which
generator class gets constructed (see build_generator() below).
"""

import requests


class OllamaGenerator:
    def __init__(self, config: dict):
        gen_cfg = config["generation"]
        self.base_url = gen_cfg.get("ollama_host", "http://localhost:11434").rstrip("/")
        self.model_name = gen_cfg["ollama_model"]
        self.temperature = gen_cfg["temperature"]
        self.top_p = gen_cfg["top_p"]
        self.max_new_tokens = gen_cfg["max_new_tokens"]

        self._check_server()

    def _check_server(self):
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=5)
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            if not any(self.model_name in m for m in models):
                print(
                    f"[ollama_generator] Warning: '{self.model_name}' not found in "
                    f"Ollama's local models ({models}). Run: ollama pull {self.model_name}"
                )
        except requests.exceptions.ConnectionError:
            raise RuntimeError(
                f"Could not reach Ollama at {self.base_url}. Is Ollama running? "
                f"Install it from https://ollama.com/download, then run "
                f"'ollama pull {self.model_name}' — Ollama starts its server "
                f"automatically after install."
            )

    def chat(self, system_prompt: str, user_prompt: str, max_new_tokens: int | None = None) -> str:
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {
                "temperature": self.temperature,
                "top_p": self.top_p,
                "num_predict": max_new_tokens or self.max_new_tokens,
            },
        }
        resp = requests.post(f"{self.base_url}/api/chat", json=payload, timeout=180)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"].strip()
