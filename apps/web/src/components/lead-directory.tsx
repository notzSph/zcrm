"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Building2, ChevronRight, Filter, UsersRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LeadStatus, type Lead } from "@/lib/types";
import styles from "./lead-pages.module.scss";

const filters: { value: "all" | LeadStatus; label: string }[] = [
  { value: "all", label: "All leads" }, { value: LeadStatus.Target, label: "Target" }, { value: LeadStatus.Connected, label: "Connected" }, { value: LeadStatus.Contacted, label: "Contacted" }, { value: LeadStatus.Meeting, label: "Meeting" }, { value: LeadStatus.Proposal, label: "Proposal" }, { value: LeadStatus.Won, label: "Won" }, { value: LeadStatus.Lost, label: "Lost" }, { value: LeadStatus.Nurture, label: "Nurture" },
];

function upcoming(lead: Lead) { return lead.reminders.find((item) => !item.completed_at); }
function compactDate(value: string) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value)); }

export default function LeadDirectory() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = (searchParams.get("status") as "all" | LeadStatus | null) || "all";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/leads", { cache: "no-store" }).then(async (response) => { if (response.status === 401) { window.location.assign("/login"); return []; } if (!response.ok) throw new Error(); return response.json(); }).then(setLeads).catch(() => setError("Could not load the lead directory. Try again.")).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => active === "all" ? leads : leads.filter((lead) => lead.status === active), [active, leads]);

  function changeFilter(value: "all" | LeadStatus) {
    router.replace(value === "all" ? pathname : `${pathname}?status=${value}`);
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><Link className={styles.back} href="/"><ArrowLeft size={15} /> Pipeline</Link><h1>Lead directory</h1><p>Every account, with the current state and next follow-up in one place.</p></div>
      <div className={styles.directoryTotal}><UsersRound size={17} /><span>{leads.length}</span> leads</div>
    </header>
    <section className={styles.filters} aria-label="Filter leads by status"><Filter size={15} />{filters.map((filter) => <button key={filter.value} className={active === filter.value ? styles.activeFilter : ""} onClick={() => changeFilter(filter.value)}>{filter.label}<span>{filter.value === "all" ? leads.length : leads.filter((lead) => lead.status === filter.value).length}</span></button>)}</section>
    {error && <div className={styles.error}>{error}<button onClick={() => window.location.reload()}>Retry</button></div>}
    <section className={styles.list}>
      <div className={styles.listHead}><span>Account</span><span>Stage</span><span>Next follow-up</span><span /></div>
      {loading && <div className={styles.loading}>Loading directory…</div>}
      {!loading && visible.map((lead) => { const reminder = upcoming(lead); return <Link className={styles.row} href={`/leads/${lead.id}`} key={lead.id}><div className={styles.account}><span className={styles.avatar}>{lead.company.slice(0, 1)}</span><div><strong>{lead.company}</strong><small>{lead.contact_name || lead.contact_email || "No contact added"}</small></div></div><em className={styles.status} data-status={lead.status}>{lead.status}</em><div className={styles.followup}>{reminder ? <><Bell size={13} /> <span>{compactDate(reminder.due_at)} · {reminder.title}</span></> : <span>Nothing scheduled</span>}</div><ChevronRight size={17} /></Link>; })}
      {!loading && !visible.length && <div className={styles.empty}><Building2 size={20} /> No leads in this view.</div>}
    </section>
  </main>;
}
