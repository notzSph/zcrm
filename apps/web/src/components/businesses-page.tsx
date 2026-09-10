"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Check, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./businesses-page.module.scss";

type Business = { id: string; name: string; created_at: string };

export default function BusinessesPage() {
  const router = useRouter(); const [businesses, setBusinesses] = useState<Business[]>([]); const [name, setName] = useState(""); const [editing, setEditing] = useState<Business | null>(null); const [error, setError] = useState("");
  const load = async () => { const response = await fetch("/api/businesses", { cache: "no-store" }); if (response.ok) setBusinesses(await response.json()); else setError("Could not load your businesses."); };
  useEffect(() => { load(); }, []);
  const manage = (id: string) => router.push(`/businesses/${id}`);
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const response = await fetch("/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); if (!response.ok) { setError("Could not create the business."); return; } const business = await response.json() as Business; manage(business.id); };
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!editing) return; const form = new FormData(event.currentTarget); const response = await fetch(`/api/businesses/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name") }) }); if (!response.ok) { setError("Could not rename the business."); return; } setEditing(null); await load(); };
  const remove = async (business: Business) => { if (!window.confirm(`Delete “${business.name}” and all its CRM data? This cannot be undone.`)) return; const response = await fetch(`/api/businesses/${business.id}`, { method: "DELETE" }); if (!response.ok) { setError("Could not delete the business."); return; } await load(); };
  return <main className={styles.page}><section className={styles.card}><span className={styles.eyebrow}><Building2 size={15} /> Your businesses</span><h1>Choose a workspace.</h1><p>Every pipeline is isolated to its business. Pick one to work inside it.</p>{error && <p className={styles.error}>{error}</p>}<div className={styles.list}>{businesses.map((business) => editing?.id === business.id ? <form className={styles.editRow} key={business.id} onSubmit={save}><input name="name" defaultValue={business.name} autoFocus required /><button title="Save"><Check size={15} /></button><button type="button" title="Cancel" onClick={() => setEditing(null)}><X size={15} /></button></form> : <div className={styles.businessRow} key={business.id}><button className={styles.open} onClick={() => manage(business.id)}><span><Building2 size={17} /></span><strong>{business.name}</strong><ChevronRight size={17} /></button><div className={styles.actions}><button title="Rename" onClick={() => setEditing(business)}><Pencil size={14} /></button><button title="Delete" onClick={() => remove(business)}><Trash2 size={14} /></button></div></div>)}{!businesses.length && <p className={styles.empty}>No businesses yet. Create the first workspace below.</p>}</div><form onSubmit={create}><label>New business<input value={name} onChange={(event) => setName(event.target.value)} placeholder="VM Group" required /></label><button><Plus size={16} /> Create workspace</button></form></section></main>;
}
