import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { createSafeRedirectUrl, sanitizeRedirectPath } from "@/lib/auth-url";

export async function proxy(request: NextRequest) {
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const { pathname, searchParams } = request.nextUrl;

  // 0. Problem A Fix: NEVER serve or redirect to 0.0.0.0 in browser
  // If the browser requested 0.0.0.0 as the host, redirect immediately to localhost
  if (hostHeader.startsWith("0.0.0.0")) {
    const safeBase = `http://localhost:${request.nextUrl.port || "3000"}`;
    const safeUrl = new URL(pathname + request.nextUrl.search, safeBase);
    return NextResponse.redirect(safeUrl, 308);
  }

  // 1. If an auth code or token_hash arrived on any route other than the auth handlers
  // (e.g. Supabase redirecting to /?code=... or /login?code=...), route directly to /auth/callback
  if ((searchParams.has("code") || searchParams.has("token_hash")) && !pathname.startsWith("/auth/")) {
    const callbackTarget = `/auth/callback?${searchParams.toString()}`;
    const callbackUrl = createSafeRedirectUrl(callbackTarget, request);
    return NextResponse.redirect(callbackUrl);
  }

  const { supabaseResponse, user } = await updateSession(request);

  // Routes that require authentication
  const protectedPrefixes = [
    "/dashboard",
    "/expenses",
    "/analytics",
    "/groups",
    "/budgets",
    "/settings",
    "/scanner",
    "/ocr-results",
  ];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  // Routes only for unauthenticated users
  const authOnlyRoutes = ["/login"];
  const isAuthOnly = authOnlyRoutes.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const safeRedirectParam = pathname !== "/dashboard" ? `?redirect=${encodeURIComponent(pathname)}` : "";
    const loginUrl = createSafeRedirectUrl(`/login${safeRedirectParam}`, request);
    const redirectResponse = NextResponse.redirect(loginUrl);

    // Preserve cookies set by updateSession
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });

    // Prevent caching of protected redirects
    redirectResponse.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    return redirectResponse;
  }

  if (isAuthOnly && user) {
    const rawRedirect = searchParams.get("redirect") || "/dashboard";
    const safeTarget = sanitizeRedirectPath(rawRedirect, "/dashboard");
    const targetUrl = createSafeRedirectUrl(safeTarget, request);
    const redirectResponse = NextResponse.redirect(targetUrl);

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });

    return redirectResponse;
  }

  // Add no-store to protected authenticated responses to defeat browser back-navigation caching
  if (isProtected && user) {
    supabaseResponse.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
  }

  return supabaseResponse;
}

// Support both proxy named export and default export
export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
