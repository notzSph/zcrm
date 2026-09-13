"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Bell, Building2, CalendarDays, ChevronDown, FileText,
  LayoutDashboard, LogOut, Menu, Plus, UserCircle, UsersRound, X,
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

  return <div className={styles.shell}>
    <div className={styles.mobileHeader}>
      <Link className={styles.brand} href="/" aria-label="zCRM pipeline"><span className={styles.brandMark}>z</span><span>CRM</span></Link>
      <button className={styles.menuButton} type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="primary-sidebar" aria-label={menuOpen ? "Close navigation" : "Open navigation"}>{menuOpen ? <X size={19}/> : <Menu size={19}/>}</button>
    </div>

    <aside id="primary-sidebar" className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.sidebarHeader}>
        <Link className={styles.brand} href="/" aria-label="zCRM pipeline"><span className={styles.brandMark}>z</span><span>CRM</span></Link>
        <span className={styles.liveDot}><i/> Live</span>
      </div>
      <Link className={styles.newLead} href="/leads/new"><Plus size={14}/> New lead <span>→</span></Link>
      <p className={styles.navLabel}>Workspace</p>
      <nav className={styles.nav} aria-label="Primary navigation">
        {mainLinks.map((link) => { const Icon = link.icon; const active = link.match(pathname); return <Link aria-current={active ? "page" : undefined} className={active ? styles.active : ""} href={link.href} key={link.href}><span className={styles.linkIndex}>/{link.index}</span><Icon size={16} aria-hidden="true"/><span>{link.label}</span></Link>; })}
      </nav>
      <div className={styles.divider}/>
      <p className={styles.navLabel}>Account</p>
      <nav className={styles.nav} aria-label="Account navigation"><Link aria-current={pathname === "/profile" ? "page" : undefined} className={pathname === "/profile" ? styles.active : ""} href="/profile"><span className={styles.linkIndex}>/05</span><UserCircle size={16}/><span>Profile</span></Link></nav>
      <div className={styles.sidebarFooter}>
        <p>CRM workspace</p>
        <span>Operational clarity.</span>
      </div>
    </aside>

    {menuOpen && <button className={styles.scrim} type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation"/>}

    <div className={styles.mainColumn}>
      <div className={styles.workspaceBar}>
        <div className={styles.workspaceIdentity}>
          <span className={styles.workspaceAvatar}>{activeBusiness?.logo_url ? <img src={activeBusiness.logo_url} alt=""/> : activeBusiness?.name?.slice(0,1).toUpperCase() || "W"}</span>
          <label className={styles.workspaceText}><small>Active workspace</small><span><select value={activeBusinessId} onChange={(event) => switchBusiness(event.target.value)} disabled={!businesses.length} aria-label="Active workspace"><option value="">{workspaceError || "Loading workspace…"}</option>{businesses.map((business) => <option value={business.id} key={business.id}>{business.name}</option>)}</select><ChevronDown size={13}/></span></label>
        </div>
        <nav className={styles.quickViews} aria-label="Quick views">{quickLinks.map((link) => { const Icon = link.icon; const active = pathname === "/leads" && searchParams.get("status") === link.href.split("=")[1]; return <Link className={active ? styles.activeQuick : ""} href={link.href} key={link.href}><Icon size={13}/>{link.label}</Link>; })}</nav>
        <div className={styles.accountMenu}><Link href="/profile" className={styles.account}>{user?.profile_pic ? <img src={user.profile_pic} alt=""/> : <span>{initials}</span>}<span><strong>{user?.display_name || "CRM operator"}</strong><small>{user?.email || "Loading account…"}</small></span></Link><button type="button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={15}/></button></div>
      </div>
      <main className={styles.content} id="main-content">{children}</main>
    </div>
  </div>;
}
