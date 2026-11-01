import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "@cord/contracts";
import type { Database } from "@cord/database";
import type { AuthService } from "../auth/service.ts";
import type { SessionTransportOptions } from "../auth/transport.ts";
import { sessionToken, clientMode } from "../auth/transport.ts";
import { requireSession } from "../auth/required.ts";
import { HttpError } from "../../common/http.ts";
export function createPushRouter(
  database: Database,
  auth: AuthService,
  options: SessionTransportOptions,
) {
  const router = Router();
  router.use(requireSession(auth, options));
  router.post("/register", async (request, response) => {
    const input = z
      .strictObject({
        token: z
          .string()
          .min(20)
          .max(2048)
          .regex(/^[A-Za-z0-9_:.~-]+$/),
      })
      .safeParse(request.body);
    if (!input.success || clientMode(request) !== "native")
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid native push device.");
    const tokenHash = createHash("sha256")
      .update(sessionToken(request, options.secureCookies)!)
      .digest("hex");
    const session = await database.session.findUniqueOrThrow({
      where: { tokenHash },
      select: { id: true },
    });
    const count = await database.pushDevice.count({ where: { sessionId: session.id } });
    if (count >= 5) await database.pushDevice.deleteMany({ where: { sessionId: session.id } });
    await database.pushDevice.upsert({
      where: { token: input.data.token },
      create: { token: input.data.token, sessionId: session.id },
      update: { sessionId: session.id },
    });
    response.status(204).end();
  });
  return router;
}
