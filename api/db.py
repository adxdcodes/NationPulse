"""Connection pooling for the API. FastAPI runs sync `def` endpoints in a
thread pool automatically, so a psycopg2 ThreadedConnectionPool (rather
than an async driver) is the simplest thing that's actually correct under
concurrent requests.
"""
import psycopg2
import psycopg2.pool
import psycopg2.extras

import config

_pool = psycopg2.pool.ThreadedConnectionPool(minconn=1, maxconn=10, dsn=config.DATABASE_URL)


def _get_live_conn():
    """Retrieve a connection from the pool, testing it if it was idle.
    Remote database poolers (e.g. Supabase) drop idle connections after a timeout.
    If the connection is dead, discard it and open a fresh one.
    """
    conn = _pool.getconn()
    try:
        if conn.closed:
            raise psycopg2.OperationalError("Connection is closed")
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
    except (psycopg2.OperationalError, psycopg2.InterfaceError, psycopg2.DatabaseError):
        try:
            conn.close()
        except Exception:
            pass
        try:
            _pool.putconn(conn, close=True)
        except Exception:
            pass
        conn = _pool.getconn()
    return conn


def get_conn():
    """FastAPI dependency: `conn = Depends(get_conn)`. Commits on success,
    rolls back on exception, always returns the connection to the pool."""
    conn = _get_live_conn()
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    try:
        yield conn
        if not conn.closed:
            conn.commit()
    except Exception:
        if not conn.closed:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn.closed:
            try:
                _pool.putconn(conn, close=True)
            except Exception:
                pass
        else:
            _pool.putconn(conn)


def checkout_conn():
    """For code that isn't a FastAPI request — background threads (the job
    exit-code watcher in routers/processing.py) — which can't use
    Depends(get_conn) since there's no request to inject it into. Caller
    is responsible for calling checkin_conn() when done, same contract as
    get_conn()'s finally block."""
    conn = _get_live_conn()
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    return conn


def checkin_conn(conn):
    if conn.closed:
        try:
            _pool.putconn(conn, close=True)
        except Exception:
            pass
    else:
        _pool.putconn(conn)

