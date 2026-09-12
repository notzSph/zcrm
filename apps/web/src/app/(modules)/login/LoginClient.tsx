"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/lib/components/auth-form/auth-form.module.scss";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!response.ok) {
      setError("Incorrect email or password.");
      return;
    }
    router.replace("/businesses");
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.mark}><Image src="/brand/zspinach.svg" alt="" width={28} height={28} priority />z<span>CRM</span></div>
        <div className={styles.heading}><LockKeyhole size={18} /> <span>Private workspace</span></div>
        <h1>Keep the pipeline moving.</h1>
        <p>Sign in to track opportunities, status, and the next follow-up.</p>
        <form onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button disabled={loading}>{loading ? "Signing in…" : <>Enter zCRM <ArrowRight size={17} /></>}</button>
        </form>
        <p className={styles.authLink}><Link href="/reset-password">Forgot password?</Link></p>
        <p className={styles.authLink}>New here? <Link href="/register">Create your business</Link></p>
      </section>
    </main>
  );
}
