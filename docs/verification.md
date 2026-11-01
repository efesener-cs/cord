# User verification handoff

The user explicitly owns tests, builds, configuration checks, browser checks, and native/device verification for the communication implementation. None of the commands in this document were run for this slice. Dependency installation, native plugin metadata updates, Prisma client/migration generation, code formatting, and brand-asset generation are implementation operations, not passing verification results.

## Build and configuration gates

Use the pinned Node/pnpm versions. Do not assume existing `dist` output contains the new SDK or dashboard.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm api:build
pnpm api:typecheck
pnpm build
pnpm desktop:build
pnpm mobile:build
docker compose --env-file .env.example config --quiet
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml config --quiet
git diff --check
```

For self-hosting, create a private `.env.production` with `CORD_DOMAIN`, `MEDIA_DOMAIN`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and appropriate `API_ALLOWED_ORIGINS`. Use URL-safe generated PostgreSQL credentials or encode their URL representation consistently. Then validate the standalone stack:

```sh
docker compose --env-file .env.production -f compose.self-host.yaml config --quiet
```

## Existing automated suites

Account and initial server/channel integration tests use a dedicated PostgreSQL database. Create a separate test database, migrate it, then run the suites. Never point these variables at production.

```sh
DATABASE_URL=postgresql://cord:cord@127.0.0.1:5433/cord_test pnpm db:migrate
TEST_DATABASE_URL=postgresql://cord:cord@127.0.0.1:5433/cord_test pnpm api:test
pnpm client:test
pnpm desktop:test
```

Without `TEST_DATABASE_URL`, database suites skip; skipped tests do not establish database coverage. Existing suites cover the earlier auth/server/channel foundation. New message, invitation, friendship, realtime, upload, media, packaging, and native behavior need additional automation or the manual scenarios below.

## Local startup

```sh
docker compose --env-file .env.example up -d --build --wait web api media
```

Use `http://localhost:8081`. Docker images and existing running containers have not been rebuilt for this slice. Rebuilding applies committed migrations through `migrate`; it does not delete existing accounts/volumes. Never use `down -v` for routine upgrades.

## Two-account workflow

1. Open two independent browser profiles (or browser plus Electron); create accounts A and B. Check invalid registration, wrong password, logout, expiry/revocation, F5, tab/browser restart, and transport isolation. On desktop test OS-encrypted storage and no-keyring consent/refusal separately. F5/Ctrl+R must now reload the renderer.
2. A creates a server. Confirm creator ownership and `genel`, then refresh/restart and find both. Create a channel, try invalid names and a duplicate, and check concurrent duplicate submissions.
3. A creates an invite; B joins with its code. B can read channels and messages but cannot create channels/invites, kick members, or delete the server. Test invalid, expired, and revoked invitation codes. Repeated join must not create duplicate memberships.
4. Exchange channel messages. Reload and paginate history. Send simultaneously from two sessions, disconnect one client while more than fifty messages arrive, reconnect, and confirm history has no gap or duplicates. Retry a failed send with the same client ID; only one database message should exist.
5. Use an unrelated account C to request guessed server/channel/message/file IDs; no private resource should be returned. Remove B and check that new messages/files and media access are denied. Test leave, owner protection, member removal, and explicit server-deletion confirmation.
6. A sends B a friend request. Check sender-only cancellation, recipient-only acceptance/decline, duplicate/mutual requests, and removal. Start a DM only after acceptance. Verify only its participants can read/send. Check multiple online devices and friend-only presence.
7. Check incoming typing indicators, throttling, expiry, offline status, reconnect, and logout while a socket is connected. Typing and presence must never appear to unrelated users.
8. Check persistent DM/friend notifications, unread counts, conversation navigation, mark-all/read synchronization, outside-click and Escape dismissal, keyboard focus, and narrow/short popover scrolling.
9. Upload image and non-image files, file-only messages, four-file/10-MiB boundaries, invalid/empty files, duplicate attachment claims, another user's upload IDs, cancelled staged files, failure/retry, and authorized downloads. No HTML/SVG should execute inline. Check volume persistence and cleanup of staged/orphaned files.
10. Change theme and language. Reopen the app and confirm account preferences restore. Verify all new dialogs, errors, empty states, focus, and buttons in Turkish/English and both themes. Check two different accounts on the same client for cache/draft leakage.

## Media and native

1. Start the media service. Open the same channel/DM on two clients and start a call on each. Test microphone permission refusal/acceptance, mute, camera, remote audio/video, playback unblock, device removal, reconnect, and leaving. Confirm room identity is session-bound and unauthorized room grants fail.
2. On desktop/browser, test the screen/window picker, cancellation, actual screen capture, and stopping sharing. On Android, test the custom MediaProjection consent prompt, cancellation, foreground capture notification, rotation, OS stop action, call leave/logout, and activity destruction. The separate screen participant must not subscribe to audio/video or duplicate playback.
3. Test session expiry/logout/server removal during a call. Media administration reconciliation should remove invalid participants within its interval when the media administration endpoint is reachable. Check `LIVEKIT_INTERNAL_URL` and do not treat token expiry alone as active-call revocation.
4. Configure reachable API/media URLs for Android. `localhost` on a device is not the host. The default media configuration advertises host loopback and must be adapted for an emulator/LAN device; see native setup. Test secure session restart, origin scoping, revoked token cleanup, keyboard/safe-area behavior, back navigation, camera/microphone permissions, file picker, and actual downloads.
5. Enable system notifications from Settings. Test foreground/background message receipt and notification navigation. Local notifications do not deliver closed-app/background-killed messages. If optional FCM is configured, separately verify killed-app delivery, token refresh, opt-in, notification tap, logout/session-expiry suppression, and invalid-token cleanup. iOS needs a macOS/Xcode host for actual build/device verification.
6. Generate/install the debug APK with `VITE_API_URL` configured and `pnpm mobile:apk`. Test the generated launcher/splash assets. Release signing is operator supplied; no signed release is asserted.
7. Run `pnpm desktop:package`, launch the packaged application, and test session storage, API/CSP, media permissions, files, system notifications, and restart. Native builds are separate from GUI success.

## Operations

On an isolated deployment, run `pnpm backup`, restore into a disposable stack with the explicit restore guard, and verify users, sessions, channels, messages, attachments, and permissions. Verify failed restores leave API stopped. Operator environment/secrets need a separate protected backup. Public DNS/TLS/firewall/TURN behavior and device/network reachability must be checked on the actual target; no public deployment was performed here.

## Optional-provider and native-adapter gates

If using Android FCM, validate the chosen Compose stack with `compose.push.yaml`, private provider files, and `VITE_PUSH_ENABLED=true`. Confirm a build without provider configuration continues to work with push disabled. Verify device registrations are tied to the current session and disappear/become ineligible after logout/expiry. Never use a skipped/default-off provider as evidence of successful push delivery.

The Android screen adapter adds a native LiveKit dependency and Kotlin plugin. Its Gradle dependency resolution, MediaProjection/foreground-service behavior on current Android, rotation, capture cancellation while connecting, and stop/destroy cleanup all need actual compilation and device checks. The native adapter is not proven by TypeScript compilation or Capacitor metadata generation.
