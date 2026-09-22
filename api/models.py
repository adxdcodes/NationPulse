"""Request-body schemas. Response shapes are built as plain dicts in each
router (see README for why) so these only cover incoming data."""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class FollowCreate(BaseModel):
    kind: str = Field(pattern="^(bill|topic|mp)$")
    target_id: str = Field(min_length=1, max_length=200)


class AdminContentEdit(BaseModel):
    """Only the AI-generated/interpretive fields are editable by a
    moderator — bill facts (title, dates, ministry...) come from sansad.in
    and are not something the admin UI should be able to overwrite. See
    README "Suggested changes" for why this is a deliberate split from the
    old mock admin's single flat edit form."""
    plain_title: Optional[str] = None
    summary: Optional[str] = None
    why_it_matters: Optional[str] = None
    topic: Optional[str] = None
    key_changes: Optional[list] = None


class AdminEntityForm(BaseModel):
    """For manually adding a bill the ingestion pipeline hasn't seen yet —
    kept for parity with the old mock admin's "Add entity" button, but
    expect this to be used rarely now that ingestion is automatic."""
    bill_number: str
    bill_name: str
    ministry_name: Optional[str] = None
    bill_year: Optional[int] = None
    introduced_house: Optional[str] = None
    status: str = "Introduced"
    summary: Optional[str] = None
    why_it_matters: Optional[str] = None
    topic: Optional[str] = None
