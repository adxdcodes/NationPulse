"""Orchestrates: find candidate bills -> reserve (lock) -> build prompt from
extracted text -> call the configured AI provider -> validate output ->
write to bill_ai_content as 'pending_review' (or 'failed' with the reason).

Usage:
    python pipeline.py                                  # gemini, up to 20 bills
    python pipeline.py --provider gemini --model gemini-1.5-flash
    python pipeline.py --loop --interval 600
"""
import argparse
import logging
import time

import config
import db
from providers.factory import get_provider
from providers.base import ProviderError
from prompts import SYSTEM_PROMPT, BILL_SUMMARY_SCHEMA, build_user_prompt
from validate import validate_bill_summary, SchemaValidationError

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ai_pipeline")


def generate_with_retry(provider, system_prompt, user_prompt, schema):
    last_error = None
    for attempt in range(1, config.MAX_RETRIES + 1):
        try:
            result = provider.generate(system_prompt, user_prompt, schema)
            validate_bill_summary(result.parsed)
            return result
        except (ProviderError, SchemaValidationError) as e:
            last_error = e
            log.warning("Attempt %d/%d failed: %s", attempt, config.MAX_RETRIES, e)
            if attempt < config.MAX_RETRIES:
                time.sleep(config.RETRY_DELAY_SECONDS * attempt)
    raise last_error


def process_one(bill_id: int, providers: list, prompt: str | None = None) -> tuple[bool, str]:
    primary_provider = providers[0]
    with db.get_conn() as conn:
        row_id = db.reserve_generation(conn, bill_id, primary_provider.name, primary_provider.model)
        if row_id is None:
            return False, f"bill {bill_id} already claimed by another run, skipped"

    try:
        with db.get_conn() as conn:
            bill = db.get_bill_with_texts(conn, bill_id)
        if not bill:
            with db.get_conn() as conn:
                db.save_failure(conn, row_id, "No extracted text available for this bill.")
            return False, f"bill {bill_id}: no extracted text"

        user_prompt = build_user_prompt(
            bill_number=bill["bill_number"], bill_name=bill["bill_name"],
            ministry=bill["ministry_name"], bill_year=bill["bill_year"],
            house=bill["introduced_house"], status=bill["status"],
            primary_text=bill["primary_text"], introduced_text=bill["introduced_text"],
            max_chars=config.MAX_INPUT_CHARS,
            prompt=prompt,
        )

        result = None
        model_errors = []
        for index, provider in enumerate(providers):
            try:
                result = generate_with_retry(provider, SYSTEM_PROMPT, user_prompt, BILL_SUMMARY_SCHEMA)
                if index:
                    log.info("Model %s succeeded after fallback.", provider.model)
                break
            except (ProviderError, SchemaValidationError) as error:
                model_errors.append(f"{provider.model}: {error}")
                if index < len(providers) - 1:
                    log.warning("Model %s failed; trying fallback model %s.", provider.model, providers[index + 1].model)

        if result is None:
            raise ProviderError("All Gemini models failed: " + " | ".join(model_errors))

        with db.get_conn() as conn:
            db.save_success(
                conn, row_id,
                source_doc_id=bill["primary_doc_id"], parsed=result.parsed,
                raw_response=result.raw_response, input_char_count=len(user_prompt),
                latency_ms=result.latency_ms, model_version=result.model,
            )
        return True, f"bill {bill_id} ({bill['bill_number']}) -> {provider.name}/{provider.model}, {result.latency_ms}ms"

    except Exception as e:
        with db.get_conn() as conn:
            db.save_failure(conn, row_id, str(e))
        return False, f"bill {bill_id} FAILED: {e}"


def run_batch(limit: int, provider_name: str, model: str, bill_id: int | None = None,
              prompt: str | None = None) -> int:
    model_names = [model or config.GEMINI_MODEL, config.GEMINI_MODEL_2, config.GEMINI_MODEL_3]
    model_names = list(dict.fromkeys(name.strip() for name in model_names if name and name.strip()))
    providers = [get_provider(provider_name, model_name) for model_name in model_names]
    with db.get_conn() as conn:
        bill_ids = db.find_candidate_bills(conn, limit, bill_id=bill_id)

    if not bill_ids:
        log.info("No candidate bills to summarize.")
        return 0

    log.info("Found %d candidate bill(s). Model order: %s.", len(bill_ids), ", ".join(model_names))
    ok, failed = 0, 0
    for bid in bill_ids:
        success, message = process_one(bid, providers, prompt=prompt)
        (log.info if success else log.warning)(message)
        ok += success
        failed += not success

    log.info("Batch complete: %d succeeded, %d failed.", ok, failed)
    return len(bill_ids)


def main():
    parser = argparse.ArgumentParser(description="AI bill summarization pipeline")
    parser.add_argument("--provider", default=None, help="gemini (default: AI_PROVIDER env)")
    parser.add_argument("--model", default=None, help="Override the default model for the chosen provider")
    parser.add_argument("--prompt", default=None, help="Optional prompt text; summary_prompt.txt is used when omitted")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval", type=int, default=600)
    parser.add_argument("--bill-id", type=int, default=None,
                         help="Scope to exactly one bill (used by admin-triggered jobs)")
    parser.add_argument("--job-id", type=int, default=None,
                         help="Admin job id — accepted for CLI compatibility with the API's spawn command, "
                              "but no longer used: job status is now tracked by the API watching this "
                              "process's exit code, not by this process self-reporting. See api/routers/processing.py.")
    args = parser.parse_args()

    if args.bill_id is not None:
        run_batch(args.limit, args.provider, args.model, bill_id=args.bill_id, prompt=args.prompt)
        return

    if args.loop:
        log.info("Starting in loop mode, polling every %ds.", args.interval)
        while True:
            processed = run_batch(args.limit, args.provider, args.model, prompt=args.prompt)
            time.sleep(args.interval if processed == 0 else 2)
    else:
        run_batch(args.limit, args.provider, args.model, prompt=args.prompt)


if __name__ == "__main__":
    main()
