"""Shared interface every provider implements, so pipeline.py never has to
know which API it's actually talking to."""
import time
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass


class ProviderError(Exception):
    """Raised for anything that went wrong talking to the model — network
    errors, non-2xx responses, or output that doesn't parse as JSON."""


@dataclass
class ProviderResult:
    parsed: dict
    raw_response: dict
    model: str
    provider: str
    latency_ms: int


class AIProvider(ABC):
    name: str

    @abstractmethod
    def _call(self, system_prompt: str, user_prompt: str, schema: dict) -> tuple[dict, dict]:
        """Provider-specific API call. Returns (parsed_json_dict, raw_response_dict).
        Raises ProviderError on any failure (network, HTTP status, unparsable output)."""

    def generate(self, system_prompt: str, user_prompt: str, schema: dict) -> ProviderResult:
        start = time.monotonic()
        parsed, raw = self._call(system_prompt, user_prompt, schema)
        latency_ms = int((time.monotonic() - start) * 1000)
        return ProviderResult(parsed=parsed, raw_response=raw, model=self.model, provider=self.name, latency_ms=latency_ms)


def safe_json_loads(text: str) -> dict:
    """Model output is occasionally wrapped in ```json fences even when told
    not to — strip that before parsing rather than failing the whole call."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError as e:
        raise ProviderError(f"Model output was not valid JSON: {e}\n---\n{text[:500]}")
