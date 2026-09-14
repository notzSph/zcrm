import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, JSON, DateTime, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .core.db import Base


class LeadStatus(str, enum.Enum):
    target = "target"
    connected = "connected"
    contacted = "contacted"
    meeting = "meeting"
    proposal = "proposal"
    won = "won"
    lost = "lost"
    nurture = "nurture"


class ReminderKind(str, enum.Enum):
    follow_up = "follow_up"
    meeting = "meeting"
    proposal = "proposal"
    check_in = "check_in"
    other = "other"


class ActivityType(str, enum.Enum):
    lead_created = "lead_created"
    status_changed = "status_changed"
    lead_updated = "lead_updated"
    reminder_created = "reminder_created"
    reminder_completed = "reminder_completed"
    reminder_updated = "reminder_updated"
    reminder_deleted = "reminder_deleted"


class InteractionType(str, enum.Enum):
    reply = "reply"
    message = "message"
    call = "call"
    meeting = "meeting"
    proposal_sent = "proposal_sent"
    note = "note"
    other = "other"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(180))
    password_hash: Mapped[str] = mapped_column(String(512))
    profile_pic: Mapped[str | None] = mapped_column(String(512))
    reset_token: Mapped[str | None] = mapped_column(String(128), index=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[list["BusinessMembership"]] = relationship(back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    sessions: Mapped[list["UserSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    logo_url: Mapped[str | None] = mapped_column(String(512))
    website: Mapped[str | None] = mapped_column(String(512))
    industry: Mapped[str | None] = mapped_column(String(120), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[list["BusinessMembership"]] = relationship(back_populates="business", cascade="all, delete-orphan", lazy="selectin")
    owner: Mapped["User | None"] = relationship(foreign_keys=[owner_id])
    leads: Mapped[list["Lead"]] = relationship(back_populates="business", cascade="all, delete-orphan")


class BusinessMembership(Base):
    __tablename__ = "business_memberships"
    __table_args__ = (UniqueConstraint("user_id", "business_id", name="ux_business_memberships_user_business"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    is_admin: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="memberships")
    business: Mapped[Business] = relationship(back_populates="memberships")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    active_business_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("businesses.id", ondelete="SET NULL"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="sessions")
    active_business: Mapped[Business | None] = relationship(lazy="selectin")


class ApiIdempotency(Base):
    __tablename__ = "api_idempotency"
    __table_args__ = (UniqueConstraint("business_id", "scope_key", name="ux_api_idempotency_business_scope"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    scope_key: Mapped[str] = mapped_column(String(255))
    request_hash: Mapped[str] = mapped_column(String(64))
    status_code: Mapped[int] = mapped_column(default=201, nullable=False)
    response_body: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LeadUpload(Base):
    __tablename__ = "lead_uploads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(64), default="document", server_default="document")
    status: Mapped[str] = mapped_column(String(32), default="initiated", server_default="initiated", index=True)
    storage_key: Mapped[str | None] = mapped_column(String(255), unique=True)
    size_bytes: Mapped[int | None] = mapped_column()
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    source: Mapped[str] = mapped_column(String(64), default="user", server_default="user")
    idempotency_key: Mapped[str | None] = mapped_column(String(255), index=True)
    request_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    company: Mapped[str] = mapped_column(String(180), index=True)
    contact_name: Mapped[str | None] = mapped_column(String(180))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    contact_phone: Mapped[str | None] = mapped_column(String(64))
    linkedin_url: Mapped[str | None] = mapped_column(String(512))
    source: Mapped[str | None] = mapped_column(String(120), index=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    estimated_value: Mapped[float | None] = mapped_column(Numeric(12, 2))
    external_ref: Mapped[str | None] = mapped_column(String(255), index=True)
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.target, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    next_action: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    version: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)

    business: Mapped[Business] = relationship(back_populates="leads")
    reminders: Mapped[list["Reminder"]] = relationship(back_populates="lead", cascade="all, delete-orphan", order_by="Reminder.due_at")
    activities: Mapped[list["Activity"]] = relationship(back_populates="lead", cascade="all, delete-orphan", order_by="Activity.created_at.desc()")
    interactions: Mapped[list["Interaction"]] = relationship(back_populates="lead", cascade="all, delete-orphan", order_by="Interaction.occurred_at.desc()")
    attachments: Mapped[list["LeadAttachment"]] = relationship(back_populates="lead", cascade="all, delete-orphan", order_by="LeadAttachment.created_at.desc()")


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(280))
    kind: Mapped[ReminderKind] = mapped_column(Enum(ReminderKind, name="reminder_kind"), default=ReminderKind.follow_up, index=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    location: Mapped[str | None] = mapped_column(String(512))
    duration_minutes: Mapped[int] = mapped_column(default=30, server_default="30", nullable=False)
    travel_minutes: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)
    alarm_minutes_before: Mapped[list] = mapped_column(JSON, default=lambda: [120, 60], nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    external_ref: Mapped[str | None] = mapped_column(String(255), index=True)
    caldav_uid: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    caldav_url: Mapped[str | None] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    lead: Mapped[Lead] = relationship(back_populates="reminders")
    owner_user: Mapped[User | None] = relationship(foreign_keys=[owner_user_id])

    @property
    def calendar_synced(self) -> bool:
        return bool(self.caldav_uid and self.caldav_url)


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[ActivityType] = mapped_column(Enum(ActivityType, name="activity_type"), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    source: Mapped[str] = mapped_column(String(64), default="system", server_default="system", nullable=False)
    revision: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)
    redacted: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)
    recorded_seq: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False, server_default=text("nextval('timeline_recorded_seq')"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    lead: Mapped[Lead] = relationship(back_populates="activities")


class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    interaction_type: Mapped[InteractionType] = mapped_column(Enum(InteractionType, name="interaction_type"), index=True)
    body: Mapped[str] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    external_ref: Mapped[str | None] = mapped_column(String(255), index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    source: Mapped[str] = mapped_column(String(64), default="user", server_default="user", nullable=False)
    revision: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)
    redacted: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)
    recorded_seq: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False, server_default=text("nextval('timeline_recorded_seq')"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    lead: Mapped[Lead] = relationship(back_populates="interactions")


class LeadAttachment(Base):
    __tablename__ = "lead_attachments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(255), unique=True)
    content_type: Mapped[str] = mapped_column(String(160))
    size_bytes: Mapped[int] = mapped_column()
    kind: Mapped[str] = mapped_column(String(64), default="document", index=True)
    status: Mapped[str] = mapped_column(String(32), default="completed", server_default="completed", index=True, nullable=False)
    source: Mapped[str] = mapped_column(String(64), default="user", server_default="user", nullable=False)
    revision: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)
    redacted: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)
    recorded_seq: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False, server_default=text("nextval('timeline_recorded_seq')"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    lead: Mapped[Lead] = relationship(back_populates="attachments")
