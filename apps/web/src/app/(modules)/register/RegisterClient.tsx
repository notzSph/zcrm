"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "@/lib/components/auth-form/auth-form.module.scss";

export default function RegisterPage() {
  const router = useRouter(); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const password = String(form.get("password"));
    if (password !== String(form.get("confirm_password"))) { setError("Passwords do not match."); return; }
    setError(""); setLoading(true);
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: form.get("display_name"), email: form.get("email"), password, business_name: form.get("business_name") }) });
    setLoading(false);
    if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.detail || "Could not create the account."); return; }
    router.replace("/"); router.refresh();
  }
  return <main className={styles.page}><section className={styles.card}><div className={styles.mark}><Image src="/brand/zspinach.svg" alt="" width={28} height={28} priority />z<span>CRM</span></div><div className={styles.heading}><UserPlus size={18} /> <span>New workspace</span></div><h1>Create your business.</h1><p>Your account gets full access to the workspace. Add other users after they register.</p><form onSubmit={submit}><label>Name<input name="display_name" required autoComplete="name" /></label><label>Business name<input name="business_name" required placeholder="Acme Inc." /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" minLength={10} required autoComplete="new-password" /></label><label>Confirm password<input name="confirm_password" type="password" minLength={10} required autoComplete="new-password" /></label>{error && <p className={styles.error} role="alert">{error}</p>}<button disabled={loading}>{loading ? "Creating…" : <>Create workspace <ArrowRight size={17} /></>}</button></form><p className={styles.authLink}>Already registered? <Link href="/login">Sign in</Link></p></section></main>;
}
