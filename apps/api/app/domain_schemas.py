from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .domain_models import ActivityType, InteractionType, LeadStatus, ReminderKind


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
    owner_id: uuid.UUID | None = None
    name: str
    logo_url: str | None = None
    website: str | None = None
    industry: str | None = None
    description: str | None = None
    created_at: datetime


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: EmailStr
    display_name: str
    profile_pic: str | None = None
    businesses: list[BusinessOut]
    active_business_id: uuid.UUID | None


class LoginOut(BaseModel):
    session_token: str
    user: UserOut


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=180)
    profile_pic: str | None = Field(default=None, max_length=512)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    user_id: uuid.UUID
    token: str
    new_password: str = Field(min_length=10)


class BusinessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    logo_url: str | None = Field(default=None, max_length=512)
    website: str | None = Field(default=None, max_length=512)
    industry: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class BusinessUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    logo_url: str | None = Field(default=None, max_length=512)
    website: str | None = Field(default=None, max_length=512)
    industry: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class ActiveBusinessUpdate(BaseModel):
    business_id: uuid.UUID


class MemberAdd(BaseModel):
    email: EmailStr


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: EmailStr
    display_name: str
    profile_pic: str | None = None
    is_admin: bool


class MemberRoleUpdate(BaseModel):
    is_admin: bool


class OwnershipTransfer(BaseModel):
    user_id: uuid.UUID


class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=280)
    kind: ReminderKind = ReminderKind.follow_up
    due_at: datetime
    location: str | None = Field(default=None, max_length=512)
    duration_minutes: int = Field(default=30, ge=1, le=1440)
    travel_minutes: int = Field(default=0, ge=0, le=1440)
    alarm_minutes_before: list[int] = Field(default_factory=lambda: [120, 60], min_length=0, max_length=8)
    external_ref: str | None = Field(default=None, max_length=255)


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=280)
    kind: ReminderKind | None = None
    due_at: datetime | None = None
    location: str | None = Field(default=None, max_length=512)
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    travel_minutes: int | None = Field(default=None, ge=0, le=1440)
    alarm_minutes_before: list[int] | None = Field(default=None, min_length=0, max_length=8)
    completed: bool | None = None


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    lead_id: uuid.UUID
    title: str
    kind: ReminderKind
    due_at: datetime
    location: str | None
    duration_minutes: int
    travel_minutes: int
    alarm_minutes_before: list[int]
    completed_at: datetime | None
    external_ref: str | None
    caldav_uid: str | None
    caldav_url: str | None
    calendar_synced: bool


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
    contact_phone: str | None = Field(default=None, max_length=64)
    linkedin_url: str | None = Field(default=None, max_length=512)
    source: str | None = Field(default=None, max_length=120)
    tags: list[str] = Field(default_factory=list)
    estimated_value: float | None = None
    external_ref: str | None = Field(default=None, max_length=255)
    status: LeadStatus = LeadStatus.connected
    description: str | None = None
    next_action: str | None = None


class LeadUpdate(BaseModel):
    company: str | None = Field(default=None, min_length=1, max_length=180)
    contact_name: str | None = Field(default=None, max_length=180)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=64)
    linkedin_url: str | None = Field(default=None, max_length=512)
    source: str | None = Field(default=None, max_length=120)
    tags: list[str] | None = None
    estimated_value: float | None = None
    external_ref: str | None = Field(default=None, max_length=255)
    status: LeadStatus | None = None
    description: str | None = None
    next_action: str | None = None


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    company: str
    contact_name: str | None
    contact_email: EmailStr | None
    contact_phone: str | None
    linkedin_url: str | None
    source: str | None
    tags: list[str]
    estimated_value: float | None
    external_ref: str | None
    status: LeadStatus
    description: str | None
    next_action: str | None
    created_at: datetime
    updated_at: datetime
    reminders: list[ReminderOut] = []
    activities: list[ActivityOut] = []
    interactions: list["InteractionOut"] = []
    attachments: list["AttachmentOut"] = []


class StatusUpdate(BaseModel):
    status: LeadStatus
    next_action: str | None = None


class InteractionCreate(BaseModel):
    interaction_type: InteractionType
    body: str = Field(min_length=1, max_length=10000)
    occurred_at: datetime | None = None
    external_ref: str | None = Field(default=None, max_length=255)


class InteractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    lead_id: uuid.UUID
    interaction_type: InteractionType
    body: str
    occurred_at: datetime
    external_ref: str | None
    created_at: datetime


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    lead_id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    kind: str


class AttachmentUpdate(BaseModel):
    filename: str | None = Field(default=None, min_length=1, max_length=255)
    kind: str | None = Field(default=None, min_length=1, max_length=64)
    created_at: datetime
