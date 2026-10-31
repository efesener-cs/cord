import type { HealthResponse } from "@cord/contracts";

export function getHealth(): HealthResponse {
  return {
    status: "ok",
    service: "cord-api",
    apiVersion: "v1",
    uptimeSeconds: Math.floor(process.uptime()),
  };
}
