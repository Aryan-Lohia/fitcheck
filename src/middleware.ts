import { NextRequest, NextResponse } from "next/server";

/** Production app origin — browsers / extensions calling the API from this host. */
const PRODUCTION_ORIGIN = "https://fitcheck.aryanlohia.com";

function extraOriginsFromEnv(): string[] {
  const raw = process.env.CORS_ORIGINS ;
  if (!raw?.trim()) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === PRODUCTION_ORIGIN) return true;
  if (isLocalhostOrigin(origin)) return true;
  return extraOriginsFromEnv().includes(origin);
}

function corsHeaders(request: NextRequest, origin: string): Headers {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Access-Control-Allow-Credentials", "true");
  h.set("Vary", "Origin");
  const requested = request.headers.get("access-control-request-headers");
  h.set(
    "Access-Control-Allow-Headers",
    requested ??
    "Content-Type, Authorization, Cookie, X-Requested-With, X-CSRF-Token"
  );
  h.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD"
  );
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    if (!origin || !isAllowedOrigin(origin)) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(request, origin),
    });
  }

  const response = NextResponse.next();

  if (origin && isAllowedOrigin(origin)) {
    const ch = corsHeaders(request, origin);
    ch.forEach((value, key) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
