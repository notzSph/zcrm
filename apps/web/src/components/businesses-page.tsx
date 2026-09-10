"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./businesses-page.module.scss";

type Business = { id: string; name: string; created_at: string };

export default function BusinessesPage() {
  const router = useRouter(); const [businesses, setBusinesses] = useState<Business[]>([]); const [name, setName] = useState(""); const [error, setError] = useState("");
  const load = async () => { const response = await fetch("/api/businesses", { cache: "no-store" }); if (response.ok) setBusinesses(await response.json()); else setError("Could not load your businesses."); };
  useEffect(() => { load(); }, []);
  const select = async (id: string) => { const response = await fetch("/api/auth/active-business", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: id }) }); if (!response.ok) { setError("Could not open this business."); return; } router.replace("/"); router.refresh(); };
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const response = await fetch("/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); if (!response.ok) { setError("Could not create the business."); return; } const business = await response.json() as Business; await select(business.id); };
  return <main className={styles.page}><section className={styles.card}><span className={styles.eyebrow}><Building2 size={15} /> Your businesses</span><h1>Choose a workspace.</h1><p>Every pipeline is isolated to its business. Pick one to work inside it.</p>{error && <p className={styles.error}>{error}</p>}<div className={styles.list}>{businesses.map((business) => <button key={business.id} onClick={() => select(business.id)}><span><Building2 size={17} /></span><strong>{business.name}</strong><ChevronRight size={17} /></button>)}{!businesses.length && <p className={styles.empty}>No businesses yet. Create the first workspace below.</p>}</div><form onSubmit={create}><label>New business<input value={name} onChange={(event) => setName(event.target.value)} placeholder="VM Group" required /></label><button><Plus size={16} /> Create workspace</button></form></section></main>;
}
