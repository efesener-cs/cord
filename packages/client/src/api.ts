export interface NativeSessionStorage {
  read: () => Promise<string | null>;
  write: (token: string) => Promise<void>;
  clear: () => Promise<void>;
}
let baseUrl = "";
let transport: "web" | "native" = "web";
let storage: NativeSessionStorage | undefined;
// Called by platform adapters before creating stores. No platform imports belong here.
export function configureApi(
  url: string,
  options: { transport?: "web" | "native"; storage?: NativeSessionStorage } = {},
): void {
  const normalized = url.replace(/\/$/, "");
  if (normalized) {
    const address = new URL(normalized);
    if (
      !["http:", "https:"].includes(address.protocol) ||
      address.username ||
      address.password ||
      address.search ||
      address.hash ||
      address.pathname !== "/"
    )
      throw new Error("The API base URL must be an HTTP(S) origin.");
  }
  baseUrl = normalized;
  transport = options.transport ?? "web";
  storage = options.storage;
}
export function getApiBaseUrl(): string {
  return baseUrl;
}

export function getSessionTransport() {
  return { transport, storage };
}
