import { Router, type Request } from "express";
import { rateLimit } from "express-rate-limit";
import { loginSchema, registerSchema } from "@cord/contracts";
import { HttpError } from "../../common/http.ts";
import type { AuthService } from "./service.ts";

function bearer(request: Request): string {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.get("authorization") ?? "");
  if (!match?.[1]) throw new HttpError(401, "UNAUTHORIZED", "A valid session is required.");
  return match[1];
}
export function createAccountRouter(auth: AuthService): Router {
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
  router.post("/auth/register", attempts, async (request, response) => {
    const input = registerSchema.safeParse(request.body);
    if (!input.success)
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid registration details.");
    response.status(201).json({ user: await auth.register(input.data) });
  });
  router.post("/auth/login", attempts, async (request, response) => {
    const input = loginSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid login details.");
    response.json(await auth.login(input.data));
  });
  router.post("/auth/logout", async (request, response) => {
    await auth.logout(bearer(request));
    response.status(204).end();
  });
  router.get("/users/me", async (request, response) => {
    response.json({ user: await auth.authenticate(bearer(request)) });
  });
  return router;
}
