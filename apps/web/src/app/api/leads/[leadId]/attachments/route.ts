import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const token = request.cookies.get("zcrm_session")?.value;
  if (!token) return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  const url = new URL(`/api/v1/leads/${leadId}/attachments`, process.env.API_INTERNAL_URL);
  url.search = request.nextUrl.search;
  const response = await fetch(url, { method: "POST", headers: { Cookie: `zcrm_session=${token}`, "Content-Type": request.headers.get("content-type") ?? "" }, body: await request.arrayBuffer(), cache: "no-store" });
  return new NextResponse(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
}
