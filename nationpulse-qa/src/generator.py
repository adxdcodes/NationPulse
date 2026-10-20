"""
generator.py
------------
Wraps a decoder-only instruct LLM (default: Qwen2.5-7B-Instruct) for
both the relevance-check/query-refinement step and final answer
generation in the NationPulse Bill Q&A pipeline.
"""

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


class LLMGenerator:
    def __init__(self, config: dict):
        gen_cfg = config["generation"]
        self.tokenizer = AutoTokenizer.from_pretrained(gen_cfg["model_name"])

        quant_config = None
        if gen_cfg.get("load_in_4bit") and gen_cfg["device"] == "cuda":
            quant_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_quant_type="nf4",
            )

        self.model = AutoModelForCausalLM.from_pretrained(
            gen_cfg["model_name"],
            device_map="auto" if gen_cfg["device"] == "cuda" else None,
            quantization_config=quant_config,
            torch_dtype=torch.float16 if gen_cfg["device"] == "cuda" else torch.float32,
        )
        if gen_cfg["device"] != "cuda":
            self.model.to(gen_cfg["device"])

        self.max_new_tokens = gen_cfg["max_new_tokens"]
        self.temperature = gen_cfg["temperature"]
        self.top_p = gen_cfg["top_p"]
        self.device = gen_cfg["device"]

    def chat(self, system_prompt: str, user_prompt: str, max_new_tokens: int | None = None) -> str:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        prompt = self.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)

        output_ids = self.model.generate(
            **inputs,
            max_new_tokens=max_new_tokens or self.max_new_tokens,
            temperature=self.temperature,
            top_p=self.top_p,
            do_sample=self.temperature > 0,
            pad_token_id=self.tokenizer.eos_token_id,
        )
        generated = output_ids[0][inputs["input_ids"].shape[1] :]
        return self.tokenizer.decode(generated, skip_special_tokens=True).strip()
