"""Validates a parsed model response against BILL_SUMMARY_SCHEMA before it's
allowed anywhere near the database. Structured-output modes (tool-use,
json_schema, responseSchema) make providers *usually* honor the schema, but
"usually" isn't good enough for something that lands in a public review
queue — this is the actual guarantee.
"""
from jsonschema import validate, ValidationError
from prompts import BILL_SUMMARY_SCHEMA


class SchemaValidationError(Exception):
    pass


def validate_bill_summary(parsed: dict) -> None:
    try:
        validate(instance=parsed, schema=BILL_SUMMARY_SCHEMA)
    except ValidationError as e:
        raise SchemaValidationError(f"Model output failed schema validation: {e.message}")

    # A couple of checks jsonschema's `enum`/`type` alone won't catch:
    if not parsed.get("summary", "").strip():
        raise SchemaValidationError("summary is empty.")
    if not parsed.get("why_it_matters", "").strip():
        raise SchemaValidationError("why_it_matters is empty.")
    for change in parsed.get("key_changes", []):
        if not change.get("before", "").strip() or not change.get("after", "").strip():
            raise SchemaValidationError("A key_changes entry has an empty before/after.")
