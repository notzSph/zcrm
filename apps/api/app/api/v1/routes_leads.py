from datetime import UTC, datetime, time
import os
from pathlib import Path
from typing import Literal
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.domain_models import Activity, ActivityType, BusinessMembership, Interaction, InteractionType, Lead, LeadAttachment, LeadStatus, Reminder, ReminderKind
from app.domain_schemas import ActivityOut, AttachmentOut, AttachmentUpdate, InteractionCreate, InteractionOut, LeadCreate, LeadOut, LeadUpdate, ReminderCreate, ReminderOut, ReminderUpdate
from app.security import RequestContext, get_db, require_context

router = APIRouter(tags=["crm"])

def lead_query(): return select(Lead).options(selectinload(Lead.reminders), selectinload(Lead.activities), selectinload(Lead.interactions), selectinload(Lead.attachments))
def get_lead_or_404(db: Session, lead_id: uuid.UUID, business_id: uuid.UUID) -> Lead:
    lead = db.scalar(lead_query().where(Lead.id == lead_id, Lead.business_id == business_id))
    if not lead: raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@router.get("/meta")
def metadata(_: RequestContext = Depends(require_context)) -> dict[str, list[str]]:
    return {"lead_statuses": [x.value for x in LeadStatus], "reminder_kinds": [x.value for x in ReminderKind], "activity_types": [x.value for x in ActivityType], "interaction_types": [x.value for x in InteractionType]}

@router.get("/leads", response_model=list[LeadOut])
def list_leads(context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> list[Lead]:
    return list(db.scalars(lead_query().where(Lead.business_id == context.business.id).order_by(Lead.updated_at.desc())))

@router.get("/leads/{lead_id}/workspace")
def lead_workspace(lead_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> dict[str, str]:
    if context.user is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    memberships = select(BusinessMembership.business_id).where(BusinessMembership.user_id == context.user.id)
    lead = db.scalar(select(Lead).where(Lead.id == lead_id, Lead.business_id.in_(memberships)))
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"business_id": str(lead.business_id), "business_name": lead.business.name}

@router.post("/leads", response_model=LeadOut, status_code=201)
def create_lead(payload: LeadCreate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Lead:
    lead = Lead(business_id=context.business.id, **payload.model_dump()); db.add(lead); db.flush(); db.add(Activity(lead_id=lead.id, event_type=ActivityType.lead_created, payload={"status": lead.status.value})); db.commit(); return get_lead_or_404(db, lead.id, context.business.id)

@router.get("/leads/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Lead: return get_lead_or_404(db, lead_id, context.business.id)

@router.get("/leads/{lead_id}/interactions", response_model=list[InteractionOut])
def list_interactions(lead_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> list[Interaction]:
    get_lead_or_404(db, lead_id, context.business.id)
    return list(db.scalars(select(Interaction).join(Lead).where(Interaction.lead_id == lead_id, Lead.business_id == context.business.id).order_by(Interaction.occurred_at.desc())))

@router.post("/leads/{lead_id}/interactions", response_model=InteractionOut, status_code=201)
def create_interaction(lead_id: uuid.UUID, payload: InteractionCreate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Interaction:
    get_lead_or_404(db, lead_id, context.business.id)
    interaction = Interaction(lead_id=lead_id, interaction_type=payload.interaction_type, body=payload.body.strip(), occurred_at=payload.occurred_at or datetime.now(UTC), external_ref=payload.external_ref)
    db.add(interaction); db.commit(); db.refresh(interaction)
    return interaction

UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/app/uploads")) / "leads"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

def attachment_for_business(db: Session, attachment_id: uuid.UUID, business_id: uuid.UUID) -> LeadAttachment:
    attachment = db.scalar(select(LeadAttachment).join(Lead).where(LeadAttachment.id == attachment_id, Lead.business_id == business_id))
    if not attachment: raise HTTPException(status_code=404, detail="Attachment not found")
    return attachment

@router.get("/leads/{lead_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(lead_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> list[LeadAttachment]:
    get_lead_or_404(db, lead_id, context.business.id)
    return list(db.scalars(select(LeadAttachment).join(Lead).where(LeadAttachment.lead_id == lead_id, Lead.business_id == context.business.id).order_by(LeadAttachment.created_at.desc())))

@router.post("/leads/{lead_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(lead_id: uuid.UUID, file: UploadFile = File(...), kind: str = Form("document"), context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> LeadAttachment:
    get_lead_or_404(db, lead_id, context.business.id)
    filename = Path(file.filename or "attachment").name[:255]
    if not filename or filename in {".", ".."}: raise HTTPException(status_code=400, detail="Invalid filename")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES: raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")
    storage_key = f"{uuid.uuid4().hex}_{filename}"
    directory = UPLOADS_DIR / str(context.business.id)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / storage_key).write_bytes(content)
    attachment = LeadAttachment(lead_id=lead_id, filename=filename, storage_key=storage_key, content_type=file.content_type or "application/octet-stream", size_bytes=len(content), kind=kind[:64])
    db.add(attachment); db.commit(); db.refresh(attachment)
    return attachment

@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> FileResponse:
    attachment = attachment_for_business(db, attachment_id, context.business.id)
    path = UPLOADS_DIR / str(context.business.id) / attachment.storage_key
    if not path.is_file(): raise HTTPException(status_code=404, detail="Attachment file missing")
    return FileResponse(path, media_type=attachment.content_type, filename=attachment.filename)

@router.patch("/attachments/{attachment_id}", response_model=AttachmentOut)
def update_attachment(attachment_id: uuid.UUID, payload: AttachmentUpdate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> LeadAttachment:
    attachment = attachment_for_business(db, attachment_id, context.business.id)
    changes = payload.model_dump(exclude_unset=True)
    if "filename" in changes:
        filename = Path(changes["filename"]).name
        if not filename or filename in {".", ".."}: raise HTTPException(status_code=400, detail="Invalid filename")
        changes["filename"] = filename
    for key, value in changes.items(): setattr(attachment, key, value)
    db.commit(); db.refresh(attachment)
    return attachment

@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> None:
    attachment = attachment_for_business(db, attachment_id, context.business.id)
    path = UPLOADS_DIR / str(context.business.id) / attachment.storage_key
    if path.is_file(): path.unlink()
    db.delete(attachment); db.commit()

@router.patch("/leads/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: uuid.UUID, payload: LeadUpdate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Lead:
    lead = get_lead_or_404(db, lead_id, context.business.id); changes = payload.model_dump(exclude_unset=True); changed = [k for k, v in changes.items() if getattr(lead, k) != v]; old_status = lead.status
    for key, value in changes.items(): setattr(lead, key, value)
    if "status" in changed: db.add(Activity(lead_id=lead.id, event_type=ActivityType.status_changed, payload={"from": old_status.value, "to": lead.status.value}))
    other = [k for k in changed if k != "status"]
    if other: db.add(Activity(lead_id=lead.id, event_type=ActivityType.lead_updated, payload={"fields": other}))
    db.commit(); return get_lead_or_404(db, lead.id, context.business.id)

@router.delete("/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> None:
    db.delete(get_lead_or_404(db, lead_id, context.business.id)); db.commit()

@router.post("/leads/{lead_id}/reminders", response_model=ReminderOut, status_code=201)
def create_reminder(lead_id: uuid.UUID, payload: ReminderCreate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Reminder:
    get_lead_or_404(db, lead_id, context.business.id); reminder = Reminder(lead_id=lead_id, **payload.model_dump()); db.add(reminder); db.flush(); db.add(Activity(lead_id=lead_id, event_type=ActivityType.reminder_created, payload={"title": reminder.title, "kind": reminder.kind.value})); db.commit(); db.refresh(reminder); return reminder

def reminder_for_business(db: Session, reminder_id: uuid.UUID, business_id: uuid.UUID) -> Reminder:
    reminder = db.scalar(select(Reminder).join(Lead).where(Reminder.id == reminder_id, Lead.business_id == business_id))
    if not reminder: raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder

@router.patch("/reminders/{reminder_id}", response_model=ReminderOut)
def update_reminder(reminder_id: uuid.UUID, payload: ReminderUpdate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Reminder:
    reminder = reminder_for_business(db, reminder_id, context.business.id); changes = payload.model_dump(exclude_unset=True, exclude={"completed"}); changed = [k for k, v in changes.items() if getattr(reminder, k) != v]
    for key, value in changes.items(): setattr(reminder, key, value)
    if payload.completed is not None: reminder.completed_at = datetime.now(UTC) if payload.completed else None
    if changed or payload.completed is not None: db.add(Activity(lead_id=reminder.lead_id, event_type=ActivityType.reminder_updated, payload={"fields": changed, "title": reminder.title}))
    db.commit(); db.refresh(reminder); return reminder

@router.delete("/reminders/{reminder_id}", status_code=204)
def delete_reminder(reminder_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> None:
    reminder = reminder_for_business(db, reminder_id, context.business.id); db.delete(reminder); db.commit()

@router.get("/reminders", response_model=list[ReminderOut])
def list_reminders(bucket: Literal["overdue", "today", "upcoming"] | None = None, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> list[Reminder]:
    query = select(Reminder).join(Lead).where(Lead.business_id == context.business.id, Reminder.completed_at.is_(None)); now = datetime.now(UTC); start = datetime.combine(now.date(), time.min, tzinfo=UTC); end = datetime.combine(now.date(), time.max, tzinfo=UTC)
    if bucket == "overdue": query = query.where(Reminder.due_at < start)
    elif bucket == "today": query = query.where(Reminder.due_at.between(start, end))
    elif bucket == "upcoming": query = query.where(Reminder.due_at > end)
    return list(db.scalars(query.order_by(Reminder.due_at.asc())))
