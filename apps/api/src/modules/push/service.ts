import { applicationDefault, initializeApp, deleteApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { Database } from "@cord/database";

/** Optional Android background delivery; the provider credential is server-only. */
export function createPushService(database: Database) {
  const app = initializeApp({ credential: applicationDefault() }, "cord-push");
  let running = false;
  let closed = false;
  async function deliver() {
    if (running || closed) return;
    running = true;
    try {
      const pending = await database.notification.findMany({
        where: {
          pushedAt: null,
          read: false,
          user: { sessions: { some: { expiresAt: { gt: new Date() }, devices: { some: {} } } } },
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { user: { select: { locale: true } } },
      });
      for (const notice of pending) {
        const devices = await database.pushDevice.findMany({
          where: { session: { userId: notice.userId, expiresAt: { gt: new Date() } } },
          take: 500,
        });
        if (!devices.length) continue;
        const english = notice.user.locale === "en";
        const body =
          notice.kind === "direct_message"
            ? english
              ? `${notice.actorName} sent you a message.`
              : `${notice.actorName} sana mesaj gönderdi.`
            : notice.kind === "friend_request"
              ? english
                ? `${notice.actorName} sent you a friend request.`
                : `${notice.actorName} arkadaşlık isteği gönderdi.`
              : english
                ? `${notice.actorName} accepted your friend request.`
                : `${notice.actorName} arkadaşlık isteğini kabul etti.`;
        const result = await getMessaging(app).sendEachForMulticast({
          tokens: devices.map((device) => device.token),
          notification: { title: "Cord", body },
          data: { resourceId: notice.resourceId, kind: notice.kind },
          android: { priority: "high", notification: { channelId: "messages", tag: notice.id } },
        });
        for (const [index, response] of result.responses.entries()) {
          if (
            response.error &&
            [
              "messaging/invalid-registration-token",
              "messaging/registration-token-not-registered",
            ].includes(response.error.code)
          )
            await database.pushDevice.deleteMany({ where: { id: devices[index]!.id } });
        }
        if (result.successCount > 0)
          await database.notification.updateMany({
            where: { id: notice.id },
            data: { pushedAt: new Date() },
          });
      }
    } catch {
      console.error(JSON.stringify({ event: "push_delivery_failed" }));
    } finally {
      running = false;
    }
  }
  const timer = setInterval(() => {
    void deliver();
  }, 60_000);
  timer.unref();
  return {
    deliver: () => {
      void deliver();
    },
    close: async () => {
      closed = true;
      clearInterval(timer);
      await deleteApp(app);
    },
  };
}
