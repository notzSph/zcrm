"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity as ActivityIcon,
  AlarmClock,
  BadgeEuro,
  Bell,
  CalendarDays,
  ChevronRight,
  CirclePlus,
  CircleX,
  FileText,
  MessageSquareText,
  Plus,
  Radio,
  Send,
  Sprout,
  Trophy,
  Target as TargetIcon,
  Users,
  UserRoundPlus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SelectMenu, { type SelectMenuOption } from "@/lib/components/select-menu/select-menu";
import LeadDrawer from "@/lib/components/lead-drawer/lead-drawer";
import {
  LeadStatus,
  type Lead,
} from "@/lib/types";
import styles from "./crm-dashboard.module.scss";

const stages: {
  key: LeadStatus;
  label: string;
  short?: string;
  icon: LucideIcon;
}[] = [
  { key: LeadStatus.Target, label: "Target", icon: TargetIcon },
  { key: LeadStatus.Connected, label: "Connected", icon: UserRoundPlus },
  { key: LeadStatus.Contacted, label: "Contacted", icon: MessageSquareText },
  { key: LeadStatus.Meeting, label: "Meeting", icon: CalendarDays },
  { key: LeadStatus.Proposal, label: "Proposal", icon: FileText },
  {
    key: LeadStatus.Won,
    label: "Outcome",
    short: "won / lost / nurture",
    icon: Trophy,
  },
];
const outcomes: LeadStatus[] = [
  LeadStatus.Won,
  LeadStatus.Lost,
  LeadStatus.Nurture,
];
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
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  if (due < today) return "overdue";
  if (due < tomorrow) return "today";
  return "upcoming";
}

export default function CrmDashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<LeadStatus | null>(null);
  const [reminderPage, setReminderPage] = useState(0);

  const refresh = async (hardRefresh = true, syncSelected = true) => {
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
    if (syncSelected) {
      setSelected((current) =>
        current ? (data.find((lead) => lead.id === current.id) ?? null) : null,
      );
    }
    if (hardRefresh) router.refresh();
  };

  const refreshLead = async (leadId: string) => {
    const response = await fetch(`/api/leads/${leadId}`, { cache: "no-store" });
    if (!response.ok) {
      setError("Could not refresh this lead.");
      return;
    }
    const freshLead = (await response.json()) as Lead;
    setLeads((current) =>
      current.map((lead) => (lead.id === leadId ? freshLead : lead)),
    );
    setSelected((current) => (current?.id === leadId ? freshLead : current));
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const interval = window.setInterval(() => {
      if (!document.hidden) refresh(false, false);
    }, 5000);
    return () => window.clearInterval(interval);
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
  const reminderPageCount = Math.max(1, Math.ceil(reminders.length / 4));
  const visibleReminders = reminders.slice(
    reminderPage * 4,
    reminderPage * 4 + 4,
  );
  useEffect(() => {
    setReminderPage(0);
  }, [reminders.length]);

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
        description: form.get("description") || null,
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

  const headerClass = `w-100 f-row j-between a-center ${styles.header}`;

  return (
    <main className={styles.page}>
      <header className={headerClass}>
        <div>
          <h1 className={styles.brand}>Sales pipeline</h1>
          <p>Track relationships, move opportunities, and plan your next follow-up.</p>
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
          <button aria-label="Dismiss error" title="Dismiss" onClick={() => setError("")}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className={styles.dashboardTop}>
        <Link className={styles.metricCard} href="/leads">
          <span><ActivityIcon size={14} /> Open pipeline</span>
          <strong>{leads.filter((lead) => !outcomes.includes(lead.status)).length}</strong>
          <small>Review active opportunities <ChevronRight size={13} /></small>
        </Link>
        <Link className={styles.metricCard} href="/calendar">
          <span><Bell size={14} /> Follow-ups today</span>
          <strong>{dueToday.length}</strong>
          <small>Open calendar <ChevronRight size={13} /></small>
        </Link>
        <Link
          className={`${styles.metricCard} ${overdue.length ? styles.danger : ""}`}
          href="/calendar"
        >
          <span><AlarmClock size={14} /> Pipeline health</span>
          <strong>{overdue.length}</strong>
          <small>{overdue.length ? "overdue" : "no overdue"} · {leads.filter((lead) => outcomes.includes(lead.status)).length} closed</small>
        </Link>
        <Link className={styles.metricCard} href="/leads">
          <span><Users size={14} /> Total leads</span>
          <strong>{leads.length}</strong>
          <small>Browse directory <ChevronRight size={13} /></small>
        </Link>

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
            {visibleReminders.map(({ reminder, lead }) => (
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
          {reminderPageCount > 1 && (
            <div className={styles.reminderPagination}>
              <button
                onClick={() => setReminderPage((page) => Math.max(0, page - 1))}
                disabled={reminderPage === 0}
                aria-label="Previous follow-ups"
              >
                ←
              </button>
              <span>
                {reminderPage + 1} / {reminderPageCount}
              </span>
              <button
                onClick={() =>
                  setReminderPage((page) =>
                    Math.min(reminderPageCount - 1, page + 1),
                  )
                }
                disabled={reminderPage === reminderPageCount - 1}
                aria-label="Next follow-ups"
              >
                →
              </button>
            </div>
          )}
        </section>
      </div>

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
              onDragOver={(event) => {
                event.preventDefault();
                setDragTarget(stage.key);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) setDragTarget(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const leadId =
                  event.dataTransfer.getData("text/plain") || draggingId;
                setDragTarget(null);
                setDraggingId(null);
                if (leadId) moveLead(leadId, stage.key);
              }}
            >
              <div className={styles.columnHead}>
                <div>
                  <h2>
                    <StageIcon size={14} /> {stage.label}
                  </h2>
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
                      aria-label={`Open ${lead.company} lead details`}
                      onClick={() => setSelected(lead)}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", lead.id);
                        setDraggingId(lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragTarget(null);
                      }}
                    >
                      <div className={styles.cardTop}>
                        <strong>{lead.company}</strong>
                        {outcomes.includes(lead.status) && (
                          <em className={styles.statusChip} data-status={lead.status}>
                            {lead.status}
                          </em>
                        )}
                      </div>
                      <span>{lead.contact_name || "No contact yet"}</span>
                      {lead.next_action && <p>{lead.next_action}</p>}
                      {(lead.estimated_value != null || lead.source) && (
                        <div className={styles.cardMeta}>
                          {lead.estimated_value != null && (
                            <span><BadgeEuro size={12} />{lead.estimated_value.toLocaleString()}</span>
                          )}
                          {lead.source && <span>{lead.source}</span>}
                        </div>
                      )}
                      {leadReminder(lead) && (
                        <small
                          className={styles.dueChip}
                          data-due={reminderState(leadReminder(lead)!.due_at)}
                        >
                          <Bell size={12} />{" "}
                          {dateLabel(leadReminder(lead)!.due_at)}
                        </small>
                      )}
                      <span className={styles.cardLink}>
                        View profile <ChevronRight size={12} />
                      </span>
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
        <Image
          src="/brand/zspinach.svg"
          alt="zSpinach"
          width={18}
          height={18}
        />
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
              Description
              <textarea
                name="description"
                placeholder="Useful context for this lead"
              />
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
          key={selected.id}
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateLead}
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
          <button aria-label={`Close ${title}`} title="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
