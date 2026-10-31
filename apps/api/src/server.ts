import { createDatabase } from "@cord/database";
import { createAuthService } from "./modules/auth/service.ts";
import { createServer } from "node:http";
import { createApp } from "./app.ts";
import { readConfig } from "./config/environment.ts";

const config = readConfig();
const database = createDatabase(config.databaseUrl);
await database.$connect();
const server = createServer(
  createApp({ auth: createAuthService(database), allowedOrigins: config.allowedOrigins }),
);
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
  server.close((error) => {
    void database.$disconnect().finally(() => {
      clearTimeout(timeout);
      process.exitCode = error ? 1 : 0;
    });
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
