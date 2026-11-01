import { Router } from "express";
import {
  z,
  targetSchema,
  sendMessageSchema,
  resourcePageQuerySchema,
  friendRequestSchema,
  preferencesSchema,
} from "@cord/contracts";
import type { Database } from "@cord/database";
import { HttpError } from "../../common/http.ts";
import type { AuthService } from "../auth/service.ts";
import { requireSession } from "../auth/required.ts";
import type { SessionTransportOptions } from "../auth/transport.ts";
import type { MessageService } from "./messages.ts";
import type { SocialService } from "./social.ts";

export function createCommunicationRouter(
  database: Database,
  messages: MessageService,
  social: SocialService,
  auth: AuthService,
  session: SessionTransportOptions,
) {
  const router = Router();
  router.use(
    ["/channels", "/conversations", "/friends", "/notifications", "/users/me/preferences"],
    requireSession(auth, session),
  );
  function id(value: unknown): string {
    const result = z.uuid().safeParse(value);
    if (!result.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid identifier.");
    return result.data;
  }
  function query(value: unknown) {
    const result = resourcePageQuerySchema.safeParse(value);
    if (!result.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid pagination.");
    return result.data;
  }
  for (const [path, kind] of [
    ["channels", "channel"],
    ["conversations", "conversation"],
  ] as const) {
    router.get(`/${path}/:id/messages`, async (request, response) => {
      const target = targetSchema.parse({ kind, id: id(request.params.id) });
      response.json(await messages.list(response.locals.user.id, target, query(request.query)));
    });
    router.post(`/${path}/:id/messages`, async (request, response) => {
      const input = sendMessageSchema.safeParse(request.body);
      if (!input.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid message.");
      const target = targetSchema.parse({ kind, id: id(request.params.id) });
      response
        .status(201)
        .json({ message: await messages.send(response.locals.user.id, target, input.data) });
    });
  }
  router.get("/friends", async (_request, response) =>
    response.json(await social.friends(response.locals.user.id)),
  );
  router.post("/friends", async (request, response) => {
    const input = friendRequestSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid username.");
    await social.request(response.locals.user.id, input.data.username);
    response.status(204).end();
  });
  router.post("/friends/:id/accept", async (request, response) => {
    await social.accept(response.locals.user.id, id(request.params.id));
    response.status(204).end();
  });
  router.delete("/friends/:id", async (request, response) => {
    await social.remove(response.locals.user.id, id(request.params.id));
    response.status(204).end();
  });
  router.get("/conversations", async (request, response) =>
    response.json(await social.conversations(response.locals.user.id, query(request.query))),
  );
  router.post("/conversations", async (request, response) => {
    const input = z.strictObject({ userId: z.uuid() }).safeParse(request.body);
    if (!input.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid participant.");
    response.json(await social.conversation(response.locals.user.id, input.data.userId));
  });
  router.get("/notifications", async (request, response) =>
    response.json(await social.notifications(response.locals.user.id, query(request.query))),
  );
  router.post("/notifications/read", async (request, response) => {
    const input = z.strictObject({ resourceId: z.uuid().optional() }).safeParse(request.body);
    if (!input.success)
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid notification target.");
    await social.readNotifications(response.locals.user.id, input.data.resourceId);
    response.status(204).end();
  });
  router.get("/users/me/preferences", async (_request, response) => {
    response.json({
      preferences: await database.user.findUniqueOrThrow({
        where: { id: response.locals.user.id },
        select: { locale: true, theme: true },
      }),
    });
  });
  router.put("/users/me/preferences", async (request, response) => {
    const input = preferencesSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid preferences.");
    const preferences = await database.user.update({
      where: { id: response.locals.user.id },
      data: input.data,
      select: { locale: true, theme: true },
    });
    response.json({ preferences });
  });
  return router;
}
