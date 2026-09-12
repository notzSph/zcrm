import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import styles from "./state.module.scss";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <SearchX className={styles.warning} size={22} aria-hidden="true" />
      <div>
        <h1>Page not found</h1>
        <p>This CRM view does not exist or is no longer available.</p>
        <Link className={styles.button} href="/"><ArrowLeft size={15} /> Back to pipeline</Link>
      </div>
    </main>
  );
}
