import express, { Router, type Express } from "express";
import helmet from "helmet";
import { requestContext, notFound, handleError } from "./common/http.ts";
import { createHealthRouter } from "./modules/health/router.ts";

/** Build the HTTP application without starting a listener, for integration tests. */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestContext);
  const v1 = Router();
  v1.use(express.json({ limit: "16kb" }));
  v1.use("/health", createHealthRouter());
  app.use("/api/v1", v1);
  app.use(notFound);
  app.use(handleError);
  return app;
}
