"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  AlarmClock,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  FileText,
  MessageSquareText,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  UserRoundPlus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ActivityType, LeadStatus, type Activity, type Lead, type Reminder } from "@/lib/types";
import { leadStatusOptions, reminderKindOptions } from "@/lib/options";
import styles from "./crm-dashboard.module.scss";

const stages: { key: LeadStatus; label: string; short?: string; icon: LucideIcon }[] = [
  { key: LeadStatus.Connected, label: "Connected", icon: UserRoundPlus },
  { key: LeadStatus.Contacted, label: "Contacted", icon: MessageSquareText },
  { key: LeadStatus.Meeting, label: "Meeting", icon: CalendarDays },
  { key: LeadStatus.Proposal, label: "Proposal", icon: FileText },
  { key: LeadStatus.Won, label: "Outcome", short: "won / lost / nurture", icon: Trophy },
];
const outcomes: LeadStatus[] = [LeadStatus.Won, LeadStatus.Lost, LeadStatus.Nurture];

function dateLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const day = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function localDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function leadReminder(lead: Lead) {
  return lead.reminders.find((reminder) => !reminder.completed_at);
}

function reminderState(value: string) {
  const due = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (due < today) return "overdue";
  if (due < tomorrow) return "today";
  return "upcoming";
}

export default function CrmDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<LeadStatus | null>(null);

  const refresh = async () => {
    const response = await fetch("/api/leads", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    if (!response.ok) {
      setError("Could not load your pipeline.");
      return;
    }
    const data = (await response.json()) as Lead[];
    setLeads(data);
    setSelected((current) =>
      current ? (data.find((lead) => lead.id === current.id) ?? null) : null,
    );
  };

  const refreshLead = async (leadId: string) => {
    const response = await fetch(`/api/leads/${leadId}`, { cache: "no-store" });
    if (!response.ok) {
      setError("Could not refresh this lead.");
      return;
    }
    const freshLead = (await response.json()) as Lead;
    setLeads((current) => current.map((lead) => lead.id === leadId ? freshLead : lead));
    setSelected((current) => current?.id === leadId ? freshLead : current);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const reminders = useMemo(
    () =>
      leads
        .flatMap((lead) =>
          lead.reminders
            .filter((reminder) => !reminder.completed_at)
            .map((reminder) => ({ reminder, lead })),
        )
        .sort(
          (a, b) => +new Date(a.reminder.due_at) - +new Date(b.reminder.due_at),
        ),
    [leads],
  );
  const now = new Date();
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
  const overdue = reminders.filter(
    ({ reminder }) =>
      +new Date(reminder.due_at) <
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
  );
  const dueToday = reminders.filter(
    ({ reminder }) =>
      +new Date(reminder.due_at) >=
        new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() &&
      +new Date(reminder.due_at) < todayEnd,
  );

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: form.get("company"),
        contact_name: form.get("contact_name") || null,
        contact_email: form.get("contact_email") || null,
        next_action: form.get("next_action") || null,
      }),
    });
    if (!response.ok) {
      setError("Could not create lead.");
      return;
    }
    setNewLeadOpen(false);
    await refresh();
  }

  async function updateLead(id: string, updates: Partial<Lead>) {
    const response = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      setError("Could not save changes.");
      return;
    }
    await refreshLead(id);
  }

  async function moveLead(leadId: string, destination: LeadStatus) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.status === destination) return;
    await updateLead(leadId, { status: destination });
  }

  async function addReminder(
    leadId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const due = form.get("due_at") as string;
    const response = await fetch(`/api/leads/${leadId}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        kind: form.get("kind") || "follow_up",
        due_at: new Date(due).toISOString(),
      }),
    });
    if (!response.ok) {
      setError("Could not add reminder.");
      return;
    }
    event.currentTarget.reset();
    await refreshLead(leadId);
  }

  async function completeReminder(reminder: Reminder) {
    const response = await fetch(`/api/reminders/${reminder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    if (!response.ok) {
      setError("Could not complete reminder.");
      return;
    }
    const leadId = leads.find((lead) => lead.reminders.some((item) => item.id === reminder.id))?.id;
    if (leadId) await refreshLead(leadId); else await refresh();
  }

  async function updateReminder(id: string, updates: Partial<Reminder>) {
    const response = await fetch(`/api/reminders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    if (!response.ok) { setError("Could not update reminder."); return; }
    const leadId = leads.find((lead) => lead.reminders.some((item) => item.id === id))?.id;
    if (leadId) await refreshLead(leadId); else await refresh();
  }

  async function deleteReminder(id: string) {
    if (!window.confirm("Delete this reminder?")) return;
    const leadId = leads.find((lead) => lead.reminders.some((item) => item.id === id))?.id;
    const response = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("Could not delete reminder."); return; }
    if (leadId) await refreshLead(leadId); else await refresh();
  }

  async function deleteLead(id: string) {
    if (!window.confirm("Delete this lead and its full history? This cannot be undone.")) return;
    const response = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("Could not delete lead."); return; }
    setSelected(null);
    await refresh();
  }

  const headerClass = `w-100 f-row j-between a-center ${styles.header}`;

  return (
    <main className={styles.page}>
      <header className={headerClass}>
        <div>
          <div className={styles.brand}>
            <span>z</span>CRM
          </div>
          <p>Pipeline, no bullshit.</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.primary} href="/leads/new">
            <Plus size={17} /> New lead
          </Link>
        </div>
      </header>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      <section className={styles.overview}>
        <div>
          <span><ActivityIcon size={14} /> Open pipeline</span>
          <strong>
            {leads.filter((lead) => !outcomes.includes(lead.status)).length}
          </strong>
        </div>
        <div>
          <span><Bell size={14} /> Follow-ups today</span>
          <strong>{dueToday.length}</strong>
        </div>
        <div className={overdue.length ? styles.danger : ""}>
          <span><AlarmClock size={14} /> Overdue</span>
          <strong>{overdue.length}</strong>
        </div>
        <div>
          <span><Trophy size={14} /> Closed</span>
          <strong>
            {leads.filter((lead) => outcomes.includes(lead.status)).length}
          </strong>
        </div>
      </section>

      <section className={styles.reminderStrip}>
        <div className={styles.reminderTitle}>
          <Bell size={17} />
          <div>
            <span>Follow-up queue</span>
            <small>
              {reminders.length ? `${reminders.length} open` : "All clear"}
            </small>
          </div>
        </div>
        <div className={styles.reminderItems}>
          {reminders.slice(0, 4).map(({ reminder, lead }) => (
            <button
              className={
                +new Date(reminder.due_at) < todayEnd
                  ? styles.reminderUrgent
                  : styles.reminder
              }
              key={reminder.id}
              onClick={() => setSelected(lead)}
            >
              <span>{dateLabel(reminder.due_at)}</span>
              {lead.company}: {reminder.title}
              <ChevronRight size={14} />
            </button>
          ))}
          {!reminders.length && (
            <p className={styles.emptyReminder}>
              Nothing hanging over your head. Suspiciously clean.
            </p>
          )}
        </div>
      </section>

      <section className={styles.board} aria-label="Sales pipeline">
        {stages.map((stage) => {
          const StageIcon = stage.icon;
          const columnLeads = leads.filter((lead) =>
            stage.key === LeadStatus.Won
              ? outcomes.includes(lead.status)
              : lead.status === stage.key,
          );
          return (
            <div
              className={`${styles.column} ${dragTarget === stage.key ? styles.dropTarget : ""}`}
              key={stage.key}
              onDragOver={(event) => { event.preventDefault(); setDragTarget(stage.key); }}
              onDragLeave={(event) => { if (event.currentTarget === event.target) setDragTarget(null); }}
              onDrop={(event) => {
                event.preventDefault();
                const leadId = event.dataTransfer.getData("text/plain") || draggingId;
                setDragTarget(null); setDraggingId(null);
                if (leadId) moveLead(leadId, stage.key);
              }}
            >
              <div className={styles.columnHead}>
                <div>
                  <h2><StageIcon size={14} /> {stage.label}</h2>
                  {stage.short && <small>{stage.short}</small>}
                </div>
                <span>{columnLeads.length}</span>
              </div>
              <div className={styles.cards}>
                {loading && <div className={styles.skeleton} />}
                {!loading &&
                  columnLeads.map((lead) => (
                    <button
                      className={styles.card}
                      key={lead.id}
                      onClick={() => setSelected(lead)}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", lead.id);
                        setDraggingId(lead.id);
                      }}
                      onDragEnd={() => { setDraggingId(null); setDragTarget(null); }}
                    >
                      <div className={styles.cardTop}>
                        <strong>{lead.company}</strong>
                        <em className={styles.statusChip} data-status={lead.status}>{lead.status}</em>
                      </div>
                      <span>{lead.contact_name || "No contact yet"}</span>
                      {lead.next_action && <p>{lead.next_action}</p>}
                      {leadReminder(lead) && (
                        <small className={styles.dueChip} data-due={reminderState(leadReminder(lead)!.due_at)}>
                          <Bell size={12} />{" "}
                          {dateLabel(leadReminder(lead)!.due_at)}
                        </small>
                      )}
                      <span className={styles.cardLink}>View profile <ChevronRight size={12} /></span>
                    </button>
                  ))}
                {!loading && !columnLeads.length && (
                  <div className={styles.blank}>
                    <CirclePlus size={16} /> nothing here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <footer className={styles.poweredBy}>
        <span>Powered by</span>
        <Image src="/brand/zs-mark.svg" alt="zSpinach" width={18} height={18} />
        <strong>zSpinach</strong>
      </footer>

      {newLeadOpen && (
        <Modal title="New lead" onClose={() => setNewLeadOpen(false)}>
          <form className={styles.form} onSubmit={createLead}>
            <label>
              Company
              <input name="company" required autoFocus />
            </label>
            <label>
              Contact name
              <input name="contact_name" />
            </label>
            <label>
              Email
              <input type="email" name="contact_email" />
            </label>
            <label>
              Next action
              <textarea
                name="next_action"
                placeholder="What moves this forward?"
              />
            </label>
            <button className={styles.primary}>
              <Plus size={16} /> Add to connected
            </button>
          </form>
        </Modal>
      )}
      {selected && (
        <LeadDrawer
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateLead}
          onAddReminder={addReminder}
          onCompleteReminder={completeReminder}
          onUpdateReminder={updateReminder}
          onDeleteReminder={deleteReminder}
          onDeleteLead={deleteLead}
        />
      )}
    </main>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <h2>{title}</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LeadDrawer({
  lead,
  onClose,
  onUpdate,
  onAddReminder,
  onCompleteReminder,
  onUpdateReminder,
  onDeleteReminder,
  onDeleteLead,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Lead>) => Promise<void>;
  onAddReminder: (
    leadId: string,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  onCompleteReminder: (reminder: Reminder) => Promise<void>;
  onUpdateReminder: (id: string, updates: Partial<Reminder>) => Promise<void>;
  onDeleteReminder: (id: string) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
}) {
  const [company, setCompany] = useState(lead.company);
  const [contactName, setContactName] = useState(lead.contact_name || "");
  const [contactEmail, setContactEmail] = useState(lead.contact_email || "");
  const [nextAction, setNextAction] = useState(lead.next_action || "");
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  useEffect(() => {
    setCompany(lead.company);
    setContactName(lead.contact_name || "");
    setContactEmail(lead.contact_email || "");
    setNextAction(lead.next_action || "");
    setStatus(lead.status);
  }, [lead]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onUpdate(lead.id, {
      company,
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      next_action: nextAction || null,
      status,
    });
  }
  async function saveReminder(event: FormEvent<HTMLFormElement>, reminder: Reminder) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onUpdateReminder(reminder.id, { title: String(form.get("title")), kind: form.get("kind") as Reminder["kind"], due_at: new Date(String(form.get("due_at"))).toISOString() });
    setEditingReminderId(null);
  }
  return (
    <div className={styles.drawerWrap}>
      <button className={styles.scrim} aria-label="Close" onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.drawerHead}>
          <div>
            <span>Lead record</span>
            <h2>{lead.company}</h2>
          </div>
          <button onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <form className={styles.form} onSubmit={save}>
          <label>
            Company
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              required
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as LeadStatus)}
            >
              {leadStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contact name
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
            />
          </label>
          <label>
            Next action
            <textarea
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </label>
          <button className={styles.primary}>Save changes</button>
        </form>
        <div className={styles.drawerSection}>
          <div className={styles.sectionTitle}>
            <h3>Reminders</h3>
            <span>
              {lead.reminders.filter((item) => !item.completed_at).length} open
            </span>
          </div>
          {lead.reminders.map((reminder) => (
            <div className={styles.reminderRow} key={reminder.id}>
              {editingReminderId === reminder.id ? <form className={styles.editReminder} onSubmit={(event) => saveReminder(event, reminder)}><input name="title" defaultValue={reminder.title} required /><select name="kind" defaultValue={reminder.kind}>{reminderKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input name="due_at" type="datetime-local" defaultValue={localDateTime(reminder.due_at)} required /><div><button type="submit">Save</button><button type="button" onClick={() => setEditingReminderId(null)}>Cancel</button></div></form> : <><button disabled={Boolean(reminder.completed_at)} onClick={() => onCompleteReminder(reminder)}>{reminder.completed_at ? <Check size={14} /> : <span />}</button><div><strong>{reminder.title}</strong><small><em className={styles.kindChip}>{reminder.kind.replace("_", " ")}</em>{dateLabel(reminder.due_at)}{reminder.completed_at ? " · done" : ""}</small></div><div className={styles.reminderActions}><button type="button" title="Edit reminder" onClick={() => setEditingReminderId(reminder.id)}><Pencil size={13} /></button><button type="button" title="Delete reminder" onClick={() => onDeleteReminder(reminder.id)}><Trash2 size={13} /></button></div></>}
            </div>
          ))}
          <form
            className={styles.addReminder}
            onSubmit={(event) => onAddReminder(lead.id, event)}
          >
            <input name="title" placeholder="Follow up…" required />
            <select name="kind" defaultValue="follow_up">
              {reminderKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input
              name="due_at"
              type="datetime-local"
              defaultValue={localDateTime()}
              required
            />
            <button aria-label="Add reminder">
              <Plus size={16} />
            </button>
          </form>
        </div>
        <ActivityLog activities={lead.activities} />
        <button className={styles.deleteLead} type="button" onClick={() => onDeleteLead(lead.id)}><Trash2 size={14} /> Delete lead</button>
      </aside>
    </div>
  );
}

function ActivityLog({ activities }: { activities: Activity[] }) {
  const description = (activity: Activity) => {
    if (activity.event_type === ActivityType.LeadCreated) return "Lead created";
    if (activity.event_type === ActivityType.StatusChanged) return `Status moved from ${activity.payload.from} to ${activity.payload.to}`;
    if (activity.event_type === ActivityType.LeadUpdated) return `Updated: ${(activity.payload.fields as string[]).join(", ")}`;
    if (activity.event_type === ActivityType.ReminderCreated) return `Added ${activity.payload.kind} reminder: ${activity.payload.title}`;
    if (activity.event_type === ActivityType.ReminderCompleted) return `Completed reminder: ${activity.payload.title}`;
    if (activity.event_type === ActivityType.ReminderDeleted) return `Deleted reminder: ${activity.payload.title}`;
    return `Updated reminder: ${activity.payload.title}`;
  };
  return <div className={styles.activitySection}>
    <div className={styles.sectionTitle}><h3>Activity</h3><span>{activities.length} event{activities.length === 1 ? "" : "s"}</span></div>
    {activities.length ? activities.map((activity) => <div className={styles.activityRow} key={activity.id}><span /><div><strong>{description(activity)}</strong><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.created_at))}</small></div></div>) : <p className={styles.noActivity}>History starts with the next change.</p>}
  </div>;
}
