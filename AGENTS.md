# Agent instructions

## Project and current scope

Cord is a self-hostable, Discord-like communication platform organized as a pnpm monorepo. Read `README.md` and `docs/architecture.md` before changing package boundaries or technology choices.

The repository includes a shared Vue frontend with public landing/auth screens and a dashboard wired to persistent servers, channels, invitation-based memberships, friendships, DMs, message history, attachments, notifications, and account preferences. Express/Prisma stores accounts and 24-hour revocable opaque sessions; web uses HttpOnly cookies/CSRF, Electron uses an origin-bound main-process vault with automatic OS encryption or explicit no-keyring plaintext consent, and native Capacitor uses KeyStore/Keychain-backed storage. Socket.IO handles message delivery, friend presence, typing, and change notifications; HTTP remains authoritative. LiveKit is the separate media plane for calls/video and supported browser/desktop screen capture. Android MediaProjection screen-sharing and optional FCM push adapters are present but unverified; FCM needs operator provider files and is disabled by default. iOS ReplayKit/APNs, configurable roles, and store distribution remain outside this Android-first local package scope. Do not describe those as implemented.

Base Compose serves Caddy on localhost:8081, Express on localhost:3001, development PostgreSQL on localhost:5433, and local LiveKit signaling on localhost:7880; uploads and PostgreSQL have separate persistent volumes. The development override adds Vite on localhost:5173. `compose.self-host.yaml` is a standalone domain/TLS deployment configuration with no published API/database ports. Its runtime/networking still needs operator validation. The migration service applies committed migrations before API startup; never reset valuable data or delete volumes without explicit instructions. Read `docs/api.md` before backend changes and `docs/native-clients.md` before native changes.

The user explicitly assigned tests, builds, configuration checks, browser/device verification, and package/runtime verification for the communication slice to themselves. Implementation/generation is not a passing test result. See `docs/verification.md` for the handoff; do not claim successful latest-slice verification or signed releases.

## Language and tooling

- Write repository documentation, code identifiers, and code comments in English. Respond to the user in their preferred language.
- Use TypeScript for application and shared package code, with strict checking inherited from `tsconfig.base.json`.
- Use pnpm workspaces. Respect the Node and pnpm versions pinned in `.node-version` and `package.json`.
- Use Vite+ for the client toolchain and shared checks when configured. Do not introduce another package manager, lockfile format, or monorepo orchestrator without a concrete need.
- Commit `pnpm-lock.yaml` updates when dependencies change. Do not hand-edit dependency resolutions.

## Technology decisions

- Web: Vue 3, Vue Router, and Pinia.
- Styling: Vue scoped CSS and shared CSS custom properties. Do not add Tailwind.
- Backend: Express with TypeScript and Socket.IO, organized as a modular monolith.
- Desktop: Electron.
- Mobile: Capacitor using the shared Vue client. Ionic Vue components are optional.
- Database: PostgreSQL with Prisma 7.10.1 and the PostgreSQL adapter in `packages/database`. Keep CLI/client/adapter versions aligned; the generated client is ignored.
- Zod validates shared account request schemas on the server and response contracts in the SDK.
- LiveKit is the current separate media SFU. Keep Redis/distributed API adapters and object storage deferred until required.

## Frontend design

Read `docs/design.md` before changing frontend visuals, branding, layout, scrolling, themes, language controls, or interaction patterns. It is the source of truth for the approved design direction. Reuse the shared logo and semantic color tokens; follow its viewport-shell and independent conversation-scrolling rules. Keep both themes and languages coherent. Update that document when the user approves a new design decision, and distinguish working previews from deferred features.

## Workspace boundaries

- `apps/web`: browser entry point and web platform integration.
- `apps/api`: HTTP API, Socket.IO handlers, configuration, and backend feature modules.
- `apps/desktop`: Electron main, preload, and renderer entry points.
- `apps/mobile`: Capacitor configuration and mobile integration.
- `packages/client`: shared screens, routing, state, composables, and platform interfaces.
- `packages/ui`: reusable Vue components and shared styles.
- `packages/contracts`: platform-independent API/event contracts and runtime validation schemas.
- `packages/sdk`: platform-independent HTTP and Socket.IO client.
- `packages/database`: server-only data access, schema, and migrations.

Keep Electron and Capacitor imports in their application adapters. Never import database code or server secrets into client packages. Keep business logic in backend services so HTTP controllers and Socket.IO handlers can share it. Validate incoming data on the server; TypeScript types and client validation are insufficient.

Keep Electron renderer Node access disabled and expose only the required capabilities through preload. Treat voice/video media transport as separate from message events.

## Docker and self-hosting

Use Docker Compose for web/API development and the self-hosting target. The existing PostgreSQL service uses a prebuilt image and needs no custom Dockerfile. Add web/API Dockerfiles and development Compose configuration alongside their first runnable implementation; do not defer container support until feature development is complete.

Keep development bind mounts and host ports separate from production deployment settings. Preserve database volumes unless deletion is explicitly requested. Never commit real environment files, credentials, tokens, or signing material; maintain placeholder values in `.env.example`.

## Validation and documentation

For configuration-only changes, run `docker compose --env-file .env.example config --quiet` when Compose is affected, validate modified JSON, and check whitespace with `git diff --check`. For frontend changes, run `pnpm typecheck`, `pnpm build`, and `git diff --check`. For native adapter changes, also run the affected `pnpm desktop:build` or `pnpm mobile:build` and follow `docs/native-clients.md`; distinguish compilation from actual runtime/device verification. Follow the visual and responsive verification guidance in `docs/design.md` when browser access is available, and report any verification limits. For backend changes run `pnpm api:build` and `pnpm api:typecheck`; Vitest is available via `pnpm api:test`; the account integration suite requires a dedicated migrated `TEST_DATABASE_URL` and is skipped without one. Run other relevant checks when configured; do not invent successful checks.

Update `README.md` and the relevant `docs/` files when architecture, setup commands, or deployment behavior changes. Preserve user changes unrelated to the task. Do not force-push or rewrite shared Git history unless explicitly requested.
