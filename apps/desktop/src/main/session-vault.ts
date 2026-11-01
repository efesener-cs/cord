import { app, safeStorage } from "electron";
import { readFile, mkdir, writeFile, rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

interface StoredSession {
  origin: string;
  token: string;
}
let cached: StoredSession | null | undefined;
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work);
  queue = result.catch(() => undefined);
  return result;
}
function encryptedStorageAvailable(): boolean {
  return (
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text")
  );
}
function checkOrigin(origin: unknown): asserts origin is string {
  if (typeof origin !== "string") throw new Error("Invalid session origin");
  const url = new URL(origin);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin)
    throw new Error("Invalid session origin");
}
function validSession(value: unknown): value is StoredSession {
  return (
    typeof value === "object" &&
    value !== null &&
    "origin" in value &&
    typeof value.origin === "string" &&
    "token" in value &&
    typeof value.token === "string" &&
    /^[\w-]{43}$/.test(value.token)
  );
}
const location = () => join(app.getPath("userData"), "session.enc");
const plaintextLocation = () => join(app.getPath("userData"), "session.json");
async function persist(path: string, data: Buffer | string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await mkdir(app.getPath("userData"), { recursive: true });
    await writeFile(temporary, data, { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
async function load(): Promise<void> {
  if (cached !== undefined) return;
  cached = null;
  const encrypted = encryptedStorageAvailable();
  if (encrypted) {
    try {
      if ((await stat(location())).size > 4096) return;
      const value: unknown = JSON.parse(safeStorage.decryptString(await readFile(location())));
      if (validSession(value)) cached = value;
      return;
    } catch {
      // A previously consented plaintext session may exist without a keyring.
    }
  }
  try {
    if ((await stat(plaintextLocation())).size > 4096) return;
    const value: unknown = JSON.parse(await readFile(plaintextLocation(), "utf8"));
    if (!validSession(value)) return;
    cached = value;
    if (encrypted) {
      await persist(location(), safeStorage.encryptString(JSON.stringify(value)));
      await rm(plaintextLocation(), { force: true });
    }
  } catch {
    // Missing/corrupt storage requires login; failed migration keeps the consented session.
  }
}
export const sessionVault = {
  read(origin: unknown): Promise<string | null> {
    return serialized(async () => {
      checkOrigin(origin);
      await load();
      return cached?.origin === origin ? cached.token : null;
    });
  },
  write(
    origin: unknown,
    token: unknown,
    confirmPlaintext: () => Promise<boolean> = async () => false,
  ): Promise<void> {
    return serialized(async () => {
      checkOrigin(origin);
      if (typeof token !== "string" || !/^[\w-]{43}$/.test(token))
        throw new Error("Invalid session token");
      cached = { origin, token };
      try {
        // Remove the old token even if consent is declined or the new write fails.
        await rm(location(), { force: true });
        await rm(plaintextLocation(), { force: true });
        if (encryptedStorageAvailable()) {
          await persist(location(), safeStorage.encryptString(JSON.stringify(cached)));
        } else if (await confirmPlaintext()) {
          await persist(plaintextLocation(), JSON.stringify(cached));
        }
      } catch {
        // Keep a per-process session if persistence or the consent dialog fails.
      }
    });
  },
  clear(origin: unknown): Promise<void> {
    return serialized(async () => {
      checkOrigin(origin);
      await load();
      if (cached && cached.origin !== origin) return;
      cached = null;
      await rm(location(), { force: true });
      await rm(plaintextLocation(), { force: true });
    });
  },
};
