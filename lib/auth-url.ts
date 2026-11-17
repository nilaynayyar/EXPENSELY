/**
 * EXPENSELY - AUTHENTICATION & REDIRECT URL SANITIZATION UTILITY
 * 
 * Guarantees that:
 * 1. 0.0.0.0 is NEVER used as a browser-facing redirect destination.
 * 2. In local development, browser destinations always use localhost or valid LAN IP.
 * 3. In production, NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL or verified host is used.
 * 4. Open redirect vulnerabilities are strictly prevented.
 */

export type RequestWithHeaders = Request | {
  url: string;
  headers: {
    get(key: string): string | null;
  };
};

const DEFAULT_DEV_ORIGIN = "http://localhost:3000";

/**
 * Returns the canonical base URL for the application.
 * Never returns an origin containing 0.0.0.0.
 */
export function getAppBaseUrl(request?: RequestWithHeaders): string {
  // 1. Explicit production environment configuration has highest precedence
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) {
    const cleanConfigured = configuredUrl.trim().replace(/\/+$/, "");
    if (!cleanConfigured.includes("0.0.0.0")) {
      return cleanConfigured;
    }
  }

  // 2. Client-side execution (browser window)
  if (typeof window !== "undefined" && window.location) {
    const { hostname, port, protocol } = window.location;
    if (hostname === "0.0.0.0" || hostname === "") {
      return `http://localhost:${port || "3000"}`;
    }
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }

  // 3. Server-side execution with request headers
  if (request) {
    try {
      const headers = request.headers;
      const forwardedHost = headers.get("x-forwarded-host");
      const host = forwardedHost || headers.get("host");

      if (host) {
        const cleanHost = host.split(",")[0].trim();
        if (cleanHost.startsWith("0.0.0.0")) {
          const port = cleanHost.split(":")[1] || "3000";
          return `http://localhost:${port}`;
        }

        const forwardedProto = headers.get("x-forwarded-proto");
        const isDev = process.env.NODE_ENV === "development";
        const proto = forwardedProto || (isDev ? "http" : "https");

        return `${proto}://${cleanHost}`;
      }

      // Check request.url if host header was somehow missing
      const parsedUrl = new URL(request.url);
      if (parsedUrl.hostname === "0.0.0.0") {
        return `http://localhost:${parsedUrl.port || "3000"}`;
      }
      return parsedUrl.origin;
    } catch {
      // Fallback below
    }
  }

  // 4. Default fallback
  return DEFAULT_DEV_ORIGIN;
}

/**
 * Sanitizes a redirect path or URL.
 * Only allows safe relative paths or same-origin URLs.
 * Rejects external URLs, protocol-relative URLs (//), and 0.0.0.0 destinations.
 */
export function sanitizeRedirectPath(
  target: string | null | undefined,
  fallback: string = "/dashboard"
): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();

  // Reject empty string or dangerous protocol-relative URLs like "//evil.com" or "/\evil.com"
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  // Handle absolute URLs
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      // Strictly reject 0.0.0.0
      if (parsed.hostname === "0.0.0.0") {
        return fallback;
      }

      // If same host as configured app URL or localhost, allow its path
      const appUrl = getAppBaseUrl();
      const appParsed = new URL(appUrl);
      if (parsed.host === appParsed.host || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        return parsed.pathname + parsed.search || fallback;
      }

      // External host rejected
      return fallback;
    } catch {
      return fallback;
    }
  }

  // Must be a relative path starting with single "/"
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // Check for any embedded 0.0.0.0
  if (trimmed.includes("0.0.0.0")) {
    return fallback;
  }

  return trimmed;
}

/**
 * Creates a safe browser-facing redirect URL.
 * Guarantees the destination origin is safe and never 0.0.0.0.
 */
export function createSafeRedirectUrl(
  path: string,
  request?: RequestWithHeaders
): URL {
  const base = getAppBaseUrl(request);
  const safePath = sanitizeRedirectPath(path, "/dashboard");
  return new URL(safePath, base);
}
