import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const response = await fetch(`${process.env.API_INTERNAL_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) return NextResponse.json(payload, { status: response.status });

  const result = NextResponse.json({ ok: true });
  result.cookies.set("zcrm_session", payload.session_token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return result;
}
