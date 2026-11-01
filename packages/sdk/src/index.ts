import {
  attachmentSchema,
  messagesResponseSchema,
  messageResponseSchema,
  membersResponseSchema,
  inviteResponseSchema,
  friendsResponseSchema,
  conversationsResponseSchema,
  conversationResponseSchema,
  notificationsResponseSchema,
  preferencesResponseSchema,
  mediaResponseSchema,
  type MessageTarget,
  type SendMessageRequest,
  type AccountPreferences,
  loginResponseSchema,
  serverResponseSchema,
  serversResponseSchema,
  channelResponseSchema,
  channelsResponseSchema,
  type CreateServerRequest,
  type CreateChannelRequest,
  type ResourcePageRequest,
  userResponseSchema,
  type ApiErrorCode,
  type LoginRequest,
  type RegisterRequest,
} from "@cord/contracts";

export class ApiError extends Error {
  readonly code: ApiErrorCode | "NETWORK_ERROR";
  readonly status: number;
  constructor(code: ApiErrorCode | "NETWORK_ERROR", status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export function createApiClient(options: {
  baseUrl?: string;
  transport?: "web" | "native";
  getToken: () => string | null;
  onUnauthorized?: () => void;
}) {
  async function request(path: string, method = "GET", body?: unknown): Promise<unknown> {
    const mode = options.transport ?? "web";
    const headers: Record<string, string> = { "X-Cord-Client": mode };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = options.getToken();
    if (token && mode === "native") headers.Authorization = `Bearer ${token}`;
    let response: Response;
    try {
      response = await fetch(`${options.baseUrl ?? ""}/api/v1${path}`, {
        method,
        headers,
        credentials: mode === "web" ? "same-origin" : "omit",
        cache: "no-store",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError("NETWORK_ERROR", 0);
    }
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: { code?: ApiErrorCode };
      } | null;
      if (response.status === 401 && data?.error?.code === "UNAUTHORIZED")
        options.onUnauthorized?.();
      throw new ApiError(data?.error?.code ?? "INTERNAL_ERROR", response.status);
    }
    return response.status === 204 ? undefined : response.json();
  }
  async function binary(path: string, method: "GET" | "POST", body?: Blob): Promise<Response> {
    const mode = options.transport ?? "web";
    const token = options.getToken();
    let response: Response;
    try {
      response = await fetch(`${options.baseUrl ?? ""}/api/v1${path}`, {
        method,
        credentials: mode === "web" ? "same-origin" : "omit",
        headers: {
          "X-Cord-Client": mode,
          ...(body ? { "Content-Type": "application/octet-stream" } : {}),
          ...(mode === "native" && token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body } : {}),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new ApiError("NETWORK_ERROR", 0);
    }
    if (response.status === 401) options.onUnauthorized?.();
    if (!response.ok)
      throw new ApiError(
        response.status === 401
          ? "UNAUTHORIZED"
          : response.status === 413
            ? "PAYLOAD_TOO_LARGE"
            : "INTERNAL_ERROR",
        response.status,
      );
    return response;
  }
  function pageQuery(page: ResourcePageRequest = {}): string {
    const query = new URLSearchParams();
    if (page.cursor !== undefined) query.set("cursor", String(page.cursor));
    if (page.limit !== undefined) query.set("limit", String(page.limit));
    return query.size ? `?${query}` : "";
  }
  return {
    async listMessages(target: MessageTarget, page?: ResourcePageRequest) {
      return messagesResponseSchema.parse(
        await request(
          `/${target.kind === "channel" ? "channels" : "conversations"}/${encodeURIComponent(target.id)}/messages${pageQuery(page)}`,
        ),
      );
    },
    async sendMessage(target: MessageTarget, input: SendMessageRequest) {
      return messageResponseSchema.parse(
        await request(
          `/${target.kind === "channel" ? "channels" : "conversations"}/${encodeURIComponent(target.id)}/messages`,
          "POST",
          input,
        ),
      );
    },
    async listMembers(serverId: string, page?: ResourcePageRequest) {
      return membersResponseSchema.parse(
        await request(`/servers/${encodeURIComponent(serverId)}/members${pageQuery(page)}`),
      );
    },
    async createInvite(serverId: string) {
      return inviteResponseSchema.parse(
        await request(`/servers/${encodeURIComponent(serverId)}/invites`, "POST"),
      );
    },
    async revokeInvites(serverId: string) {
      await request(`/servers/${encodeURIComponent(serverId)}/invites`, "DELETE");
    },
    async joinServer(code: string) {
      return serverResponseSchema.parse(await request("/servers/join", "POST", { code }));
    },
    async leaveServer(serverId: string) {
      await request(`/servers/${encodeURIComponent(serverId)}/leave`, "POST");
    },
    async deleteServer(serverId: string) {
      await request(`/servers/${encodeURIComponent(serverId)}`, "DELETE");
    },
    async removeMember(serverId: string, userId: string) {
      await request(
        `/servers/${encodeURIComponent(serverId)}/members/${encodeURIComponent(userId)}`,
        "DELETE",
      );
    },
    async listFriends() {
      return friendsResponseSchema.parse(await request("/friends"));
    },
    async requestFriend(username: string) {
      await request("/friends", "POST", { username });
    },
    async acceptFriend(id: string) {
      await request(`/friends/${encodeURIComponent(id)}/accept`, "POST");
    },
    async removeFriend(id: string) {
      await request(`/friends/${encodeURIComponent(id)}`, "DELETE");
    },
    async listConversations(page?: ResourcePageRequest) {
      return conversationsResponseSchema.parse(await request(`/conversations${pageQuery(page)}`));
    },
    async createConversation(userId: string) {
      return conversationResponseSchema.parse(await request("/conversations", "POST", { userId }));
    },
    async listNotifications(page?: ResourcePageRequest) {
      return notificationsResponseSchema.parse(await request(`/notifications${pageQuery(page)}`));
    },
    async readNotifications(resourceId?: string) {
      await request("/notifications/read", "POST", resourceId ? { resourceId } : {});
    },
    async getPreferences() {
      return preferencesResponseSchema.parse(await request("/users/me/preferences"));
    },
    async savePreferences(preferences: AccountPreferences) {
      return preferencesResponseSchema.parse(
        await request("/users/me/preferences", "PUT", preferences),
      );
    },
    async registerDevice(token: string) {
      await request("/devices/register", "POST", { token });
    },
    async mediaScreenToken(target: MessageTarget) {
      return mediaResponseSchema.parse(await request("/media/screen-token", "POST", target));
    },
    async mediaToken(target: MessageTarget) {
      return mediaResponseSchema.parse(await request("/media/token", "POST", target));
    },
    async deleteUpload(id: string) {
      await request(`/uploads/${encodeURIComponent(id)}`, "DELETE");
    },
    async upload(file: File) {
      const query = new URLSearchParams({
        name: file.name,
        mediaType: file.type || "application/octet-stream",
      });
      const response = await binary(`/uploads?${query}`, "POST", file);
      const data = (await response.json()) as { attachment: unknown };
      return attachmentSchema.parse(data.attachment);
    },
    async download(id: string) {
      return (await binary(`/uploads/${encodeURIComponent(id)}`, "GET")).blob();
    },
    async listServers(page?: ResourcePageRequest) {
      return serversResponseSchema.parse(await request(`/servers${pageQuery(page)}`));
    },
    async createServer(input: CreateServerRequest) {
      return serverResponseSchema.parse(await request("/servers", "POST", input));
    },
    async listChannels(serverId: string, page?: ResourcePageRequest) {
      return channelsResponseSchema.parse(
        await request(`/servers/${encodeURIComponent(serverId)}/channels${pageQuery(page)}`),
      );
    },
    async createChannel(serverId: string, input: CreateChannelRequest) {
      return channelResponseSchema.parse(
        await request(`/servers/${encodeURIComponent(serverId)}/channels`, "POST", input),
      );
    },
    async register(input: RegisterRequest) {
      return userResponseSchema.parse(await request("/auth/register", "POST", input));
    },
    async login(input: LoginRequest) {
      return loginResponseSchema.parse(await request("/auth/login", "POST", input));
    },
    async me() {
      return userResponseSchema.parse(await request("/users/me"));
    },
    async logout() {
      await request("/auth/logout", "POST");
    },
  };
}

export { createRealtimeClient } from "./realtime.js";
