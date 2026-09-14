import uuid
from datetime import UTC, datetime
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.domain_models import BusinessMembership, Interaction, Lead, Reminder, User
from app.domain_schemas import InteractionCreate, InteractionOut, LeadCreate, LeadOut, ReminderCreate, ReminderOut, StatusUpdate
from app.security import RequestContext, get_db, require_agent_context
from app.api.v1.routes_leads import get_lead_or_404
from app.caldav import CalDAVError, sync_reminder

router = APIRouter(prefix="/agent", tags=["agent"])

@router.get("/capabilities")
def capabilities(_: RequestContext = Depends(require_agent_context)) -> dict[str, list[str]]:
    return {"operations": ["lead_upsert", "lead_status", "interaction_create", "reminder_create", "attachment_upload"], "headers": ["X-API-Key", "X-Business-ID", "X-Calendar-User-Email"]}

@router.put("/leads", response_model=LeadOut)
def upsert_lead(payload: LeadCreate, context: RequestContext = Depends(require_agent_context), db: Session = Depends(get_db)) -> Lead:
    lead = None
    if payload.external_ref:
        lead = db.scalar(select(Lead).where(Lead.business_id == context.business.id, Lead.external_ref == payload.external_ref))
    if lead is None:
        lead = Lead(business_id=context.business.id, **payload.model_dump()); db.add(lead)
    else:
        for key, value in payload.model_dump(exclude_unset=True).items(): setattr(lead, key, value)
    db.commit(); return get_lead_or_404(db, lead.id, context.business.id)

@router.patch("/leads/{lead_id}/status", response_model=LeadOut)
def update_status(lead_id: uuid.UUID, payload: StatusUpdate, context: RequestContext = Depends(require_agent_context), db: Session = Depends(get_db)) -> Lead:
    lead = get_lead_or_404(db, lead_id, context.business.id); lead.status = payload.status
    if payload.next_action is not None: lead.next_action = payload.next_action
    db.commit(); return get_lead_or_404(db, lead.id, context.business.id)

@router.post("/leads/{lead_id}/interactions", response_model=InteractionOut, status_code=201)
def create_interaction(lead_id: uuid.UUID, payload: InteractionCreate, context: RequestContext = Depends(require_agent_context), db: Session = Depends(get_db)) -> Interaction:
    get_lead_or_404(db, lead_id, context.business.id)
    if payload.external_ref:
        existing = db.scalar(select(Interaction).join(Lead).where(Interaction.lead_id == lead_id, Interaction.external_ref == payload.external_ref, Lead.business_id == context.business.id))
        if existing: return existing
    interaction = Interaction(lead_id=lead_id, interaction_type=payload.interaction_type, body=payload.body.strip(), occurred_at=payload.occurred_at or datetime.now(UTC), external_ref=payload.external_ref)
    db.add(interaction); db.commit(); db.refresh(interaction); return interaction

@router.post("/leads/{lead_id}/reminders", response_model=ReminderOut, status_code=201)
def create_reminder(lead_id: uuid.UUID, payload: ReminderCreate, x_calendar_user_email: str | None = Header(default=None, alias="X-Calendar-User-Email"), context: RequestContext = Depends(require_agent_context), db: Session = Depends(get_db)) -> Reminder:
    lead = get_lead_or_404(db, lead_id, context.business.id)
    calendar_owner = None
    if x_calendar_user_email:
        calendar_owner = db.scalar(select(User).join(BusinessMembership).where(BusinessMembership.business_id == context.business.id, User.email == x_calendar_user_email.casefold()))
        if not calendar_owner:
            raise HTTPException(status_code=404, detail="Calendar owner is not a member of this business")
    if payload.external_ref:
        existing = db.scalar(select(Reminder).join(Lead).where(Reminder.lead_id == lead_id, Reminder.external_ref == payload.external_ref, Lead.business_id == context.business.id))
        if existing: return existing
    reminder = Reminder(lead_id=lead_id, owner_user_id=calendar_owner.id if calendar_owner else None, **payload.model_dump()); db.add(reminder); db.flush()
    try:
        synced = sync_reminder(reminder, lead, calendar_owner)
    except CalDAVError as exc:
        db.rollback(); raise HTTPException(status_code=502, detail=str(exc)) from exc
    if synced: reminder.caldav_uid, reminder.caldav_url = synced
    db.commit(); db.refresh(reminder); return reminder
