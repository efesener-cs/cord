import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { HttpError } from "../../common/http.ts";

const options = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
let active = 0;
function derive(password: string, salt: string): Promise<Buffer> {
  // Bound expensive work instead of allowing an unbounded password-hashing queue.
  if (active >= 2) throw new HttpError(503, "SERVICE_BUSY", "Please try again shortly.");
  active++;
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => {
      active--;
      if (error) reject(error);
      else resolve(key);
    });
  });
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);
  return `scrypt$131072$8$1$${salt}$${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hex] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    n !== "131072" ||
    r !== "8" ||
    p !== "1" ||
    !salt ||
    !hex ||
    !/^[a-f0-9]{128}$/.test(hex)
  )
    return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(hex, "hex"));
}
// Run the same expensive operation for unknown usernames to reduce timing disclosure.
export const dummyPasswordHash = `scrypt$131072$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;
