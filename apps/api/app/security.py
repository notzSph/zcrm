import hashlib
import hmac
import logging
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
AGENT_SESSION_LIFETIME_HOURS = 12
logger = logging.getLogger(__name__)
password_hasher = PasswordHasher()

def _configured_business_scope(
    variable_name: str,
    fallback_variable_name: str | None = None,
) -> uuid.UUID | frozenset[uuid.UUID]:
    configured = os.getenv(variable_name, "").strip()
    if not configured and fallback_variable_name:
        configured = os.getenv(fallback_variable_name, "").strip()
    if not configured:
        raise HTTPException(status_code=500, detail=f"{variable_name} is not configured")

    try:
        business_ids = frozenset(
            uuid.UUID(value.strip())
            for value in configured.split(",")
            if value.strip()
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"{variable_name} contains an invalid business ID",
        ) from exc
    if not business_ids:
        raise HTTPException(status_code=500, detail=f"{variable_name} is not configured")
    return next(iter(business_ids)) if len(business_ids) == 1 else business_ids


def _business_is_allowed(
    business_id: uuid.UUID,
    scope: uuid.UUID | frozenset[uuid.UUID] | None,
) -> bool:
    if scope is None:
        return True
    if isinstance(scope, frozenset):
        return business_id in scope
    return business_id == scope


def agent_business_scope(
    x_api_key: str | None,
) -> uuid.UUID | frozenset[uuid.UUID] | None | bool:
    """Return the allowed business ID(s), or False for an unknown agent key."""
    jayzoo_key = os.getenv("JAYZOO_API_KEY", "")
    if x_api_key and jayzoo_key and hmac.compare_digest(x_api_key, jayzoo_key):
        return _configured_business_scope("JAYZOO_BUSINESS_IDS", "JAYZOO_BUSINESS_ID")
    caio_key = os.getenv("CAIO_API_KEY", "")
    if x_api_key and caio_key and hmac.compare_digest(x_api_key, caio_key):
        return _configured_business_scope("CAIO_BUSINESS_ID")
    return False

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

def create_agent_session(db: Session, user: User, business_id: uuid.UUID) -> str:
    """Mint a short-lived normal session for the owner of an agent-selected business."""
    raw_token = secrets.token_urlsafe(32)
    db.add(UserSession(
        token_hash=hash_token(raw_token),
        user_id=user.id,
        active_business_id=business_id,
        expires_at=datetime.now(UTC) + timedelta(hours=AGENT_SESSION_LIFETIME_HOURS),
    ))
    db.commit()
    logger.info("agent session minted for business=%s user=%s", business_id, user.id)
    return raw_token

def invalidate_session(db: Session, raw_token: str) -> None:
    session = db.query(UserSession).filter(UserSession.token_hash == hash_token(raw_token)).first()
    if session:
        db.delete(session); db.commit()

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
    agent_scope = agent_business_scope(x_api_key)
    if agent_scope is not False:
        try:
            business_id = uuid.UUID(x_business_id or "")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="X-Business-ID is required for agent access") from exc
        if not _business_is_allowed(
            business_id,
            agent_scope if agent_scope is not False else None,
        ):
            raise HTTPException(status_code=403, detail="API key is not authorized for this business")
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

def require_agent_context(x_api_key: str | None = Header(default=None), x_business_id: str | None = Header(default=None), db: Session = Depends(get_db)) -> RequestContext:
    agent_scope = agent_business_scope(x_api_key)
    if agent_scope is False:
        raise HTTPException(status_code=401, detail="Valid X-API-Key required")
    try: business_id = uuid.UUID(x_business_id or "")
    except ValueError as exc: raise HTTPException(status_code=400, detail="X-Business-ID is required") from exc
    if not _business_is_allowed(
        business_id,
        agent_scope if agent_scope is not False else None,
    ):
        raise HTTPException(status_code=403, detail="API key is not authorized for this business")
    business = db.get(Business, business_id)
    if not business: raise HTTPException(status_code=404, detail="Business not found")
    return RequestContext(business=business, user=None, is_agent=True)

def require_unrestricted_agent(x_api_key: str | None = Header(default=None), x_business_id: str | None = Header(default=None), db: Session = Depends(get_db)) -> RequestContext:
    """Require the unrestricted JAYZOO service key for session exchange."""
    jayzoo_key = os.getenv("JAYZOO_API_KEY", "")
    if not x_api_key or not jayzoo_key or not hmac.compare_digest(x_api_key, jayzoo_key):
        raise HTTPException(status_code=401, detail="Unrestricted agent key required")
    try:
        business_id = uuid.UUID(x_business_id or "")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="X-Business-ID is required") from exc
    business = db.get(Business, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return RequestContext(business=business, user=None, is_agent=True)
