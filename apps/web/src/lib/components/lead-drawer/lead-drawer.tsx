"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, LoaderCircle, Paperclip, Plus, Send, Trash2, Upload, X } from "lucide-react";
import SelectMenu, { type SelectMenuOption } from "@/lib/components/select-menu/select-menu";
import { leadDrawerApi, type LeadDrawerApi, type LeadTimelineEntry } from "@/lib/api/lead-drawer";
import { LeadStatus, type Lead, type LeadAttachment } from "@/lib/types";
import styles from "@/lib/components/crm-dashboard/crm-dashboard.module.scss";

const draftKey = (id: string) => `zcrm:lead-drawer:draft:${id}`;
type Tab = "activity" | "details" | "files";
type Draft = { body: string; interactionType: string };
type UploadItem = { id: string; file: File; progress: number; error?: string; complete?: boolean };

const statusOptions: SelectMenuOption<LeadStatus>[] = Object.values(LeadStatus).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
const interactionTypes = ["reply", "message", "call", "meeting", "proposal_sent", "note", "other"] as const;

function getDraft(leadId: string): Draft {
  try {
    const draft = sessionStorage.getItem(draftKey(leadId));
    return draft ? JSON.parse(draft) as Draft : { body: "", interactionType: "note" };
  } catch { return { body: "", interactionType: "note" }; }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function LeadDrawer({ lead, onClose, onUpdate, api = leadDrawerApi }: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Lead>) => Promise<void>;
  api?: LeadDrawerApi;
}) {
  const [tab, setTab] = useState<Tab>("activity");
  const [timeline, setTimeline] = useState<LeadTimelineEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState("");
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [draft, setDraft] = useState<Draft>({ body: "", interactionType: "note" });
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [company, setCompany] = useState(lead.company);
  const [contactName, setContactName] = useState(lead.contact_name || "");
  const [contactEmail, setContactEmail] = useState(lead.contact_email || "");
  const [description, setDescription] = useState(lead.description || "");
  const [nextAction, setNextAction] = useState(lead.next_action || "");
  const [status, setStatus] = useState(lead.status);
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [filesError, setFilesError] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  async function loadTimeline(cursor?: string | null, append = false) {
    setLoadingTimeline(true); setTimelineError("");
    try {
      const page = await api.getTimeline(lead.id, cursor);
      setTimeline((items) => append ? [...items, ...page.entries] : page.entries);
      setNextCursor(page.next_cursor);
    } catch {
      setTimelineError("Activity is temporarily unavailable. Try again.");
    } finally { setLoadingTimeline(false); }
  }
  async function loadFiles() {
    setLoadingFiles(true); setFilesError("");
    try { setAttachments(await api.listAttachments(lead.id)); }
    catch { setFilesError("Files are temporarily unavailable. Try again."); }
    finally { setLoadingFiles(false); }
  }

  useEffect(() => {
    setTab("activity"); setTimeline([]); setNextCursor(null); setTimelineError("");
    setDraft(getDraft(lead.id));
    setCompany(lead.company); setContactName(lead.contact_name || ""); setContactEmail(lead.contact_email || "");
    setDescription(lead.description || ""); setNextAction(lead.next_action || ""); setStatus(lead.status);
    setAttachments([]); setUploads([]); setFilesError("");
    void loadTimeline();
    // The lead ID deliberately scopes the server-owned timeline request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);
  useEffect(() => { sessionStorage.setItem(draftKey(lead.id), JSON.stringify(draft)); }, [draft, lead.id]);
  useEffect(() => { if (tab === "files" && !attachments.length && !loadingFiles && !filesError) void loadFiles(); }, [tab]);

  async function postInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.body.trim()) return;
    setPosting(true); setPostError("");
    try {
      await api.createInteraction(lead.id, { interaction_type: draft.interactionType as typeof interactionTypes[number], body: draft.body.trim(), occurred_at: new Date().toISOString(), external_ref: null });
      setDraft({ body: "", interactionType: "note" }); sessionStorage.removeItem(draftKey(lead.id));
      await loadTimeline();
    } catch { setPostError("Could not save this interaction. Your draft is still here."); }
    finally { setPosting(false); }
  }
  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try { await onUpdate(lead.id, { company, contact_name: contactName || null, contact_email: contactEmail || null, description: description || null, next_action: nextAction || null, status }); }
    finally { setSaving(false); }
  }
  function addFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const item: UploadItem = { id: `${file.name}-${file.lastModified}-${Math.random()}`, file, progress: 0 };
      setUploads((current) => [...current, item]);
      void upload(item);
    });
  }
  async function upload(item: UploadItem) {
    try {
      const attachment = await api.uploadAttachment(lead.id, item.file, "document", (progress) => setUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress } : entry)));
      setAttachments((current) => [attachment, ...current]);
      setUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress: 100, complete: true } : entry));
    } catch {
      setUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, error: "Upload failed. Retry when ready." } : entry));
    }
  }
  async function removeFile(attachment: LeadAttachment) {
    try { await api.deleteAttachment(attachment.id); setAttachments((current) => current.filter((item) => item.id !== attachment.id)); }
    catch { setFilesError("Could not delete the file. Try again."); }
  }

  return <div className={styles.drawerWrap} role="presentation">
    <button className={styles.scrim} aria-label="Close lead panel" onClick={onClose} />
    <aside className={styles.drawer} aria-label={`${lead.company} lead drawer`}>
      <div className={styles.drawerHead}><div><span>Lead record</span><h2>{lead.company}</h2></div><button aria-label="Close lead panel" title="Close" onClick={onClose}><X size={19} /></button></div>
      <Link className={styles.drawerPageLink} href={`/leads/${lead.id}`}><FileText size={14} /> Open lead page</Link>
      <div className={styles.drawerTabs} role="tablist" aria-label="Lead drawer sections">
        {([ ["activity", "Attività"], ["details", "Dettagli"], ["files", "File"] ] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? styles.drawerTabActive : ""} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      {tab === "activity" && <section className={styles.drawerTabPanel} role="tabpanel">
        <form className={styles.interactionComposer} onSubmit={postInteraction}>
          <div><label htmlFor="interaction-type">Type</label><select id="interaction-type" value={draft.interactionType} onChange={(event) => setDraft((current) => ({ ...current, interactionType: event.target.value }))}>{interactionTypes.map((type) => <option key={type} value={type}>{type.replace("_", " ")}</option>)}</select></div>
          <label>Interaction<textarea value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} placeholder="Record a call, message, note, or outcome…" /></label>
          <div className={styles.composerActions}><small>{draft.body ? "Draft saved on this device" : ""}</small><button className={styles.primary} disabled={posting || !draft.body.trim()}>{posting ? <LoaderCircle className={styles.spin} size={16} /> : <Send size={16} />} Save interaction</button></div>
          {postError && <p className={styles.inlineError}>{postError}</p>}
        </form>
        <div className={styles.timelineHead}><h3>Timeline</h3><button onClick={() => void loadTimeline()} disabled={loadingTimeline}>Refresh</button></div>
        {timelineError && <div className={styles.inlineError}>{timelineError} <button onClick={() => void loadTimeline()}>Retry</button></div>}
        {loadingTimeline && !timeline.length && <p className={styles.noActivity}>Loading activity…</p>}
        {timeline.map((entry) => <article className={styles.timelineEntry} key={entry.id}><span data-kind={entry.kind} /><div><strong>{entry.title}</strong>{entry.body && <p>{entry.body}</p>}<small>{entry.actor ? `${entry.actor} · ` : ""}{formatDate(entry.occurred_at)}</small></div></article>)}
        {!loadingTimeline && !timelineError && !timeline.length && <p className={styles.noActivity}>No activity yet.</p>}
        {nextCursor && <button className={styles.loadMore} disabled={loadingTimeline} onClick={() => void loadTimeline(nextCursor, true)}>Load earlier activity</button>}
      </section>}
      {tab === "details" && <form className={`${styles.form} ${styles.drawerTabPanel}`} onSubmit={saveDetails} role="tabpanel">
        <label>Company<input value={company} onChange={(event) => setCompany(event.target.value)} required /></label>
        <label>Status<SelectMenu label="Lead status" options={statusOptions} value={status} onChange={setStatus} /></label>
        <label>Contact name<input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
        <label>Contact email<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label>
        <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label>Next action<textarea value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></label>
        <button className={styles.primary} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </form>}
      {tab === "files" && <section className={styles.drawerTabPanel} role="tabpanel">
        <label className={styles.uploadDrop}><Upload size={18} /><span>Add files</span><small>Up to 10 MB per file</small><input type="file" multiple onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }} /></label>
        {filesError && <div className={styles.inlineError}>{filesError} <button onClick={() => void loadFiles()}>Retry</button></div>}
        {loadingFiles && <p className={styles.noActivity}>Loading files…</p>}
        {uploads.map((item) => <div className={styles.uploadRow} key={item.id}><Paperclip size={15} /><div><strong>{item.file.name}</strong>{item.error ? <small className={styles.inlineError}>{item.error} <button onClick={() => void upload(item)}>Retry</button></small> : <small>{item.complete ? "Uploaded" : `${item.progress}% uploaded`}</small>}<progress value={item.progress} max="100" /></div></div>)}
        {attachments.map((attachment) => <div className={styles.fileRow} key={attachment.id}><Paperclip size={15} /><div><a href={`/api/attachments/${attachment.id}/download`}>{attachment.filename}</a><small>{Math.ceil(attachment.size_bytes / 1024)} KB · {attachment.kind}</small></div><button aria-label={`Delete ${attachment.filename}`} onClick={() => void removeFile(attachment)}><Trash2 size={15} /></button></div>)}
        {!loadingFiles && !filesError && !attachments.length && !uploads.length && <p className={styles.noActivity}>No files attached.</p>}
      </section>}
    </aside>
  </div>;
}
