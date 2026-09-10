"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Building2, CalendarClock, Check, ChevronDown, History, Mail, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { ActivityType, type Lead, type Reminder } from "@/lib/types";
import { leadStatusOptions, reminderKindOptions } from "@/lib/options";
import styles from "./lead-pages.module.scss";

const fullDate = (value: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const localDateTime = (value?: string) => { if (!value) return ""; const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
function activityText(type: ActivityType, payload: Record<string, unknown>) {
  if (type === ActivityType.LeadCreated) return "Lead created";
  if (type === ActivityType.StatusChanged) return `Status moved from ${payload.from} to ${payload.to}`;
  if (type === ActivityType.LeadUpdated) return `Updated: ${(payload.fields as string[]).join(", ")}`;
  if (type === ActivityType.ReminderCreated) return `Added ${payload.kind} reminder: ${payload.title}`;
  if (type === ActivityType.ReminderCompleted) return `Completed reminder: ${payload.title}`;
  if (type === ActivityType.ReminderDeleted) return `Deleted reminder: ${payload.title}`;
  return `Updated reminder: ${payload.title}`;
}

export default function LeadProfile({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [missing, setMissing] = useState(false);
  const [panel, setPanel] = useState<"edit" | "reminder" | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [error, setError] = useState("");
  const loadLead = useCallback(async () => {
    const response = await fetch(`/api/leads/${leadId}`, { cache: "no-store" });
    if (response.status === 404) { setMissing(true); return; }
    if (response.ok) setLead(await response.json());
  }, [leadId]);
  useEffect(() => { loadLead(); }, [loadLead]);

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!lead) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: form.get("company"), contact_name: form.get("contact_name") || null, contact_email: form.get("contact_email") || null, status: form.get("status"), next_action: form.get("next_action") || null }) });
    if (!response.ok) { setError("Could not save changes."); return; }
    setPanel(null); await loadLead();
  }
  async function addReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!lead) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/leads/${lead.id}/reminders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), kind: form.get("kind"), due_at: new Date(String(form.get("due_at"))).toISOString() }) });
    if (!response.ok) { setError("Could not add reminder."); return; }
    setPanel(null); await loadLead();
  }
  async function deleteLead() {
    if (!lead || !window.confirm("Delete this lead and its activity history? This cannot be undone.")) return;
    const response = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    if (!response.ok) { setError("Could not delete lead."); return; }
    window.location.assign("/leads");
  }
  async function completeReminder(reminder: Reminder) {
    const response = await fetch(`/api/reminders/${reminder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) });
    if (!response.ok) { setError("Could not complete reminder."); return; }
    await loadLead();
  }
  async function saveReminder(event: FormEvent<HTMLFormElement>, reminderId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/reminders/${reminderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), kind: form.get("kind"), due_at: new Date(String(form.get("due_at"))).toISOString() }) });
    if (!response.ok) { setError("Could not save reminder changes."); return; }
    setEditingReminderId(null); await loadLead();
  }
  async function deleteReminder(reminder: Reminder) {
    if (!window.confirm(`Delete “${reminder.title}”?`)) return;
    const response = await fetch(`/api/reminders/${reminder.id}`, { method: "DELETE" });
    if (!response.ok) { setError("Could not delete reminder."); return; }
    if (editingReminderId === reminder.id) setEditingReminderId(null);
    await loadLead();
  }
  if (missing) return <main className={styles.page}><Link className={styles.back} href="/leads"><ArrowLeft size={15} /> Lead directory</Link><div className={styles.empty}><Building2 size={20} /> Lead not found.</div></main>;
  if (!lead) return <main className={styles.page}><div className={styles.loading}>Loading lead profile…</div></main>;
  const openReminders = lead.reminders.filter((reminder) => !reminder.completed_at);
  const visibleActivities = showAllActivity ? lead.activities : lead.activities.slice(0, 6);
  return <main className={styles.page}>
    <header className={styles.profileHeader}>
      <div><Link className={styles.back} href="/leads"><ArrowLeft size={15} /> Lead directory</Link><div className={styles.profileTitle}><span className={styles.largeAvatar}>{lead.company.slice(0, 1)}</span><div><em className={styles.status} data-status={lead.status}>{lead.status}</em><h1>{lead.company}</h1></div></div></div>
      <div className={styles.profileActions}><button className={styles.secondaryButton} onClick={() => setPanel(panel === "reminder" ? null : "reminder")}><Bell size={15} /> Add reminder</button><button className={styles.primaryButton} onClick={() => setPanel(panel === "edit" ? null : "edit")}><Pencil size={15} /> Edit lead</button><button className={styles.deleteButton} title="Delete lead" onClick={deleteLead}><Trash2 size={15} /></button></div>
    </header>
    {error && <p className={styles.formError}>{error}</p>}
    {panel === "edit" && <section className={styles.actionPanel}><div className={styles.panelHead}><div><span>Edit lead</span><p>Controlled status, clear record.</p></div><button onClick={() => setPanel(null)}><X size={17} /></button></div><form className={styles.newLeadForm} onSubmit={saveLead}><label>Company<input name="company" defaultValue={lead.company} required /></label><label>Status<select name="status" defaultValue={lead.status}>{leadStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Contact name<input name="contact_name" defaultValue={lead.contact_name || ""} /></label><label>Contact email<input name="contact_email" type="email" defaultValue={lead.contact_email || ""} /></label><label className={styles.fullField}>Next action<textarea name="next_action" defaultValue={lead.next_action || ""} /></label><div className={styles.formActions}><button type="button" className={styles.cancel} onClick={() => setPanel(null)}>Cancel</button><button><Pencil size={15} /> Save changes</button></div></form></section>}
    {panel === "reminder" && <section className={styles.actionPanel}><div className={styles.panelHead}><div><span>Add follow-up</span><p>Keep the next move visible.</p></div><button onClick={() => setPanel(null)}><X size={17} /></button></div><form className={styles.quickReminderForm} onSubmit={addReminder}><input name="title" placeholder="Follow up with Andrea" required autoFocus /><select name="kind" defaultValue="follow_up">{reminderKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input name="due_at" type="datetime-local" defaultValue={localDateTime()} required /><button><Plus size={15} /> Add reminder</button></form></section>}
    <section className={styles.profileGrid}>
      <article className={styles.infoCard}><h2><UserRound size={16} /> Contact</h2><p>{lead.contact_name || "No contact name"}</p><p className={styles.muted}>{lead.contact_email ? <><Mail size={14} /> {lead.contact_email}</> : "No email on file"}</p></article>
      <article className={styles.infoCard}><h2><CalendarClock size={16} /> Next action</h2><p>{lead.next_action || "No next action set."}</p></article>
      <article className={styles.infoCard}><h2><Building2 size={16} /> Record</h2><p className={styles.muted}>Added {fullDate(lead.created_at)}</p><p className={styles.muted}>Updated {fullDate(lead.updated_at)}</p></article>
    </section>
    <section className={styles.timeline}><div className={styles.timelineHead}><div><span>Follow-ups</span><h2>{openReminders.length} open reminder{openReminders.length === 1 ? "" : "s"}</h2></div><button className={styles.iconAction} onClick={() => setPanel("reminder")} title="Add reminder"><Plus size={17} /></button></div>{lead.reminders.length ? lead.reminders.map((reminder) => editingReminderId === reminder.id ? <form className={styles.reminderEdit} key={reminder.id} onSubmit={(event) => saveReminder(event, reminder.id)}><input name="title" defaultValue={reminder.title} required autoFocus /><select name="kind" defaultValue={reminder.kind}>{reminderKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input name="due_at" type="datetime-local" defaultValue={localDateTime(reminder.due_at)} required /><button className={styles.saveReminder}><Check size={14} /> Save</button><button type="button" className={styles.reminderControl} onClick={() => setEditingReminderId(null)} title="Cancel"><X size={15} /></button></form> : <div className={styles.timelineRow} key={reminder.id}><span className={reminder.completed_at ? styles.doneDot : styles.dot} /><div><strong>{reminder.title}</strong><small><em className={styles.reminderChip}>{reminder.kind.replace("_", " ")}</em>{fullDate(reminder.due_at)}{reminder.completed_at ? " · completed" : ""}</small></div><div className={styles.reminderControls}>{!reminder.completed_at && <button className={styles.reminderControl} onClick={() => completeReminder(reminder)} title="Complete reminder"><Check size={15} /></button>}<button className={styles.reminderControl} onClick={() => setEditingReminderId(reminder.id)} title="Edit reminder"><Pencil size={14} /></button><button className={`${styles.reminderControl} ${styles.reminderDelete}`} onClick={() => deleteReminder(reminder)} title="Delete reminder"><Trash2 size={14} /></button></div></div>) : <div className={styles.empty}><Bell size={18} /> No follow-ups scheduled yet. Add one now.</div>}</section>
    <section className={styles.timeline}><div className={styles.timelineHead}><div><span>Activity history</span><h2>{lead.activities.length} recorded event{lead.activities.length === 1 ? "" : "s"}</h2></div><History size={18} /></div>{visibleActivities.length ? visibleActivities.map((activity) => <div className={styles.timelineRow} key={activity.id}><span className={styles.dot} /><div><strong>{activityText(activity.event_type, activity.payload)}</strong><small>{fullDate(activity.created_at)}</small></div></div>) : <div className={styles.empty}><History size={18} /> History starts with the next change.</div>}{lead.activities.length > 6 && <button className={styles.showMore} onClick={() => setShowAllActivity(!showAllActivity)}>{showAllActivity ? "Show less" : `Show ${lead.activities.length - 6} older events`}<ChevronDown size={15} /></button>}</section>
  </main>;
}
