# Architecture

Cord is a pnpm/TypeScript monorepo with a shared Vue 3 client and one Express modular monolith. This is a single-node self-hosting implementation; Redis and distributed routing are not configured.

## Boundaries

```text
apps/web, apps/desktop renderer, apps/mobile
  -> packages/client -> packages/ui
                     -> packages/sdk -> packages/contracts
apps/api -> packages/contracts
         -> packages/database -> PostgreSQL
         -> private uploads volume
         -> LiveKit token grants
clients -> LiveKit SFU (separate audio/video transport)
```

Platform adapters own Electron/Capacitor imports. The Electron renderer remains sandboxed without Node access, with an origin-bound preload session API. Native mobile storage uses Android KeyStore/iOS Keychain through its application adapter; the web never uses that plugin's localStorage implementation. Database code and secrets remain server-only.

## Backend

Feature modules own HTTP translation and services. Auth handles hashing, revocable opaque sessions, cookie/native transport, and CSRF. Guilds handles servers, membership, channels, invites, and owner actions. Communication handles channel/DM authorization, transactional message/attachment writes, friendships, notifications, and preferences. Uploads handles authenticated binary transfer and disk cleanup. Realtime attaches Socket.IO to the same HTTP listener and broadcasts validated persisted data to current authorized users. Media issues narrowly scoped LiveKit grants after the same destination authorization.

Prisma stores User, Session, Server, ServerMember, Channel, ServerInvite, Friendship, Conversation, Message, Attachment, and Notification. Canonical participant pairs and unique client message IDs enforce duplicate protection. SQL checks constrain message targets and pair membership. Migrations add resources without resetting existing accounts. The one-shot Compose migration service runs before API startup.

HTTP controllers validate incoming data with Zod. Services own authorization and business rules; client validation is only feedback. Public selections omit password hashes, email, token digests, and internal storage paths. Tokens and invitation codes are persisted only as digests, except for explicitly consented unencrypted desktop session storage.

Messages are written over authenticated HTTP, then announced through Socket.IO. Clients deduplicate events and HTTP results by message ID. History pagination supplies reconnect gap recovery. Presence/typing are ephemeral. Notification records and unread state are durable. File metadata is transactional with messages; actual bytes use a private volume and are downloaded only after access checks.

LiveKit is a separate SFU for audio/video/screen tracks. Message traffic does not carry media. Local and self-hosting Compose configurations use separate signaling and ICE ports. Browser/Electron capture and an Android MediaProjection screen-only participant adapter are present. Android background delivery has an optional FCM provider integration; iOS background push/broadcasting and advanced roles remain separate integrations. Media participants are reconciled against sessions and destination access, including after membership changes/logout.

## Client

Shared routes are landing, register, login, and dashboard. Browser supplies HTML5 history; native adapters supply hash history. Dashboard navigation verifies `/users/me`. Login redirects a valid restored session to the dashboard. Desktop/native startup begins at the dashboard and falls through to login when unauthenticated; the public browser home remains a landing page.

The session store keeps public user and native token in memory, and exposes the authenticated SDK closure. Web tokens remain HttpOnly cookies. Electron uses OS-backed encryption automatically or an explicit native no-keyring consent dialog; refusal is process-only, acceptance permits a mode-0600 plaintext token file. No custom local encryption key is generated. Capacitor persists native tokens in its platform secure store, scoped to API origin.

`communication.ts` owns real lists, message history caches, notifications, presence, and reconnect synchronization. It clears on account changes/logout and discards stale asynchronous results across accounts. Forms/drafts/dialogs stay local. Failed sends retain their draft and retry identifier. Local demo modules remain for isolated previews but are not the authenticated dashboard's data source. Theme/language preferences persist to the account. Notifications require explicit OS permission.

## Packaging and operations

Base Compose provides loopback web/API/PostgreSQL/media and private upload storage. `compose.dev.yaml` adds Vite/watch mounts with WebSocket proxying. The standalone self-hosting Compose file removes published database/API ports, adds HTTPS Caddy domains and certificate volumes, and configures public media ICE/TURN UDP. Operators supply domains, secrets, firewall rules, and backups. Backup/restore scripts snapshot PostgreSQL and uploads together while stopping API writers; restores require an explicit destructive-action environment guard.

Desktop packaging stages only compiled files in a minimal application package. Android APK commands use the existing SDK/JDK 21 discovery. Release signing is supplied through operator environment variables. No signing secrets or real deployment environment files belong in Git.

This implementation slice is unverified by request. See [verification.md](verification.md), [api.md](api.md), [native-clients.md](native-clients.md), and [self-hosting.md](self-hosting.md).
