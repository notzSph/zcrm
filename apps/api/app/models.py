import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class LeadStatus(str, enum.Enum):
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


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(180))
    password_hash: Mapped[str] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[list["BusinessMembership"]] = relationship(back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    sessions: Mapped[list["UserSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(180), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[list["BusinessMembership"]] = relationship(back_populates="business", cascade="all, delete-orphan", lazy="selectin")
    leads: Mapped[list["Lead"]] = relationship(back_populates="business", cascade="all, delete-orphan")


class BusinessMembership(Base):
    __tablename__ = "business_memberships"
    __table_args__ = (UniqueConstraint("user_id", "business_id", name="ux_business_memberships_user_business"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
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


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    company: Mapped[str] = mapped_column(String(180), index=True)
    contact_name: Mapped[str | None] = mapped_column(String(180))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.connected, index=True)
    next_action: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    business: Mapped[Business] = relationship(back_populates="leads")
    reminders: Mapped[list["Reminder"]] = relationship(back_populates="lead", cascade="all, delete-orphan", order_by="Reminder.due_at")
    activities: Mapped[list["Activity"]] = relationship(back_populates="lead", cascade="all, delete-orphan", order_by="Activity.created_at.desc()")


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(280))
    kind: Mapped[ReminderKind] = mapped_column(Enum(ReminderKind, name="reminder_kind"), default=ReminderKind.follow_up, index=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    lead: Mapped[Lead] = relationship(back_populates="reminders")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[ActivityType] = mapped_column(Enum(ActivityType, name="activity_type"), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    lead: Mapped[Lead] = relationship(back_populates="activities")
