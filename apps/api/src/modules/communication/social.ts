import { Prisma, type Database } from "@cord/database";
import type { ResourcePageQuery } from "@cord/contracts";
import { HttpError } from "../../common/http.ts";
import { silentEvents, type CommunicationEvents } from "./events.ts";
const userFields = { id: true, username: true } as const;
const pair = (a: string, b: string) =>
  a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
export function createSocialService(
  database: Database,
  events: CommunicationEvents = silentEvents,
) {
  return {
    async friends(userId: string) {
      const rows = await database.friendship.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        orderBy: { createdAt: "desc" },
        include: { userA: { select: userFields }, userB: { select: userFields } },
      });
      return {
        friends: rows.map((row) => ({
          id: row.id,
          user: row.userAId === userId ? row.userB : row.userA,
          accepted: row.accepted,
          incoming: row.requestedBy !== userId,
          createdAt: row.createdAt,
        })),
      };
    },
    async request(userId: string, username: string) {
      const user = await database.user.findUnique({ where: { username }, select: userFields });
      if (!user || user.id === userId)
        throw new HttpError(400, "VALIDATION_ERROR", "Choose another registered account.");
      const key = pair(userId, user.id);
      const actor = await database.user.findUniqueOrThrow({
        where: { id: userId },
        select: userFields,
      });
      try {
        await database.$transaction(async (tx) => {
          const friendship = await tx.friendship.create({ data: { ...key, requestedBy: userId } });
          await tx.notification.create({
            data: {
              userId: user.id,
              actorName: actor.username,
              kind: "friend_request",
              resourceId: friendship.id,
            },
          });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
          throw new HttpError(409, "CONFLICT", "A friendship or pending request already exists.");
        throw error;
      }
      events.changed([userId, user.id]);
    },
    async accept(userId: string, id: string) {
      const row = await database.friendship.findFirst({
        where: { id, requestedBy: { not: userId }, OR: [{ userAId: userId }, { userBId: userId }] },
      });
      if (!row) throw new HttpError(404, "NOT_FOUND", "Friend request not found.");
      const actor = await database.user.findUniqueOrThrow({
        where: { id: userId },
        select: userFields,
      });
      await database.$transaction(async (tx) => {
        const accepted = await tx.friendship.updateMany({
          where: { id, accepted: false },
          data: { accepted: true },
        });
        if (accepted.count)
          await tx.notification.create({
            data: {
              userId: row.requestedBy,
              actorName: actor.username,
              kind: "friend_accepted",
              resourceId: row.id,
            },
          });
      });
      events.changed([row.userAId, row.userBId]);
    },
    async remove(userId: string, id: string) {
      const row = await database.friendship.findFirst({
        where: { id, OR: [{ userAId: userId }, { userBId: userId }] },
      });
      if (!row) throw new HttpError(404, "NOT_FOUND", "Friendship not found.");
      await database.friendship.deleteMany({ where: { id } });
      events.changed([row.userAId, row.userBId]);
    },
    async conversations(userId: string, query: ResourcePageQuery) {
      const rows = await database.conversation.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        include: { userA: { select: userFields }, userB: { select: userFields } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      const items = rows.slice(0, query.limit);
      return {
        conversations: items.map((row) => ({
          id: row.id,
          user: row.userAId === userId ? row.userB : row.userA,
          createdAt: row.createdAt,
        })),
        nextCursor: rows.length > query.limit ? items.at(-1)!.id : null,
      };
    },
    async conversation(userId: string, peerId: string) {
      if (peerId === userId)
        throw new HttpError(400, "VALIDATION_ERROR", "Choose another account.");
      const key = pair(userId, peerId);
      const friendship = await database.friendship.findUnique({ where: { userAId_userBId: key } });
      if (!friendship?.accepted)
        throw new HttpError(
          403,
          "FORBIDDEN",
          "Accept a friend request before starting a conversation.",
        );
      const row = await database.conversation.upsert({
        where: { userAId_userBId: key },
        create: key,
        update: {},
        include: { userA: { select: userFields }, userB: { select: userFields } },
      });
      events.changed([userId, peerId]);
      return {
        conversation: {
          id: row.id,
          user: row.userAId === userId ? row.userB : row.userA,
          createdAt: row.createdAt,
        },
      };
    },
    async notifications(userId: string, query: ResourcePageQuery) {
      const [rows, unreadCount] = await database.$transaction([
        database.notification.findMany({
          where: { userId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: query.limit + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
          select: {
            id: true,
            actorName: true,
            kind: true,
            resourceId: true,
            read: true,
            createdAt: true,
          },
        }),
        database.notification.count({ where: { userId, read: false } }),
      ]);
      const items = rows.slice(0, query.limit);
      return {
        notifications: items,
        unreadCount,
        nextCursor: rows.length > query.limit ? items.at(-1)!.id : null,
      };
    },
    async readNotifications(userId: string, resourceId?: string) {
      await database.notification.updateMany({
        where: { userId, ...(resourceId ? { resourceId } : {}) },
        data: { read: true },
      });
      events.changed([userId]);
    },
  };
}
export type SocialService = ReturnType<typeof createSocialService>;
