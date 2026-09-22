from fastapi import APIRouter, Depends, HTTPException
from psycopg2 import errors as pg_errors

from db import get_conn
from auth import hash_password, verify_password, create_token, require_user
from models import SignupRequest, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _public_user(row: dict) -> dict:
    return {"id": row["id"], "name": row["name"], "email": row["email"], "isAdmin": row["is_admin"]}


@router.post("/signup")
def signup(body: SignupRequest, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        try:
            cur.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s) "
                "RETURNING id, name, email, is_admin, created_at",
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
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return {"token": create_token(user["id"]), "user": _public_user(user)}


@router.get("/me")
def me(user: dict = Depends(require_user)):
    return _public_user(user)
