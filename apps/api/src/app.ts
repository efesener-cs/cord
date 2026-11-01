import { createPushRouter } from "./modules/push/router.ts";
import { createCommunicationRouter } from "./modules/communication/router.ts";
import { createAccessService } from "./modules/communication/access.ts";
import { createMessageService } from "./modules/communication/messages.ts";
import { createSocialService } from "./modules/communication/social.ts";
import { createUploadRouter } from "./modules/uploads/router.ts";
import { createMediaRouter, type MediaConfig } from "./modules/media/router.ts";
import type { Database } from "@cord/database";
import type { CommunicationEvents } from "./modules/communication/events.ts";
import { createGuildRouter } from "./modules/guilds/router.ts";
import type { GuildService } from "./modules/guilds/service.ts";
import express, { Router, type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { createAccountRouter } from "./modules/auth/router.ts";
import type { SessionTransportOptions } from "./modules/auth/transport.ts";
import type { AuthService } from "./modules/auth/service.ts";
import { requestContext, notFound, handleError } from "./common/http.ts";
import { createHealthRouter } from "./modules/health/router.ts";

/** Build the HTTP application without starting a listener, for integration tests. */
export function createApp(options: {
  database?: Database;
  events?: CommunicationEvents;
  uploadDirectory?: string;
  media?: MediaConfig;
  auth: AuthService;
  guilds: GuildService;
  allowedOrigins: string[];
  session: SessionTransportOptions;
}): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestContext);
  app.use(
    cors({
      origin: options.allowedOrigins,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Cord-Client"],
      credentials: false,
      maxAge: 600,
    }),
  );
  const v1 = Router();
  v1.use(express.json({ limit: "16kb" }));
  v1.use("/health", createHealthRouter());
  v1.use(createAccountRouter(options.auth, options.session));
  v1.use("/servers", createGuildRouter(options.guilds, options.auth, options.session));
  if (options.database) {
    const access = createAccessService(options.database);
    const messages = createMessageService(options.database, access, options.events);
    const social = createSocialService(options.database, options.events);
    v1.use("/devices", createPushRouter(options.database, options.auth, options.session));
    v1.use(
      "/uploads",
      createUploadRouter(
        options.database,
        options.auth,
        options.session,
        access,
        options.uploadDirectory ?? "../../.data/uploads",
      ),
    );
    v1.use("/media", createMediaRouter(options.auth, options.session, access, options.media));
    v1.use(
      createCommunicationRouter(options.database, messages, social, options.auth, options.session),
    );
  }
  app.use("/api/v1", v1);
  app.use(notFound);
  app.use(handleError);
  return app;
}
