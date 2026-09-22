"""Picks a provider instance by name, so the rest of the pipeline never
imports a specific vendor module directly."""
import config
from providers.base import ProviderError
from providers.gemini_provider import GeminiProvider

_FACTORIES = {
    "gemini": lambda model=None: GeminiProvider(model=model),
}


def get_provider(name: str = None, model: str = None):
    name = (name or config.AI_PROVIDER).lower()
    if name not in _FACTORIES:
        raise ProviderError(f"Unknown provider '{name}'. Choose one of: {', '.join(_FACTORIES)}")
    return _FACTORIES[name](model=model)
