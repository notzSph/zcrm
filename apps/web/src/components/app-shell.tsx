"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, Bell, FileText, LayoutDashboard, LogOut, Plus, UsersRound } from "lucide-react";
import styles from "./app-shell.module.scss";

const mainLinks = [
  { href: "/", label: "Pipeline", icon: LayoutDashboard, match: (path: string) => path === "/" },
  { href: "/leads", label: "Lead directory", icon: UsersRound, match: (path: string) => path.startsWith("/leads") },
];
const quickLinks = [
  { href: "/leads?status=meeting", label: "Meetings", icon: Bell },
  { href: "/leads?status=proposal", label: "Proposals", icon: FileText },
  { href: "/leads?status=won", label: "Won", icon: BarChart3 },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname === "/login") return <>{children}</>;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/"><span>z</span>CRM</Link>
      <p className={styles.workspace}>Private workspace</p>
      <Link className={styles.newLead} href="/leads/new"><Plus size={16} /> New lead</Link>
      <nav className={styles.nav} aria-label="Main navigation">
        {mainLinks.map((link) => { const Icon = link.icon; return <Link className={link.match(pathname) ? styles.active : ""} href={link.href} key={link.href}><Icon size={16} />{link.label}</Link>; })}
      </nav>
      <div className={styles.divider} />
      <p className={styles.navLabel}>Quick views</p>
      <nav className={styles.nav} aria-label="Quick views">
        {quickLinks.map((link) => { const Icon = link.icon; const status = link.href.split("=")[1]; return <Link className={pathname === "/leads" && searchParams.get("status") === status ? styles.active : ""} href={link.href} key={link.href}><Icon size={15} />{link.label}</Link>; })}
      </nav>
      <button className={styles.logout} onClick={logout}><LogOut size={15} /> Sign out</button>
    </aside>
    <div className={styles.content}>{children}</div>
  </div>;
}
