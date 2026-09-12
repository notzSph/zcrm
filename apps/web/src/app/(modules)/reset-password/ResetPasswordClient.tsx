"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "@/lib/components/auth-form/auth-form.module.scss";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState(""); const [userId, setUserId] = useState(""); const [token, setToken] = useState(""); const [newPassword, setNewPassword] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { const params = new URLSearchParams(window.location.search); setUserId(params.get("user_id") ?? ""); setToken(params.get("token") ?? ""); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); setLoading(true); try { const endpoint = token && userId ? "/api/auth/reset-password" : "/api/auth/forgot-password"; const body = token && userId ? { user_id: userId, token, new_password: newPassword } : { email }; const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (response.ok) setMessage(data.message); else setError(data.detail ?? "Could not complete the request."); } catch { setError("Could not reach the service. Try again."); } finally { setLoading(false); } }
  const isReset = Boolean(token && userId);
  return <main className={styles.page}><section className={styles.card}><div className={styles.mark}><Image src="/brand/zspinach.svg" alt="" width={28} height={28} priority />z<span>CRM</span></div><h1>{isReset ? "Choose a new password." : "Recover your account."}</h1><p>{isReset ? "Set a new password for your zCRM account." : "Enter your email and we’ll send reset instructions."}</p><form onSubmit={submit} aria-busy={loading}>{isReset ? <label>New password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={10} required autoFocus /></label> : <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>}{error && <p className={styles.error} role="alert">{error}</p>}{message && <p role="status">{message}</p>}{!message && <button type="submit" disabled={loading}>{loading ? "Working…" : isReset ? "Update password" : "Request reset"}</button>}</form><p className={styles.authLink}><Link href="/login">Back to sign in</Link></p></section></main>;
}
