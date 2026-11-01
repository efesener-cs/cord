import { createHash } from "node:crypto";
import { sessionToken } from "../auth/transport.ts";
import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import { targetSchema } from "@cord/contracts";
import { requireSession } from "../auth/required.ts";
import type { AuthService } from "../auth/service.ts";
import type { SessionTransportOptions } from "../auth/transport.ts";
import type { AccessService } from "../communication/access.ts";
import { HttpError } from "../../common/http.ts";
export interface MediaConfig {
  internalUrl?: string;
  url: string;
  apiKey: string;
  apiSecret: string;
}
export function createMediaRouter(
  auth: AuthService,
  session: SessionTransportOptions,
  access: AccessService,
  config?: MediaConfig,
) {
  const router = Router();
  router.use(requireSession(auth, session));
  router.post(["/token", "/screen-token"], async (request, response) => {
    const input = targetSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid media destination.");
    await access.target(response.locals.user.id, input.data);
    if (!config) throw new HttpError(503, "MEDIA_UNAVAILABLE", "Media service is not configured.");
    const room = `${input.data.kind}:${input.data.id}`;
    const token = new AccessToken(config.apiKey, config.apiSecret, {
      identity: `${response.locals.user.id}:${createHash("sha256").update(sessionToken(request, session.secureCookies)!).digest("hex")}${request.path === "/screen-token" ? ":screen" : ""}`,
      name: response.locals.user.username,
      ttl: "60s",
    });
    token.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: request.path !== "/screen-token",
      canPublishData: false,
    });
    response.json({ url: config.url, token: await token.toJwt(), room });
  });
  return router;
}
