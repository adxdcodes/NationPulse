"""Connection pooling for the API. FastAPI runs sync `def` endpoints in a
thread pool automatically, so a psycopg2 ThreadedConnectionPool (rather
than an async driver) is the simplest thing that's actually correct under
concurrent requests.
"""
import psycopg2.pool
import psycopg2.extras

import config

_pool = psycopg2.pool.ThreadedConnectionPool(minconn=1, maxconn=10, dsn=config.DATABASE_URL)


def get_conn():
    """FastAPI dependency: `conn = Depends(get_conn)`. Commits on success,
    rolls back on exception, always returns the connection to the pool."""
    conn = _pool.getconn()
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


def checkout_conn():
    """For code that isn't a FastAPI request — background threads (the job
    exit-code watcher in routers/processing.py) — which can't use
    Depends(get_conn) since there's no request to inject it into. Caller
    is responsible for calling checkin_conn() when done, same contract as
    get_conn()'s finally block."""
    conn = _pool.getconn()
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    return conn


def checkin_conn(conn):
    _pool.putconn(conn)
