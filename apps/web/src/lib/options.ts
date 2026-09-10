import { LeadStatus, ReminderKind } from "./types";

export const leadStatusOptions = [
  { value: LeadStatus.Connected, label: "Connected" },
  { value: LeadStatus.Contacted, label: "Contacted" },
  { value: LeadStatus.Meeting, label: "Meeting" },
  { value: LeadStatus.Proposal, label: "Proposal" },
  { value: LeadStatus.Won, label: "Won" },
  { value: LeadStatus.Lost, label: "Lost" },
  { value: LeadStatus.Nurture, label: "Nurture" },
] as const;

export const reminderKindOptions = [
  { value: ReminderKind.FollowUp, label: "Follow-up" },
  { value: ReminderKind.Meeting, label: "Meeting" },
  { value: ReminderKind.Proposal, label: "Proposal" },
  { value: ReminderKind.CheckIn, label: "Check-in" },
  { value: ReminderKind.Other, label: "Other" },
] as const;
