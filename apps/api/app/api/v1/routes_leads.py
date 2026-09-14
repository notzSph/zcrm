import base64
import hashlib
import hmac
import json
from datetime import UTC, datetime, time
import os
from pathlib import Path
from typing import Literal
import uuid
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from app.caldav import CalDAVError, delete_event, sync_reminder
from app.domain_models import Activity, ActivityType, ApiIdempotency, BusinessMembership, Interaction, InteractionType, Lead, LeadAttachment, LeadStatus, LeadUpload, Reminder, ReminderKind
from app.domain_schemas import ActivityOut, AttachmentOut, AttachmentUpdate, InteractionCreate, InteractionOut, LeadCreate, LeadOut, LeadUpdate, ReminderCreate, ReminderOut, ReminderUpdate, StatusTransitionCreate, TimelineActor, TimelineItem, TimelinePage, TimelineSource, UploadInitiate, UploadOut
from app.core.config import settings
from app.security import RequestContext, get_db, require_context

router = APIRouter(tags=["crm"])

TIMELINE_SCHEMA_VERSION = 1
ALLOWED_STATUS_TRANSITIONS = {
    LeadStatus.target: {LeadStatus.connected, LeadStatus.contacted, LeadStatus.nurture, LeadStatus.lost},
    LeadStatus.connected: {LeadStatus.contacted, LeadStatus.meeting, LeadStatus.nurture, LeadStatus.lost},
    LeadStatus.contacted: {LeadStatus.meeting, LeadStatus.proposal, LeadStatus.nurture, LeadStatus.lost},
    LeadStatus.meeting: {LeadStatus.proposal, LeadStatus.won, LeadStatus.lost, LeadStatus.nurture},
    LeadStatus.proposal: {LeadStatus.won, LeadStatus.lost, LeadStatus.nurture},
    LeadStatus.won: {LeadStatus.nurture},
    LeadStatus.lost: {LeadStatus.target, LeadStatus.nurture},
    LeadStatus.nurture: {LeadStatus.target, LeadStatus.connected, LeadStatus.contacted, LeadStatus.meeting, LeadStatus.lost},
}

def _sign_cursor(payload: dict) -> str:
    encoded = base64.urlsafe_b64encode(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(settings.timeline_cursor_secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"

def _read_cursor(value: str) -> dict:
    try:
        encoded, signature = value.split(".", 1)
        expected = hmac.new(settings.timeline_cursor_secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected): raise ValueError
        return json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
    except (ValueError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid timeline cursor") from None

def _timeline_item(record: object) -> TimelineItem:
    if isinstance(record, Interaction):
        return TimelineItem(id=record.id, kind="interaction", occurred_at=record.occurred_at, recorded_at=record.created_at, actor=TimelineActor(type="user" if record.actor_user_id else "system", id=record.actor_user_id), source=TimelineSource(type=record.source), revision=record.revision, redacted=record.redacted, payload={"interaction_type": record.interaction_type.value, "body": None if record.redacted else record.body, "external_ref": record.external_ref})
    if isinstance(record, LeadAttachment):
        return TimelineItem(id=record.id, kind="attachment", occurred_at=record.created_at, recorded_at=record.created_at, actor=TimelineActor(type="user" if record.source == "user" else "system"), source=TimelineSource(type=record.source), revision=record.revision, redacted=record.redacted, payload={"filename": None if record.redacted else record.filename, "content_type": None if record.redacted else record.content_type, "size_bytes": None if record.redacted else record.size_bytes, "kind": record.kind, "status": record.status})
    assert isinstance(record, Activity)
    return TimelineItem(id=record.id, kind="activity", occurred_at=record.created_at, recorded_at=record.created_at, actor=TimelineActor(type="user" if record.actor_user_id else "system", id=record.actor_user_id), source=TimelineSource(type=record.source), revision=record.revision, redacted=record.redacted, payload={} if record.redacted else {"event_type": record.event_type.value, **record.payload})

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
def create_interaction(lead_id: uuid.UUID, payload: InteractionCreate, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"), context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Interaction:
    get_lead_or_404(db, lead_id, context.business.id)
    request_hash = hashlib.sha256(json.dumps({"lead_id": str(lead_id), "payload": payload.model_dump(mode="json")}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if idempotency_key:
        replay = db.scalar(select(ApiIdempotency).where(ApiIdempotency.business_id == context.business.id, ApiIdempotency.scope_key == idempotency_key))
        if replay:
            if replay.request_hash != request_hash:
                raise HTTPException(status_code=409, detail="Idempotency key was used with a different request")
            return replay.response_body
    interaction = Interaction(lead_id=lead_id, interaction_type=payload.interaction_type, body=payload.body.strip(), occurred_at=payload.occurred_at or datetime.now(UTC), external_ref=payload.external_ref, actor_user_id=context.user.id if context.user else None, source="agent" if context.is_agent else "user")
    db.add(interaction); db.flush()
    if idempotency_key:
        response_body = InteractionOut.model_validate(interaction).model_dump(mode="json")
        db.add(ApiIdempotency(business_id=context.business.id, scope_key=idempotency_key, request_hash=request_hash, response_body=response_body))
    db.commit(); db.refresh(interaction)
    return interaction

@router.get("/leads/{lead_id}/timeline", response_model=TimelinePage)
def lead_timeline(
    lead_id: uuid.UUID,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    types: list[str] | None = Query(default=None),
    context: RequestContext = Depends(require_context),
    db: Session = Depends(get_db),
) -> TimelinePage:
    get_lead_or_404(db, lead_id, context.business.id)
    requested_types = set(types or {"interaction", "attachment", "activity"})
    invalid_types = requested_types - {"interaction", "attachment", "activity"}
    if invalid_types:
        raise HTTPException(status_code=400, detail="Unsupported timeline type")
    base = {"version": TIMELINE_SCHEMA_VERSION, "lead_id": str(lead_id), "types": sorted(requested_types), "direction": "desc"}
    if cursor:
        decoded = _read_cursor(cursor)
        if {key: decoded.get(key) for key in base} != base:
            raise HTTPException(status_code=400, detail="Cursor does not match timeline query")
        snapshot_seq = int(decoded["snapshot_seq"])
        before = (datetime.fromisoformat(decoded["occurred_at"]) if decoded.get("occurred_at") else None, uuid.UUID(decoded["id"]) if decoded.get("id") else None)
    else:
        maxima: list[int] = []
        for model in (Interaction, LeadAttachment, Activity):
            if model.__name__.lower().replace("lead", "") in requested_types or (model is Activity and "activity" in requested_types):
                value = db.scalar(select(func.max(model.recorded_seq)).join(Lead, model.lead_id == Lead.id).where(model.lead_id == lead_id, Lead.business_id == context.business.id))
                if value is not None: maxima.append(value)
        snapshot_seq = max(maxima, default=0)
        before = (None, None)
    records: list[object] = []
    if "interaction" in requested_types:
        records.extend(db.scalars(select(Interaction).join(Lead).where(Interaction.lead_id == lead_id, Lead.business_id == context.business.id, Interaction.recorded_seq <= snapshot_seq)).all())
    if "attachment" in requested_types:
        records.extend(db.scalars(select(LeadAttachment).join(Lead).where(LeadAttachment.lead_id == lead_id, Lead.business_id == context.business.id, LeadAttachment.recorded_seq <= snapshot_seq)).all())
    if "activity" in requested_types:
        records.extend(db.scalars(select(Activity).join(Lead).where(Activity.lead_id == lead_id, Lead.business_id == context.business.id, Activity.recorded_seq <= snapshot_seq)).all())
    items = [_timeline_item(record) for record in records]
    items.sort(key=lambda item: (item.occurred_at or datetime.min.replace(tzinfo=UTC), item.id.hex), reverse=True)
    if before[0] is not None and before[1] is not None:
        items = [item for item in items if (item.occurred_at or datetime.min.replace(tzinfo=UTC), item.id) < before]
    page = items[:limit]
    next_cursor = None
    if len(items) > limit and page:
        last = page[-1]
        next_cursor = _sign_cursor({**base, "snapshot_seq": snapshot_seq, "occurred_at": last.occurred_at.isoformat() if last.occurred_at else None, "id": str(last.id)})
    return TimelinePage(items=page, next_cursor=next_cursor)

@router.post("/leads/{lead_id}/status-transitions", response_model=LeadOut)
def transition_lead_status(lead_id: uuid.UUID, payload: StatusTransitionCreate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Lead:
    lead = get_lead_or_404(db, lead_id, context.business.id)
    if payload.expected_version != lead.version:
        raise HTTPException(status_code=409, detail="Lead version is stale")
    if payload.status != lead.status and payload.status not in ALLOWED_STATUS_TRANSITIONS[lead.status]:
        raise HTTPException(status_code=422, detail=f"Invalid transition from {lead.status.value} to {payload.status.value}")
    old_status = lead.status
    lead.status = payload.status
    if payload.next_action is not None:
        lead.next_action = payload.next_action
    lead.version += 1
    db.add(Activity(lead_id=lead.id, actor_user_id=context.user.id if context.user else None, source="agent" if context.is_agent else "user", event_type=ActivityType.status_changed, payload={"from": old_status.value, "to": lead.status.value, "reason": payload.reason, "version": lead.version}))
    db.commit()
    return get_lead_or_404(db, lead.id, context.business.id)

UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/app/uploads")) / "leads"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

@router.post("/leads/{lead_id}/attachments/initiate", response_model=UploadOut, status_code=201)
def initiate_attachment_upload(lead_id: uuid.UUID, payload: UploadInitiate, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"), context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> LeadUpload:
    get_lead_or_404(db, lead_id, context.business.id)
    filename = Path(payload.filename).name
    if not filename or filename in {".", ".."}: raise HTTPException(status_code=400, detail="Invalid filename")
    request_hash = hashlib.sha256(json.dumps(payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if idempotency_key:
        existing = db.scalar(select(LeadUpload).join(Lead).where(LeadUpload.lead_id == lead_id, LeadUpload.idempotency_key == idempotency_key, Lead.business_id == context.business.id))
        if existing:
            if existing.request_hash != request_hash: raise HTTPException(status_code=409, detail="Idempotency key was used with a different request")
            return existing
    upload = LeadUpload(lead_id=lead_id, filename=filename, content_type=payload.content_type, kind=payload.kind, size_bytes=payload.size_bytes, idempotency_key=idempotency_key, request_hash=request_hash, actor_user_id=context.user.id if context.user else None, source="agent" if context.is_agent else "user")
    db.add(upload); db.commit(); db.refresh(upload)
    return upload

@router.post("/uploads/{upload_id}/complete", response_model=AttachmentOut, status_code=201)
async def complete_attachment_upload(upload_id: uuid.UUID, file: UploadFile = File(...), context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> LeadAttachment:
    upload = db.scalar(select(LeadUpload).join(Lead).where(LeadUpload.id == upload_id, Lead.business_id == context.business.id))
    if not upload: raise HTTPException(status_code=404, detail="Upload not found")
    if upload.status == "completed":
        attachment = db.scalar(select(LeadAttachment).where(LeadAttachment.storage_key == upload.storage_key))
        if attachment: return attachment
    if upload.status == "aborted": raise HTTPException(status_code=409, detail="Upload is aborted")
    if upload.status == "failed":
        upload.status = "initiated"
        db.commit()
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        upload.status = "failed"; db.commit()
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")
    if upload.size_bytes is not None and upload.size_bytes != len(content):
        upload.status = "failed"; db.commit()
        raise HTTPException(status_code=409, detail="Uploaded size does not match initiated size")
    if Path(file.filename or upload.filename).name != upload.filename:
        raise HTTPException(status_code=409, detail="Filename does not match initiated upload")
    storage_key = f"{uuid.uuid4().hex}_{upload.filename}"
    directory = UPLOADS_DIR / str(context.business.id)
    directory.mkdir(parents=True, exist_ok=True)
    try:
        (directory / storage_key).write_bytes(content)
        attachment = LeadAttachment(lead_id=upload.lead_id, filename=upload.filename, storage_key=storage_key, content_type=file.content_type or upload.content_type, size_bytes=len(content), kind=upload.kind, actor_user_id=upload.actor_user_id, source=upload.source)
        db.add(attachment); db.flush()
        upload.storage_key = storage_key; upload.size_bytes = len(content); upload.status = "completed"; upload.completed_at = datetime.now(UTC)
        db.commit(); db.refresh(attachment)
        return attachment
    except Exception:
        db.rollback()
        upload.status = "failed"
        db.commit()
        (directory / storage_key).unlink(missing_ok=True)
        raise

@router.get("/uploads/{upload_id}", response_model=UploadOut)
def get_attachment_upload(upload_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> LeadUpload:
    upload = db.scalar(select(LeadUpload).join(Lead).where(LeadUpload.id == upload_id, Lead.business_id == context.business.id))
    if not upload: raise HTTPException(status_code=404, detail="Upload not found")
    return upload

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
    attachment = LeadAttachment(lead_id=lead_id, filename=filename, storage_key=storage_key, content_type=file.content_type or "application/octet-stream", size_bytes=len(content), kind=kind[:64], actor_user_id=context.user.id if context.user else None, source="agent" if context.is_agent else "user")
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
    attachment.redacted = True
    attachment.status = "redacted"
    attachment.revision += 1
    db.commit()

@router.patch("/leads/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: uuid.UUID, payload: LeadUpdate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Lead:
    lead = get_lead_or_404(db, lead_id, context.business.id); changes = payload.model_dump(exclude_unset=True); changed = [k for k, v in changes.items() if getattr(lead, k) != v]; old_status = lead.status
    for key, value in changes.items(): setattr(lead, key, value)
    if changed: lead.version += 1
    if "status" in changed: db.add(Activity(lead_id=lead.id, actor_user_id=context.user.id if context.user else None, source="agent" if context.is_agent else "user", event_type=ActivityType.status_changed, payload={"from": old_status.value, "to": lead.status.value, "version": lead.version}))
    other = [k for k in changed if k != "status"]
    if other: db.add(Activity(lead_id=lead.id, event_type=ActivityType.lead_updated, payload={"fields": other}))
    db.commit(); return get_lead_or_404(db, lead.id, context.business.id)

@router.delete("/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> None:
    db.delete(get_lead_or_404(db, lead_id, context.business.id)); db.commit()

@router.post("/leads/{lead_id}/reminders", response_model=ReminderOut, status_code=201)
def create_reminder(lead_id: uuid.UUID, payload: ReminderCreate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Reminder:
    lead = get_lead_or_404(db, lead_id, context.business.id); reminder = Reminder(lead_id=lead_id, **payload.model_dump()); db.add(reminder); db.flush()
    try:
        synced = sync_reminder(reminder, lead)
    except CalDAVError as exc:
        db.rollback(); raise HTTPException(status_code=502, detail=str(exc)) from exc
    if synced: reminder.caldav_uid, reminder.caldav_url = synced
    db.add(Activity(lead_id=lead_id, event_type=ActivityType.reminder_created, payload={"title": reminder.title, "kind": reminder.kind.value})); db.commit(); db.refresh(reminder); return reminder

def reminder_for_business(db: Session, reminder_id: uuid.UUID, business_id: uuid.UUID) -> Reminder:
    reminder = db.scalar(select(Reminder).join(Lead).where(Reminder.id == reminder_id, Lead.business_id == business_id))
    if not reminder: raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder

@router.patch("/reminders/{reminder_id}", response_model=ReminderOut)
def update_reminder(reminder_id: uuid.UUID, payload: ReminderUpdate, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> Reminder:
    reminder = reminder_for_business(db, reminder_id, context.business.id); changes = payload.model_dump(exclude_unset=True, exclude={"completed"}); changed = [k for k, v in changes.items() if getattr(reminder, k) != v]
    for key, value in changes.items(): setattr(reminder, key, value)
    if payload.completed is not None: reminder.completed_at = datetime.now(UTC) if payload.completed else None
    try:
        synced = sync_reminder(reminder, reminder.lead)
    except CalDAVError as exc:
        db.rollback(); raise HTTPException(status_code=502, detail=str(exc)) from exc
    if synced: reminder.caldav_uid, reminder.caldav_url = synced
    if changed or payload.completed is not None: db.add(Activity(lead_id=reminder.lead_id, event_type=ActivityType.reminder_updated, payload={"fields": changed, "title": reminder.title}))
    db.commit(); db.refresh(reminder); return reminder

@router.delete("/reminders/{reminder_id}", status_code=204)
def delete_reminder(reminder_id: uuid.UUID, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> None:
    reminder = reminder_for_business(db, reminder_id, context.business.id)
    try:
        delete_event(reminder)
    except CalDAVError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    db.delete(reminder); db.commit()

@router.get("/reminders", response_model=list[ReminderOut])
def list_reminders(bucket: Literal["overdue", "today", "upcoming"] | None = None, context: RequestContext = Depends(require_context), db: Session = Depends(get_db)) -> list[Reminder]:
    query = select(Reminder).join(Lead).where(Lead.business_id == context.business.id, Reminder.completed_at.is_(None)); now = datetime.now(UTC); start = datetime.combine(now.date(), time.min, tzinfo=UTC); end = datetime.combine(now.date(), time.max, tzinfo=UTC)
    if bucket == "overdue": query = query.where(Reminder.due_at < start)
    elif bucket == "today": query = query.where(Reminder.due_at.between(start, end))
    elif bucket == "upcoming": query = query.where(Reminder.due_at > end)
    return list(db.scalars(query.order_by(Reminder.due_at.asc())))
