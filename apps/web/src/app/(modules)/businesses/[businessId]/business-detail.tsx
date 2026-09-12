import BusinessDetailClient from "./BusinessDetailClient";

export default function BusinessDetail({ businessId }: { businessId: string }) {
  return <BusinessDetailClient businessId={businessId} />;
}
