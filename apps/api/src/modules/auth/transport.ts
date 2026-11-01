import type { CookieOptions, Request, RequestHandler } from "express";
import { HttpError } from "../../common/http.ts";

export interface SessionTransportOptions {
  secureCookies: boolean;
  webOrigins: string[];
}
export function cookieSettings(secure: boolean): { name: string; options: CookieOptions } {
  return {
    name: secure ? "__Host-cord_session" : "cord_session",
    options: { httpOnly: true, secure, sameSite: "lax", path: secure ? "/" : "/api/v1" },
  };
}
export function clientMode(request: Request): "web" | "native" {
  const mode = request.get("X-Cord-Client");
  if (mode !== "web" && mode !== "native")
    throw new HttpError(403, "CSRF_REJECTED", "An explicit client transport is required.");
  return mode;
}
export function protectSessionWrites(options: SessionTransportOptions): RequestHandler {
  return (request, _response, next) => {
    const mode = clientMode(request);
    if (mode === "web" && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.get("origin");
      if (
        request.get("sec-fetch-site") === "cross-site" ||
        (origin && !options.webOrigins.includes(origin))
      )
        throw new HttpError(403, "CSRF_REJECTED", "The request origin is not permitted.");
    }
    next();
  };
}
export function sessionToken(request: Request, secure: boolean): string | null {
  if (clientMode(request) === "native") {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.get("authorization") ?? "");
    return match?.[1] ?? null;
  }
  const { name } = cookieSettings(secure);
  const values = (request.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (values.length !== 1) return null;
  const token = values[0]!.slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
