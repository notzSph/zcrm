from datetime import UTC, datetime, timedelta
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, selectinload

from app.domain_models import BusinessMembership, User, UserSession
from app.domain_schemas import (
    ForgotPasswordIn, LoginIn, LoginOut, ProfileUpdate, RegisterIn,
    ResetPasswordIn, UserOut,
)
from app.security import create_session, get_db, get_user_session, hash_password, invalidate_session, verify_password

router = APIRouter(tags=["auth"])


def serialize_user(db: Session, user: User, session: UserSession) -> UserOut:
    memberships = db.query(BusinessMembership).options(
        selectinload(BusinessMembership.business)
    ).filter(BusinessMembership.user_id == user.id).all()
    return UserOut(
        id=user.id, email=user.email, display_name=user.display_name,
        profile_pic=user.profile_pic,
        businesses=[item.business for item in memberships],
        active_business_id=session.active_business_id,
    )


@router.post("/register", response_model=LoginOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> LoginOut:
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already in use")
    from app.domain_models import Business
    user = User(email=payload.email.lower(), display_name=payload.display_name.strip(), password_hash=hash_password(payload.password))
    business = Business(name=payload.business_name.strip(), owner_id=user.id)
    db.add_all([user, business]); db.flush()
    db.add(BusinessMembership(user_id=user.id, business_id=business.id, is_admin=True)); db.commit()
    token = create_session(db, user)
    session = db.query(UserSession).filter(UserSession.token_hash == __import__("hashlib").sha256(token.encode()).hexdigest()).one()
    session.active_business_id = business.id; db.commit()
    return LoginOut(session_token=token, user=serialize_user(db, user, session))


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> LoginOut:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_session(db, user)
    session = db.query(UserSession).filter(UserSession.token_hash == __import__("hashlib").sha256(token.encode()).hexdigest()).one()
    return LoginOut(session_token=token, user=serialize_user(db, user, session))


@router.get("/me", response_model=UserOut)
def me(request: Request, db: Session = Depends(get_db)) -> UserOut:
    user, session = get_user_session(request, db)
    return serialize_user(db, user, session)

@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
    raw_token = request.cookies.get("zcrm_session")
    if raw_token: invalidate_session(db, raw_token)
    return {"message": "Logged out"}


@router.patch("/me", response_model=UserOut)
def update_me(payload: ProfileUpdate, request: Request, db: Session = Depends(get_db)) -> UserOut:
    user, session = get_user_session(request, db)
    user.display_name = payload.display_name.strip(); user.profile_pic = payload.profile_pic
    db.commit(); db.refresh(user)
    return serialize_user(db, user, session)


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)) -> dict[str, str]:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        return {"message": "If the account exists, reset instructions will be sent."}
    user.reset_token = secrets.token_urlsafe(32)
    user.reset_token_expires_at = datetime.now(UTC) + timedelta(hours=1)
    db.commit()
    return {"message": "If the account exists, reset instructions will be sent.", "token": user.reset_token, "user_id": str(user.id)}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)) -> dict[str, str]:
    user = db.query(User).filter(User.id == payload.user_id, User.reset_token == payload.token).first()
    if not user or not user.reset_token_expires_at or user.reset_token_expires_at < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None; user.reset_token_expires_at = None
    db.commit()
    return {"message": "Password reset successful"}
