export enum LeadStatus {
  Connected = "connected",
  Contacted = "contacted",
  Meeting = "meeting",
  Proposal = "proposal",
  Won = "won",
  Lost = "lost",
  Nurture = "nurture",
}

export enum ReminderKind {
  FollowUp = "follow_up",
  Meeting = "meeting",
  Proposal = "proposal",
  CheckIn = "check_in",
  Other = "other",
}

export enum ActivityType {
  LeadCreated = "lead_created",
  StatusChanged = "status_changed",
  LeadUpdated = "lead_updated",
  ReminderCreated = "reminder_created",
  ReminderCompleted = "reminder_completed",
  ReminderUpdated = "reminder_updated",
  ReminderDeleted = "reminder_deleted",
}

export type Reminder = {
  id: string;
  lead_id: string;
  title: string;
  kind: ReminderKind;
  due_at: string;
  completed_at: string | null;
};

export type Activity = {
  id: string;
  lead_id: string;
  event_type: ActivityType;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Interaction = {
  id: string;
  lead_id: string;
  interaction_type: "reply" | "message" | "call" | "meeting" | "proposal_sent" | "note" | "other";
  body: string;
  occurred_at: string;
  external_ref: string | null;
  created_at: string;
};

export type LeadAttachment = {
  id: string;
  lead_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  kind: string;
  created_at: string;
};

export type Lead = {
  id: string;
  company: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  linkedin_url: string | null;
  source: string | null;
  tags: string[];
  estimated_value: number | null;
  external_ref: string | null;
  status: LeadStatus;
  next_action: string | null;
  created_at: string;
  updated_at: string;
  reminders: Reminder[];
  activities: Activity[];
  interactions: Interaction[];
  attachments: LeadAttachment[];
};
