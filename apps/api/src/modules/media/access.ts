import { RoomServiceClient } from "livekit-server-sdk";
import type { Database } from "@cord/database";
import type { AuthService } from "../auth/service.ts";
import type { AccessService } from "../communication/access.ts";
import type { MediaConfig } from "./router.ts";

export function createMediaAccess(
  database: Database,
  auth: AuthService,
  access: AccessService,
  config: MediaConfig,
) {
  const url = new URL(config.internalUrl ?? config.url);
  url.protocol =
    url.protocol === "wss:" ? "https:" : url.protocol === "ws:" ? "http:" : url.protocol;
  const rooms = new RoomServiceClient(url.origin, config.apiKey, config.apiSecret);
  let running = false;
  let closed = false;
  async function reconcile() {
    if (running || closed) return;
    running = true;
    try {
      for (const room of await rooms.listRooms()) {
        const targetMatch = /^(channel|conversation):([a-f0-9-]{36})$/.exec(room.name);
        if (!targetMatch) continue;
        const target = { kind: targetMatch[1] as "channel" | "conversation", id: targetMatch[2]! };
        for (const participant of await rooms.listParticipants(room.name)) {
          const identity = /^([a-f0-9-]{36}):([a-f0-9]{64})(?::screen)?$/.exec(
            participant.identity,
          );
          let allowed = false;
          if (identity) {
            const session = await database.session.findUnique({
              where: { tokenHash: identity[2]! },
              select: { userId: true, expiresAt: true },
            });
            if (session?.userId === identity[1] && session.expiresAt.getTime() > Date.now()) {
              try {
                await access.target(session.userId, target);
                allowed = true;
              } catch {
                /* Access was removed. */
              }
            }
          }
          if (!allowed)
            await rooms.removeParticipant(room.name, participant.identity).catch(() => {});
        }
      }
    } catch {
      /* Media service may be stopped independently of messaging. */
    } finally {
      running = false;
    }
  }
  const timer = setInterval(() => {
    void reconcile();
  }, 10_000);
  timer.unref();
  const stopRevocation = auth.onRevoked(() => {
    void reconcile();
  });
  return {
    reconcile: () => {
      void reconcile();
    },
    close: () => {
      closed = true;
      clearInterval(timer);
      stopRevocation();
    },
  };
}
