import { Prisma, type Database } from "@cord/database";
import type {
  MessageTarget,
  ResourcePageQuery,
  SendMessageInput,
  PublicMessage,
} from "@cord/contracts";
import type { AccessService } from "./access.ts";
import { HttpError } from "../../common/http.ts";
import { silentEvents, type CommunicationEvents } from "./events.ts";

const fields = {
  id: true,
  clientId: true,
  channelId: true,
  conversationId: true,
  content: true,
  createdAt: true,
  author: { select: { id: true, username: true } },
  attachments: { select: { id: true, name: true, mediaType: true, size: true } },
} as const;
const whereTarget = (target: MessageTarget) =>
  target.kind === "channel" ? { channelId: target.id } : { conversationId: target.id };
export function createMessageService(
  database: Database,
  access: AccessService,
  events: CommunicationEvents = silentEvents,
) {
  return {
    async list(userId: string, target: MessageTarget, query: ResourcePageQuery) {
      await access.target(userId, target);
      const messages = await database.message.findMany({
        where: whereTarget(target),
        select: fields,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      const items = messages.slice(0, query.limit);
      const nextCursor = messages.length > query.limit ? items.at(-1)!.id : null;
      return { messages: items.reverse(), nextCursor };
    },
    async send(userId: string, target: MessageTarget, input: SendMessageInput) {
      await access.target(userId, target);
      const existing = await database.message.findUnique({
        where: { authorId_clientId: { authorId: userId, clientId: input.clientId } },
        select: fields,
      });
      if (existing) {
        if (
          existing.channelId !== (target.kind === "channel" ? target.id : null) ||
          existing.conversationId !== (target.kind === "conversation" ? target.id : null)
        )
          throw new HttpError(
            409,
            "CONFLICT",
            "Message identifier belongs to another conversation.",
          );
        return existing;
      }
      if (new Set(input.attachmentIds).size !== input.attachmentIds.length)
        throw new HttpError(400, "VALIDATION_ERROR", "Duplicate attachments.");
      let created;
      try {
        created = await database.$transaction(async (tx) => {
          const message = await tx.message.create({
            data: {
              authorId: userId,
              clientId: input.clientId,
              content: input.content,
              ...whereTarget(target),
            },
          });
          if (input.attachmentIds.length) {
            const claimed = await tx.attachment.updateMany({
              where: { id: { in: input.attachmentIds }, ownerId: userId, messageId: null },
              data: { messageId: message.id },
            });
            if (claimed.count !== input.attachmentIds.length)
              throw new HttpError(400, "VALIDATION_ERROR", "Attachments are unavailable.");
          }
          const result = await tx.message.findUniqueOrThrow({
            where: { id: message.id },
            select: fields,
          });
          if (target.kind === "conversation") {
            const conversation = await tx.conversation.findUniqueOrThrow({
              where: { id: target.id },
            });
            const recipient =
              conversation.userAId === userId ? conversation.userBId : conversation.userAId;
            await tx.notification.create({
              data: {
                userId: recipient,
                actorName: result.author.username,
                kind: "direct_message",
                resourceId: target.id,
              },
            });
          }
          return result;
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const retry = await database.message.findUnique({
            where: { authorId_clientId: { authorId: userId, clientId: input.clientId } },
            select: fields,
          });
          if (
            retry &&
            retry.channelId === (target.kind === "channel" ? target.id : null) &&
            retry.conversationId === (target.kind === "conversation" ? target.id : null)
          )
            return retry;
        }
        throw error;
      }
      await events
        .message({ ...created, createdAt: created.createdAt.toISOString() } satisfies PublicMessage)
        .catch(() => {
          // Persistence already committed; reconnect/history synchronization recovers delivery.
          console.error(JSON.stringify({ event: "message_delivery_failed" }));
        });
      return created;
    },
  };
}
export type MessageService = ReturnType<typeof createMessageService>;
