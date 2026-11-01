import { createPinia, setActivePinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { configureApi } from "../src/api";
import { useSessionStore } from "../src/session";

const user = { id: "77fb0b69-6e62-4219-84ce-b2ce39a1b2e9", username: "deniz" };
const token = "a".repeat(43);
const freshStore = () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  return useSessionStore(pinia);
};
afterEach(() => {
  vi.unstubAllGlobals();
  configureApi("");
});

describe("session restoration", () => {
  it("restores a fresh browser store using its HttpOnly cookie transport without an in-memory token", async () => {
    configureApi("");
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      expect(options.credentials).toBe("same-origin");
      expect(options.headers).toEqual({ "X-Cord-Client": "web" });
      return Response.json({ user });
    });
    vi.stubGlobal("fetch", fetch);
    const session = freshStore();
    expect(session.authenticated).toBe(false);
    expect(await session.verify()).toBe(true);
    expect(session.username).toBe(user.username);
    expect(fetch.mock.calls[0]![0]).toBe("/api/v1/users/me");
  });
  it("restores Electron's saved token in a new renderer store and clears it on logout", async () => {
    const storage = {
      read: vi.fn(async () => token),
      write: vi.fn(),
      clear: vi.fn(async () => {}),
    };
    configureApi("http://127.0.0.1:3001", { transport: "native", storage });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options: RequestInit) => {
        expect(options.credentials).toBe("omit");
        expect(options.headers).toMatchObject({
          Authorization: `Bearer ${token}`,
          "X-Cord-Client": "native",
        });
        return url.endsWith("/auth/logout")
          ? new Response(null, { status: 204 })
          : Response.json({ user });
      }),
    );
    const session = freshStore();
    expect(await session.verify()).toBe(true);
    expect(storage.read).toHaveBeenCalledOnce();
    await session.logout();
    expect(storage.clear).toHaveBeenCalledOnce();
    expect(session.authenticated).toBe(false);
  });
  it("discards a revoked native session when the server rejects it", async () => {
    const storage = {
      read: vi.fn(async () => token),
      write: vi.fn(),
      clear: vi.fn(async () => {}),
    };
    configureApi("http://127.0.0.1:3001", { transport: "native", storage });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })),
    );
    const session = freshStore();
    expect(await session.verify()).toBe(false);
    expect(storage.clear).toHaveBeenCalledOnce();
    expect(session.user).toBeNull();
  });
});
