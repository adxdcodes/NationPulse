"""
generator_factory.py
----------------------
Picks which generator backend to construct based on
config["generation"]["backend"] ("transformers", "ollama", or
"gemini"), so the rest of the pipeline (qa_pipeline.py, cli.py,
api.py) never needs to know or care which one is active.
"""


def build_generator(config: dict):
    backend = config["generation"].get("backend", "transformers")

    if backend == "gemini":
        from gemini_generator import GeminiGenerator
        return GeminiGenerator(config)

    if backend == "ollama":
        from ollama_generator import OllamaGenerator
        return OllamaGenerator(config)

    if backend == "transformers":
        from generator import LLMGenerator
        return LLMGenerator(config)

    raise ValueError(
        f"Unknown generation.backend '{backend}' in config — expected "
        f"'transformers', 'ollama', or 'gemini'."
    )
