"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Building2, CalendarClock, Mail, UserRound } from "lucide-react";
import type { Lead } from "@/lib/types";
import styles from "./lead-pages.module.scss";

function fullDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default function LeadProfile({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { fetch(`/api/leads/${leadId}`, { cache: "no-store" }).then(async (response) => { if (response.status === 404) { setMissing(true); return; } if (response.ok) setLead(await response.json()); }); }, [leadId]);
  if (missing) return <main className={styles.page}><Link className={styles.back} href="/leads"><ArrowLeft size={15} /> Lead directory</Link><div className={styles.empty}><Building2 size={20} /> Lead not found.</div></main>;
  if (!lead) return <main className={styles.page}><div className={styles.loading}>Loading lead profile…</div></main>;
  const openReminders = lead.reminders.filter((reminder) => !reminder.completed_at);
  return <main className={styles.page}>
    <header className={styles.header}><div><Link className={styles.back} href="/leads"><ArrowLeft size={15} /> Lead directory</Link><div className={styles.profileTitle}><span className={styles.largeAvatar}>{lead.company.slice(0, 1)}</span><div><em className={styles.status} data-status={lead.status}>{lead.status}</em><h1>{lead.company}</h1></div></div></div></header>
    <section className={styles.profileGrid}>
      <article className={styles.infoCard}><h2><UserRound size={16} /> Contact</h2><p>{lead.contact_name || "No contact name"}</p><p className={styles.muted}>{lead.contact_email ? <><Mail size={14} /> {lead.contact_email}</> : "No email on file"}</p></article>
      <article className={styles.infoCard}><h2><CalendarClock size={16} /> Next action</h2><p>{lead.next_action || "No next action set."}</p></article>
      <article className={styles.infoCard}><h2><Building2 size={16} /> Record</h2><p className={styles.muted}>Added {fullDate(lead.created_at)}</p><p className={styles.muted}>Updated {fullDate(lead.updated_at)}</p></article>
    </section>
    <section className={styles.timeline}><div className={styles.timelineHead}><div><span>Follow-ups</span><h2>{openReminders.length} open reminder{openReminders.length === 1 ? "" : "s"}</h2></div><Bell size={18} /></div>{lead.reminders.length ? lead.reminders.map((reminder) => <div className={styles.timelineRow} key={reminder.id}><span className={reminder.completed_at ? styles.doneDot : styles.dot} /><div><strong>{reminder.title}</strong><small>{fullDate(reminder.due_at)}{reminder.completed_at ? " · completed" : ""}</small></div></div>) : <div className={styles.empty}><Bell size={18} /> No follow-ups scheduled yet.</div>}</section>
  </main>;
}
