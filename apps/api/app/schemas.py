import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import ActivityType, LeadStatus, ReminderKind


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10)
    display_name: str = Field(min_length=1, max_length=180)
    business_name: str = Field(min_length=1, max_length=180)


class BusinessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    created_at: datetime


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    display_name: str
    businesses: list[BusinessOut]
    active_business_id: uuid.UUID | None


class LoginOut(BaseModel):
    session_token: str
    user: UserOut


class BusinessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)


class ActiveBusinessUpdate(BaseModel):
    business_id: uuid.UUID


class MemberAdd(BaseModel):
    email: EmailStr


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
