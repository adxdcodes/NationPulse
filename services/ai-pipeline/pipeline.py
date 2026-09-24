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
import re

import model_scheduler as scheduler
from free_model_discovery import discover, FREE_TEXT_MODELS

import config
import db
from providers.factory import get_provider
from providers.base import ProviderError
from prompts import SYSTEM_PROMPT, BILL_SUMMARY_SCHEMA, build_user_prompt
from validate import validate_bill_summary, SchemaValidationError

from log_setup import configure
log = configure("ai_pipeline")


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


def process_one(bill_id: int, providers: list, prompt: str | None = None, document_id: int | None = None) -> tuple[bool, str]:
    primary_provider = providers[0]
    with db.get_conn() as conn:
        row_id = db.reserve_generation(conn, bill_id, primary_provider.name, primary_provider.model)
        if row_id is None:
            return False, f"bill {bill_id} already claimed by another run, skipped"

    try:
        with db.get_conn() as conn:
            bill = db.get_bill_with_texts(conn, bill_id, document_id=document_id)
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

        # Model rotation is automatic; only models configured in ai_model_limits
        # are eligible. A quota reservation is committed BEFORE calling Gemini.
        result = None
        chosen_provider = None
        model_errors = []
        estimated_tokens = max(1, (len(SYSTEM_PROMPT) + len(user_prompt)) // 3)
        remaining = list(providers)
        while remaining:
            with db.get_conn() as conn:
                reservation = scheduler.reserve(
                    conn, [p.model for p in remaining], bill_id, estimated_tokens)
            if reservation is None:
                model_errors.append("No configured model has available quota; try again after reset")
                break
            model_name, usage_id = reservation
            chosen_provider = next(p for p in remaining if p.model == model_name)
            remaining = [p for p in remaining if p.model != model_name]
            try:
                # Do not retry 429 on the same model: switch or stop instead.
                result = chosen_provider.generate(SYSTEM_PROMPT, user_prompt, BILL_SUMMARY_SCHEMA)
                validate_bill_summary(result.parsed)
                metadata = result.raw_response.get("usageMetadata", {})
                with db.get_conn() as conn:
                    scheduler.finish(conn, usage_id, "succeeded",
                        actual_input=metadata.get("promptTokenCount"),
                        actual_output=metadata.get("candidatesTokenCount"))
                break
            except (ProviderError, SchemaValidationError) as error:
                message = str(error)
                match = re.search(r"Gemini API returned (\d+)", message)
                http_status = int(match.group(1)) if match else None
                limited = http_status == 429
                with db.get_conn() as conn:
                    scheduler.finish(conn, usage_id, "rate_limited" if limited else "failed",
                                     http_status=http_status, error=message)
                    if limited:
                        scheduler.cooldown(conn, model_name,
                            seconds=scheduler.retry_seconds(message), error=message)
                    elif http_status in (400, 401, 403, 404):
                        scheduler.cooldown(conn, model_name, seconds=86400, error=message)
                model_errors.append(f"{model_name}: {message}")
                log.warning("Model %s failed (%s); considering next eligible model", model_name, http_status)

        if result is None:
            raise ProviderError("No model completed generation: " + " | ".join(model_errors))

        with db.get_conn() as conn:
            db.save_success(
                conn, row_id,
                source_doc_id=bill["primary_doc_id"], parsed=result.parsed,
                raw_response=result.raw_response, input_char_count=len(user_prompt),
                latency_ms=result.latency_ms, model_version=result.model,
            )
        return True, f"bill {bill_id} ({bill['bill_number']}) -> {chosen_provider.name}/{chosen_provider.model}, {result.latency_ms}ms"

    except Exception as e:
        with db.get_conn() as conn:
            db.save_failure(conn, row_id, str(e))
        return False, f"bill {bill_id} FAILED: {e}"


def run_batch(limit: int, provider_name: str, model: str, bill_id: int | None = None,
              prompt: str | None = None, document_id: int | None = None) -> int:
    if provider_name not in (None, "gemini"):
        raise ValueError("This free-tier scheduler supports Gemini only")
    if model:
        if model not in FREE_TEXT_MODELS:
            raise ValueError(f"Model {model!r} is not in the documented free-tier allowlist")
        model_names = [model]
    else:
        model_names = discover()
    if not model_names:
        log.error("No eligible free-tier text models returned by Gemini models.list for this key.")
        return 0
    with db.get_conn() as conn:
        configured = scheduler.model_diagnostics(conn, model_names)
    for item in configured:
        if not item["configured"]:
            log.warning("Model %s is available to the key but has no quota row in ai_model_limits. Run db/006_free_model_candidates.sql.", item["model"])
        elif not item["enabled"]:
            log.warning("Model %s is disabled in ai_model_limits.", item["model"])
        elif item["cooldown_until"]:
            log.info("Model %s cooldown_until=%s", item["model"], item["cooldown_until"])
    providers = [get_provider("gemini", model_name) for model_name in model_names]
    with db.get_conn() as conn:
        bill_ids = db.find_candidate_bills(conn, limit, bill_id=bill_id)

    if not bill_ids:
        log.info("No candidate bills to summarize.")
        return 0

    log.info("Found %d candidate bill(s). Model order: %s.", len(bill_ids), ", ".join(model_names))
    ok, failed = 0, 0
    for bid in bill_ids:
        success, message = process_one(bid, providers, prompt=prompt, document_id=document_id)
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
    parser.add_argument("--document-id", type=int, default=None, help="Generate from exactly this extracted document")
    parser.add_argument("--bill-id", type=int, default=None,
                         help="Scope to exactly one bill (used by admin-triggered jobs)")
    parser.add_argument("--job-id", type=int, default=None,
                         help="Admin job id — accepted for CLI compatibility with the API's spawn command, "
                              "but no longer used: job status is now tracked by the API watching this "
                              "process's exit code, not by this process self-reporting. See api/routers/processing.py.")
    args = parser.parse_args()

    if args.bill_id is not None:
        run_batch(args.limit, args.provider, args.model, bill_id=args.bill_id, prompt=args.prompt, document_id=args.document_id)
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
