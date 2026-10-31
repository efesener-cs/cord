/** Public, platform-independent HTTP response contracts. */
export interface HealthResponse {
  status: "ok";
  service: "cord-api";
  apiVersion: "v1";
  uptimeSeconds: number;
}

export type ApiErrorCode =
  | "NOT_FOUND"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR"
  | "VALIDATION_ERROR"
  | "ACCOUNT_EXISTS"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "SERVICE_BUSY";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
  };
}

export { z } from "zod";
import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_.-]{2,31}$/);
export const registerSchema = z.strictObject({
  username: usernameSchema,
  email: z.email().max(254).trim().toLowerCase(),
  password: z.string().min(12).max(128),
});
export const loginSchema = z.strictObject({
  username: usernameSchema,
  password: z.string().min(1).max(128),
});
export const userSchema = z.object({ id: z.uuid(), username: z.string() });
export const userResponseSchema = z.object({ user: userSchema });
export const loginResponseSchema = userResponseSchema.extend({
  token: z.string(),
  expiresAt: z.iso.datetime(),
});
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type PublicUser = z.infer<typeof userSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
