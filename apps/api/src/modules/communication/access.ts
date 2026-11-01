import type { Database } from "@cord/database";
import type { MessageTarget } from "@cord/contracts";
import { HttpError } from "../../common/http.ts";

export function createAccessService(database: Database) {
  return {
    async target(userId: string, target: MessageTarget): Promise<void> {
      const allowed =
        target.kind === "channel"
          ? await database.channel.findFirst({
              where: { id: target.id, server: { members: { some: { userId } } } },
              select: { id: true },
            })
          : await database.conversation.findFirst({
              where: { id: target.id, OR: [{ userAId: userId }, { userBId: userId }] },
              select: { id: true },
            });
      if (!allowed) throw new HttpError(404, "NOT_FOUND", "Conversation or channel not found.");
    },
  };
}
export type AccessService = ReturnType<typeof createAccessService>;
