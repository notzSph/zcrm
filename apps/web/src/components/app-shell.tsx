"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Bell, Building2, CalendarDays, FileText, LayoutDashboard, LogOut, Plus, UserCircle, UsersRound } from "lucide-react";
import type { Business } from "@/lib/types";
import styles from "./app-shell.module.scss";

const mainLinks = [
  { href: "/", label: "Pipeline", icon: LayoutDashboard, match: (path: string) => path === "/" },
  { href: "/calendar", label: "Follow-up calendar", icon: CalendarDays, match: (path: string) => path === "/calendar" },
  { href: "/leads", label: "Lead directory", icon: UsersRound, match: (path: string) => path.startsWith("/leads") },
];
const quickLinks = [
  { href: "/leads?status=meeting", label: "Meetings", icon: Bell },
  { href: "/leads?status=proposal", label: "Proposals", icon: FileText },
  { href: "/leads?status=won", label: "Won", icon: BarChart3 },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState("");

  useEffect(() => {
    if (pathname === "/login" || pathname === "/register") return;
    fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const user = await response.json();
      setBusinesses(user.businesses ?? []);
      setActiveBusinessId(user.active_business_id ?? user.businesses?.[0]?.id ?? "");
    }).catch(() => undefined);
  }, [pathname]);

  async function switchBusiness(businessId: string) {
    if (!businessId || businessId === activeBusinessId) return;
    const response = await fetch("/api/auth/active-business", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: businessId }) });
    if (!response.ok) return;
    setActiveBusinessId(businessId);
    router.replace("/");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  if (pathname === "/login" || pathname === "/register") return <>{children}</>;

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/"><span>z</span>CRM</Link>
      <div className={styles.workspaceSwitcher}>
        <label htmlFor="workspace-switcher">Active workspace</label>
        <select id="workspace-switcher" value={activeBusinessId} onChange={(event) => switchBusiness(event.target.value)} disabled={!businesses.length}>
          {!businesses.length && <option value="">Loading workspaces…</option>}
          {businesses.map((business) => <option value={business.id} key={business.id}>{business.name}</option>)}
        </select>
        <Link className={styles.workspace} href="/businesses"><Building2 size={12} /> Manage workspaces</Link>
      </div>
      <Link className={styles.newLead} href="/leads/new"><Plus size={16} /> New lead</Link>
      <nav className={styles.nav} aria-label="Main navigation">
        {mainLinks.map((link) => { const Icon = link.icon; return <Link className={link.match(pathname) ? styles.active : ""} href={link.href} key={link.href}><Icon size={16} />{link.label}</Link>; })}
      </nav>
      <div className={styles.divider} />
      <nav className={styles.nav} aria-label="Account navigation">
        <Link className={pathname === "/profile" ? styles.active : ""} href="/profile"><UserCircle size={15} />Profile</Link>
      </nav>
      <p className={styles.navLabel}>Quick views</p>
      <nav className={styles.nav} aria-label="Quick views">
        {quickLinks.map((link) => { const Icon = link.icon; const status = link.href.split("=")[1]; return <Link className={pathname === "/leads" && searchParams.get("status") === status ? styles.active : ""} href={link.href} key={link.href}><Icon size={15} />{link.label}</Link>; })}
      </nav>
      <button className={styles.logout} onClick={logout}><LogOut size={15} /> Sign out</button>
    </aside>
    <div className={styles.content}>{children}</div>
  </div>;
}
