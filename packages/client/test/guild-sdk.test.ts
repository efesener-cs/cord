import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiError, createApiClient } from "@cord/sdk";

const server = {
  id: "c3fc3e87-562d-45d9-b660-99360830f401",
  ownerId: "b118a8ad-833b-4ba4-a3da-c2feaa0d19b8",
  name: "Community",
  createdAt: "2026-11-01T10:00:00.000Z",
};
const channel = {
  id: "c3fc3e87-562d-45d9-b660-99360830f402",
  serverId: server.id,
  name: "genel",
  createdAt: server.createdAt,
};
afterEach(() => vi.unstubAllGlobals());
describe("server/channel SDK", () => {
  it("sends native credentials and parses server/channel write responses", async () => {
    const fetch = vi.fn(async (url: string) =>
      Response.json(url.endsWith("/channels") ? { channel } : { server }),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({
      baseUrl: "https://cord.example",
      transport: "native",
      getToken: () => "a".repeat(43),
    });
    expect(await api.createServer({ name: server.name })).toEqual({ server });
    expect(await api.createChannel(server.id, { name: channel.name })).toEqual({ channel });
    expect(fetch).toHaveBeenLastCalledWith(
      `https://cord.example/api/v1/servers/${server.id}/channels`,
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        body: JSON.stringify({ name: "genel" }),
        headers: expect.objectContaining({
          "X-Cord-Client": "native",
          Authorization: `Bearer ${"a".repeat(43)}`,
        }),
      }),
    );
  });
  it("passes pagination and uses the browser cookie transport", async () => {
    const fetch = vi.fn(async (url: string) =>
      Response.json(
        url.includes("/channels")
          ? { channels: [channel], nextCursor: null }
          : { servers: [server], nextCursor: server.id },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ getToken: () => null });
    expect((await api.listServers({ limit: 1, cursor: server.id })).nextCursor).toBe(server.id);
    expect(fetch.mock.calls[0]?.[0]).toBe(`/api/v1/servers?cursor=${server.id}&limit=1`);
    expect(await api.listChannels(server.id)).toEqual({ channels: [channel], nextCursor: null });
    expect(fetch).toHaveBeenLastCalledWith(
      `/api/v1/servers/${server.id}/channels`,
      expect.objectContaining({ credentials: "same-origin", headers: { "X-Cord-Client": "web" } }),
    );
  });
  it("rejects malformed response contracts and preserves permission errors", async () => {
    const api = createApiClient({ getToken: () => null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ servers: [{ id: "bad" }], nextCursor: null })),
    );
    await expect(api.listServers()).rejects.toThrow();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 })),
    );
    await expect(api.createChannel(server.id, { name: "news" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    await expect(api.listChannels(server.id)).rejects.toBeInstanceOf(ApiError);
  });
});
