import LeadProfile from "@/components/lead-profile";

export default async function LeadProfilePage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LeadProfile leadId={leadId} />;
}

