import hashlib
import hmac
import os
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Generator
import uuid

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session, selectinload

from .database import SessionLocal
from .models import Business, BusinessMembership, User, UserSession

SESSION_COOKIE_NAME = "zcrm_session"
SESSION_LIFETIME_DAYS = 30
password_hasher = PasswordHasher()

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=64)
    return f"{salt.hex()}:{key.hex()}"

def verify_password(password: str, stored: str) -> bool:
    if stored.startswith("$argon2"):
        try:
            return password_hasher.verify(stored, password)
        except (VerifyMismatchError, ValueError):
            return False
    try:
        salt_hex, key_hex = stored.split(":")
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1, dklen=64)
        return hmac.compare_digest(actual, bytes.fromhex(key_hex))
    except (ValueError, TypeError):
        return False

def hash_token(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()

def create_session(db: Session, user: User) -> str:
    raw_token = secrets.token_urlsafe(32)
    db.add(UserSession(token_hash=hash_token(raw_token), user_id=user.id, expires_at=datetime.now(UTC) + timedelta(days=SESSION_LIFETIME_DAYS)))
    db.commit()
    return raw_token

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@dataclass(frozen=True)
class RequestContext:
    business: Business
    user: User | None
    is_agent: bool = False

def get_user_session(request: Request, db: Session = Depends(get_db)) -> tuple[User, UserSession]:
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    session = db.query(UserSession).options(selectinload(UserSession.user).selectinload(User.memberships)).filter(UserSession.token_hash == hash_token(raw_token)).first()
    expires_at = session.expires_at if session else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if not session or not expires_at or expires_at.astimezone(UTC) < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    return session.user, session

def require_context(request: Request, x_api_key: str | None = Header(default=None), x_business_id: str | None = Header(default=None), db: Session = Depends(get_db)) -> RequestContext:
    api_key = os.getenv("JAYZOO_API_KEY", "")
    if x_api_key and api_key and hmac.compare_digest(x_api_key, api_key):
        try:
            business_id = uuid.UUID(x_business_id or "")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="X-Business-ID is required for agent access") from exc
        business = db.get(Business, business_id)
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        return RequestContext(business=business, user=None, is_agent=True)
    user, session = get_user_session(request, db)
    if not session.active_business_id:
        raise HTTPException(status_code=409, detail="Select a business workspace first")
    membership = db.query(BusinessMembership).filter(BusinessMembership.user_id == user.id, BusinessMembership.business_id == session.active_business_id).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Business access revoked")
    business = db.get(Business, session.active_business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return RequestContext(business=business, user=user)
