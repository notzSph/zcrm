"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { LeadStatus } from "@/lib/types";
import { leadStatusOptions } from "@/lib/options";
import styles from "@/components/lead-pages.module.scss";

export default function NewLeadPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: form.get("company"), contact_name: form.get("contact_name") || null, contact_email: form.get("contact_email") || null, contact_phone: form.get("contact_phone") || null, linkedin_url: form.get("linkedin_url") || null, source: form.get("source") || null, estimated_value: form.get("estimated_value") ? Number(form.get("estimated_value")) : null, status: form.get("status"), next_action: form.get("next_action") || null }) });
    setSaving(false);
    if (!response.ok) { setError("Could not create the lead. Check the fields and try again."); return; }
    const lead = await response.json();
    router.replace(`/leads/${lead.id}`);
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><Link className={styles.back} href="/leads"><ArrowLeft size={15} /> Lead directory</Link><h1>New lead</h1><p>Add the essentials now. The record can be filled out as the conversation moves.</p></div></header>
    <section className={styles.newLeadCard}><div className={styles.newLeadIntro}><Building2 size={18} /><div><span>New account</span><p>Keep it lean. Add the contact and marketing context when you have it.</p></div></div><form className={styles.newLeadForm} onSubmit={submit}><label>Company<input name="company" required autoFocus placeholder="Acme Inc." /></label><label>Starting status<select name="status" defaultValue={LeadStatus.Connected}>{leadStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Contact name<input name="contact_name" placeholder="John Doe" /></label><label>Contact email<input name="contact_email" type="email" placeholder="name@company.com" /></label><label>Phone<input name="contact_phone" placeholder="+1 555 0100" /></label><label>LinkedIn URL<input name="linkedin_url" type="url" placeholder="https://linkedin.com/in/…" /></label><label>Source<input name="source" placeholder="Referral, website, outbound…" /></label><label>Estimated value<input name="estimated_value" type="number" min="0" step="0.01" placeholder="5000" /></label><label className={styles.fullField}>Next action<textarea name="next_action" placeholder="Send the intro and follow up next week." /></label>{error && <p className={styles.formError}>{error}</p>}<div className={styles.formActions}><Link className={styles.cancel} href="/leads">Cancel</Link><button disabled={saving}>{saving ? "Creating…" : <><Plus size={16} /> Create lead</>}</button></div></form></section>
  </main>;
}
