import os
from datetime import UTC, datetime, time
from typing import Literal
import uuid

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session, selectinload

from .database import Base, engine, get_db
from .models import Activity, ActivityType, Lead, LeadStatus, Reminder, ReminderKind
from .schemas import LeadCreate, LeadOut, LeadUpdate, LoginIn, ReminderCreate, ReminderOut, ReminderUpdate, TokenOut
from .security import bearer_scheme, create_access_token, require_access, verify_password


app = FastAPI(title="zCRM API", version="0.1.0")
origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:3200").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    # Lightweight forward migration for existing early zCRM databases.
    columns = {column["name"] for column in inspect(engine).get_columns("reminders")}
    if "kind" not in columns:
        with engine.begin() as connection:
            if engine.dialect.name == "postgresql":
                connection.execute(text("""
                    DO $$ BEGIN
                      CREATE TYPE reminder_kind AS ENUM ('follow_up', 'meeting', 'proposal', 'check_in', 'other');
                    EXCEPTION WHEN duplicate_object THEN null;
                    END $$;
                """))
                connection.execute(text("ALTER TABLE reminders ADD COLUMN kind reminder_kind NOT NULL DEFAULT 'follow_up'"))
            else:
                connection.execute(text("ALTER TABLE reminders ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'follow_up'"))


def lead_query():
    return select(Lead).options(selectinload(Lead.reminders), selectinload(Lead.activities))


def get_lead_or_404(db: Session, lead_id: uuid.UUID) -> Lead:
    lead = db.scalar(lead_query().where(Lead.id == lead_id))
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/meta")
def metadata(_: str = Depends(require_access)) -> dict[str, list[str]]:
    """Canonical enum values for API clients, imports, and analytics jobs."""
    return {
        "lead_statuses": [item.value for item in LeadStatus],
        "reminder_kinds": [item.value for item in ReminderKind],
        "activity_types": [item.value for item in ActivityType],
    }


@app.post("/api/v1/auth/login", response_model=TokenOut)
def login(payload: LoginIn) -> TokenOut:
    admin_email = os.getenv("ADMIN_EMAIL", "").lower()
    password_hash = os.getenv("ADMIN_PASSWORD_HASH", "")
    if not password_hash or payload.email.lower() != admin_email or not verify_password(payload.password, password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return TokenOut(access_token=create_access_token(payload.email.lower()))


@app.get("/api/v1/leads", response_model=list[LeadOut])
def list_leads(
    db: Session = Depends(get_db),
    _: str = Depends(require_access),
) -> list[Lead]:
    return list(db.scalars(lead_query().order_by(Lead.updated_at.desc())))


@app.post("/api/v1/leads", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(
    payload: LeadCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_access),
) -> Lead:
    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.flush()
    db.add(Activity(lead_id=lead.id, event_type=ActivityType.lead_created, payload={"status": lead.status.value}))
    db.commit()
    return get_lead_or_404(db, lead.id)


@app.get("/api/v1/leads/{lead_id}", response_model=LeadOut)
def get_lead(
    lead_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: str = Depends(require_access),
) -> Lead:
    return get_lead_or_404(db, lead_id)


@app.patch("/api/v1/leads/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_access),
) -> Lead:
    lead = get_lead_or_404(db, lead_id)
    changes = payload.model_dump(exclude_unset=True)
    changed_fields = [field for field, value in changes.items() if getattr(lead, field) != value]
    previous_status = lead.status
    for field, value in changes.items():
        setattr(lead, field, value)
    if "status" in changed_fields:
        db.add(Activity(
            lead_id=lead.id,
            event_type=ActivityType.status_changed,
            payload={"from": previous_status.value, "to": lead.status.value},
        ))
    non_status_changes = [field for field in changed_fields if field != "status"]
    if non_status_changes:
        db.add(Activity(lead_id=lead.id, event_type=ActivityType.lead_updated, payload={"fields": non_status_changes}))
    db.commit()
    return get_lead_or_404(db, lead_id)


@app.post("/api/v1/leads/{lead_id}/reminders", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    lead_id: uuid.UUID,
    payload: ReminderCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_access),
) -> Reminder:
    get_lead_or_404(db, lead_id)
    reminder = Reminder(lead_id=lead_id, **payload.model_dump())
    db.add(reminder)
    db.flush()
    db.add(Activity(
        lead_id=lead_id,
        event_type=ActivityType.reminder_created,
        payload={"title": reminder.title, "kind": reminder.kind.value, "due_at": reminder.due_at.isoformat()},
    ))
    db.commit()
    db.refresh(reminder)
    return reminder


@app.get("/api/v1/reminders", response_model=list[ReminderOut])
def list_reminders(
    bucket: Literal["overdue", "today", "upcoming"] | None = None,
    db: Session = Depends(get_db),
    _: str = Depends(require_access),
) -> list[Reminder]:
    query = select(Reminder).where(Reminder.completed_at.is_(None))
    now = datetime.now(UTC)
    start_today = datetime.combine(now.date(), time.min, tzinfo=UTC)
    end_today = datetime.combine(now.date(), time.max, tzinfo=UTC)
    if bucket == "overdue":
        query = query.where(Reminder.due_at < start_today)
    elif bucket == "today":
        query = query.where(Reminder.due_at.between(start_today, end_today))
    elif bucket == "upcoming":
        query = query.where(Reminder.due_at > end_today)
    return list(db.scalars(query.order_by(Reminder.due_at.asc())))


@app.patch("/api/v1/reminders/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: uuid.UUID,
    payload: ReminderUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_access),
) -> Reminder:
    reminder = db.get(Reminder, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    changes = payload.model_dump(exclude_unset=True, exclude={"completed"})
    changed_fields = [field for field, value in changes.items() if getattr(reminder, field) != value]
    for field, value in changes.items():
        setattr(reminder, field, value)
    if payload.completed is not None:
        reminder.completed_at = datetime.now(UTC) if payload.completed else None
        if payload.completed:
            db.add(Activity(
                lead_id=reminder.lead_id,
                event_type=ActivityType.reminder_completed,
                payload={"title": reminder.title, "kind": reminder.kind.value},
            ))
    if changed_fields:
        db.add(Activity(
            lead_id=reminder.lead_id,
            event_type=ActivityType.reminder_updated,
            payload={"fields": changed_fields, "title": reminder.title},
        ))
    db.commit()
    db.refresh(reminder)
    return reminder
