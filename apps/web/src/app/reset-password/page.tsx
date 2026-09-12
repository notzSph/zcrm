"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import styles from "../login/page.module.scss";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const data = await response.json(); if (response.ok) setMessage(data.message); else setError(data.detail ?? "Could not request reset."); }
  return <main className={styles.page}><section className={styles.card}><h1>Recover your account.</h1><p>Enter your email and we’ll generate reset instructions.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>{error && <p className={styles.error}>{error}</p>}{message && <p>{message}</p>}<button type="submit">Request reset</button></form><p className={styles.authLink}><Link href="/login">Back to sign in</Link></p></section></main>;
}
