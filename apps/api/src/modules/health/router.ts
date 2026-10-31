import { Router } from "express";
import { getHealth } from "./service.ts";

export function createHealthRouter(): Router {
  const router = Router();
  router.get("/", (_request, response) => {
    response.json(getHealth());
  });
  return router;
}
