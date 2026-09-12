"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListFilter,
} from "lucide-react";
import type { Lead, Reminder } from "@/lib/types";
import styles from "./follow-up-calendar.module.scss";

type CalendarItem = Reminder & { lead: Lead };
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const timeLabel = (value: string) =>
  new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );

export default function FollowUpCalendar() {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadLeads = useCallback(async () => {
    const response = await fetch("/api/leads", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    if (!response.ok) throw new Error();
    setLeads(await response.json());
  }, []);
  useEffect(() => {
    loadLeads()
      .catch(() => setError("Could not load follow-ups. Try again."))
      .finally(() => setLoading(false));
    const interval = window.setInterval(() => {
      if (!document.hidden) loadLeads().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadLeads]);

  const items = useMemo<CalendarItem[]>(
    () =>
      leads
        .flatMap((lead) =>
          lead.reminders
            .filter((reminder) => !reminder.completed_at)
            .map((reminder) => ({ ...reminder, lead })),
        )
        .sort((a, b) => +new Date(a.due_at) - +new Date(b.due_at)),
    [leads],
  );
  const monthItems = items.filter((item) => {
    const due = new Date(item.due_at);
    return (
      due.getFullYear() === month.getFullYear() &&
      due.getMonth() === month.getMonth()
    );
  });
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(1 - ((firstDay.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  const today = dayKey(new Date());
  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(month);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <CalendarDays size={15} /> Follow-up calendar
          </span>
          <h1>{monthLabel}</h1>
          <p>
            Monthly view by default. Every open follow-up, exactly where it
            needs to be.
          </p>
        </div>
        <div className={styles.controls}>
          <button
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            aria-label="Previous month"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className={styles.todayButton}
            onClick={() =>
              setMonth(
                new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              )
            }
          >
            Today
          </button>
          <button
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            aria-label="Next month"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </header>
      <section className={styles.summary}>
        <div>
          <Bell size={16} />
          <span>Open follow-ups</span>
          <strong>{items.length}</strong>
        </div>
        <div>
          <CalendarDays size={16} />
          <span>This month</span>
          <strong>{monthItems.length}</strong>
        </div>
        <div>
          <ListFilter size={16} />
          <span>Accounts due</span>
          <strong>
            {new Set(monthItems.map((item) => item.lead_id)).size}
          </strong>
        </div>
      </section>
      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}
      <div className={styles.layout}>
        <section className={styles.calendar}>
          <div className={styles.weekdays}>
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className={styles.grid}>
            {days.map((date) => {
              const dateItems = items.filter(
                (item) => dayKey(new Date(item.due_at)) === dayKey(date),
              );
              const inMonth = date.getMonth() === month.getMonth();
              return (
                <div
                  className={`${styles.day} ${!inMonth ? styles.outside : ""} ${dayKey(date) === today ? styles.today : ""}`}
                  key={date.toISOString()}
                >
                  <span className={styles.dayNumber}>{date.getDate()}</span>
                  <div className={styles.dayItems}>
                    {dateItems.slice(0, 3).map((item) => (
                      <Link
                        className={styles.event}
                        data-kind={item.kind}
                        href={`/leads/${item.lead_id}`}
                        key={item.id}
                      >
                        <b>{timeLabel(item.due_at)}</b>
                        <span>{item.lead.company}</span>
                        <small>{item.title}</small>
                      </Link>
                    ))}
                    {dateItems.length > 3 && (
                      <span className={styles.more}>
                        +{dateItems.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <aside className={styles.agenda}>
          <div className={styles.agendaHead}>
            <div>
              <span>Month agenda</span>
              <h2>{monthItems.length} open</h2>
            </div>
            <Bell size={17} />
          </div>
          {loading && <p className={styles.empty}>Loading follow-ups…</p>}
          {!loading &&
            monthItems.map((item) => (
              <Link
                className={styles.agendaItem}
                href={`/leads/${item.lead_id}`}
                key={item.id}
              >
                <span className={styles.dateBadge}>
                  <b>{new Date(item.due_at).getDate()}</b>
                  <small>
                    {new Intl.DateTimeFormat("en", { month: "short" }).format(
                      new Date(item.due_at),
                    )}
                  </small>
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>
                    {item.lead.company} · {timeLabel(item.due_at)}
                  </p>
                </div>
                <em data-kind={item.kind}>{item.kind.replace("_", " ")}</em>
              </Link>
            ))}
          {!loading && !monthItems.length && (
            <p className={styles.empty}>Nothing scheduled this month.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
