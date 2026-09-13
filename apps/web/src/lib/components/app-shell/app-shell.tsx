"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
const focusableSelector = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState("");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mainColumnRef = useRef<HTMLDivElement>(null);
  const mobileHeaderRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const sync = () => { setMobile(media.matches); if (!media.matches) setMenuOpen(false); };
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname, query]);

  useEffect(() => {
    if (!mobile) return;
    if (menuOpen) {
      wasOpen.current = true;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => closeButtonRef.current?.focus());
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); return; }
        if (event.key !== "Tab" || !sidebarRef.current) return;
        const items = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>(focusableSelector));
        if (!items.length) return;
        const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      };
      document.addEventListener("keydown", onKeyDown);
      return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
    }
    if (wasOpen.current) { wasOpen.current = false; requestAnimationFrame(() => menuButtonRef.current?.focus()); }
  }, [menuOpen, mobile]);

  useEffect(() => {
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
    setWorkspaceError("");
    try {
      const response = await fetch("/api/auth/active-business", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: businessId }) });
      if (!response.ok) throw new Error("Workspace switch failed");
      setActiveBusinessId(businessId); router.replace("/"); router.refresh();
    } catch { setWorkspaceError("Could not switch workspace"); }
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/login"); }

  const activeBusiness = businesses.find((business) => business.id === activeBusinessId);
  const initials = user?.display_name?.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "Z";
  if (publicRoutes.has(pathname)) return <div id="main-content">{children}</div>;
  const sidebarHidden = mobile && !menuOpen;

  return <div className={styles.shell}>
    <div className={styles.mobileHeader} ref={mobileHeaderRef} inert={mobile && menuOpen ? true : undefined} aria-hidden={mobile && menuOpen ? "true" : undefined}>
      <Link className={styles.brand} href="/" aria-label="zCRM pipeline"><span className={styles.brandMark}>z</span><span>CRM</span></Link>
      <button ref={menuButtonRef} className={styles.menuButton} type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="primary-sidebar" aria-label="Open navigation"><Menu size={19} aria-hidden="true"/></button>
    </div>

    <aside ref={sidebarRef} id="primary-sidebar" className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`} inert={sidebarHidden ? true : undefined} aria-hidden={sidebarHidden ? "true" : undefined} aria-label="Site navigation">
      <div className={styles.sidebarHeader}>
        <Link className={styles.brand} href="/" aria-label="zCRM pipeline"><span className={styles.brandMark}>z</span><span>CRM</span></Link>
        <button ref={closeButtonRef} className={styles.drawerClose} type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={19} aria-hidden="true"/></button>
      </div>
      <Link className={styles.newLead} href="/leads/new"><Plus size={14} aria-hidden="true"/> New lead <span>→</span></Link>
      <p className={styles.navLabel}>Workspace</p>
      <nav className={styles.nav} aria-label="Primary navigation">
        {mainLinks.map((link) => { const Icon = link.icon; const active = link.match(pathname); return <Link aria-current={active ? "page" : undefined} className={active ? styles.active : ""} href={link.href} key={link.href}><span className={styles.linkIndex}>/{link.index}</span><Icon size={16} aria-hidden="true"/><span>{link.label}</span></Link>; })}
      </nav>
      <div className={styles.divider}/>
      <p className={styles.navLabel}>Account</p>
      <nav className={styles.nav} aria-label="Account navigation"><Link aria-current={pathname === "/profile" ? "page" : undefined} className={pathname === "/profile" ? styles.active : ""} href="/profile"><span className={styles.linkIndex}>/05</span><UserCircle size={16} aria-hidden="true"/><span>Profile</span></Link></nav>
      <div className={styles.sidebarFooter}><p>CRM workspace</p><span>Operational clarity.</span></div>
    </aside>

    {menuOpen && mobile && <button className={styles.scrim} type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation"/>}

    <div className={styles.mainColumn} ref={mainColumnRef} inert={mobile && menuOpen ? true : undefined} aria-hidden={mobile && menuOpen ? "true" : undefined}>
      <div className={styles.workspaceBar}>
        <div className={styles.workspaceIdentity}>
          <span className={styles.workspaceAvatar} aria-hidden="true">{activeBusiness?.logo_url ? <img src={activeBusiness.logo_url} alt=""/> : activeBusiness?.name?.slice(0,1).toUpperCase() || "W"}</span>
          <label className={styles.workspaceText}><small>Active workspace</small><span><select value={activeBusinessId} onChange={(event) => switchBusiness(event.target.value)} disabled={!businesses.length} aria-describedby="workspace-error"><option value="">{businesses.length ? "Select workspace" : "Loading workspace…"}</option>{businesses.map((business) => <option value={business.id} key={business.id}>{business.name}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></span></label>
          <span id="workspace-error" className={styles.workspaceError} role="status" aria-live="polite">{workspaceError}</span>
        </div>
        <nav className={styles.quickViews} aria-label="Quick views">{quickLinks.map((link) => { const Icon = link.icon; const active = pathname === "/leads" && searchParams.get("status") === link.href.split("=")[1]; return <Link className={active ? styles.activeQuick : ""} href={link.href} key={link.href}><Icon size={13} aria-hidden="true"/>{link.label}</Link>; })}</nav>
        <div className={styles.accountMenu}><Link href="/profile" className={styles.account}>{user?.profile_pic ? <img src={user.profile_pic} alt=""/> : <span aria-hidden="true">{initials}</span>}<span><strong>{user?.display_name || "CRM operator"}</strong><small>{user?.email || "Loading account…"}</small></span></Link><button type="button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={15} aria-hidden="true"/></button></div>
      </div>
      <main className={styles.content} id="main-content">{children}</main>
    </div>
  </div>;
}
