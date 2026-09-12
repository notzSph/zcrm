"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import styles from "./state.module.scss";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.page} role="alert">
      <AlertTriangle className={styles.warning} size={22} aria-hidden="true" />
      <div>
        <h1>Something went wrong</h1>
        <p>The workspace could not be displayed. Your CRM data was not changed.</p>
        <button onClick={reset}><RotateCcw size={15} /> Try again</button>
      </div>
    </main>
  );
}
