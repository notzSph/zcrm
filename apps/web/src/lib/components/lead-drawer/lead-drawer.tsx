"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, LoaderCircle, Paperclip, Send, Trash2, Upload, X } from "lucide-react";
import SelectMenu, { type SelectMenuOption } from "@/lib/components/select-menu/select-menu";
import { leadDrawerApi, type LeadDrawerApi, type LeadTimelineItem } from "@/lib/api/lead-drawer";
import { LeadStatus, type Lead, type LeadAttachment } from "@/lib/types";
import styles from "@/lib/components/crm-dashboard/crm-dashboard.module.scss";

const draftKey = (id: string) => `zcrm:lead-drawer:draft:${id}`;
type Tab = "activity" | "details" | "files";
type Draft = { body: string; interactionType: string; idempotencyKey: string };
type UploadPhase = "uploading" | "complete" | "error";
type UploadItem = { id: string; file: File; progress: number; phase: UploadPhase; error?: string };

const statusOptions: SelectMenuOption<LeadStatus>[] = Object.values(LeadStatus).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
const interactionTypes = ["reply", "message", "call", "meeting", "proposal_sent", "note", "other"] as const;

function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function emptyDraft(): Draft { return { body: "", interactionType: "note", idempotencyKey: newIdempotencyKey() }; }
function getDraft(leadId: string): Draft {
  try {
    const saved = sessionStorage.getItem(draftKey(leadId));
    if (!saved) return emptyDraft();
    const draft = JSON.parse(saved) as Partial<Draft>;
    return { body: draft.body ?? "", interactionType: draft.interactionType ?? "note", idempotencyKey: draft.idempotencyKey ?? newIdempotencyKey() };
  } catch { return emptyDraft(); }
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function actorLabel(item: LeadTimelineItem) { return item.actor.label ?? (item.actor.type === "user" ? "User" : "System"); }
function timelineTitle(item: LeadTimelineItem) {
  if (item.kind === "interaction") return item.payload.interaction_type.replaceAll("_", " ");
  if (item.kind === "attachment") return item.payload.kind.replaceAll("_", " ");
  return (item.payload.event_type ?? "activity").replaceAll("_", " ");
}
function timelineText(item: LeadTimelineItem) {
  if (item.redacted) return "This timeline item is redacted.";
  if (item.kind === "interaction") return item.payload.body || "Interaction recorded.";
  if (item.kind === "attachment") {
    if (!item.payload.filename) return "Attachment updated.";
    const size = item.payload.size_bytes == null ? "" : ` (${Math.ceil(item.payload.size_bytes / 1024)} KB)`;
    return `${item.payload.filename}${size}`;
  }
  if (item.payload.from && item.payload.to) return `${item.payload.from} → ${item.payload.to}`;
  if (item.payload.title) return item.payload.title;
  if (item.payload.fields?.length) return `Updated: ${item.payload.fields.join(", ")}`;
  return "Lead activity recorded.";
}

export default function LeadDrawer({ lead, onClose, onUpdate, onRefresh, api = leadDrawerApi }: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Lead>) => Promise<void>;
  onRefresh: (id: string) => Promise<void>;
  api?: LeadDrawerApi;
}) {
  const activeLeadId = useRef(lead.id);
  const uploadingIds = useRef(new Set<string>());
  activeLeadId.current = lead.id;
  const [tab, setTab] = useState<Tab>("activity");
  const [timeline, setTimeline] = useState<LeadTimelineItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState("");
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [company, setCompany] = useState(lead.company);
  const [contactName, setContactName] = useState(lead.contact_name || "");
  const [contactEmail, setContactEmail] = useState(lead.contact_email || "");
  const [description, setDescription] = useState(lead.description || "");
  const [nextAction, setNextAction] = useState(lead.next_action || "");
  const [status, setStatus] = useState(lead.status);
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [filesError, setFilesError] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  async function loadTimeline(cursor?: string | null, append = false, requestedLeadId = lead.id) {
    setLoadingTimeline(true); setTimelineError("");
    try {
      const page = await api.getTimeline(requestedLeadId, cursor);
      if (activeLeadId.current !== requestedLeadId) return;
      // Do not merge, infer, or deduplicate server-owned timeline items.
      setTimeline(append ? (current) => [...current, ...page.items] : page.items);
      setNextCursor(page.next_cursor);
    } catch {
      if (activeLeadId.current === requestedLeadId) setTimelineError("Activity is temporarily unavailable. Try again.");
    } finally { if (activeLeadId.current === requestedLeadId) setLoadingTimeline(false); }
  }
  async function loadFiles(requestedLeadId = lead.id) {
    setLoadingFiles(true); setFilesError("");
    try {
      const items = await api.listAttachments(requestedLeadId);
      if (activeLeadId.current === requestedLeadId) setAttachments(items);
    } catch {
      if (activeLeadId.current === requestedLeadId) setFilesError("Files are temporarily unavailable. Try again.");
    } finally { if (activeLeadId.current === requestedLeadId) setLoadingFiles(false); }
  }

  useEffect(() => {
    setTab("activity"); setTimeline([]); setNextCursor(null); setTimelineError(""); setPostError(""); setDetailsError("");
    setDraft(getDraft(lead.id));
    setCompany(lead.company); setContactName(lead.contact_name || ""); setContactEmail(lead.contact_email || "");
    setDescription(lead.description || ""); setNextAction(lead.next_action || ""); setStatus(lead.status);
    uploadingIds.current.clear(); setAttachments([]); setUploads([]); setFilesError("");
    void loadTimeline(undefined, false, lead.id);
    // lead.id is the request scope; activeLeadId rejects stale responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);
  useEffect(() => {
    if (draft.body || draft.interactionType !== "note") sessionStorage.setItem(draftKey(lead.id), JSON.stringify(draft));
    else sessionStorage.removeItem(draftKey(lead.id));
  }, [draft, lead.id]);
  useEffect(() => { if (tab === "files" && !attachments.length && !loadingFiles && !filesError) void loadFiles(); }, [tab, attachments.length, loadingFiles, filesError]);

  function updateDraft(changes: Partial<Pick<Draft, "body" | "interactionType">>) {
    setDraft((current) => ({ ...current, ...changes, idempotencyKey: newIdempotencyKey() }));
  }
  async function postInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.body.trim() || posting) return;
    const requestedLeadId = lead.id;
    setPosting(true); setPostError("");
    try {
      await api.createInteraction(requestedLeadId, { interaction_type: draft.interactionType as typeof interactionTypes[number], body: draft.body.trim(), occurred_at: new Date().toISOString(), external_ref: null }, draft.idempotencyKey);
      if (activeLeadId.current !== requestedLeadId) return;
      setDraft(emptyDraft());
      await loadTimeline(undefined, false, requestedLeadId);
    } catch {
      if (activeLeadId.current === requestedLeadId) setPostError("Could not save this interaction. Your draft is still here.");
    } finally { if (activeLeadId.current === requestedLeadId) setPosting(false); }
  }
  async function changeStatus(nextStatus: LeadStatus) {
    if (nextStatus === status || savingStatus) return;
    const requestedLeadId = lead.id;
    const previousStatus = status;
    setStatus(nextStatus); setSavingStatus(true); setDetailsError("");
    try {
      await api.transitionStatus(requestedLeadId, {
        status: nextStatus,
        next_action: nextAction || null,
        reason: "Updated from Kanban lead drawer",
        expected_version: lead.version,
      });
      if (activeLeadId.current === requestedLeadId) await onRefresh(requestedLeadId);
    } catch {
      if (activeLeadId.current === requestedLeadId) {
        setStatus(previousStatus);
        setDetailsError("Could not update the status. Refresh the lead and try again.");
      }
    } finally { if (activeLeadId.current === requestedLeadId) setSavingStatus(false); }
  }
  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedLeadId = lead.id;
    setSaving(true); setDetailsError("");
    try {
      await onUpdate(requestedLeadId, {
        company,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        description: description || null,
        next_action: nextAction || null,
      });
    } catch {
      if (activeLeadId.current === requestedLeadId) setDetailsError("Could not save these changes. Refresh the lead and try again.");
    } finally { if (activeLeadId.current === requestedLeadId) setSaving(false); }
  }
  function addFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const item: UploadItem = { id: `${file.name}-${file.lastModified}-${Math.random()}`, file, progress: 0, phase: "uploading" };
      setUploads((current) => [...current, item]);
      void upload(item, lead.id);
    });
  }
  async function upload(item: UploadItem, requestedLeadId = lead.id) {
    if (item.phase === "complete" || uploadingIds.current.has(item.id)) return;
    uploadingIds.current.add(item.id);
    setUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, error: undefined, phase: "uploading" } : entry));
    try {
      const attachment = await api.uploadAttachment(requestedLeadId, item.file, "document", (progress) => {
        if (activeLeadId.current === requestedLeadId) setUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress } : entry));
      });
      if (activeLeadId.current !== requestedLeadId) return;
      setAttachments((current) => current.some((entry) => entry.id === attachment.id) ? current : [attachment, ...current]);
      setUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress: 100, phase: "complete" } : entry));
    } catch {
      if (activeLeadId.current === requestedLeadId) setUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, phase: "error", error: "Upload failed. Retry when ready." } : entry));
    } finally { uploadingIds.current.delete(item.id); }
  }
  async function removeFile(attachment: LeadAttachment) {
    const requestedLeadId = lead.id;
    try { await api.deleteAttachment(attachment.id); if (activeLeadId.current === requestedLeadId) setAttachments((current) => current.filter((item) => item.id !== attachment.id)); }
    catch { if (activeLeadId.current === requestedLeadId) setFilesError("Could not delete the file. Try again."); }
  }

  return <div className={styles.drawerWrap} role="presentation">
    <button className={styles.scrim} aria-label="Close lead panel" onClick={onClose} />
    <aside className={styles.drawer} aria-label={`${lead.company} lead drawer`} role="dialog" aria-modal="true">
      <div className={styles.drawerHead}>
        <div className={styles.drawerIdentity}>
          <span>Lead record</span>
          <div className={styles.drawerLeadRow}>
            <h2>{lead.company}</h2>
            <span className={styles.drawerLeadGap} aria-hidden="true" />
            <div className={styles.drawerStatusCell} aria-busy={savingStatus}>
              <SelectMenu label="Lead status" options={statusOptions} value={status} onChange={(value) => void changeStatus(value)} compact className={styles.drawerStatusSelect} />
            </div>
          </div>
        </div>
        <button aria-label="Close lead panel" title="Close" onClick={onClose}><X size={19} /></button>
      </div>
      {detailsError && <p className={styles.inlineError} role="alert">{detailsError}</p>}
      <Link className={styles.drawerPageLink} href={`/leads/${lead.id}`}><FileText size={14} /> Open lead page</Link>
      <div className={styles.drawerTabs} role="tablist" aria-label="Lead drawer sections">
        {([ ["activity", "Attività"], ["details", "Dettagli"], ["files", "File"] ] as const).map(([value, label]) => <button key={value} id={`lead-drawer-tab-${value}`} role="tab" aria-controls={`lead-drawer-panel-${value}`} aria-selected={tab === value} className={tab === value ? styles.drawerTabActive : ""} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      {tab === "activity" && <section className={styles.drawerTabPanel} id="lead-drawer-panel-activity" role="tabpanel" aria-labelledby="lead-drawer-tab-activity">
        <form className={styles.interactionComposer} onSubmit={postInteraction}>
          <div><label htmlFor="interaction-type">Type</label><select id="interaction-type" value={draft.interactionType} onChange={(event) => updateDraft({ interactionType: event.target.value })}>{interactionTypes.map((type) => <option key={type} value={type}>{type.replace("_", " ")}</option>)}</select></div>
          <label>Interaction<textarea value={draft.body} onChange={(event) => updateDraft({ body: event.target.value })} placeholder="Record a call, message, note, or outcome…" /></label>
          <div className={styles.composerActions}><small>{draft.body ? "Draft saved on this device" : ""}</small><button className={styles.primary} disabled={posting || !draft.body.trim()}>{posting ? <LoaderCircle className={styles.spin} size={16} /> : <Send size={16} />} Save interaction</button></div>
          {postError && <p className={styles.inlineError} role="alert">{postError}</p>}
        </form>
        <div className={styles.timelineHead}><h3>Timeline</h3><button onClick={() => void loadTimeline()} disabled={loadingTimeline}>Refresh</button></div>
        {timelineError && <div className={styles.inlineError} role="alert">{timelineError} <button onClick={() => void loadTimeline()}>Retry</button></div>}
        {loadingTimeline && !timeline.length && <p className={styles.noActivity}>Loading activity…</p>}
        {timeline.map((item) => <article className={styles.timelineEntry} key={item.id}><span data-kind={item.kind} /><div><strong>{timelineTitle(item)}</strong><p>{timelineText(item)}</p><small>{actorLabel(item)} · {formatDate(item.occurred_at ?? item.recorded_at)}</small></div></article>)}
        {!loadingTimeline && !timelineError && !timeline.length && <p className={styles.noActivity}>No activity yet.</p>}
        {nextCursor && <button className={styles.loadMore} disabled={loadingTimeline} onClick={() => void loadTimeline(nextCursor, true)}>Load earlier activity</button>}
      </section>}
      {tab === "details" && <form className={`${styles.form} ${styles.drawerTabPanel}`} id="lead-drawer-panel-details" onSubmit={saveDetails} role="tabpanel" aria-labelledby="lead-drawer-tab-details">
        <label>Company<input value={company} onChange={(event) => setCompany(event.target.value)} required /></label><label>Contact name<input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label><label>Contact email<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><label>Next action<textarea value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></label><button className={styles.primary} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </form>}
      {tab === "files" && <section className={styles.drawerTabPanel} id="lead-drawer-panel-files" role="tabpanel" aria-labelledby="lead-drawer-tab-files">
        <label className={styles.uploadDrop}><Upload size={18} /><span>Add files</span><small>Up to 10 MB per file</small><input type="file" multiple onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }} /></label>
        {filesError && <div className={styles.inlineError} role="alert">{filesError} <button onClick={() => void loadFiles()}>Retry</button></div>}{loadingFiles && <p className={styles.noActivity}>Loading files…</p>}
        {uploads.map((item) => <div className={styles.uploadRow} key={item.id}><Paperclip size={15} /><div><strong>{item.file.name}</strong>{item.error ? <small className={styles.inlineError}>{item.error} <button onClick={() => void upload(item)}>Retry</button></small> : <small>{item.phase === "complete" ? "Uploaded" : `${item.progress}% uploaded`}</small>}<progress value={item.progress} max="100" /></div></div>)}
        {attachments.map((attachment) => <div className={styles.fileRow} key={attachment.id}><Paperclip size={15} /><div><a href={`/api/attachments/${attachment.id}/download`}>{attachment.filename}</a><small>{Math.ceil(attachment.size_bytes / 1024)} KB · {attachment.kind}</small></div><button aria-label={`Delete ${attachment.filename}`} onClick={() => void removeFile(attachment)}><Trash2 size={15} /></button></div>)}
        {!loadingFiles && !filesError && !attachments.length && !uploads.length && <p className={styles.noActivity}>No files attached.</p>}
      </section>}
    </aside>
  </div>;
}
