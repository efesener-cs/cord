# Development

Use Node 24.22.1 and pnpm 12.14.0. TypeScript is strict; Vue 3/Pinia/Vue Router form the shared client. Styling uses scoped CSS and shared semantic tokens, with Turkish/English and dark/light support. No Tailwind, extra package manager, or monorepo orchestrator is introduced.

## Running

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Vite web is at `http://localhost:5173`. Start the API/database separately or use the development Compose override:

```sh
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml up --build api web-dev media
```

For the bundled stack use `docker compose --env-file .env.example up -d --build --wait web api media`. Rebuild after dependency/migration changes. The latest communication work has not been built or deployed in this slice; old running containers may still serve earlier behavior.

Host API setup: create a root `.env` only if needed, start PostgreSQL, run `pnpm db:migrate`, then `pnpm api:dev`. Host PostgreSQL is `127.0.0.1:5433`, containers use `postgres:5432`. Database credentials never belong in frontend variables. Preserve volumes.

## Screens and state

Routes are `/`, `/register`, `/login`, `/dashboard`. Public home is illustrative; registration/login call the account API. Dashboard guards validate server sessions, login restores valid sessions, and authenticated content uses real resources. Web restores via HttpOnly cookies. Electron uses main-process session storage and a safe default no-keyring consent dialog. Native Capacitor injects an origin-scoped secure storage adapter.

`session.ts` owns identity/transport and authenticated SDK closures. `communication.ts` owns real server/channel/friend/conversation/notification/history state, presence, typing, and reconnect resync. State resets on account changes/logout. Dialogs, search, selected navigation, drafts, and uploads in progress remain local to their screens. Theme/language preferences persist to the account.

`DashboardScreen.vue` provides server/channel creation, join-by-invitation, owner/member actions, friendships, real conversation navigation, notifications, and account settings. `RealChat.vue` renders persistent messages and authenticated files. `CallPanel.vue` uses LiveKit for media. The retained `ChatPanel.vue`, `demo.ts`, and `store.ts` are isolated preview code, not dashboard data sources.

The application fits the viewport. Navigation, server lists, message history, modals, and notification lists scroll internally. The composer remains outside history scrolling. Read [design.md](design.md) before changing layouts, branding, themes, or interaction patterns.

## Backend and contracts

The HTTP API, Socket.IO authentication/events, database models, and SDK methods are documented in [api.md](api.md). Changes belong to the existing modular monolith. Validation and authorization always run on the server. Media transport uses LiveKit independently of message events. Upload bytes use a private volume and authorized download endpoint.

Prisma clients are generated and ignored; schema/migrations are source. The communication migration adds friendships, DMs, messages, attachment metadata, invites, notifications, and preferences. Do not reset existing databases to apply it.

## Native and packaging

See [native-clients.md](native-clients.md). Root commands include `pnpm desktop:dev`, `pnpm desktop:package`, `pnpm mobile:dev`, and `VITE_API_URL=<reachable-origin> pnpm mobile:apk`. Development Android HTTP permission is confined to the debug manifest. Native plugin metadata was regenerated; compilation, device behavior, and artifacts remain unverified.

Use `python3 scripts/generate-brand.py` with ImageMagick to regenerate launcher/splash assets from the approved shared SVG. Do not hand-redesign the logo in platform projects.

## Verification handoff

The user owns this slice's tests, type checks, builds, Compose validation, whitespace checks, browser inspection, and native/device checks. Follow [verification.md](verification.md). Code generation, formatting, and dependency installation are not verification. Existing foundation suites are not comprehensive coverage of the new communication/media functionality.
