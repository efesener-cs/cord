/** Public, platform-independent HTTP response contracts. */
export interface HealthResponse {
  status: "ok";
  service: "cord-api";
  apiVersion: "v1";
  uptimeSeconds: number;
}

export type ApiErrorCode =
  | "NOT_FOUND"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR"
  | "VALIDATION_ERROR"
  | "ACCOUNT_EXISTS"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "SERVICE_BUSY"
  | "CSRF_REJECTED"
  | "FORBIDDEN"
  | "CHANNEL_EXISTS"
  | "CONFLICT"
  | "MEDIA_UNAVAILABLE";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
  };
}

export { z } from "zod";
import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_.-]{2,31}$/);
export const registerSchema = z.strictObject({
  username: usernameSchema,
  email: z.email().max(254).trim().toLowerCase(),
  password: z.string().min(12).max(128),
});
export const loginSchema = z.strictObject({
  username: usernameSchema,
  password: z.string().min(1).max(128),
});
export const userSchema = z.object({ id: z.uuid(), username: z.string() });
export const userResponseSchema = z.object({ user: userSchema });
export const loginResponseSchema = userResponseSchema.extend({
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
  expiresAt: z.iso.datetime(),
});
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type PublicUser = z.infer<typeof userSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// Names are display data. Server-side membership checks still govern every resource.
export const createServerSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[^\p{Cc}\p{Cf}]+$/u),
});
export const createChannelSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
});
export const serverIdParamsSchema = z.object({ serverId: z.uuid() });
export const resourcePageQuerySchema = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const serverSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  ownerId: z.uuid(),
  createdAt: z.iso.datetime(),
});
export const channelSchema = z.object({
  id: z.uuid(),
  serverId: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
});
export const serverResponseSchema = z.object({ server: serverSchema });
export const channelResponseSchema = z.object({ channel: channelSchema });
export const serversResponseSchema = z.object({
  servers: z.array(serverSchema),
  nextCursor: z.uuid().nullable(),
});
export const channelsResponseSchema = z.object({
  channels: z.array(channelSchema),
  nextCursor: z.uuid().nullable(),
});
export type CreateServerRequest = z.infer<typeof createServerSchema>;
export type CreateChannelRequest = z.infer<typeof createChannelSchema>;
export type ResourcePageQuery = z.infer<typeof resourcePageQuerySchema>;
export interface ResourcePageRequest {
  cursor?: string;
  limit?: number;
}
export type PublicServer = z.infer<typeof serverSchema>;
export type PublicChannel = z.infer<typeof channelSchema>;

export const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("channel"), id: z.uuid() }),
  z.object({ kind: z.literal("conversation"), id: z.uuid() }),
]);
export type MessageTarget = z.infer<typeof targetSchema>;
export const attachmentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  mediaType: z.string(),
  size: z.number().int().nonnegative(),
});
export const messageSchema = z.object({
  id: z.uuid(),
  clientId: z.uuid(),
  author: userSchema,
  channelId: z.uuid().nullable(),
  conversationId: z.uuid().nullable(),
  content: z.string(),
  createdAt: z.iso.datetime(),
  attachments: z.array(attachmentSchema),
});
export const sendMessageSchema = z
  .strictObject({
    clientId: z.uuid(),
    content: z.string().trim().max(4000),
    attachmentIds: z.array(z.uuid()).max(4).default([]),
  })
  .refine((value) => value.content.length > 0 || value.attachmentIds.length > 0);
export const messagesResponseSchema = z.object({
  messages: z.array(messageSchema),
  nextCursor: z.uuid().nullable(),
});
export const messageResponseSchema = z.object({ message: messageSchema });
export type PublicMessage = z.infer<typeof messageSchema>;
export type SendMessageRequest = z.input<typeof sendMessageSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type PublicAttachment = z.infer<typeof attachmentSchema>;
export const memberSchema = z.object({
  user: userSchema,
  joinedAt: z.iso.datetime(),
  owner: z.boolean(),
});
export const membersResponseSchema = z.object({
  members: z.array(memberSchema),
  nextCursor: z.uuid().nullable(),
});
export const inviteResponseSchema = z.object({
  code: z.string(),
  expiresAt: z.iso.datetime(),
  serverId: z.uuid(),
});
export const inviteCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
export const friendRequestSchema = z.strictObject({ username: usernameSchema });
export const friendSchema = z.object({
  id: z.uuid(),
  user: userSchema,
  accepted: z.boolean(),
  incoming: z.boolean(),
  createdAt: z.iso.datetime(),
});
export const friendsResponseSchema = z.object({ friends: z.array(friendSchema) });
export type PublicFriend = z.infer<typeof friendSchema>;
export const conversationSchema = z.object({
  id: z.uuid(),
  user: userSchema,
  createdAt: z.iso.datetime(),
});
export const conversationsResponseSchema = z.object({
  conversations: z.array(conversationSchema),
  nextCursor: z.uuid().nullable(),
});
export const conversationResponseSchema = z.object({ conversation: conversationSchema });
export type PublicConversation = z.infer<typeof conversationSchema>;
export const notificationSchema = z.object({
  id: z.uuid(),
  actorName: z.string(),
  kind: z.enum(["friend_request", "friend_accepted", "direct_message"]),
  resourceId: z.uuid(),
  read: z.boolean(),
  createdAt: z.iso.datetime(),
});
export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  nextCursor: z.uuid().nullable(),
  unreadCount: z.number().int().nonnegative(),
});
export type PublicNotification = z.infer<typeof notificationSchema>;
export const preferencesSchema = z.strictObject({
  locale: z.enum(["tr", "en"]),
  theme: z.enum(["dark", "light"]),
});
export const preferencesResponseSchema = z.object({ preferences: preferencesSchema });
export type AccountPreferences = z.infer<typeof preferencesSchema>;
export const mediaResponseSchema = z.object({ url: z.url(), token: z.string(), room: z.string() });
export const typingSchema = z.object({ target: targetSchema, active: z.boolean() });
export const typingEventSchema = z.object({
  target: targetSchema,
  user: userSchema,
  active: z.boolean(),
});
export const presenceSchema = z.object({ userIds: z.array(z.uuid()) });
