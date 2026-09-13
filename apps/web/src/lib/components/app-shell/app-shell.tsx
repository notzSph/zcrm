"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Bell, Building2, CalendarDays, ChevronDown, FileText,
  LayoutDashboard, LogOut, Menu, Plus, UsersRound, X,
} from "lucide-react";
import type { Business } from "@/lib/types";
import styles from "./app-shell.module.scss";

type CurrentUser = { display_name: string; email: string; profile_pic?: string | null; businesses: Business[]; active_business_id?: string | null };
const publicRoutes = new Set(["/login", "/register", "/reset-password"]);
const mainLinks = [
  { href: "/", label: "Pipeline", index: "01", icon: LayoutDashboard, match: (path: string) => path === "/" },
  { href: "/calendar", label: "Calendar", index: "02", icon: CalendarDays, match: (path: string) => path === "/calendar" },
  { href: "/leads", label: "Leads", index: "03", icon: UsersRound, match: (path: string) => path.startsWith("/leads") },
  { href: "/businesses", label: "Workspaces", index: "04", icon: Building2, match: (path: string) => path.startsWith("/businesses") },
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
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    if (publicRoutes.has(pathname)) return;
    fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { window.location.assign("/login"); return; }
      if (!response.ok) throw new Error("Profile unavailable");
      const nextUser = (await response.json()) as CurrentUser;
      setUser(nextUser); setBusinesses(nextUser.businesses ?? []);
      setActiveBusinessId(nextUser.active_business_id ?? nextUser.businesses?.[0]?.id ?? "");
      setWorkspaceError("");
    }).catch(() => setWorkspaceError("Workspace unavailable"));
  }, [pathname]);

  async function switchBusiness(businessId: string) {
    if (!businessId || businessId === activeBusinessId) return;
    const response = await fetch("/api/auth/active-business", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: businessId }) });
    if (!response.ok) { setWorkspaceError("Could not switch workspace"); return; }
    setWorkspaceError(""); setActiveBusinessId(businessId); router.replace("/"); router.refresh();
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/login"); }
  const activeBusiness = businesses.find((business) => business.id === activeBusinessId);
  const initials = user?.display_name?.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "Z";
  if (publicRoutes.has(pathname)) return <div id="main-content">{children}</div>;

  const navigation = (mobile = false) => (
    <nav className={mobile ? styles.mobileLinks : styles.nav} aria-label={mobile ? "Mobile navigation" : "Primary navigation"}>
      {mainLinks.map((link) => { const Icon = link.icon; const active = link.match(pathname); return (
        <Link aria-current={active ? "page" : undefined} className={active ? styles.active : ""} href={link.href} key={link.href}>
          <span className={styles.linkIndex}>/{link.index}</span><Icon size={15} aria-hidden="true" />{link.label}
        </Link>
      ); })}
    </nav>
  );

  return <div className={styles.shell}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/" aria-label="zCRM pipeline"><span className={styles.brandMark}>z</span><span>CRM</span></Link>
        {navigation()}
        <div className={styles.headerActions}>
          <Link className={styles.createButton} href="/leads/new"><Plus size={14} /> New lead</Link>
          <button className={styles.menuButton} onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? "Close navigation" : "Open navigation"}>{menuOpen ? <X size={18}/> : <Menu size={18}/>}</button>
        </div>
      </div>
      {menuOpen && <div id="mobile-navigation" className={styles.mobileMenu}>{navigation(true)}<Link className={styles.mobileCreate} href="/leads/new">Create a new lead <span>→</span></Link></div>}
    </header>

    <div className={styles.workspaceBar}>
      <div className={styles.workspaceBarInner}>
        <label className={styles.workspaceSelect}><span>{activeBusiness?.name?.slice(0,1).toUpperCase() || "W"}</span><span className={styles.workspaceText}><small>Active workspace</small><select value={activeBusinessId} onChange={(event) => switchBusiness(event.target.value)} disabled={!businesses.length} aria-label="Active workspace"><option value="">{workspaceError || "Loading workspace…"}</option>{businesses.map((business) => <option value={business.id} key={business.id}>{business.name}</option>)}</select></span><ChevronDown size={13}/></label>
        <nav className={styles.quickViews} aria-label="Quick views">{quickLinks.map((link) => { const Icon = link.icon; const active = pathname === "/leads" && searchParams.get("status") === link.href.split("=")[1]; return <Link className={active ? styles.activeQuick : ""} href={link.href} key={link.href}><Icon size={13}/>{link.label}</Link>; })}</nav>
        <div className={styles.accountMenu}><Link href="/profile" className={styles.account}>{user?.profile_pic ? <img src={user.profile_pic} alt=""/> : <span>{initials}</span>}<span><strong>{user?.display_name || "CRM operator"}</strong><small>{user?.email || "Loading account…"}</small></span></Link><button onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={15}/></button></div>
      </div>
    </div>
    <div className={styles.content} id="main-content">{children}</div>
  </div>;
}
