import { resolve } from "node:path";
import type { MediaConfig } from "../modules/media/router.ts";
export interface ApiConfig {
  pushEnabled: boolean;
  uploadDirectory: string;
  media?: MediaConfig;
  secureCookies: boolean;
  webOrigins: string[];
  databaseUrl: string;
  allowedOrigins: string[];
  host: string;
  port: number;
  environment: "development" | "test" | "production";
}

/** Fail before opening a socket if server configuration is invalid. */
export function readConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const rawPort = env.PORT ?? "3001";
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  const environment = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(environment)) {
    throw new Error("NODE_ENV must be development, test, or production.");
  }
  const host = env.HOST ?? "127.0.0.1";
  if (!host.trim() || host !== host.trim())
    throw new Error("HOST must be a nonempty host without surrounding whitespace.");
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  let databaseAddress: URL;
  try {
    databaseAddress = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(databaseAddress.protocol))
    throw new Error("DATABASE_URL must be a PostgreSQL URL.");
  const allowedOrigins = (env.API_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of allowedOrigins) {
    if (origin === "null") continue;
    let address: URL;
    try {
      address = new URL(origin);
    } catch {
      throw new Error("Invalid API_ALLOWED_ORIGINS entry.");
    }
    if (
      !["http:", "https:", "capacitor:"].includes(address.protocol) ||
      address.host === "" ||
      origin !== `${address.protocol}//${address.host}`
    )
      throw new Error("Invalid API_ALLOWED_ORIGINS entry.");
  }
  const cookieSetting = env.COOKIE_SECURE ?? (environment === "production" ? "true" : "false");
  if (!["true", "false"].includes(cookieSetting))
    throw new Error("COOKIE_SECURE must be true or false.");
  const webOrigins = (
    env.API_WEB_ORIGINS ??
    "http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5175,http://127.0.0.1:5175"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of webOrigins) {
    let address: URL;
    try {
      address = new URL(origin);
    } catch {
      throw new Error("Invalid API_WEB_ORIGINS entry.");
    }
    if (!["http:", "https:"].includes(address.protocol) || origin !== address.origin)
      throw new Error("Invalid API_WEB_ORIGINS entry.");
  }
  const pushSetting = env.PUSH_ENABLED ?? "false";
  if (!["true", "false"].includes(pushSetting))
    throw new Error("PUSH_ENABLED must be true or false.");
  if (pushSetting === "true" && !env.GOOGLE_APPLICATION_CREDENTIALS)
    throw new Error("PUSH_ENABLED requires GOOGLE_APPLICATION_CREDENTIALS.");
  let media: MediaConfig | undefined;
  if (env.LIVEKIT_URL || env.LIVEKIT_API_KEY || env.LIVEKIT_API_SECRET) {
    if (
      !env.LIVEKIT_URL ||
      !env.LIVEKIT_API_KEY ||
      !env.LIVEKIT_API_SECRET ||
      env.LIVEKIT_API_SECRET.length < 32
    )
      throw new Error(
        "Configure LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET (at least 32 characters) together.",
      );
    const url = new URL(env.LIVEKIT_URL);
    if (
      !["ws:", "wss:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("LIVEKIT_URL must be a ws/wss server address.");
    media = { url: url.href, apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET };
  }
  if (media && env.LIVEKIT_INTERNAL_URL) {
    const internal = new URL(env.LIVEKIT_INTERNAL_URL);
    if (!["http:", "https:"].includes(internal.protocol) || internal.username || internal.password)
      throw new Error("LIVEKIT_INTERNAL_URL must be an HTTP(S) media administration origin.");
    media.internalUrl = internal.origin;
  }
  return {
    pushEnabled: pushSetting === "true",
    uploadDirectory: resolve(env.UPLOAD_DIRECTORY ?? "../../.data/uploads"),
    ...(media ? { media } : {}),
    secureCookies: cookieSetting === "true",
    webOrigins,
    host,
    port: Number(rawPort),
    environment: environment as ApiConfig["environment"],
    databaseUrl,
    allowedOrigins,
  };
}
