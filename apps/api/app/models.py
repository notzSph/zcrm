import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String, Text, func
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


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company: Mapped[str] = mapped_column(String(180), index=True)
    contact_name: Mapped[str | None] = mapped_column(String(180))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.connected, index=True)
    next_action: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
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
