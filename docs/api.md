# HTTP and realtime API

The Express modular monolith uses PostgreSQL/Prisma 7.10.1. The shared SDK validates public responses with Zod. The dashboard uses persistent servers, memberships, channels, friends, conversations, messages, notifications, and account preferences. Implementation in this slice has not been compiled or runtime-tested; verification is assigned to the user in [verification.md](verification.md).

## Addresses and startup

Local Compose exposes Caddy at `http://localhost:8081`, API at `http://127.0.0.1:3001`, PostgreSQL at `127.0.0.1:5433`, and media signaling at `ws://localhost:7880`. Inside Compose, use `api:3000`, `postgres:5432`, and `media:7880`. Caddy and Vite proxy `/api` including Socket.IO. Resource paths below are prefixed by `/api/v1`.

```sh
docker compose --env-file .env.example up -d --build --wait web api media
```

For host development, create a root `.env` from `.env.example` only if one does not already exist. Start PostgreSQL, run `pnpm db:migrate`, then `pnpm api:dev`. Prisma migrations are additive; never reset a valuable database. The new communication migration must be applied before the updated API starts. The Compose migration dependency handles this when images are rebuilt.

## Authentication

| Method | Path | Response |
| --- | --- | --- |
| GET | `/health` | Process liveness |
| POST | `/auth/register` | 201 `{ user }` |
| POST | `/auth/login` | `{ user, expiresAt }`; native response also contains `token` |
| POST | `/auth/logout` | 204; idempotent session revocation |
| GET | `/users/me` | `{ user: { id, username } }` |
| GET / PUT | `/users/me/preferences` | `{ preferences: { locale, theme } }` |

Registration uses `{ username, email, password }`. Usernames normalize to lowercase and contain 3–32 ASCII letters/digits/underscores/dots/hyphens, starting with a letter or digit. Passwords contain 12–128 characters; email verification/password reset are not implemented. Login uses `{ username, password }`. Unknown fields are rejected.

All account/resource calls declare `X-Cord-Client: web` or `native`. Web uses a host-only HttpOnly SameSite=Lax cookie with a fixed 24-hour expiry. Production defaults to `COOKIE_SECURE=true`, `__Host-cord_session`, Path=/; the loopback HTTP preview explicitly uses `cord_session`, Path=/api/v1. Web SDK requests use same-origin credentials and never receive a token in JSON. Cookie writes reject cross-site requests and origins outside `API_WEB_ORIGINS`. Native requests omit cookies and use `Authorization: Bearer <token>`. Transport fallback is forbidden. `API_ALLOWED_ORIGINS` controls exact native CORS origins; it is not authentication.

Passwords use bounded-concurrency asynchronous scrypt. Sessions are random opaque 32-byte tokens; only SHA-256 digests are stored. Sessions expire after 24 hours. Registration/login share a per-IP limit of 30 per 15 minutes. Resource routers additionally limit authenticated users to 300 requests per minute per router instance. Limits are process-local; this deployment is a single API instance. Forwarded IP headers are not trusted.

## Servers, membership, channels

| Method | Path | Permission / payload |
| --- | --- | --- |
| GET / POST | `/servers` | List joined servers / create `{ name }` |
| GET / POST | `/servers/:serverId/channels` | Member reads / owner creates `{ name }` |
| GET | `/servers/:serverId/members` | Member-only paginated member list |
| POST | `/servers/:serverId/invites` | Owner creates a seven-day invitation; returns `{ code, expiresAt, serverId }` |
| DELETE | `/servers/:serverId/invites` | Owner revokes all invitation codes |
| POST | `/servers/join` | Join with `{ code }`; repeated joins are idempotent |
| POST | `/servers/:serverId/leave` | Member leaves; owner must delete instead |
| DELETE | `/servers/:serverId/members/:userId` | Owner removes another member |
| DELETE | `/servers/:serverId` | Owner deletes server and cascading channels/messages |

Server names are trimmed Unicode text, 1–80 characters without control/format characters. Creating a server atomically creates its owner membership and the initial `genel` channel. Channel names normalize to lowercase and contain 1–64 ASCII letters, digits, or hyphens, starting with a letter/digit. Names are unique within a server. Only token digests of invitation codes are stored.

Public server fields are `id`, `name`, `ownerId`, `createdAt`; channel fields are `id`, `name`, `serverId`, `createdAt`. Member responses include public user, join date, and `owner`. Nonmembers and absent servers both return 404. Members without ownership receive 403 on owner actions. Current roles are owner/member; configurable roles and ownership transfer are not implemented.

Server/channel/member/conversation/notification lists use `limit` (1–100, default 50) and UUID `cursor`, returning `nextCursor` or null. Member cursors are user IDs; other cursors are resource IDs. Unknown query fields are rejected. Server/channel lists sort by creation time then ID ascending; conversations/notifications sort descending.

## Friends, conversations, notifications

| Method | Path | Payload / behavior |
| --- | --- | --- |
| GET / POST | `/friends` | List all friend relationships / request `{ username }` |
| POST | `/friends/:id/accept` | Only the request recipient can accept |
| DELETE | `/friends/:id` | Decline, cancel, or remove the caller's relationship |
| GET / POST | `/conversations` | List caller's DMs / create or find `{ userId }` |
| GET | `/notifications` | Paginated notifications and total `unreadCount` |
| POST | `/notifications/read` | `{ resourceId? }`; omit to mark all read |

A canonical unique user pair prevents duplicate/mutual friend requests and duplicate conversations. Creating a new DM requires an accepted friendship. Existing conversations remain accessible to their two participants after friendship removal. No arbitrary user can read or send to another DM. Notifications are persisted for friend requests, acceptance, and received DMs. `resourceId` identifies a relationship or conversation, depending on kind. System notifications are opt-in; native local notifications require a running application to receive events. Optional FCM delivery can notify closed Android apps when operator configuration is supplied; local notifications alone do not provide closed-app delivery.

## Messages and files

| Method | Path | Behavior |
| --- | --- | --- |
| GET / POST | `/channels/:id/messages` | Member-only history / send |
| GET / POST | `/conversations/:id/messages` | Participant-only history / send |
| POST | `/uploads?name=...&mediaType=...` | Upload binary `application/octet-stream`, up to 10 MiB |
| GET | `/uploads/:id` | Authenticated attachment download |
| DELETE | `/uploads/:id` | Delete caller-owned unattached upload |

Send `{ clientId: UUID, content: string, attachmentIds?: UUID[] }`. Content is trimmed, at most 4000 characters. At least content or one attachment is required; at most four attachments are allowed. Attachments must be owned, unattached uploads; claiming them and writing the message/DM notification is transactional. `(authorId, clientId)` provides retry idempotency. Reusing an ID in a different destination is rejected. Database checks require exactly one message target.

History is fetched newest page first, returned in chronological order within each page. `nextCursor` points to the oldest message in that page to fetch earlier messages. The client merges by message ID and fills missed pages after reconnect. A message contains public author, content, ISO date, destination IDs, client ID, and attachment metadata.

Files are stored by random UUID under server-only `UPLOAD_DIRECTORY`. Downloads verify current target access and force attachment disposition with nosniff/sandbox headers; no HTML/SVG inline rendering. Before message attachment, only the uploader can read the file. A staged-upload limit and hourly cleanup remove uploads older than one day and old orphaned files. Attached files remain until their database resource is removed; orphan disk reclamation follows on cleanup. Uploaded content is not malware-scanned. Backups must include both PostgreSQL and the uploads volume.

## Socket.IO

The Socket.IO path is `/api/socket.io`, not the HTTP v1 prefix. Browser handshake auth is `{ client: 'web' }` with its cookie and an exact allowed web Origin. Native handshake auth is `{ client: 'native', token }`; tokens never enter query strings. Connection origins must be in the configured web/native allowlists. Clients receive only events for current members/participants; the server resolves membership again on message/typing broadcasts rather than trusting stale channel rooms.

- `message:created`: validated public message.
- `resources:changed`: refresh authoritative HTTP lists/notifications.
- `presence:changed`: friend-only user ID and online state.
- `presence:list`: acknowledgement containing currently online accepted friend IDs.
- `typing`: client `{ target: { kind: 'channel'|'conversation', id }, active }`; server adds public user after authorization.

Typing is throttled. Session expiry disconnects the socket; API logout immediately disconnects all sockets with that token. Administrative database revocation is detected by periodic session checks. Presence is in memory; process restarts/reconnects rebuild it. Messages are committed over HTTP; Socket.IO accelerates delivery and HTTP history recovers gaps. No Redis or multi-instance adapter is configured.

## Media

`POST /media/token` accepts `{ kind: 'channel'|'conversation', id }`, verifies current access, and returns a short-lived LiveKit room grant `{ url, token, room }`. Server-only `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` never enter client environment variables. `LIVEKIT_URL` must be reachable from the actual client. The media plane is separate from HTTP/Socket.IO. Microphone/camera publishing and desktop/browser screen capture use LiveKit. Android uses a custom Capacitor MediaProjection adapter with the native LiveKit SDK to publish a screen-only participant. `POST /media/screen-token` issues its separately scoped identity; it cannot subscribe to room audio/video. iOS screen broadcasting still requires a ReplayKit extension.

Room grants bind participant identity to the user's session digest and expire after sixty seconds for joining. The API also reconciles active LiveKit rooms against current sessions and destination access every ten seconds, and requests reconciliation on logout/membership changes. Invalid participants are removed through the media administration API. Configure server-only `LIVEKIT_INTERNAL_URL` to the media HTTP address (`http://media:7880` inside Compose). Enforcement is bounded by reconciliation and media availability, not an assertion that JWT expiration itself disconnects an existing call. See [self-hosting.md](self-hosting.md) for signaling, ICE, and TURN configuration.

## Errors and verification

Errors use `{ error: { code, message, requestId } }`. Statuses include 400 validation/JSON, 401 unauthenticated, 403 CSRF/permission, 404 absent/private resource, 409 duplicate/conflict, 413 payload limit, 429 rate limit, and 503 busy/unconfigured media. Unexpected errors are redacted. Responses use request IDs and no-store headers; request logging excludes credentials, cookies, token headers, query strings, and bodies.

Existing `pnpm api:test` suites cover account/session, server/channel foundations, and deployment cookie policy. Database tests require a dedicated migrated `TEST_DATABASE_URL` and are skipped without it. New communication/realtime/upload/media behavior still needs the checks in [verification.md](verification.md); no passing result is claimed for this slice.

## Optional Android background push

`POST /devices/register` accepts a native authenticated `{ token }`. The FCM registration token is stored against the current session; logout cascades its device registration and expired sessions are excluded from delivery. No device/session tokens are logged or returned. Delivery is off by default. `PUSH_ENABLED=true` requires a server-only `GOOGLE_APPLICATION_CREDENTIALS` JSON file. The optional `compose.push.yaml` mounts the operator file specified by `PUSH_CREDENTIALS_FILE`.

Unread recent notifications with eligible devices are sent through Firebase Admin on resource changes and periodic retries. Invalid provider tokens are removed; notification delivery is marked after provider acceptance. Provider acceptance is not proof of device display. This integration, token refresh, opt-in, and killed-app receipt still require user verification and external provider setup. iOS APNs registration/delivery is not configured by the Android-first adapter.
