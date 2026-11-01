import { createPushService } from "./modules/push/service.ts";
import { createMediaAccess } from "./modules/media/access.ts";
import { createRealtime } from "./modules/realtime/server.ts";
import { createAccessService } from "./modules/communication/access.ts";
import { cleanUploads } from "./modules/uploads/router.ts";
import type { CommunicationEvents } from "./modules/communication/events.ts";
import { createGuildService } from "./modules/guilds/service.ts";
import { createDatabase } from "@cord/database";
import { createAuthService } from "./modules/auth/service.ts";
import { createServer } from "node:http";
import { createApp } from "./app.ts";
import { readConfig } from "./config/environment.ts";

const config = readConfig();
const database = createDatabase(config.databaseUrl);
await database.$connect();
const auth = createAuthService(database);
const sessionOptions = { secureCookies: config.secureCookies, webOrigins: config.webOrigins };
let realtime: ReturnType<typeof createRealtime> | undefined;
let mediaAccess: ReturnType<typeof createMediaAccess> | undefined;
const push = config.pushEnabled ? createPushService(database) : undefined;
const events: CommunicationEvents = {
  message: async (message) => {
    await realtime?.events.message(message);
  },
  changed: (userIds) => {
    realtime?.events.changed(userIds);
    mediaAccess?.reconcile();
    push?.deliver();
  },
};
const server = createServer(
  createApp({
    auth,
    database,
    events,
    uploadDirectory: config.uploadDirectory,
    ...(config.media ? { media: config.media } : {}),
    guilds: createGuildService(database, events),
    allowedOrigins: config.allowedOrigins,
    session: sessionOptions,
  }),
);
realtime = createRealtime(server, database, auth, createAccessService(database), {
  ...sessionOptions,
  allowedOrigins: config.allowedOrigins,
});
mediaAccess = config.media
  ? createMediaAccess(database, auth, createAccessService(database), config.media)
  : undefined;
const cleanup = setInterval(
  () => {
    void cleanUploads(database, config.uploadDirectory).catch(() =>
      console.error(JSON.stringify({ event: "upload_cleanup_failed" })),
    );
  },
  60 * 60 * 1000,
);
cleanup.unref();
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(JSON.stringify({ event: "server_error", code: error.code ?? "UNKNOWN" }));
  process.exitCode = 1;
});
server.listen(config.port, config.host, () => {
  console.info(
    JSON.stringify({
      event: "server_started",
      host: config.host,
      port: config.port,
      environment: config.environment,
    }),
  );
});
let stopping = false;
function shutdown(): void {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => {
    process.exit(1);
  }, 10_000);
  timeout.unref();
  clearInterval(cleanup);
  mediaAccess?.close();
  void (async () => {
    try {
      await realtime?.close();
      await push?.close();
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      await database.$disconnect();
    } catch {
      process.exitCode = 1;
    } finally {
      clearTimeout(timeout);
    }
  })();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
