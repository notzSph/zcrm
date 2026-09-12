import { LoaderCircle } from "lucide-react";
import styles from "./state.module.scss";

export default function Loading() {
  return (
    <main className={styles.page} aria-busy="true" aria-live="polite">
      <LoaderCircle className={styles.spinner} size={22} aria-hidden="true" />
      <div>
        <h1>Loading workspace</h1>
        <p>Getting the latest CRM data…</p>
      </div>
    </main>
  );
}
