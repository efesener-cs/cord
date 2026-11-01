import { createHash, randomBytes } from "node:crypto";
import { silentEvents, type CommunicationEvents } from "../communication/events.ts";
import { Prisma, type Database } from "@cord/database";
import type { CreateServerRequest, CreateChannelRequest, ResourcePageQuery } from "@cord/contracts";
import { HttpError } from "../../common/http.ts";

const serverFields = { id: true, name: true, ownerId: true, createdAt: true } as const;
const channelFields = { id: true, name: true, serverId: true, createdAt: true } as const;

function page<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? items.at(-1)!.id : null };
}

export function createGuildService(database: Database, events: CommunicationEvents = silentEvents) {
  async function memberServer(userId: string, serverId: string) {
    const server = await database.server.findFirst({
      where: { id: serverId, members: { some: { userId } } },
      select: { ownerId: true },
    });
    // Do not disclose the existence of a private server to nonmembers.
    if (!server) throw new HttpError(404, "NOT_FOUND", "Server not found.");
    return server;
  }
  async function ownerServer(userId: string, serverId: string) {
    const server = await memberServer(userId, serverId);
    if (server.ownerId !== userId)
      throw new HttpError(403, "FORBIDDEN", "Server ownership is required.");
  }
  return {
    async members(userId: string, serverId: string, query: ResourcePageQuery) {
      const server = await memberServer(userId, serverId);
      const rows = await database.serverMember.findMany({
        where: { serverId },
        include: { user: { select: { id: true, username: true } } },
        orderBy: { userId: "asc" },
        take: query.limit + 1,
        ...(query.cursor
          ? { cursor: { serverId_userId: { serverId, userId: query.cursor } }, skip: 1 }
          : {}),
      });
      const items = rows.slice(0, query.limit);
      return {
        members: items.map((row) => ({
          user: row.user,
          joinedAt: row.joinedAt,
          owner: row.userId === server.ownerId,
        })),
        nextCursor: rows.length > query.limit ? items.at(-1)!.userId : null,
      };
    },
    async invite(userId: string, serverId: string) {
      await ownerServer(userId, serverId);
      const code = randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await database.serverInvite.create({
        data: { serverId, tokenHash: createHash("sha256").update(code).digest("hex"), expiresAt },
      });
      return { code, expiresAt, serverId };
    },
    async join(userId: string, code: string) {
      const invite = await database.serverInvite.findUnique({
        where: { tokenHash: createHash("sha256").update(code).digest("hex") },
      });
      if (!invite || invite.expiresAt.getTime() <= Date.now())
        throw new HttpError(404, "NOT_FOUND", "Invitation is invalid or expired.");
      await database.serverMember.upsert({
        where: { serverId_userId: { serverId: invite.serverId, userId } },
        create: { serverId: invite.serverId, userId },
        update: {},
      });
      events.changed([userId]);
      return database.server.findUniqueOrThrow({
        where: { id: invite.serverId },
        select: serverFields,
      });
    },
    async leave(userId: string, serverId: string) {
      const server = await memberServer(userId, serverId);
      if (server.ownerId === userId)
        throw new HttpError(
          403,
          "FORBIDDEN",
          "The owner must delete the server instead of leaving.",
        );
      await database.serverMember.deleteMany({ where: { serverId, userId } });
      events.changed([userId]);
    },
    async removeMember(userId: string, serverId: string, memberId: string) {
      await ownerServer(userId, serverId);
      if (userId === memberId)
        throw new HttpError(403, "FORBIDDEN", "The owner cannot be removed.");
      await database.serverMember.deleteMany({ where: { serverId, userId: memberId } });
      events.changed([memberId]);
    },
    async deleteServer(userId: string, serverId: string) {
      await ownerServer(userId, serverId);
      const members = await database.serverMember.findMany({
        where: { serverId },
        select: { userId: true },
      });
      await database.server.delete({ where: { id: serverId } });
      events.changed(members.map((member) => member.userId));
    },
    async revokeInvites(userId: string, serverId: string) {
      await ownerServer(userId, serverId);
      await database.serverInvite.deleteMany({ where: { serverId } });
    },
    async createServer(userId: string, input: CreateServerRequest) {
      // Nested writes commit the server, owner membership, and initial channel atomically.
      const server = await database.server.create({
        data: {
          name: input.name,
          ownerId: userId,
          members: { create: { userId } },
          channels: { create: { name: "genel" } },
        },
        select: serverFields,
      });
      events.changed([userId]);
      return server;
    },
    async listServers(userId: string, query: ResourcePageQuery) {
      const rows = await database.server.findMany({
        where: { members: { some: { userId } } },
        select: serverFields,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      const result = page(rows, query.limit);
      return { servers: result.items, nextCursor: result.nextCursor };
    },
    async listChannels(userId: string, serverId: string, query: ResourcePageQuery) {
      await memberServer(userId, serverId);
      const rows = await database.channel.findMany({
        where: { serverId },
        select: channelFields,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      const result = page(rows, query.limit);
      return { channels: result.items, nextCursor: result.nextCursor };
    },
    async createChannel(userId: string, serverId: string, input: CreateChannelRequest) {
      const server = await memberServer(userId, serverId);
      if (server.ownerId !== userId)
        throw new HttpError(403, "FORBIDDEN", "Only the server owner can create channels.");
      try {
        const channel = await database.channel.create({
          data: { serverId, name: input.name },
          select: channelFields,
        });
        const members = await database.serverMember.findMany({
          where: { serverId },
          select: { userId: true },
        });
        events.changed(members.map((member) => member.userId));
        return channel;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
          throw new HttpError(409, "CHANNEL_EXISTS", "A channel with this name already exists.");
        throw error;
      }
    },
  };
}
export type GuildService = ReturnType<typeof createGuildService>;
