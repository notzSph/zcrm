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

export type Lead = {
  id: string;
  company: string;
  contact_name: string | null;
  contact_email: string | null;
  status: LeadStatus;
  next_action: string | null;
  created_at: string;
  updated_at: string;
  reminders: Reminder[];
  activities: Activity[];
};
