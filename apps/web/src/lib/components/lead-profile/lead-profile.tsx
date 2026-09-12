"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  FileText,
  History,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { ActivityType, type Lead, type Reminder } from "@/lib/types";
import { leadStatusOptions, reminderKindOptions } from "@/lib/options";
import styles from "@/lib/components/lead-pages/lead-pages.module.scss";

const fullDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const localDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
function activityText(type: ActivityType, payload: Record<string, unknown>) {
  if (type === ActivityType.LeadCreated) return "Lead created";
  if (type === ActivityType.StatusChanged)
    return `Status moved from ${payload.from} to ${payload.to}`;
  if (type === ActivityType.LeadUpdated)
    return `Updated: ${(payload.fields as string[]).join(", ")}`;
  if (type === ActivityType.ReminderCreated)
    return `Added ${payload.kind} reminder: ${payload.title}`;
  if (type === ActivityType.ReminderCompleted)
    return `Completed reminder: ${payload.title}`;
  if (type === ActivityType.ReminderDeleted)
    return `Deleted reminder: ${payload.title}`;
  return `Updated reminder: ${payload.title}`;
}

export default function LeadProfile({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [missing, setMissing] = useState(false);
  const [panel, setPanel] = useState<
    "edit" | "reminder" | "interaction" | null
  >(null);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(
    null,
  );
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const loadLead = useCallback(async () => {
    const response = await fetch(`/api/leads/${leadId}`, { cache: "no-store" });
    if (response.status === 404) {
      const workspaceResponse = await fetch(`/api/leads/${leadId}/workspace`, {
        cache: "no-store",
      });
      if (workspaceResponse.ok) {
        const workspace = (await workspaceResponse.json()) as {
          business_id: string;
        };
        const switchResponse = await fetch("/api/auth/active-business", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_id: workspace.business_id }),
        });
        if (switchResponse.ok) {
          const recovered = await fetch(`/api/leads/${leadId}`, {
            cache: "no-store",
          });
          if (recovered.ok) {
            setMissing(false);
            setLead(await recovered.json());
            router.refresh();
            return;
          }
        }
      }
      setMissing(true);
      return;
    }
    if (response.ok) setLead(await response.json());
  }, [leadId, router]);
  useEffect(() => {
    loadLead();
    const interval = window.setInterval(() => {
      if (
        !document.hidden &&
        !panel &&
        !editingReminderId &&
        !editingAttachmentId &&
        !uploading
      )
        loadLead();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadLead, panel, editingReminderId, editingAttachmentId, uploading]);

  async function refreshPage() {
    await loadLead();
    router.refresh();
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: form.get("company"),
        contact_name: form.get("contact_name") || null,
        contact_email: form.get("contact_email") || null,
        contact_phone: form.get("contact_phone") || null,
        linkedin_url: form.get("linkedin_url") || null,
        source: form.get("source") || null,
        estimated_value: form.get("estimated_value")
          ? Number(form.get("estimated_value"))
          : null,
        status: form.get("status"),
        description: form.get("description") || null,
        next_action: form.get("next_action") || null,
      }),
    });
    if (!response.ok) {
      setError("Could not save changes.");
      return;
    }
    setPanel(null);
    await refreshPage();
  }
  async function addReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/leads/${lead.id}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        kind: form.get("kind"),
        due_at: new Date(String(form.get("due_at"))).toISOString(),
      }),
    });
    if (!response.ok) {
      setError("Could not add reminder.");
      return;
    }
    setPanel(null);
    await refreshPage();
  }
  async function addInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/leads/${lead.id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interaction_type: form.get("interaction_type"),
        body: form.get("body"),
        external_ref: form.get("external_ref") || null,
      }),
    });
    if (!response.ok) {
      setError("Could not add interaction.");
      return;
    }
    setPanel(null);
    await refreshPage();
  }
  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;
    if (uploading) return;
    setUploading(true);
    try {
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      const response = await fetch(`/api/leads/${lead.id}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.detail || "Could not upload attachment.");
        return;
      }
      formElement.reset();
      await refreshPage();
    } finally {
      setUploading(false);
    }
  }
  async function deleteLead() {
    if (
      !lead ||
      !window.confirm(
        "Delete this lead and its activity history? This cannot be undone.",
      )
    )
      return;
    const response = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not delete lead.");
      return;
    }
    window.location.assign("/leads");
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
    await refreshPage();
  }
  async function saveReminder(
    event: FormEvent<HTMLFormElement>,
    reminderId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/reminders/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        kind: form.get("kind"),
        due_at: new Date(String(form.get("due_at"))).toISOString(),
      }),
    });
    if (!response.ok) {
      setError("Could not save reminder changes.");
      return;
    }
    setEditingReminderId(null);
    await refreshPage();
  }
  async function deleteReminder(reminder: Reminder) {
    if (!window.confirm(`Delete “${reminder.title}”?`)) return;
    const response = await fetch(`/api/reminders/${reminder.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Could not delete reminder.");
      return;
    }
    if (editingReminderId === reminder.id) setEditingReminderId(null);
    await refreshPage();
  }
  async function saveAttachment(
    event: FormEvent<HTMLFormElement>,
    attachmentId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/attachments/${attachmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: form.get("filename"),
        kind: form.get("kind"),
      }),
    });
    if (!response.ok) {
      setError("Could not update attachment.");
      return;
    }
    setEditingAttachmentId(null);
    await refreshPage();
  }
  async function deleteAttachment(attachmentId: string, filename: string) {
    if (!window.confirm(`Delete “${filename}”?`)) return;
    const response = await fetch(`/api/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Could not delete attachment.");
      return;
    }
    await refreshPage();
  }
  if (missing)
    return (
      <main className={styles.page}>
        <Link className={styles.back} href="/leads">
          <ArrowLeft size={15} /> Lead directory
        </Link>
        <div className={styles.empty}>
          <Building2 size={20} /> Lead not found.
        </div>
      </main>
    );
  if (!lead)
    return (
      <main className={styles.page}>
        <div className={styles.loading}>Loading lead profile…</div>
      </main>
    );
  const openReminders = lead.reminders.filter(
    (reminder) => !reminder.completed_at,
  );
  const visibleActivities = showAllActivity
    ? lead.activities
    : lead.activities.slice(0, 6);
  return (
    <main className={styles.page}>
      <header className={styles.profileHeader}>
        <div>
          <Link className={styles.back} href="/leads">
            <ArrowLeft size={15} /> Lead directory
          </Link>
          <div className={styles.profileTitle}>
            <span className={styles.largeAvatar}>
              {lead.company.slice(0, 1)}
            </span>
            <div className={styles.titleContent}>
              <div className={styles.titleLine}>
                <h1>{lead.company}</h1>
                <em className={styles.status} data-status={lead.status}>
                  {lead.status}
                </em>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.profileActions}>
          <button
            className={styles.secondaryButton}
            onClick={() =>
              setPanel(panel === "interaction" ? null : "interaction")
            }
          >
            <MessageSquare size={15} /> Log interaction
          </button>
          <button
            className={styles.secondaryButton}
            onClick={() => setPanel(panel === "reminder" ? null : "reminder")}
          >
            <Bell size={15} /> Add reminder
          </button>
          <button
            className={styles.primaryButton}
            onClick={() => setPanel(panel === "edit" ? null : "edit")}
          >
            <Pencil size={15} /> Edit lead
          </button>
          <button
            className={styles.deleteButton}
            title="Delete lead"
            onClick={deleteLead}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>
      {error && <p className={styles.formError}>{error}</p>}
      {panel === "edit" && (
        <section className={styles.actionPanel}>
          <div className={styles.panelHead}>
            <div>
              <span>Edit lead</span>
              <p>Keep the record clear and actionable.</p>
            </div>
            <button onClick={() => setPanel(null)}>
              <X size={17} />
            </button>
          </div>
          <form className={styles.newLeadForm} onSubmit={saveLead}>
            <label className={styles.companyField}>
              Company
              <input name="company" defaultValue={lead.company} required />
            </label>
            <label className={styles.statusField}>
              Status
              <select
                className={styles.statusSelect}
                name="status"
                defaultValue={lead.status}
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
                name="contact_name"
                defaultValue={lead.contact_name || ""}
              />
            </label>
            <label>
              Contact email
              <input
                name="contact_email"
                type="email"
                defaultValue={lead.contact_email || ""}
              />
            </label>
            <label>
              Phone
              <input
                name="contact_phone"
                defaultValue={lead.contact_phone || ""}
              />
            </label>
            <label>
              LinkedIn URL
              <input
                name="linkedin_url"
                type="url"
                defaultValue={lead.linkedin_url || ""}
              />
            </label>
            <label>
              Source
              <input name="source" defaultValue={lead.source || ""} />
            </label>
            <label>
              Estimated value
              <input
                name="estimated_value"
                type="number"
                min="0"
                step="0.01"
                defaultValue={lead.estimated_value ?? ""}
              />
            </label>
            <label className={styles.fullField}>
              Description
              <span className={styles.fieldHint}>
                A short reference for the lead record.
              </span>
              <textarea
                name="description"
                placeholder="Who they are, what they need, or useful context."
                defaultValue={lead.description || ""}
              />
            </label>
            <label className={styles.fullField}>
              Next action
              <span className={styles.fieldHint}>
                One concrete next step, or leave empty.
              </span>
              <textarea
                name="next_action"
                placeholder="e.g. Send proposal on Monday"
                defaultValue={lead.next_action || ""}
              />
            </label>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancel}
                onClick={() => setPanel(null)}
              >
                Cancel
              </button>
              <button>
                <Pencil size={15} /> Save changes
              </button>
            </div>
          </form>
        </section>
      )}
      {panel === "reminder" && (
        <section className={styles.actionPanel}>
          <div className={styles.panelHead}>
            <div>
              <span>Add follow-up</span>
              <p>Set what, when, and why.</p>
            </div>
            <button onClick={() => setPanel(null)}>
              <X size={17} />
            </button>
          </div>
          <form
            className={`${styles.quickReminderForm} ${styles.reminderComposer}`}
            onSubmit={addReminder}
          >
            <label className={styles.iconField}>
              <Bell size={15} />
              <input
                name="title"
                placeholder="What needs to happen?"
                required
                autoFocus
              />
            </label>
            <label className={styles.iconField}>
              <CalendarClock size={15} />
              <select name="kind" defaultValue="follow_up">
                {reminderKindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.iconField}>
              <CalendarClock size={15} />
              <input
                name="due_at"
                type="datetime-local"
                defaultValue={localDateTime()}
                required
              />
            </label>
            <button>
              <Plus size={15} /> Add follow-up
            </button>
          </form>
        </section>
      )}
      {panel === "interaction" && (
        <section className={styles.actionPanel}>
          <div className={styles.panelHead}>
            <div>
              <span>Log interaction</span>
              <p>Capture the real conversation.</p>
            </div>
            <button onClick={() => setPanel(null)}>
              <X size={17} />
            </button>
          </div>
          <form className={styles.quickReminderForm} onSubmit={addInteraction}>
            <select name="interaction_type" defaultValue="reply">
              <option value="reply">Reply received</option>
              <option value="message">Message sent</option>
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
              <option value="proposal_sent">Proposal sent</option>
              <option value="note">Note</option>
              <option value="other">Other</option>
            </select>
            <input
              name="external_ref"
              placeholder="Discord message ID (optional)"
            />
            <textarea
              name="body"
              placeholder="John replied that…"
              required
              autoFocus
            />
            <button>
              <Plus size={15} /> Log interaction
            </button>
          </form>
        </section>
      )}
      <section className={styles.profileGrid}>
        <article className={styles.infoCard}>
          <h2>
            <UserRound size={16} /> Contact
          </h2>
          <div className={styles.contactLine}>
            <p>{lead.contact_name || "No contact name"}</p>
            <p className={styles.muted}>
              {lead.contact_email ? (
                <>
                  <Mail size={14} /> {lead.contact_email}
                </>
              ) : (
                "No email on file"
              )}
            </p>
          </div>
          <p className={styles.muted}>
            {lead.contact_phone || "No phone on file"}
          </p>
          {lead.linkedin_url && (
            <p className={styles.muted}>
              <a href={lead.linkedin_url} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </p>
          )}
        </article>
        <article className={styles.infoCard}>
          <h2>
            <CalendarClock size={16} /> Next action
          </h2>
          <p>{lead.next_action || "No next action set."}</p>
        </article>
        <article className={`${styles.infoCard} ${styles.descriptionCard}`}>
          <h2>
            <FileText size={16} /> Description
          </h2>
          <p>{lead.description || "No description added."}</p>
        </article>
        <article className={styles.infoCard}>
          <h2>
            <Building2 size={16} /> Record
          </h2>
          <p className={styles.muted}>Added {fullDate(lead.created_at)}</p>
          <p className={styles.muted}>Updated {fullDate(lead.updated_at)}</p>
        </article>
        <article className={styles.infoCard}>
          <h2>Marketing</h2>
          <p>{lead.source || "No source"}</p>
          <p className={styles.muted}>
            {lead.estimated_value != null
              ? `Estimated €${lead.estimated_value.toLocaleString()}`
              : "No value set"}
          </p>
        </article>
      </section>
      <section className={styles.timeline}>
        <div className={styles.timelineHead}>
          <div>
            <span>Follow-ups</span>
            <h2>
              {openReminders.length} open reminder
              {openReminders.length === 1 ? "" : "s"}
            </h2>
          </div>
          <button
            className={styles.iconAction}
            onClick={() => setPanel("reminder")}
            title="Add reminder"
          >
            <Plus size={17} />
          </button>
        </div>
        {lead.reminders.length ? (
          lead.reminders.map((reminder) =>
            editingReminderId === reminder.id ? (
              <form
                className={styles.reminderEdit}
                key={reminder.id}
                onSubmit={(event) => saveReminder(event, reminder.id)}
              >
                <input
                  name="title"
                  defaultValue={reminder.title}
                  required
                  autoFocus
                />
                <select name="kind" defaultValue={reminder.kind}>
                  {reminderKindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  name="due_at"
                  type="datetime-local"
                  defaultValue={localDateTime(reminder.due_at)}
                  required
                />
                <button className={styles.saveReminder}>
                  <Check size={14} /> Save
                </button>
                <button
                  type="button"
                  className={styles.reminderControl}
                  onClick={() => setEditingReminderId(null)}
                  title="Cancel"
                >
                  <X size={15} />
                </button>
              </form>
            ) : (
              <div className={styles.timelineRow} key={reminder.id}>
                <span
                  className={
                    reminder.completed_at ? styles.doneDot : styles.dot
                  }
                />
                <div>
                  <strong>{reminder.title}</strong>
                  <small>
                    <em className={styles.reminderChip}>
                      {reminder.kind.replace("_", " ")}
                    </em>
                    {fullDate(reminder.due_at)}
                    {reminder.completed_at ? " · completed" : ""}
                  </small>
                </div>
                <div className={styles.reminderControls}>
                  {!reminder.completed_at && (
                    <button
                      className={styles.reminderControl}
                      onClick={() => completeReminder(reminder)}
                      title="Complete reminder"
                    >
                      <Check size={15} />
                    </button>
                  )}
                  <button
                    className={styles.reminderControl}
                    onClick={() => setEditingReminderId(reminder.id)}
                    title="Edit reminder"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className={`${styles.reminderControl} ${styles.reminderDelete}`}
                    onClick={() => deleteReminder(reminder)}
                    title="Delete reminder"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ),
          )
        ) : (
          <div className={styles.empty}>
            <Bell size={18} /> No follow-ups scheduled yet. Add one now.
          </div>
        )}
      </section>
      <section className={styles.timeline}>
        <div className={styles.timelineHead}>
          <div>
            <span>Activity history</span>
            <h2>
              {lead.activities.length} recorded event
              {lead.activities.length === 1 ? "" : "s"}
            </h2>
          </div>
          <History size={18} />
        </div>
        {visibleActivities.length ? (
          visibleActivities.map((activity) => (
            <div className={styles.timelineRow} key={activity.id}>
              <span className={styles.dot} />
              <div>
                <strong>
                  {activityText(activity.event_type, activity.payload)}
                </strong>
                <small>{fullDate(activity.created_at)}</small>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.empty}>
            <History size={18} /> History starts with the next change.
          </div>
        )}
        {lead.activities.length > 6 && (
          <button
            className={styles.showMore}
            onClick={() => setShowAllActivity(!showAllActivity)}
          >
            {showAllActivity
              ? "Show less"
              : `Show ${lead.activities.length - 6} older events`}
            <ChevronDown size={15} />
          </button>
        )}
      </section>
      <section className={styles.timeline}>
        <div className={styles.timelineHead}>
          <div>
            <span>Interactions</span>
            <h2>
              {lead.interactions.length} recorded interaction
              {lead.interactions.length === 1 ? "" : "s"}
            </h2>
          </div>
          <MessageSquare size={18} />
        </div>
        {lead.interactions.length ? (
          lead.interactions.map((interaction) => (
            <div className={styles.timelineRow} key={interaction.id}>
              <span className={styles.dot} />
              <div>
                <strong>
                  {interaction.interaction_type.replaceAll("_", " ")}
                </strong>
                <p>{interaction.body}</p>
                <small>
                  {fullDate(interaction.occurred_at)}
                  {interaction.external_ref
                    ? ` · ${interaction.external_ref}`
                    : ""}
                </small>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.empty}>
            <MessageSquare size={18} /> No interactions recorded yet.
          </div>
        )}
      </section>
      <section className={styles.timeline}>
        <div className={styles.timelineHead}>
          <div>
            <span>Attachments</span>
            <h2>
              {lead.attachments.length} file
              {lead.attachments.length === 1 ? "" : "s"}
            </h2>
          </div>
        </div>
        {lead.attachments.map((attachment) =>
          editingAttachmentId === attachment.id ? (
            <form
              className={styles.reminderEdit}
              key={attachment.id}
              onSubmit={(event) => saveAttachment(event, attachment.id)}
            >
              <input
                name="filename"
                defaultValue={attachment.filename}
                required
                autoFocus
              />
              <select name="kind" defaultValue={attachment.kind}>
                <option value="quotation">Quotation</option>
                <option value="proposal">Proposal</option>
                <option value="document">Document</option>
              </select>
              <button
                className={styles.reminderControl}
                title="Save attachment"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                className={styles.reminderControl}
                onClick={() => setEditingAttachmentId(null)}
                title="Cancel"
              >
                <X size={15} />
              </button>
            </form>
          ) : (
            <div className={styles.timelineRow} key={attachment.id}>
              <span className={styles.dot} />
              <div>
                <strong>
                  <a href={`/api/attachments/${attachment.id}/download`}>
                    {attachment.filename}
                  </a>
                </strong>
                <small>
                  {attachment.kind} ·{" "}
                  {(attachment.size_bytes / 1024).toFixed(1)} KB ·{" "}
                  {fullDate(attachment.created_at)}
                </small>
              </div>
              <div className={styles.reminderControls}>
                <button
                  className={styles.reminderControl}
                  onClick={() => setEditingAttachmentId(attachment.id)}
                  title="Edit attachment"
                >
                  <Pencil size={13} />
                </button>
                <button
                  className={`${styles.reminderControl} ${styles.reminderDelete}`}
                  onClick={() =>
                    deleteAttachment(attachment.id, attachment.filename)
                  }
                  title="Delete attachment"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ),
        )}
        <form className={styles.quickReminderForm} onSubmit={uploadAttachment}>
          <select name="kind" defaultValue="quotation" disabled={uploading}>
            <option value="quotation">Quotation</option>
            <option value="proposal">Proposal</option>
            <option value="document">Document</option>
          </select>
          <input name="file" type="file" required disabled={uploading} />
          <button disabled={uploading}>
            {uploading ? (
              "Uploading…"
            ) : (
              <>
                <Plus size={15} /> Upload file
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
