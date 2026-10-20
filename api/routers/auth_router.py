import httpx
from fastapi import APIRouter, Depends, HTTPException
from psycopg2 import errors as pg_errors

import config
from db import get_conn
from auth import hash_password, verify_password, create_token, require_user
from models import SignupRequest, LoginRequest, GoogleLoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _public_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "isAdmin": row["is_admin"],
        "avatarUrl": row.get("avatar_url"),
    }


@router.post("/signup")
def signup(body: SignupRequest, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        try:
            cur.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s) "
                "RETURNING id, name, email, is_admin, avatar_url, created_at",
                (body.name.strip(), body.email.lower(), hash_password(body.password)),
            )
        except pg_errors.UniqueViolation:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        user = cur.fetchone()
    return {"token": create_token(user["id"]), "user": _public_user(user)}


@router.post("/login")
def login(body: LoginRequest, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM users WHERE email = %s", (body.email.lower(),))
        user = cur.fetchone()
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return {"token": create_token(user["id"]), "user": _public_user(user)}


@router.post("/google")
def google_login(body: GoogleLoginRequest, conn=Depends(get_conn)):
    if not body.credential:
        raise HTTPException(status_code=400, detail="Missing Google credential.")

    try:
        resp = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.credential},
            timeout=10.0,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with Google authentication service: {exc}")


    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token.")

    token_info = resp.json()
    google_id = token_info.get("sub")
    email = (token_info.get("email") or "").lower().strip()
    email_verified = str(token_info.get("email_verified", "")).lower() in ("true", "1")
    name = token_info.get("name") or email.split("@")[0]
    picture = token_info.get("picture")

    if not email or not email_verified:
        raise HTTPException(status_code=400, detail="Google account email is not verified.")

    # If configured, enforce audience check
    if config.GOOGLE_CLIENT_ID:
        aud = token_info.get("aud")
        if aud != config.GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Google token client ID mismatch.")

    with conn.cursor() as cur:
        # Check if user exists by google_id or email
        cur.execute(
            "SELECT id, name, email, is_admin, avatar_url FROM users WHERE google_id = %s OR email = %s",
            (google_id, email),
        )
        user = cur.fetchone()

        if user:
            # Update user google_id / avatar_url if missing
            cur.execute(
                "UPDATE users SET google_id = COALESCE(google_id, %s), avatar_url = COALESCE(avatar_url, %s), updated_at = now() WHERE id = %s RETURNING id, name, email, is_admin, avatar_url",
                (google_id, picture, user["id"]),
            )
            user = cur.fetchone()
        else:
            # Create a new user with Google credentials
            cur.execute(
                "INSERT INTO users (name, email, google_id, avatar_url, is_admin, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, false, now(), now()) "
                "RETURNING id, name, email, is_admin, avatar_url",
                (name, email, google_id, picture),
            )
            user = cur.fetchone()

    return {"token": create_token(user["id"]), "user": _public_user(user)}


@router.get("/me")
def me(user: dict = Depends(require_user)):
    return _public_user(user)

