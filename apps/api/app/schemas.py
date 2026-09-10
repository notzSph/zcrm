import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import ActivityType, LeadStatus, ReminderKind


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=280)
    kind: ReminderKind = ReminderKind.follow_up
    due_at: datetime


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=280)
    kind: ReminderKind | None = None
    due_at: datetime | None = None
    completed: bool | None = None


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    lead_id: uuid.UUID
    title: str
    kind: ReminderKind
    due_at: datetime
    completed_at: datetime | None


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    lead_id: uuid.UUID
    event_type: ActivityType
    payload: dict
    created_at: datetime


class LeadCreate(BaseModel):
    company: str = Field(min_length=1, max_length=180)
    contact_name: str | None = Field(default=None, max_length=180)
    contact_email: EmailStr | None = None
    status: LeadStatus = LeadStatus.connected
    next_action: str | None = None


class LeadUpdate(BaseModel):
    company: str | None = Field(default=None, min_length=1, max_length=180)
    contact_name: str | None = Field(default=None, max_length=180)
    contact_email: EmailStr | None = None
    status: LeadStatus | None = None
    next_action: str | None = None


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    company: str
    contact_name: str | None
    contact_email: EmailStr | None
    status: LeadStatus
    next_action: str | None
    created_at: datetime
    updated_at: datetime
    reminders: list[ReminderOut] = []
    activities: list[ActivityOut] = []
