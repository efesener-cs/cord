import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { mkdtemp, readFile, rm, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const state = vi.hoisted(() => ({ directory: "", available: true, backend: "gnome_libsecret" }));
vi.mock("electron", () => ({
  app: { getPath: () => state.directory },
  safeStorage: {
    isEncryptionAvailable: () => state.available,
    getSelectedStorageBackend: () => state.backend,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: (value: Buffer) => {
      if (!value.toString().startsWith("encrypted:")) throw new Error("Invalid ciphertext");
      return value.toString().slice(10);
    },
  },
}));
const origin = "https://api.cord.example";
const token = "a".repeat(43);
beforeEach(async () => {
  vi.resetModules();
  state.directory = await mkdtemp(join(tmpdir(), "cord-vault-"));
  state.available = true;
  state.backend = "gnome_libsecret";
});
afterEach(async () => {
  await rm(state.directory, { recursive: true, force: true });
});
const vault = async () => (await import("../src/main/session-vault.js")).sessionVault;

describe("Electron session vault (OS encryption mocked)", () => {
  it("restores an encrypted token after a main-process restart and scopes it to its API", async () => {
    const consent = vi.fn(async () => true);
    await (await vault()).write(origin, token, consent);
    expect(consent).not.toHaveBeenCalled();
    const stored = await readFile(join(state.directory, "session.enc"));
    expect(stored.toString()).toContain("encrypted:");
    vi.resetModules();
    expect(await (await vault()).read(origin)).toBe(token);
    expect(await (await vault()).read("https://other.example")).toBeNull();
    await (await vault()).clear("https://other.example");
    expect(await (await vault()).read(origin)).toBe(token);
  });
  it("keeps a session through renderer reloads without persisting when encryption is unavailable", async () => {
    state.available = false;
    await (await vault()).write(origin, token);
    expect(await (await vault()).read(origin)).toBe(token);
    await expect(readFile(join(state.directory, "session.enc"))).rejects.toThrow();
    vi.resetModules();
    expect(await (await vault()).read(origin)).toBeNull();
  });
  it.skipIf(process.platform !== "linux")(
    "never uses the insecure basic_text backend",
    async () => {
      state.backend = "basic_text";
      await (await vault()).write(origin, token);
      await expect(readFile(join(state.directory, "session.enc"))).rejects.toThrow();
    },
  );
  it("persists plaintext only after explicit consent and restores it after restart", async () => {
    state.available = false;
    const consent = vi.fn(async () => true);
    await (await vault()).write(origin, token, consent);
    expect(consent).toHaveBeenCalledOnce();
    const path = join(state.directory, "session.json");
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ origin, token });
    if (process.platform !== "win32") expect((await stat(path)).mode & 0o777).toBe(0o600);
    vi.resetModules();
    expect(await (await vault()).read(origin)).toBe(token);
    expect(await (await vault()).read("https://other.example")).toBeNull();
    await (await vault()).clear(origin);
    vi.resetModules();
    expect(await (await vault()).read(origin)).toBeNull();
    await expect(readFile(path)).rejects.toThrow();
  });
  it("removes an old saved session when consent is declined for a new login", async () => {
    state.available = false;
    await (await vault()).write(origin, token, async () => true);
    const consent = vi.fn(async () => false);
    await (await vault()).write(origin, "b".repeat(43), consent);
    expect(consent).toHaveBeenCalledOnce();
    expect(await (await vault()).read(origin)).toBe("b".repeat(43));
    await expect(readFile(join(state.directory, "session.json"))).rejects.toThrow();
    vi.resetModules();
    expect(await (await vault()).read(origin)).toBeNull();
  });
  it("migrates consented plaintext to OS encryption when a keyring becomes available", async () => {
    state.available = false;
    await (await vault()).write(origin, token, async () => true);
    state.available = true;
    vi.resetModules();
    expect(await (await vault()).read(origin)).toBe(token);
    await expect(readFile(join(state.directory, "session.json"))).rejects.toThrow();
    expect((await readFile(join(state.directory, "session.enc"), "utf8"))).toContain("encrypted:");
  });
  it("does not silently downgrade encrypted storage when encryption fails", async () => {
    const storage = await vault();
    await rm(state.directory, { recursive: true, force: true });
    await writeFile(state.directory, "not a directory");
    const consent = vi.fn(async () => true);
    await storage.write(origin, token, consent);
    expect(consent).not.toHaveBeenCalled();
    expect(await storage.read(origin)).toBe(token);
    await expect(readFile(join(state.directory, "session.json"))).rejects.toThrow();
  });
  it("clears the persisted token and serializes concurrent changes", async () => {
    const storage = await vault();
    await Promise.all([storage.write(origin, token), storage.write(origin, "b".repeat(43))]);
    expect(await storage.read(origin)).toBe("b".repeat(43));
    await storage.clear(origin);
    vi.resetModules();
    expect(await (await vault()).read(origin)).toBeNull();
    await expect(readFile(join(state.directory, "session.enc"))).rejects.toThrow();
  });
  it("requires a new login for corrupt data and rejects invalid origins/tokens", async () => {
    await writeFile(join(state.directory, "session.enc"), "corrupt");
    expect(await (await vault()).read(origin)).toBeNull();
    await expect((await vault()).write(origin, "short")).rejects.toThrow();
    await expect((await vault()).read("file:///tmp/other")).rejects.toThrow();
    await expect((await vault()).read("https://api.cord.example/path")).rejects.toThrow();
  });
});
