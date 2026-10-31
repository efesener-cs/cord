import express, { Router, type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { createAccountRouter } from "./modules/auth/router.ts";
import type { AuthService } from "./modules/auth/service.ts";
import { requestContext, notFound, handleError } from "./common/http.ts";
import { createHealthRouter } from "./modules/health/router.ts";

/** Build the HTTP application without starting a listener, for integration tests. */
export function createApp(options: { auth: AuthService; allowedOrigins: string[] }): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestContext);
  app.use(
    cors({
      origin: options.allowedOrigins,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
      maxAge: 600,
    }),
  );
  const v1 = Router();
  v1.use(express.json({ limit: "16kb" }));
  v1.use("/health", createHealthRouter());
  v1.use(createAccountRouter(options.auth));
  app.use("/api/v1", v1);
  app.use(notFound);
  app.use(handleError);
  return app;
}
