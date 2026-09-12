"use client";

import LeadProfile from "@/lib/components/lead-profile/lead-profile";

export default function LeadDetailClient({ leadId }: { leadId: string }) {
  return <LeadProfile leadId={leadId} />;
}
