import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Context) {
  const token = request.cookies.get("zcrm_session")?.value;
  if (!token) return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  const { path } = await context.params;
  const url = new URL(`/api/v1/${path.join("/")}`, process.env.API_INTERNAL_URL);
  url.search = request.nextUrl.search;
  const headers = new Headers();
  headers.set("Cookie", `zcrm_session=${token}`);
  if (request.headers.get("content-type")) headers.set("Content-Type", request.headers.get("content-type")!);
  const response = await fetch(url, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(),
    cache: "no-store",
  });
  return new NextResponse(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
