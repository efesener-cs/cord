# Cord

A pnpm monorepo for a self-hostable, Discord-like communication platform.

The runnable Vue frontend includes a public landing page, registration and login previews, and the communication dashboard. Header controls switch between dark/light themes and Turkish/English for the current session. Registration shows an alert and opens login. Any nonempty username and password open the dashboard, where a session-only Pinia store supplies the displayed name. This is a UI preview, not authentication; no accounts are created and no credentials are sent to a server. Friends/activity are demo data. Local DM and server-room conversations support Enter-to-send, reflection replies, file/image preview attachments, and message-notification popovers; no message/file is sent to the API. Electron and Capacitor development shells reuse these screens; Android and iOS projects are generated. The separate Express API now provides `/api/v1/health`, validated configuration, and JSON errors. Database connectivity, real authentication/messaging, voice, and the database schema are not implemented. Native installers, signing, and device integrations remain incomplete. The base Compose file serves the built web bundle with Caddy on localhost:8081 and provides development PostgreSQL on localhost:5433. An explicit development override adds the Vite server on localhost:5173.

## Technology choices

| Area | Choice |
| --- | --- |
| Language | TypeScript with strict checking |
| Web | Vue 3, Vue Router, Pinia, Vite+ |
| Styling | Vue scoped CSS and shared CSS custom properties; no Tailwind |
| Desktop | Electron with the shared Vue client as its renderer |
| Mobile | Capacitor; Ionic Vue components may be considered if needed |
| Backend | Express, TypeScript, Socket.IO |
| Database | PostgreSQL |
| Workspace and tooling | pnpm, Vite+ |
| Development and self-hosting target | Docker Compose |

The Vue client, Vue Router, Pinia, and Vite+ are installed. Electron, Capacitor, and Express dependencies are installed; Socket.IO integration is deferred. The ORM will be selected when the database schema is designed.

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

Open http://localhost:5173. Routes are `/` (landing), `/register`, `/login`, and `/dashboard`. Dashboard preview is accessible directly without login. Verify with `pnpm typecheck` and `pnpm build`.

For the bundled frontend preview (no local Node installation required):

```sh
docker compose --env-file .env.example up -d --build --wait web
```

Open http://localhost:8081. The final web image serves static build output with Caddy and proxies `/api/` to the separate API container. API liveness is at http://localhost:8081/api/v1/health, or directly at http://127.0.0.1:3001/api/v1/health. `WEB_PORT` and `API_PORT` change host ports.

For container development with hot reload:

```sh
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml up --build web-dev
```

This starts the Vite client and watched API with source mounts and hot reload, independently of PostgreSQL. Local backend development is also available with `pnpm api:dev`. See [API setup and tests](docs/api.md). The placeholder database credentials are for local development only. To start the database separately, copy `.env.example` to `.env` and run `docker compose up -d --wait postgres`. The host address is `127.0.0.1:5433`, with development database/user/password `cord`. `docker compose down` preserves database volumes.

For native client development:

```sh
pnpm desktop:dev
pnpm mobile:dev
```

For Android prerequisite discovery use `pnpm mobile:android:check`; the launcher finds standard SDK/JDK 21 installations without per-terminal exports. `pnpm mobile:android --target emulator-5554` builds/runs on that specific emulator.

Desktop builds and opens Electron; the mobile command serves the mobile browser entry at http://localhost:5175. To run on an emulator/device, follow [native client setup and tests](docs/native-clients.md). Android/iOS projects are already generated; do not add them a second time.

See [design](docs/design.md), [architecture](docs/architecture.md), [development](docs/development.md), [self-hosting](docs/self-hosting.md), and [agent instructions](AGENTS.md).
