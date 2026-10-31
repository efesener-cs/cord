/** Public, platform-independent HTTP response contracts. */
export interface HealthResponse {
  status: "ok";
  service: "cord-api";
  apiVersion: "v1";
  uptimeSeconds: number;
}

export type ApiErrorCode = "NOT_FOUND" | "INVALID_JSON" | "PAYLOAD_TOO_LARGE" | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
  };
}
