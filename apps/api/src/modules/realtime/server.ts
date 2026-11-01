import { createHash } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { z, typingSchema, type PublicUser } from "@cord/contracts";
import type { Database } from "@cord/database";
import type { AuthService } from "../auth/service.ts";
import { cookieSettings, type SessionTransportOptions } from "../auth/transport.ts";
import type { AccessService } from "../communication/access.ts";
import type { CommunicationEvents } from "../communication/events.ts";

export function createRealtime(
  http: HttpServer,
  database: Database,
  auth: AuthService,
  access: AccessService,
  options: SessionTransportOptions & { allowedOrigins: string[] },
) {
  const origins = [...options.webOrigins, ...options.allowedOrigins];
  const io = new Server(http, {
    path: "/api/socket.io",
    maxHttpBufferSize: 16_384,
    cors: { origin: origins, credentials: true },
    allowRequest: (request, done) =>
      done(
        null,
        typeof request.headers.origin === "string" && origins.includes(request.headers.origin),
      ),
  });
  const online = new Map<string, number>();
  const sessionRoom = (token: string) =>
    `session:${createHash("sha256").update(token).digest("hex")}`;
  const userRoom = (id: string) => `user:${id}`;
  const handshake = z.discriminatedUnion("client", [
    z.object({ client: z.literal("native"), token: z.string().regex(/^[\w-]{43}$/) }),
    z.object({ client: z.literal("web") }),
  ]);
  io.use(async (socket, next) => {
    try {
      const input = handshake.parse(socket.handshake.auth);
      let token: string | undefined;
      if (input.client === "native") token = input.token;
      else {
        if (!options.webOrigins.includes(socket.handshake.headers.origin ?? ""))
          throw new Error("Invalid web origin");
        const name = cookieSettings(options.secureCookies).name;
        const cookies = (socket.handshake.headers.cookie ?? "")
          .split(";")
          .map((part) => part.trim())
          .filter((part) => part.startsWith(`${name}=`));
        if (cookies.length === 1) token = cookies[0]!.slice(name.length + 1);
      }
      if (!token || !/^[\w-]{43}$/.test(token)) throw new Error("Missing session");
      socket.data.user = await auth.authenticate(token);
      socket.data.token = token;
      const persisted = await database.session.findUniqueOrThrow({
        where: { tokenHash: createHash("sha256").update(token).digest("hex") },
        select: { expiresAt: true },
      });
      socket.data.expiresAt = persisted.expiresAt.getTime();
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });
  async function notifyPresence(userId: string) {
    const friendships = await database.friendship.findMany({
      where: { accepted: true, OR: [{ userAId: userId }, { userBId: userId }] },
    });
    for (const friendship of friendships) {
      const peer = friendship.userAId === userId ? friendship.userBId : friendship.userAId;
      io.to(userRoom(peer)).emit("presence:changed", { userId, online: online.has(userId) });
    }
  }
  io.on("connection", (socket) => {
    const user = socket.data.user as PublicUser;
    void socket.join([userRoom(user.id), sessionRoom(socket.data.token as string)]);
    online.set(user.id, (online.get(user.id) ?? 0) + 1);
    void notifyPresence(user.id).catch(() => {});
    let lastTyping = 0;
    // Recheck database expiry and administrative revocation even without incoming events.
    const expires = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, Number(socket.data.expiresAt) - Date.now()),
    );
    const timer = setInterval(() => {
      void auth.authenticate(socket.data.token as string).catch(() => socket.disconnect(true));
    }, 15_000);
    socket.on("presence:list", async (ack: unknown) => {
      if (typeof ack !== "function") return;
      try {
        await auth.authenticate(socket.data.token as string);
        const friends = await database.friendship.findMany({
          where: { accepted: true, OR: [{ userAId: user.id }, { userBId: user.id }] },
        });
        ack({
          userIds: friends
            .map((row) => (row.userAId === user.id ? row.userBId : row.userAId))
            .filter((id) => online.has(id)),
        });
      } catch {
        socket.disconnect(true);
      }
    });
    socket.on("typing", async (payload: unknown) => {
      const parsed = typingSchema.safeParse(payload);
      if (!parsed.success || Date.now() - lastTyping < 500) return;
      lastTyping = Date.now();
      try {
        await auth.authenticate(socket.data.token as string);
        await access.target(user.id, parsed.data.target);
        const target = parsed.data.target;
        const users =
          target.kind === "channel"
            ? (
                await database.serverMember.findMany({
                  where: { server: { channels: { some: { id: target.id } } } },
                  select: { userId: true },
                })
              ).map((row) => row.userId)
            : await database.conversation
                .findUniqueOrThrow({
                  where: { id: target.id },
                  select: { userAId: true, userBId: true },
                })
                .then((row) => [row.userAId, row.userBId]);
        io.to(users.filter((id) => id !== user.id).map(userRoom)).emit("typing", {
          ...parsed.data,
          user,
        });
      } catch {
        /* Unauthorized targets produce no event. */
      }
    });
    socket.on("disconnect", () => {
      clearInterval(timer);
      clearTimeout(expires);
      const count = (online.get(user.id) ?? 1) - 1;
      if (count > 0) online.set(user.id, count);
      else online.delete(user.id);
      void notifyPresence(user.id).catch(() => {});
    });
  });
  const stopRevocations = auth.onRevoked((token) =>
    io.in(sessionRoom(token)).disconnectSockets(true),
  );
  const events: CommunicationEvents = {
    async message(message) {
      const users = message.channelId
        ? (
            await database.serverMember.findMany({
              where: { server: { channels: { some: { id: message.channelId } } } },
              select: { userId: true },
            })
          ).map((row) => row.userId)
        : await database.conversation
            .findUniqueOrThrow({
              where: { id: message.conversationId! },
              select: { userAId: true, userBId: true },
            })
            .then((row) => [row.userAId, row.userBId]);
      // Resolve current membership for every broadcast so removed members receive no messages.
      io.to(users.map(userRoom)).emit("message:created", message);
      if (message.conversationId) this.changed(users);
    },
    changed(userIds) {
      io.to(userIds.map(userRoom)).emit("resources:changed");
    },
  };
  return {
    events,
    close: async () => {
      stopRevocations();
      await io.close();
    },
  };
}
