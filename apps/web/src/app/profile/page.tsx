"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, AtSign, Building2, Check, Image as ImageIcon, LockKeyhole, Save, UserRound } from "lucide-react";
import { Business } from "@/lib/types";
import styles from "./profile.module.scss";

type User = { id: string; display_name: string; email: string; profile_pic?: string | null; businesses: Business[] };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null); const [name, setName] = useState(""); const [profilePic, setProfilePic] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((data: User) => { setUser(data); setName(data.display_name); setProfilePic(data.profile_pic ?? ""); }).catch(() => setError("Could not load your profile.")); }, []);
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); setError(""); const response = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: name, profile_pic: profilePic || null }) }); setSaving(false); if (!response.ok) { setError("Could not save profile."); return; } setUser(await response.json()); setMessage("Profile saved."); }
  if (!user) return <main className={styles.page}><p className={styles.loading}>{error || "Loading profile…"}</p></main>;
  const initials = name.trim().slice(0, 2).toUpperCase() || "Z";
  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}><UserRound size={14} /> Account settings</span><h1>Your profile</h1><p>Keep your identity and workspace links in one place.</p></div><Link className={styles.headerLink} href="/businesses">Manage businesses <ArrowRight size={14} /></Link></header>
    <div className={styles.layout}>
      <section className={styles.profileCard}><div className={styles.cardTop}><div className={styles.avatar}>{user.profile_pic ? <img src={user.profile_pic} alt="" /> : initials}</div><div><span className={styles.kicker}>Personal identity</span><h2>{user.display_name}</h2><p>Member since your first workspace</p></div></div><form onSubmit={save}><label>Display name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Email address<div className={styles.readonly}><AtSign size={14} />{user.email}<span>Verified</span></div></label><label>Profile image URL<div className={styles.inputIcon}><ImageIcon size={14} /><input value={profilePic} onChange={(e) => setProfilePic(e.target.value)} placeholder="https://…" /></div></label>{error && <p className={styles.error}>{error}</p>}{message && <p className={styles.success}><Check size={14} />{message}</p>}<button className={styles.primary} disabled={saving}><Save size={15} />{saving ? "Saving…" : "Save changes"}</button></form></section>
      <aside className={styles.side}><section className={styles.statCard}><span className={styles.kicker}>Workspace access</span><strong>{user.businesses.length}</strong><p>business {user.businesses.length === 1 ? "workspace" : "workspaces"} connected to your account</p><Link href="/businesses">View all <ArrowRight size={13} /></Link></section><section className={styles.workspaceCard}><div className={styles.sectionTitle}><Building2 size={15} /><h2>Your businesses</h2></div>{user.businesses.slice(0, 4).map((business) => <Link className={styles.businessItem} href={`/businesses/${business.id}`} key={business.id}>{business.logo_url ? <img src={business.logo_url} alt="" /> : <span>{business.name.slice(0, 1).toUpperCase()}</span>}<div><strong>{business.name}</strong><small>{business.industry || "Business workspace"}</small></div><ArrowRight size={14} /></Link>)}<Link className={styles.addBusiness} href="/businesses"><Building2 size={14} /> Manage businesses</Link></section><section className={styles.security}><LockKeyhole size={15} /><div><strong>Security</strong><p>Need to change your password? Use account recovery.</p><Link href="/reset-password">Reset password <ArrowRight size={13} /></Link></div></section></aside>
    </div>
  </main>;
}
