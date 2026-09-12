import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const response = await fetch(`${process.env.API_INTERNAL_URL}/api/v1/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.text(), cache: "no-store" });
  return NextResponse.json(await response.json(), { status: response.status });
}
