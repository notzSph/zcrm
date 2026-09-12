"use client";

import BusinessDetail from "@/lib/components/business-detail/business-detail";

export default function BusinessDetailClient({ businessId }: { businessId: string }) {
  return <BusinessDetail businessId={businessId} />;
}
