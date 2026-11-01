import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { loginSchema, registerSchema } from "@cord/contracts";
import { HttpError } from "../../common/http.ts";
import type { AuthService } from "./service.ts";
import {
  clientMode,
  cookieSettings,
  protectSessionWrites,
  sessionToken,
  type SessionTransportOptions,
} from "./transport.ts";

export function createAccountRouter(auth: AuthService, options: SessionTransportOptions): Router {
  const router = Router();
  const attempts = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    validate: { xForwardedForHeader: false },
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, _response, next) =>
      next(new HttpError(429, "RATE_LIMITED", "Too many attempts. Try again later.")),
  });
  const protect = protectSessionWrites(options);
  router.post("/auth/register", protect, attempts, async (request, response) => {
    const input = registerSchema.safeParse(request.body);
    if (!input.success)
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid registration details.");
    response.status(201).json({ user: await auth.register(input.data) });
  });
  router.post("/auth/login", protect, attempts, async (request, response) => {
    const input = loginSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid login details.");
    const session = await auth.login(input.data);
    if (clientMode(request) === "native") response.json(session);
    else {
      const cookie = cookieSettings(options.secureCookies);
      response.cookie(cookie.name, session.token, {
        ...cookie.options,
        expires: new Date(session.expiresAt),
        maxAge: 24 * 60 * 60 * 1000,
      });
      response.json({ user: session.user, expiresAt: session.expiresAt });
    }
  });
  router.post("/auth/logout", protect, async (request, response) => {
    const token = sessionToken(request, options.secureCookies);
    try {
      if (token) await auth.logout(token);
    } finally {
      if (clientMode(request) === "web") {
        const cookie = cookieSettings(options.secureCookies);
        response.clearCookie(cookie.name, cookie.options);
      }
    }
    response.status(204).end();
  });
  router.get("/users/me", protect, async (request, response) => {
    const token = sessionToken(request, options.secureCookies);
    if (!token) throw new HttpError(401, "UNAUTHORIZED", "A valid session is required.");
    response.json({ user: await auth.authenticate(token) });
  });
  return router;
}
