"use client";

import { FormEvent, useEffect, useState } from "react";

type User = { display_name: string; email: string; profile_pic?: string | null; businesses: { id: string; name: string }[] };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((data: User) => { setUser(data); setName(data.display_name); setProfilePic(data.profile_pic ?? ""); }); }, []);
  async function save(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: name, profile_pic: profilePic || null }) }); setMessage(response.ok ? "Profile saved." : "Could not save profile."); if (response.ok) setUser(await response.json()); }
  if (!user) return <main style={{ padding: 48 }}>Loading profile…</main>;
  return <main style={{ maxWidth: 720, padding: 48 }}><p>Profile</p><h1>{user.display_name}</h1><p>{user.email}</p><form onSubmit={save} style={{ display: "grid", gap: 16, maxWidth: 420 }}><label>Display name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Profile image URL<input value={profilePic} onChange={(e) => setProfilePic(e.target.value)} placeholder="https://…" /></label><button type="submit">Save profile</button>{message && <p>{message}</p>}</form><p>{user.businesses.length} business workspace{user.businesses.length === 1 ? "" : "s"}</p></main>;
}
