import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createDatabase, type Database } from "@cord/database";
import {
  channelResponseSchema,
  channelsResponseSchema,
  serverResponseSchema,
  serversResponseSchema,
} from "@cord/contracts";
import { createApp } from "../src/app.ts";
import { createAuthService } from "../src/modules/auth/service.ts";
import { createGuildService } from "../src/modules/guilds/service.ts";

const connection = process.env.TEST_DATABASE_URL;
describe.skipIf(!connection)("persistent servers, membership, and channel authorization", () => {
  let database: Database;
  let http: Server;
  let base: string;
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const people = ["owner", "member", "outsider"].map((role) => ({
    id: randomUUID(),
    username: `${role}_${suffix}`,
    token: randomBytes(32).toString("base64url"),
  }));
  const [owner, member, outsider] = people as [
    (typeof people)[number],
    (typeof people)[number],
    (typeof people)[number],
  ];
  beforeAll(async () => {
    database = createDatabase(connection!);
    await database.$connect();
    for (const person of people) {
      await database.user.create({
        data: {
          id: person.id,
          username: person.username,
          email: `${person.username}@example.test`,
          passwordHash: "unused-test-hash",
          sessions: {
            create: {
              tokenHash: createHash("sha256").update(person.token).digest("hex"),
              expiresAt: new Date(Date.now() + 60_000),
            },
          },
        },
      });
    }
    http = createServer(
      createApp({
        auth: createAuthService(database),
        guilds: createGuildService(database),
        allowedOrigins: [],
        session: { secureCookies: false, webOrigins: ["https://cord.example"] },
      }),
    );
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    if (!address || typeof address === "string") throw new Error("Missing test listener");
    base = `http://127.0.0.1:${address.port}/api/v1`;
  });
  afterAll(async () => {
    if (http?.listening) await new Promise<void>((resolve) => http.close(() => resolve()));
    if (database) {
      // Delete only these randomly identified fixtures; owned servers cascade.
      await database.user.deleteMany({ where: { id: { in: people.map((person) => person.id) } } });
      await database.$disconnect();
    }
  });
  const request = (path: string, token: string | null = owner.token, body?: unknown) =>
    fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "X-Cord-Client": "native",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function newServer() {
    const response = await request("/servers", owner.token, { name: "  Test community  " });
    expect(response.status).toBe(201);
    return serverResponseSchema.parse(await response.json()).server;
  }
  it("requires a valid session for every resource route", async () => {
    for (const token of [null, "x".repeat(43)]) {
      for (const path of ["/servers", `/servers/${randomUUID()}/channels`]) {
        expect((await request(path, token)).status).toBe(401);
        expect((await request(path, token, { name: "test" })).status).toBe(401);
      }
    }
  });
  it("validates names and rejects forged ownership before writing", async () => {
    const before = await database.server.count({ where: { ownerId: owner.id } });
    for (const body of [
      { name: " " },
      { name: "x".repeat(81) },
      { name: "bad\nname" },
      { name: "test", ownerId: outsider.id },
    ]) {
      expect((await request("/servers", owner.token, body)).status).toBe(400);
    }
    expect(await database.server.count({ where: { ownerId: owner.id } })).toBe(before);
  });
  it("persists the server, creator membership, and default text channel together", async () => {
    const server = await newServer();
    expect(server).toMatchObject({ name: "Test community", ownerId: owner.id });
    expect(
      await database.serverMember.count({ where: { serverId: server.id, userId: owner.id } }),
    ).toBe(1);
    expect(
      await database.channel.findMany({ where: { serverId: server.id }, select: { name: true } }),
    ).toEqual([{ name: "genel" }]);
    const freshService = createGuildService(database);
    const restored = await freshService.listChannels(owner.id, server.id, { limit: 50 });
    expect(restored.channels.map((channel) => channel.name)).toEqual(["genel"]);
  });
  it("lists only joined servers and allows members to read channels", async () => {
    const server = await newServer();
    await database.serverMember.create({ data: { serverId: server.id, userId: member.id } });
    const joined = serversResponseSchema.parse(
      await (await request("/servers", member.token)).json(),
    );
    expect(joined.servers.map((item) => item.id)).toContain(server.id);
    expect(joined.servers[0]).not.toHaveProperty("members");
    expect(await (await request("/servers", outsider.token)).json()).toEqual({
      servers: [],
      nextCursor: null,
    });
    const channels = channelsResponseSchema.parse(
      await (await request(`/servers/${server.id}/channels`, member.token)).json(),
    );
    expect(channels.channels[0]?.name).toBe("genel");
  });
  it("hides private and nonexistent servers from nonmembers", async () => {
    const server = await newServer();
    for (const id of [server.id, randomUUID()]) {
      for (const body of [undefined, { name: "private" }]) {
        const response = await request(`/servers/${id}/channels`, outsider.token, body);
        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe("NOT_FOUND");
      }
    }
  });
  it("lets only the owner create a channel and ignores no extra privilege fields", async () => {
    const server = await newServer();
    await database.serverMember.create({ data: { serverId: server.id, userId: member.id } });
    const forbidden = await request(`/servers/${server.id}/channels`, member.token, {
      name: "announcements",
    });
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error.code).toBe("FORBIDDEN");
    const created = await request(`/servers/${server.id}/channels`, owner.token, {
      name: "  NEWS  ",
    });
    expect(created.status).toBe(201);
    expect(channelResponseSchema.parse(await created.json()).channel).toMatchObject({
      name: "news",
      serverId: server.id,
    });
    for (const body of [
      { name: "two words" },
      { name: "x".repeat(65) },
      { name: "news", serverId: randomUUID() },
    ]) {
      expect((await request(`/servers/${server.id}/channels`, owner.token, body)).status).toBe(400);
    }
  });
  it("enforces normalized channel uniqueness even for concurrent requests", async () => {
    const server = await newServer();
    const results = await Promise.all(
      ["News", "news"].map((name) =>
        request(`/servers/${server.id}/channels`, owner.token, { name }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const duplicate = results.find((result) => result.status === 409)!;
    expect((await duplicate.json()).error.code).toBe("CHANNEL_EXISTS");
    const other = await newServer();
    expect(
      (await request(`/servers/${other.id}/channels`, owner.token, { name: "news" })).status,
    ).toBe(201);
  });
  it("paginates without repeating records and rejects invalid queries and IDs", async () => {
    const first = serversResponseSchema.parse(await (await request("/servers?limit=1")).json());
    expect(first.servers).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();
    const second = serversResponseSchema.parse(
      await (await request(`/servers?limit=1&cursor=${first.nextCursor}`)).json(),
    );
    expect(second.servers[0]?.id).not.toBe(first.servers[0]?.id);
    const server = await newServer();
    await request(`/servers/${server.id}/channels`, owner.token, { name: "second" });
    const channels = channelsResponseSchema.parse(
      await (await request(`/servers/${server.id}/channels?limit=1`)).json(),
    );
    const next = channelsResponseSchema.parse(
      await (
        await request(`/servers/${server.id}/channels?limit=1&cursor=${channels.nextCursor}`)
      ).json(),
    );
    expect(next.channels).toHaveLength(1);
    expect(next.channels[0]?.id).not.toBe(channels.channels[0]?.id);
    expect(next.nextCursor).toBeNull();
    for (const path of [
      "/servers?limit=0",
      "/servers?limit=101",
      "/servers?limit=bad",
      "/servers?cursor=bad",
      "/servers?ownerId=forged",
      "/servers/not-a-uuid/channels",
    ]) {
      expect((await request(path)).status).toBe(400);
    }
  });
  it("protects cookie-authenticated writes and keeps native/cookie transports separate", async () => {
    const before = await database.server.count({ where: { ownerId: owner.id } });
    const web = (origin: string, header = true) =>
      fetch(`${base}/servers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `cord_session=${owner.token}`,
          Origin: origin,
          ...(header ? { "X-Cord-Client": "web" } : {}),
        },
        body: JSON.stringify({ name: "Cookie community" }),
      });
    expect((await web("https://attacker.example")).status).toBe(403);
    expect((await web("https://cord.example", false)).status).toBe(403);
    expect(await database.server.count({ where: { ownerId: owner.id } })).toBe(before);
    expect((await web("https://cord.example")).status).toBe(201);
    const noBearer = await fetch(`${base}/servers`, {
      headers: { "X-Cord-Client": "native", Cookie: `cord_session=${owner.token}` },
    });
    expect(noBearer.status).toBe(401);
  });
  it("rejects expired and revoked sessions on resource routes", async () => {
    await database.session.updateMany({
      where: { userId: outsider.id },
      data: { expiresAt: new Date(0) },
    });
    expect((await request("/servers", outsider.token)).status).toBe(401);
    await database.session.deleteMany({ where: { userId: member.id } });
    expect((await request("/servers", member.token)).status).toBe(401);
  });
});
