import { Suspense } from "react";
import LeadDirectory from "@/components/lead-directory";

export default function LeadsPage() {
  return <Suspense fallback={null}><LeadDirectory /></Suspense>;
}
