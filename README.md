# Cord

A pnpm monorepo for a self-hostable, Discord-like communication platform.

The runnable Vue frontend includes a public landing page, registration and login previews, and the communication dashboard. Header controls switch between dark/light themes and Turkish/English for the current session. Registration shows an alert and opens login. Any nonempty username and password open the dashboard, where a session-only Pinia store supplies the displayed name. This is a UI preview, not authentication; no accounts are created and no credentials are sent to a server. Friends, activity, and local messages are demo data. Electron and Capacitor development shells reuse these screens; Android and iOS projects are generated. The API, real messaging, voice, and database schema are not implemented. Native installers, signing, and device integrations remain incomplete. The base Compose file provides PostgreSQL; an explicit development override adds the web client.

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

The Vue client, Vue Router, Pinia, and Vite+ are installed. Electron and Capacitor dependencies are installed; backend framework dependencies remain deferred. The ORM will be selected when the database schema is designed.

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
  development.md   Local development and upcoming setup steps
  self-hosting.md  Deployment target and current scope
  design.md        Approved visual direction, branding, and responsive behavior
  native-clients.md Desktop/mobile launch, native prerequisites, and verification
infra/
  docker/          Future application Dockerfiles
  proxy/           Future reverse proxy configuration
```

Remaining empty directories are preserved with `.gitkeep` files. Capacitor-generated Android/iOS sources are under `apps/mobile`; build outputs and copied web assets are ignored.

## Getting started

Use Node 24.22.1 and pnpm 12.14.0 as pinned in `.node-version` and `package.json`. Run the frontend locally:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:5173. Routes are `/` (landing), `/register`, `/login`, and `/dashboard`. Dashboard preview is accessible directly without login. Verify with `pnpm typecheck` and `pnpm build`.

For container development (no local Node installation required):

```sh
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml up --build web
```

This starts the web client with source mounts and hot reload, independently of PostgreSQL. The placeholder database credentials are for local development only. To start the database separately, copy `.env.example` to `.env` and run `docker compose up -d --wait`. `docker compose down` preserves database volumes.

For native client development:

```sh
pnpm desktop:dev
pnpm mobile:dev
```

Desktop builds and opens Electron; the mobile command serves the mobile browser entry at http://localhost:5175. To run on an emulator/device, follow [native client setup and tests](docs/native-clients.md). Android/iOS projects are already generated; do not add them a second time.

See [design](docs/design.md), [architecture](docs/architecture.md), [development](docs/development.md), [self-hosting](docs/self-hosting.md), and [agent instructions](AGENTS.md).
