"""Project-wide, DB-backed quota scheduler. Configure actual limits in ai_model_limits.
All API keys within one Google Cloud project share the same counters.
"""
import datetime as dt
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from psycopg2.extras import RealDictCursor

try:
    PACIFIC = ZoneInfo('America/Los_Angeles')
except ZoneInfoNotFoundError as exc:
    raise RuntimeError('Install tzdata in the AI pipeline environment: python -m pip install tzdata') from exc


def reserve(conn, model_ids, bill_id, estimated_tokens):
    """Atomically reserve one request; None if every model is cooling down/full.
    Lock the quota table for the duration of checking + inserting the usage row.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT pg_advisory_xact_lock(84712099)')
        now = dt.datetime.now(dt.timezone.utc)
        midnight_pt = now.astimezone(PACIFIC).replace(hour=0, minute=0, second=0, microsecond=0)
        day_start = midnight_pt.astimezone(dt.timezone.utc)
        cur.execute('''SELECT model_id, requests_per_minute, requests_per_day,
                       tokens_per_minute, cooldown_until FROM ai_model_limits
                       WHERE enabled AND model_id = ANY(%s)''', (model_ids,))
        configs = {row['model_id']: row for row in cur.fetchall()}
        for model_id in model_ids:
            cfg = configs.get(model_id)
            if not cfg or (cfg['cooldown_until'] and cfg['cooldown_until'] > now):
                continue
            cur.execute('''SELECT count(*) FILTER (WHERE started_at >= %s) AS minute_count,
                              coalesce(sum(estimated_input_tokens) FILTER (WHERE started_at >= %s),0) AS minute_tokens,
                              count(*) FILTER (WHERE started_at >= %s) AS day_count
                           FROM ai_model_usage WHERE model_id = %s AND started_at >= %s''',
                        (now - dt.timedelta(minutes=1), now - dt.timedelta(minutes=1), day_start,
                         model_id, min(day_start, now - dt.timedelta(minutes=1))))
            usage = cur.fetchone()
            if (usage['minute_count'] >= cfg['requests_per_minute'] or
                usage['day_count'] >= cfg['requests_per_day'] or
                usage['minute_tokens'] + estimated_tokens > cfg['tokens_per_minute']):
                continue
            cur.execute('''INSERT INTO ai_model_usage(model_id,bill_id,estimated_input_tokens)
                           VALUES (%s,%s,%s) RETURNING id''', (model_id, bill_id, estimated_tokens))
            return model_id, cur.fetchone()['id']
    return None


def finish(conn, usage_id, status, *, actual_input=None, actual_output=None, http_status=None, error=None):
    with conn.cursor() as cur:
        cur.execute('''UPDATE ai_model_usage SET status=%s, completed_at=now(),
                       actual_input_tokens=%s, actual_output_tokens=%s,
                       http_status=%s, error_message=%s WHERE id=%s''',
                    (status, actual_input, actual_output, http_status, (error or '')[:1000] or None, usage_id))


def cooldown(conn, model_id, *, seconds=70, error=None):
    with conn.cursor() as cur:
        cur.execute('''UPDATE ai_model_limits SET cooldown_until=greatest(
                         coalesce(cooldown_until, now()), now() + (%s * interval '1 second')),
                         last_error=%s, updated_at=now() WHERE model_id=%s''',
                    (min(max(seconds, 1), 86400), (error or '')[:1000], model_id))


def retry_seconds(error):
    match = re.search(r'(?:retry(?:Delay|[- ]after)[^0-9]{0,20})(\d+)(?:s| seconds)?', str(error), re.I)
    return min(int(match.group(1)), 86400) if match else 70


def model_diagnostics(conn, model_ids):
    """Explain why a model exposed by Gemini may still be ineligible locally."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT model_id, enabled, cooldown_until, requests_per_minute, requests_per_day, tokens_per_minute FROM ai_model_limits WHERE model_id = ANY(%s)", (model_ids,))
        found = {row["model_id"]: row for row in cur.fetchall()}
    return [{"model": model, "configured": model in found, "enabled": found[model]["enabled"] if model in found else False,
             "cooldown_until": found[model]["cooldown_until"] if model in found else None} for model in model_ids]
