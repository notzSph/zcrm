"use client";

import { Suspense } from "react";
import LeadDirectory from "@/lib/components/lead-directory/lead-directory";

export default function LeadsClient() {
  return <Suspense fallback={null}><LeadDirectory /></Suspense>;
}
