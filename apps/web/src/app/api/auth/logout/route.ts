import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await fetch(`${process.env.API_INTERNAL_URL}/api/v1/auth/logout`, { method: "POST", headers: { Cookie: request.headers.get("cookie") ?? "" } }).catch(() => null);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("zcrm_session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
