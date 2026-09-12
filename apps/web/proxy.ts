import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/register" || pathname === "/reset-password" || pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  const token = request.cookies.get("zcrm_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const response = await fetch(`${process.env.API_INTERNAL_URL}/api/v1/auth/me`, {
    headers: { Cookie: `zcrm_session=${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return NextResponse.redirect(new URL("/login", request.url));
  const user = await response.json() as { active_business_id: string | null };
  if (pathname !== "/businesses" && !user.active_business_id) return NextResponse.redirect(new URL("/businesses", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
