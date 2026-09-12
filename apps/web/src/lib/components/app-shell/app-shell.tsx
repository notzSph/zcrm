"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  UserCircle,
  UsersRound,
} from "lucide-react";
import type { Business } from "@/lib/types";
import styles from "./app-shell.module.scss";

type CurrentUser = {
  display_name: string;
  email: string;
  profile_pic?: string | null;
  businesses: Business[];
  active_business_id?: string | null;
};

const publicRoutes = new Set(["/login", "/register", "/reset-password"]);

const mainLinks = [
  {
    href: "/",
    label: "Pipeline",
    icon: LayoutDashboard,
    match: (path: string) => path === "/",
  },
  {
    href: "/calendar",
    label: "Follow-up calendar",
    icon: CalendarDays,
    match: (path: string) => path === "/calendar",
  },
  {
    href: "/leads",
    label: "Leads",
    icon: UsersRound,
    match: (path: string) => path.startsWith("/leads"),
  },
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

  useEffect(() => {
    if (publicRoutes.has(pathname)) return;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!response.ok) throw new Error("Profile unavailable");
        const nextUser = (await response.json()) as CurrentUser;
        setUser(nextUser);
        setBusinesses(nextUser.businesses ?? []);
        setActiveBusinessId(
          nextUser.active_business_id ?? nextUser.businesses?.[0]?.id ?? "",
        );
        setWorkspaceError("");
      })
      .catch(() => setWorkspaceError("Workspace unavailable"));
  }, [pathname]);

  async function switchBusiness(businessId: string) {
    if (!businessId || businessId === activeBusinessId) return;
    const response = await fetch("/api/auth/active-business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_id: businessId }),
    });
    if (!response.ok) {
      setWorkspaceError("Could not switch workspace");
      return;
    }
    setWorkspaceError("");
    setActiveBusinessId(businessId);
    router.replace("/");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  const activeBusiness = businesses.find(
    (business) => business.id === activeBusinessId,
  );
  const initials =
    user?.display_name
      ?.trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "Z";

  if (publicRoutes.has(pathname))
    return <div id="main-content">{children}</div>;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link className={styles.brand} href="/">
            <span>z</span>CRM
          </Link>
          <span className={styles.liveDot}>
            <i /> Live
          </span>
        </div>
        <div className={styles.workspaceSwitcher}>
          <label htmlFor="workspace-switcher">Workspace</label>
          <div className={styles.workspaceSelect}>
            {activeBusiness?.logo_url ? (
              <img src={activeBusiness.logo_url} alt="" />
            ) : (
              <span>
                {activeBusiness?.name?.slice(0, 1).toUpperCase() || "W"}
              </span>
            )}
            <select
              id="workspace-switcher"
              value={activeBusinessId}
              onChange={(event) => switchBusiness(event.target.value)}
              disabled={!businesses.length}
            >
              {!businesses.length && (
                <option value="">
                  {workspaceError || "Loading workspaces…"}
                </option>
              )}
              {businesses.map((business) => (
                <option value={business.id} key={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>
          <Link className={styles.workspace} href="/businesses">
            <Building2 size={12} /> Manage workspaces <span>↗</span>
          </Link>
        </div>
        <Link className={styles.newLead} href="/leads/new">
          <Plus size={16} /> New lead
        </Link>
        <p className={styles.navLabel}>Workspace</p>
        <nav className={styles.nav} aria-label="Main navigation">
          {mainLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                aria-current={link.match(pathname) ? "page" : undefined}
                className={link.match(pathname) ? styles.active : ""}
                href={link.href}
                key={link.href}
              >
                <Icon size={16} />
                {link.label}
                <span className={styles.chevron}>›</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.divider} />
        <p className={styles.navLabel}>Account</p>
        <nav className={styles.nav} aria-label="Account navigation">
          <Link
            aria-current={pathname === "/profile" ? "page" : undefined}
            className={pathname === "/profile" ? styles.active : ""}
            href="/profile"
          >
            <UserCircle size={15} />
            Profile<span className={styles.chevron}>›</span>
          </Link>
        </nav>
        <p className={styles.navLabel}>Quick views</p>
        <nav className={styles.nav} aria-label="Quick views">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            const status = link.href.split("=")[1];
            return (
              <Link
                aria-current={
                  pathname === "/leads" && searchParams.get("status") === status
                    ? "page"
                    : undefined
                }
                className={
                  pathname === "/leads" && searchParams.get("status") === status
                    ? styles.active
                    : ""
                }
                href={link.href}
                key={link.href}
              >
                <Icon size={15} />
                {link.label}
                <span className={styles.chevron}>›</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link className={styles.account} href="/profile">
            {user?.profile_pic ? (
              <img src={user.profile_pic} alt="" />
            ) : (
              <span>{initials}</span>
            )}
            <div>
              <strong>{user?.display_name || "Loading account…"}</strong>
              <small>{user?.email || "CRM operator"}</small>
            </div>
          </Link>
          <button className={styles.logout} onClick={logout}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      <div className={styles.content} id="main-content">
        {children}
      </div>
    </div>
  );
}
