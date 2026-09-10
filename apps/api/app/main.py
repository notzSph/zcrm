import os
import uuid
from datetime import UTC, datetime, time
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session, selectinload

from .database import Base, engine
from .models import Activity, ActivityType, Business, BusinessMembership, Lead, LeadStatus, Reminder, ReminderKind, User, UserSession
from .schemas import ActiveBusinessUpdate, BusinessCreate, BusinessOut, BusinessUpdate, LeadCreate, LeadOut, LeadUpdate, LoginIn, LoginOut, MemberAdd, RegisterIn, ReminderCreate, ReminderOut, ReminderUpdate, UserOut
from .security import RequestContext, create_session, get_db, get_user_session, hash_password, require_context, verify_password

app = FastAPI(title="zCRM API", version="0.2.0")
origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:3200").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def user_out(db: Session, user: User, session: UserSession) -> UserOut:
    memberships = db.query(BusinessMembership).options(selectinload(BusinessMembership.business)).filter(BusinessMembership.user_id == user.id).all()
    return UserOut(id=user.id, email=user.email, display_name=user.display_name, businesses=[BusinessOut.model_validate(item.business) for item in memberships], active_business_id=session.active_business_id)


def current_user(request: Request, db: Session) -> tuple[User, UserSession]:
    return get_user_session(request, db)


def lead_query():
    return select(Lead).options(selectinload(Lead.reminders), selectinload(Lead.activities))


def get_lead_or_404(db: Session, lead_id: uuid.UUID, business_id: uuid.UUID) -> Lead:
    lead = db.scalar(lead_query().where(Lead.id == lead_id, Lead.business_id == business_id))
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    lead_columns = {column["name"] for column in inspect(engine).get_columns("leads")}
    with engine.begin() as connection:
        if "business_id" not in lead_columns:
            column_type = "UUID" if engine.dialect.name == "postgresql" else "VARCHAR(36)"
            connection.execute(text(f"ALTER TABLE leads ADD COLUMN business_id {column_type}"))
        reminder_columns = {column["name"] for column in inspect(engine).get_columns("reminders")}
        if "kind" not in reminder_columns:
            if engine.dialect.name == "postgresql":
                connection.execute(text("DO $$ BEGIN CREATE TYPE reminder_kind AS ENUM ('follow_up', 'meeting', 'proposal', 'check_in', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;"))
                connection.execute(text("ALTER TABLE reminders ADD COLUMN kind reminder_kind NOT NULL DEFAULT 'follow_up'"))
            else:
                connection.execute(text("ALTER TABLE reminders ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'follow_up'"))
    db = next(get_db())
    try:
        if not db.query(User).first():
            email = os.getenv("ADMIN_EMAIL", "admin@zcrm.local").lower()
            legacy_hash = os.getenv("ADMIN_PASSWORD_HASH", "")
            if legacy_hash:
                user = User(email=email, display_name=email.split("@")[0], password_hash=legacy_hash)
                business = Business(name=os.getenv("DEFAULT_BUSINESS_NAME", "zCRM workspace"))
                db.add_all([user, business]); db.flush()
                db.add(BusinessMembership(user_id=user.id, business_id=business.id))
                db.execute(text("UPDATE leads SET business_id = :business_id WHERE business_id IS NULL"), {"business_id": str(business.id)})
                db.commit()
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]: return {"status": "ok"}


@app.post("/api/v1/auth/register", response_model=LoginOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> LoginOut:
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already in use")
    user = User(email=payload.email.lower(), display_name=payload.display_name.strip(), password_hash=hash_password(payload.password))
    business = Business(name=payload.business_name.strip())
    db.add_all([user, business]); db.flush(); db.add(BusinessMembership(user_id=user.id, business_id=business.id)); db.commit()
    token = create_session(db, user)
    session = db.query(UserSession).filter(UserSession.token_hash == __import__("hashlib").sha256(token.encode()).hexdigest()).first()
    session.active_business_id = business.id; db.commit()
    return LoginOut(session_token=token, user=user_out(db, user, session))


@app.post("/api/v1/auth/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> LoginOut:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_session(db, user)
    session = db.query(UserSession).filter(UserSession.token_hash == __import__("hashlib").sha256(token.encode()).hexdigest()).first()
    return LoginOut(session_token=token, user=user_out(db, user, session))


@app.get("/api/v1/auth/me", response_model=UserOut)
def me(request: Request, db: Session = Depends(get_db)) -> UserOut:
    user, session = current_user(request, db); return user_out(db, user, session)


@app.patch("/api/v1/auth/active-business", response_model=UserOut)
def set_active_business(payload: ActiveBusinessUpdate, request: Request, db: Session = Depends(get_db)) -> UserOut:
    user, session = current_user(request, db)
    if not db.query(BusinessMembership).filter(BusinessMembership.user_id == user.id, BusinessMembership.business_id == payload.business_id).first():
        raise HTTPException(status_code=403, detail="Business access denied")
    session.active_business_id = payload.business_id; db.commit(); db.refresh(session)
    return user_out(db, user, session)


@app.get("/api/v1/businesses", response_model=list[BusinessOut])
def list_businesses(request: Request, db: Session = Depends(get_db)) -> list[Business]:
    user, _ = current_user(request, db)
    return [item.business for item in db.query(BusinessMembership).options(selectinload(BusinessMembership.business)).filter(BusinessMembership.user_id == user.id).all()]


@app.post("/api/v1/businesses", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(payload: BusinessCreate, request: Request, db: Session = Depends(get_db)) -> Business:
    user, _ = current_user(request, db); business = Business(name=payload.name.strip()); db.add(business); db.flush(); db.add(BusinessMembership(user_id=user.id, business_id=business.id)); db.commit(); db.refresh(business); return business


def business_for_user(db: Session, user_id: uuid.UUID, business_id: uuid.UUID) -> Business:
    business = db.query(Business).join(BusinessMembership).filter(Business.id == business_id, BusinessMembership.user_id == user_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@app.get("/api/v1/businesses/{business_id}", response_model=BusinessOut)
def get_business(business_id: uuid.UUID, request: Request, db: Session = Depends(get_db)) -> Business:
    user, _ = current_user(request, db); return business_for_user(db, user.id, business_id)


@app.patch("/api/v1/businesses/{business_id}", response_model=BusinessOut)
def update_business(business_id: uuid.UUID, payload: BusinessUpdate, request: Request, db: Session = Depends(get_db)) -> Business:
    user, _ = current_user(request, db); business = business_for_user(db, user.id, business_id); business.name = payload.name.strip(); db.commit(); db.refresh(business); return business


@app.delete("/api/v1/businesses/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(business_id: uuid.UUID, request: Request, db: Session = Depends(get_db)) -> None:
    user, _ = current_user(request, db); business = business_for_user(db, user.id, business_id)
    db.query(UserSession).filter(UserSession.active_business_id == business.id).update({"active_business_id": None})
    db.delete(business); db.commit()


@app.get("/api/v1/businesses/{business_id}/members", response_model=list[UserOut])
def list_members(business_id: uuid.UUID, request: Request, db: Session = Depends(get_db)) -> list[UserOut]:
    user, session = current_user(request, db)
    if not db.query(BusinessMembership).filter(BusinessMembership.user_id == user.id, BusinessMembership.business_id == business_id).first(): raise HTTPException(status_code=403, detail="Business access denied")
    members = db.query(BusinessMembership).options(selectinload(BusinessMembership.user)).filter(BusinessMembership.business_id == business_id).all()
    return [user_out(db, member.user, session) for member in members]


@app.post("/api/v1/businesses/{business_id}/members", status_code=status.HTTP_204_NO_CONTENT)
def add_member(business_id: uuid.UUID, payload: MemberAdd, request: Request, db: Session = Depends(get_db)) -> None:
    user, _ = current_user(request, db)
    if not db.query(BusinessMembership).filter(BusinessMembership.user_id == user.id, BusinessMembership.business_id == business_id).first(): raise HTTPException(status_code=403, detail="Business access denied")
    member = db.query(User).filter(User.email == payload.email.lower()).first()
    if not member: raise HTTPException(status_code=404, detail="User not found")
    if not db.query(BusinessMembership).filter(BusinessMembership.user_id == member.id, BusinessMembership.business_id == business_id).first(): db.add(BusinessMembership(user_id=member.id, business_id=business_id)); db.commit()


@app.get("/api/v1/meta")
def metadata(_: RequestContext = Depends(require_context)) -> dict[str, list[str]]:
    return {"lead_statuses": [item.value for item in LeadStatus], "reminder_kinds": [item.value for item in ReminderKind], "activity_types": [item.value for item in ActivityType]}


@app.get("/api/v1/leads", response_model=list[LeadOut])
def list_leads(context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> list[Lead]:
    return list(db.scalars(lead_query().where(Lead.business_id == context.business.id).order_by(Lead.updated_at.desc())))


@app.post("/api/v1/leads", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Lead:
    lead = Lead(business_id=context.business.id, **payload.model_dump()); db.add(lead); db.flush(); db.add(Activity(lead_id=lead.id, event_type=ActivityType.lead_created, payload={"status": lead.status.value})); db.commit(); return get_lead_or_404(db, lead.id, context.business.id)


@app.get("/api/v1/leads/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Lead: return get_lead_or_404(db, lead_id, context.business.id)


@app.patch("/api/v1/leads/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: uuid.UUID, payload: LeadUpdate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Lead:
    lead = get_lead_or_404(db, lead_id, context.business.id); changes = payload.model_dump(exclude_unset=True); changed = [key for key, value in changes.items() if getattr(lead, key) != value]; old_status = lead.status
    for key, value in changes.items(): setattr(lead, key, value)
    if "status" in changed: db.add(Activity(lead_id=lead.id, event_type=ActivityType.status_changed, payload={"from": old_status.value, "to": lead.status.value}))
    other = [key for key in changed if key != "status"]
    if other: db.add(Activity(lead_id=lead.id, event_type=ActivityType.lead_updated, payload={"fields": other}))
    db.commit(); return get_lead_or_404(db, lead.id, context.business.id)


@app.delete("/api/v1/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> None: db.delete(get_lead_or_404(db, lead_id, context.business.id)); db.commit()


@app.post("/api/v1/leads/{lead_id}/reminders", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(lead_id: uuid.UUID, payload: ReminderCreate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Reminder:
    get_lead_or_404(db, lead_id, context.business.id); reminder = Reminder(lead_id=lead_id, **payload.model_dump()); db.add(reminder); db.flush(); db.add(Activity(lead_id=lead_id, event_type=ActivityType.reminder_created, payload={"title": reminder.title, "kind": reminder.kind.value})); db.commit(); db.refresh(reminder); return reminder


def reminder_for_business(db: Session, reminder_id: uuid.UUID, business_id: uuid.UUID) -> Reminder:
    reminder = db.scalar(select(Reminder).join(Lead).where(Reminder.id == reminder_id, Lead.business_id == business_id))
    if not reminder: raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder


@app.patch("/api/v1/reminders/{reminder_id}", response_model=ReminderOut)
def update_reminder(reminder_id: uuid.UUID, payload: ReminderUpdate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Reminder:
    reminder = reminder_for_business(db, reminder_id, context.business.id); changes = payload.model_dump(exclude_unset=True, exclude={"completed"}); changed = [key for key, value in changes.items() if getattr(reminder, key) != value]
    for key, value in changes.items(): setattr(reminder, key, value)
    if payload.completed is not None: reminder.completed_at = datetime.now(UTC) if payload.completed else None; db.add(Activity(lead_id=reminder.lead_id, event_type=ActivityType.reminder_completed, payload={"title": reminder.title, "kind": reminder.kind.value})) if payload.completed else None
    if changed: db.add(Activity(lead_id=reminder.lead_id, event_type=ActivityType.reminder_updated, payload={"fields": changed, "title": reminder.title}))
    db.commit(); db.refresh(reminder); return reminder


@app.delete("/api/v1/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> None:
    reminder = reminder_for_business(db, reminder_id, context.business.id); db.add(Activity(lead_id=reminder.lead_id, event_type=ActivityType.reminder_deleted, payload={"title": reminder.title, "kind": reminder.kind.value})); db.delete(reminder); db.commit()


@app.get("/api/v1/reminders", response_model=list[ReminderOut])
def list_reminders(bucket: Literal["overdue", "today", "upcoming"] | None = None, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> list[Reminder]:
    query = select(Reminder).join(Lead).where(Lead.business_id == context.business.id, Reminder.completed_at.is_(None)); now = datetime.now(UTC); start = datetime.combine(now.date(), time.min, tzinfo=UTC); end = datetime.combine(now.date(), time.max, tzinfo=UTC)
    if bucket == "overdue": query = query.where(Reminder.due_at < start)
    elif bucket == "today": query = query.where(Reminder.due_at.between(start, end))
    elif bucket == "upcoming": query = query.where(Reminder.due_at > end)
    return list(db.scalars(query.order_by(Reminder.due_at.asc())))
