let baseUrl = "";
// Called by platform adapters before creating stores. No platform imports belong here.
export function configureApi(url: string): void {
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
}
export function getApiBaseUrl(): string {
  return baseUrl;
}
