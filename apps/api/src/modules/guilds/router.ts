import { Router } from "express";
import {
  z,
  inviteCodeSchema,
  createServerSchema,
  createChannelSchema,
  resourcePageQuerySchema,
  serverIdParamsSchema,
} from "@cord/contracts";
import { requireSession } from "../auth/required.ts";
import type { AuthService } from "../auth/service.ts";
import { type SessionTransportOptions } from "../auth/transport.ts";
import { HttpError } from "../../common/http.ts";
import type { GuildService } from "./service.ts";

export function createGuildRouter(
  guilds: GuildService,
  auth: AuthService,
  options: SessionTransportOptions,
): Router {
  const router = Router();
  router.use(requireSession(auth, options));
  router.post("/join", async (request, response) => {
    const input = z.strictObject({ code: inviteCodeSchema }).safeParse(request.body);
    if (!input.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid invitation code.");
    response.json({ server: await guilds.join(response.locals.user.id, input.data.code) });
  });
  router.get("/:serverId/members", async (request, response) => {
    const params = serverIdParamsSchema.safeParse(request.params);
    const query = resourcePageQuerySchema.safeParse(request.query);
    if (!params.success || !query.success)
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid server or pagination.");
    response.json(await guilds.members(response.locals.user.id, params.data.serverId, query.data));
  });
  router.delete("/:serverId/members/:userId", async (request, response) => {
    const params = z.object({ serverId: z.uuid(), userId: z.uuid() }).safeParse(request.params);
    if (!params.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid member.");
    await guilds.removeMember(response.locals.user.id, params.data.serverId, params.data.userId);
    response.status(204).end();
  });
  for (const action of ["invites", "leave"] as const) {
    router.post(`/:serverId/${action}`, async (request, response) => {
      const params = serverIdParamsSchema.safeParse(request.params);
      if (!params.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid server.");
      if (action === "invites")
        response.json(await guilds.invite(response.locals.user.id, params.data.serverId));
      else {
        await guilds.leave(response.locals.user.id, params.data.serverId);
        response.status(204).end();
      }
    });
  }
  router.delete("/:serverId/invites", async (request, response) => {
    const params = serverIdParamsSchema.safeParse(request.params);
    if (!params.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid server.");
    await guilds.revokeInvites(response.locals.user.id, params.data.serverId);
    response.status(204).end();
  });
  router.delete("/:serverId", async (request, response) => {
    const params = serverIdParamsSchema.safeParse(request.params);
    if (!params.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid server.");
    await guilds.deleteServer(response.locals.user.id, params.data.serverId);
    response.status(204).end();
  });
  router.get("/", async (request, response) => {
    const query = resourcePageQuerySchema.safeParse(request.query);
    if (!query.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid page query.");
    response.json(await guilds.listServers(response.locals.user.id, query.data));
  });
  router.post("/", async (request, response) => {
    const input = createServerSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, "VALIDATION_ERROR", "Invalid server details.");
    response
      .status(201)
      .json({ server: await guilds.createServer(response.locals.user.id, input.data) });
  });
  router.get("/:serverId/channels", async (request, response) => {
    const params = serverIdParamsSchema.safeParse(request.params);
    const query = resourcePageQuerySchema.safeParse(request.query);
    if (!params.success || !query.success)
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid server or page query.");
    response.json(
      await guilds.listChannels(response.locals.user.id, params.data.serverId, query.data),
    );
  });
  router.post("/:serverId/channels", async (request, response) => {
    const params = serverIdParamsSchema.safeParse(request.params);
    const input = createChannelSchema.safeParse(request.body);
    if (!params.success || !input.success)
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid server or channel details.");
    response.status(201).json({
      channel: await guilds.createChannel(
        response.locals.user.id,
        params.data.serverId,
        input.data,
      ),
    });
  });
  return router;
}
