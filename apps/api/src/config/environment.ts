export interface ApiConfig {
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
  return {
    host,
    port: Number(rawPort),
    environment: environment as ApiConfig["environment"],
    databaseUrl,
    allowedOrigins,
  };
}
