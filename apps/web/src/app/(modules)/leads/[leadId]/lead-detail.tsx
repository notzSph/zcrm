import LeadDetailClient from "./LeadDetailClient";

export default function LeadDetail({ leadId }: { leadId: string }) {
  return <LeadDetailClient leadId={leadId} />;
}
