import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import type { AuthService } from "./service.ts";
import { protectSessionWrites, sessionToken, type SessionTransportOptions } from "./transport.ts";
import { HttpError } from "../../common/http.ts";
export function requireSession(
  auth: AuthService,
  options: SessionTransportOptions,
): RequestHandler[] {
  return [
    protectSessionWrites(options),
    async (request, response, next) => {
      const token = sessionToken(request, options.secureCookies);
      if (!token) throw new HttpError(401, "UNAUTHORIZED", "A valid session is required.");
      response.locals.user = await auth.authenticate(token);
      next();
    },
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      keyGenerator: (_request, response) => String(response.locals.user.id),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_request, _response, next) =>
        next(new HttpError(429, "RATE_LIMITED", "Too many requests. Try again later.")),
    }),
  ];
}
