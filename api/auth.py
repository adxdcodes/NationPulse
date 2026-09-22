"""Password hashing, JWT issuance/verification, and the three auth
dependencies routers use:

    Depends(get_current_user)  -> User | None   (never raises — for
                                                   endpoints public browsing
                                                   can hit either way)
    Depends(require_user)      -> User          (401 if not signed in)
    Depends(require_admin)     -> User          (403 if signed in but not admin)
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException

import config
from db import get_conn


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def get_current_user(authorization: str = Header(default=None), conn=Depends(get_conn)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    user_id = decode_token(authorization.removeprefix("Bearer ").strip())
    if user_id is None:
        return None
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, email, is_admin, created_at FROM users WHERE id = %s", (user_id,))
        return cur.fetchone()


def require_user(user: Optional[dict] = Depends(get_current_user)) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return user


def require_admin(user: dict = Depends(require_user)) -> dict:
    if not user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user
