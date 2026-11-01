# Cord

A pnpm monorepo for a self-hostable, Discord-like communication platform.

Cord now has code for a shared web/Electron/Capacitor dashboard backed by real accounts, persistent servers and channels, invitation-based membership, friendships, DMs, message history, authenticated file transfers, notifications, account preferences, and Socket.IO delivery/presence/typing. Calls use a separate self-hosted LiveKit media service. The landing page remains public; the dashboard requires a server-validated session.

Web sessions use HttpOnly cookies; Electron uses OS encryption automatically and asks explicit consent before unencrypted no-keyring persistence. Capacitor native sessions use Android KeyStore/iOS Keychain. System notifications are opt-in and require a running app to receive realtime events. Android screen capture has a native MediaProjection adapter. Optional closed-app Android push has an FCM adapter that requires private operator/provider configuration; it is disabled by default.

**The communication implementation is unverified by request.** Tests, type checks, builds, Compose validation, browser inspection, device testing, and package/runtime verification are assigned to the user. Existing containers/build outputs do not automatically contain this slice. Start with [the verification handoff](docs/verification.md). No public deployment, signed release, or device behavior is claimed.

## Technology choices

| Area | Choice |
| --- | --- |
| Language | TypeScript with strict checking |
| Web | Vue 3, Vue Router, Pinia, Vite+ |
| Styling | Vue scoped CSS and shared CSS custom properties; no Tailwind |
| Desktop | Electron with the shared Vue client as its renderer |
| Mobile | Capacitor; Ionic Vue components may be considered if needed |
| Backend | Express, TypeScript, Socket.IO |
| Database | PostgreSQL with Prisma 7.10.1 |
| Workspace and tooling | pnpm, Vite+ |
| Development and self-hosting target | Docker Compose |

The Vue client, Vue Router, Pinia, and Vite+ are installed. Electron, Capacitor, and Express dependencies are installed; Socket.IO server/client integration is present. Prisma 7.10.1 and its PostgreSQL adapter are installed; Zod validates account payloads and SDK responses.

## Repository layout

```text
apps/
  web/             Browser entry point and web platform integration
  api/             Express HTTP API and Socket.IO real-time gateway
  desktop/         Electron main, preload, and renderer entry points
  mobile/          Capacitor configuration and mobile entry point
packages/
  client/          Shared Vue screens, routing, stores, and composables
  ui/              Shared Vue components and CSS design tokens
  contracts/       Platform-independent API/event contracts and validation schemas
  sdk/             Platform-independent HTTP/Socket.IO client
  database/        Server-only data access, schema, and migrations
docs/
  architecture.md  Package boundaries and architectural decisions
  api.md           API routes, ports, configuration, and test entry points
  development.md   Local development and upcoming setup steps
  self-hosting.md  Deployment target and current scope
  design.md        Approved visual direction, branding, and responsive behavior
  native-clients.md Desktop/mobile launch, native prerequisites, and verification
infra/
  docker/          Web/API development, build, and runtime Dockerfiles
  proxy/           Caddy static web and SPA routing configuration
```

Remaining empty directories are preserved with `.gitkeep` files. Capacitor-generated Android/iOS sources are under `apps/mobile`; build outputs and copied web assets are ignored.

## Getting started

Use Node 24.22.1 and pnpm 12.14.0 as pinned in `.node-version` and `package.json`. Run the frontend locally:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:5173. Routes are `/` (landing), `/register`, `/login`, and `/dashboard`. Dashboard requires a valid account/session; register first. Root scripts build SDK/contracts before the client. Verify with `pnpm typecheck` and `pnpm build`.

For the bundled frontend preview (no local Node installation required):

```sh
docker compose --env-file .env.example up -d --build --wait web api media
```

Open http://localhost:8081. The final web image serves static build output with Caddy and proxies `/api/` to the separate API container. API liveness is at http://localhost:8081/api/v1/health, or directly at http://127.0.0.1:3001/api/v1/health. PostgreSQL starts first and the `migrate` service applies committed migrations before the API starts. `WEB_PORT` and `API_PORT` change host ports.

For container development with hot reload:

```sh
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml up --build web-dev media
```

This starts the Vite client and watched API with source mounts, backed by PostgreSQL and committed migrations. For a host-run API, configure root `.env` using `.env.example`, run `pnpm db:migrate`, then `pnpm api:dev`. See [API setup and tests](docs/api.md). The placeholder database credentials are for local development only. To start the database separately, copy `.env.example` to `.env` and run `docker compose up -d --wait postgres`. The host address is `127.0.0.1:5433`, with development database/user/password `cord`. `docker compose down` preserves database volumes.

For native client development:

```sh
pnpm desktop:dev
pnpm mobile:dev
```

For Android prerequisite discovery use `pnpm mobile:android:check`; the launcher finds standard SDK/JDK 21 installations without per-terminal exports. `pnpm mobile:android --target emulator-5554` builds/runs on that specific emulator.

Use `pnpm desktop:package` to generate a host-platform application folder, or `VITE_API_URL=<reachable-origin> pnpm mobile:apk` for a debug APK. Neither command has been run for this slice. Desktop builds and opens Electron; the mobile command serves the mobile browser entry at http://localhost:5175. To run on an emulator/device, follow [native client setup and tests](docs/native-clients.md). Android/iOS projects are already generated; do not add them a second time.

See [design](docs/design.md), [architecture](docs/architecture.md), [development](docs/development.md), [self-hosting](docs/self-hosting.md), and [agent instructions](AGENTS.md).

## Self-hosting and operations

The base stack binds development ports to loopback and stores PostgreSQL/uploads in separate persistent volumes. LiveKit signaling is at `ws://localhost:7880`; local media candidates advertise loopback. Use the standalone `compose.self-host.yaml` for domain-based HTTPS hosting, without published API/database ports. Configure operator secrets and real DNS/networking before using it. See [self-hosting](docs/self-hosting.md) for media ports and the guarded `pnpm backup` / `pnpm restore` commands.

See [implementation scope](docs/roadmap.md) for the distinction between code delivered, user verification, and remaining platform integrations.
