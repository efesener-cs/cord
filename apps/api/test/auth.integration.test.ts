import { createGuildService } from "../src/modules/guilds/service.ts";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createDatabase, type Database } from "@cord/database";
import { createApp } from "../src/app.ts";
import { createAuthService } from "../src/modules/auth/service.ts";

// Point only at a migrated, dedicated test database. Never clear application data.
const connection = process.env.TEST_DATABASE_URL;
describe.skipIf(!connection)("persistent account and session HTTP flow", () => {
  let database: Database;
  let server: Server;
  let base: string;
  const username = `test_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const password = "A long test password 123!";
  let token = "";
  beforeAll(async () => {
    database = createDatabase(connection!);
    await database.$connect();
    server = createServer(
      createApp({
        auth: createAuthService(database),
        guilds: createGuildService(database),
        allowedOrigins: ["null"],
        session: { secureCookies: false, webOrigins: ["https://cord.example"] },
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    base = `http://127.0.0.1:${address.port}/api/v1`;
  });
  afterAll(async () => {
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (database) {
      await database.user.deleteMany({ where: { username } });
      await database.$disconnect();
    }
  });
  const post = (path: string, body: unknown, bearer?: string) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cord-Client": "native",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
    });
  it("rejects invalid data and unknown fields before storing users", async () => {
    const response = await post("/auth/register", {
      username,
      email: "bad",
      password: "short",
      role: "admin",
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(await database.user.count({ where: { username } })).toBe(0);
  });
  it("normalizes the username, persists a hash, and returns no private fields", async () => {
    const response = await post("/auth/register", {
      username: username.toUpperCase(),
      email: `${username}@example.test`,
      password,
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user).toEqual({ id: expect.any(String), username });
    const row = await database.user.findUniqueOrThrow({ where: { username } });
    expect(row.passwordHash).toMatch(/^scrypt\$/);
    expect(row.passwordHash).not.toContain(password);
  });
  it("rejects a case-insensitive duplicate", async () => {
    const response = await post("/auth/register", {
      username: username.toUpperCase(),
      email: `other_${username}@example.test`,
      password,
    });
    expect(response.status).toBe(409);
  });
  it("returns the same failure for incorrect credentials and unknown users", async () => {
    for (const name of [username, "unknown_account_123"]) {
      const response = await post("/auth/login", {
        username: name,
        password: "incorrect password",
      });
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("INVALID_CREDENTIALS");
    }
  });
  it("persists only the token digest and authenticates /users/me", async () => {
    const response = await post("/auth/login", { username, password });
    expect(response.status).toBe(200);
    const body = await response.json();
    token = body.token;
    expect(token).toMatch(/^[\w-]{43}$/);
    const session = await database.session.findFirstOrThrow({ where: { user: { username } } });
    expect(session.tokenHash).toHaveLength(64);
    expect(session.tokenHash).not.toBe(token);
    const me = await fetch(`${base}/users/me`, {
      headers: { "X-Cord-Client": "native", Authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ user: { id: body.user.id, username } });
    expect(
      (await fetch(`${base}/users/me`, { headers: { "X-Cord-Client": "native" } })).status,
    ).toBe(401);
    expect(
      (
        await fetch(`${base}/users/me`, {
          headers: { "X-Cord-Client": "native", Authorization: `Bearer ${"a".repeat(43)}` },
        })
      ).status,
    ).toBe(401);
  });
  it("revokes the session on logout and supports idempotent revocation", async () => {
    expect((await post("/auth/logout", {}, token)).status).toBe(204);
    expect(
      (
        await fetch(`${base}/users/me`, {
          headers: { "X-Cord-Client": "native", Authorization: `Bearer ${token}` },
        })
      ).status,
    ).toBe(401);
    expect((await post("/auth/logout", {}, token)).status).toBe(204);
  });
  it("rejects expired sessions", async () => {
    const response = await post("/auth/login", { username, password });
    const body = await response.json();
    await database.session.updateMany({
      where: { user: { username } },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (
        await fetch(`${base}/users/me`, {
          headers: { "X-Cord-Client": "native", Authorization: `Bearer ${body.token}` },
        })
      ).status,
    ).toBe(401);
  });
  it("keeps browser sessions across fresh requests without exposing a token in JSON", async () => {
    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cord-Client": "web",
        Origin: "https://cord.example",
      },
      body: JSON.stringify({ username, password }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("token");
    const setCookie = response.headers.get("set-cookie")!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/api/v1");
    expect(setCookie).toContain("Max-Age=86400");
    expect(setCookie).not.toContain("Domain=");
    const cookie = setCookie.split(";")[0]!;
    const browser = { "X-Cord-Client": "web", Cookie: cookie };
    // A fresh request has no Pinia state or Authorization header: only the browser cookie.
    const restored = await fetch(`${base}/users/me`, { headers: browser });
    expect(restored.status).toBe(200);
    expect((await restored.json()).user.username).toBe(username);
    expect(
      (await fetch(`${base}/users/me`, { headers: { ...browser, "X-Cord-Client": "native" } }))
        .status,
    ).toBe(401);
    const noHeader = await fetch(`${base}/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(noHeader.status).toBe(403);
    const csrf = await fetch(`${base}/auth/logout`, {
      method: "POST",
      headers: { ...browser, Origin: "https://attacker.example" },
    });
    expect(csrf.status).toBe(403);
    const crossSite = await fetch(`${base}/auth/logout`, {
      method: "POST",
      headers: { ...browser, "Sec-Fetch-Site": "cross-site" },
    });
    expect(crossSite.status).toBe(403);
    expect((await fetch(`${base}/users/me`, { headers: browser })).status).toBe(200);
    const loggedOut = await fetch(`${base}/auth/logout`, { method: "POST", headers: browser });
    expect(loggedOut.status).toBe(204);
    expect(loggedOut.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
    expect((await fetch(`${base}/users/me`, { headers: browser })).status).toBe(401);
  });
  it("rejects login CSRF before creating a session", async () => {
    const before = await database.session.count({ where: { user: { username } } });
    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cord-Client": "web",
        Origin: "https://attacker.example",
      },
      body: JSON.stringify({ username, password }),
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await database.session.count({ where: { user: { username } } })).toBe(before);
  });
  it("limits repeated login attempts and exposes only configured CORS origins", async () => {
    for (let i = 0; i < 30; i++) await post("/auth/login", {});
    const limited = await post("/auth/login", {});
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("RATE_LIMITED");
    const allowed = await fetch(`${base}/health`, { headers: { Origin: "null" } });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("null");
    const denied = await fetch(`${base}/health`, {
      headers: { Origin: "https://untrusted.example" },
    });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });
});
