"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleX,
  FileText,
  Filter,
  Radio,
  Search,
  Send,
  Sprout,
  Target,
  Trophy,
  UsersRound,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SelectMenu, { type SelectMenuOption } from "@/lib/components/select-menu/select-menu";
import { LeadStatus, type Lead } from "@/lib/types";
import styles from "@/lib/components/lead-pages/lead-pages.module.scss";

type LeadFilter = "all" | LeadStatus;
const filters: SelectMenuOption<LeadFilter>[] = [
  { value: "all", label: "All leads", icon: Filter, tone: "violet" },
  { value: LeadStatus.Target, label: "Target", icon: Target, tone: "violet" },
  { value: LeadStatus.Connected, label: "Connected", icon: Radio, tone: "violet" },
  { value: LeadStatus.Contacted, label: "Contacted", icon: Send, tone: "violet" },
  { value: LeadStatus.Meeting, label: "Meeting", icon: CalendarDays, tone: "yellow" },
  { value: LeadStatus.Proposal, label: "Proposal", icon: FileText, tone: "violet" },
  { value: LeadStatus.Won, label: "Won", icon: Trophy, tone: "green" },
  { value: LeadStatus.Lost, label: "Lost", icon: CircleX, tone: "red" },
  { value: LeadStatus.Nurture, label: "Nurture", icon: Sprout, tone: "green" },
];

function upcoming(lead: Lead) {
  return lead.reminders.find((item) => !item.completed_at);
}
function compactDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function LeadDirectory() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active =
    (searchParams.get("status") as LeadFilter | null) || "all";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/leads", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign("/login");
          return [];
        }
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(setLeads)
      .catch(() => setError("Could not load the lead directory. Try again."))
      .finally(() => setLoading(false));
  }, []);
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = active === "all" || lead.status === active;
      const matchesQuery = !normalizedQuery || [
        lead.company,
        lead.contact_name,
        lead.contact_email,
        lead.source,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      return matchesStatus && matchesQuery;
    });
  }, [active, leads, query]);
  const filterOptions = filters.map((filter) => ({
    ...filter,
    count: filter.value === "all"
      ? leads.length
      : leads.filter((lead) => lead.status === filter.value).length,
  }));

  function changeFilter(value: LeadFilter) {
    router.replace(value === "all" ? pathname : `${pathname}?status=${value}`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.back} href="/">
            <ArrowLeft size={15} /> Pipeline
          </Link>
          <h1>Lead directory</h1>
          <p>
            Every account, with the current state and next follow-up in one
            place.
          </p>
        </div>
        <div className={styles.directoryTotal}>
          <UsersRound size={17} />
          <span>{leads.length}</span> leads
        </div>
      </header>
      <section className={styles.directoryTools} aria-label="Lead directory controls">
        <label className={styles.searchField}>
          <span className={styles.srOnly}>Search leads</span>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company, contact, email, or source"
          />
        </label>
        <SelectMenu
          compact
          label="Filter leads by status"
          options={filterOptions}
          value={active}
          onChange={changeFilter}
        />
        <span className={styles.resultCount} aria-live="polite">
          {visible.length} shown
        </span>
      </section>
      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}
      <section className={styles.list}>
        <div className={styles.listHead}>
          <span>Account</span>
          <span>Stage</span>
          <span>Next follow-up</span>
          <span />
        </div>
        {loading && <div className={styles.loading}>Loading directory…</div>}
        {!loading &&
          visible.map((lead) => {
            const reminder = upcoming(lead);
            return (
              <Link
                className={styles.row}
                href={`/leads/${lead.id}`}
                key={lead.id}
              >
                <div className={styles.account}>
                  <span className={styles.avatar}>
                    {lead.company.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{lead.company}</strong>
                    <small>
                      {lead.contact_name ||
                        lead.contact_email ||
                        "No contact added"}
                    </small>
                  </div>
                </div>
                <em className={styles.status} data-status={lead.status}>
                  {lead.status}
                </em>
                <div className={styles.followup}>
                  {reminder ? (
                    <>
                      <Bell size={13} />{" "}
                      <span>
                        {compactDate(reminder.due_at)} · {reminder.title}
                      </span>
                    </>
                  ) : (
                    <span>Nothing scheduled</span>
                  )}
                </div>
                <ChevronRight size={17} />
              </Link>
            );
          })}
        {!loading && !visible.length && (
          <div className={styles.empty}>
            <Building2 size={20} /> No leads in this view.
          </div>
        )}
      </section>
    </main>
  );
}
