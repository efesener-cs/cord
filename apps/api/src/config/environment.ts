export interface ApiConfig {
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
  return { host, port: Number(rawPort), environment: environment as ApiConfig["environment"] };
}
