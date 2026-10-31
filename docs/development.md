# Development

## Current scope

The browser entry point in `apps/web` mounts the shared Vue application from `packages/client`. Vue Router routes are defined in `packages/client/src/router.ts`; the browser adapter supplies HTML5 history. Pinia holds the session-only display name, preferences, demo messages, and audio control preview states. Shared CSS tokens, icons, and the theme-aware `CordLogo.vue` component live in `packages/ui`. The standalone outlined logo is exported as `@cord/ui/cord-logo.svg` from `packages/ui/src/assets/cord-logo.svg` and reused for the browser favicon.

People, presence, music, and voice activity are static fixtures. Search, friend filters, navigation, modals, and session-only text messages work locally. No data is sent to a server or persisted after reload. Audio controls change preview state only. Server creation, notifications, accounts, uploads, and calls are not implemented.

The header offers manual dark/light and Turkish/English switches. Theme and language state live in the shared Pinia preferences store and reset on reload; user locale detection and saved preferences are deferred. CSS custom properties cover surfaces, text, avatars, and interaction states in both themes. UI copy, accessible labels, demo activity descriptions, document language, and title follow the selected language. Switching does not clear local messages.

The approved visual direction, logo usage, themes, language controls, accessibility, and responsive scrolling rules are recorded in [design.md](design.md). Read it before frontend design changes. The dashboard shell fits the viewport; its columns, navigation content, and conversation messages scroll inside their own regions. Application and conversation controls remain outside those scrolling regions. Public and authentication screens use a separate viewport-sized shell with internal page scrolling.

## Routes and preview forms

| URL | Screen | Behavior |
| --- | --- | --- |
| `/` | Public landing | Explains Cord and links to signup, login, and the dashboard preview |
| `/register` | Registration | Standard required username, email, and password fields; shows a localized registration alert, then navigates to login |
| `/login` | Login | Accepts any nonempty username/password; stores the trimmed display name and navigates to the dashboard |
| `/dashboard` | Communication dashboard | Uses the shared display name in the profile, welcome message, and local message author |

Unmatched routes redirect to `/`. Route components load lazily, titles follow the route and selected language, and cross-page links use `RouterLink`. The dashboard remains directly accessible without a route guard; no authentication system exists yet. HTML5 history needs an `index.html` fallback for direct links in a future production static server; Vite development/preview already handles these routes.

`session.ts` stores only the username in Pinia. Password and email inputs stay local to the form, are never logged or persisted, and are not sent anywhere. Route changes clear the form; registration and login clear the password before navigation. Logout clears the display name and demo messages and returns to `/login`. Reloading clears all in-memory state.

Pinia is useful here for data shared across routes and components: the display name, language/theme preferences, and preview messages. Forms, search queries, open dialogs, and other screen-specific state use local Vue refs. A local ref or small composable would suffice for one isolated screen; keeping a minimal Pinia store avoids passing the shared display name through unrelated components and gives a consistent place for future account state. Pinia itself does not implement authentication or persistence.

## Local frontend

Use Node 24.22.1 and pnpm 12.14.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm build
```

Vite+ serves http://localhost:5173. The production build is written to `apps/web/dist`. `pnpm --filter @cord/web preview` serves that build for inspection.

## Container frontend

```sh
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml config --quiet
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml up --build web
```

The development Dockerfile installs the frozen workspace dependencies. Source directories and Vite configuration are mounted for hot reload; dependencies stay inside the image. Rebuild after changing package manifests or the lockfile. The web service binds only to host loopback on port 5173 and does not require the database. Stop it using the same Compose files with `stop web`.

## Database

```sh
cp .env.example .env
docker compose config --quiet
docker compose up -d --wait
```

Connect at `127.0.0.1:5432` from the host or `postgres:5432` from the Compose network. `.env` configures database name, user, password, and host port. `pnpm infra:down` preserves the persistent volume.

## Remaining implementation

Electron and Capacitor adapters now build the shared client. See [native-clients.md](native-clients.md) for desktop startup, mobile browser preview, Android/iOS prerequisites, and emulator/device commands. The Express API, validation, schema, migrations, ORM selection, and production deployment are deferred. Add the API Dockerfile and development Compose service with its first runnable implementation. Real-time messaging and media require separate implementations.

## Remaining scaffold directories

A `.gitkeep` preserves a directory; it is not a requirement to add a file immediately. Implement these areas when their feature work begins:

| Area | Remaining work | Order/trigger |
| --- | --- | --- |
| `apps/api/src/config`, `common`, and `modules/auth`, `users`, `guilds`, `channels`, `messages`, `realtime` | Express entry point, validated configuration, feature services/controllers, authentication, and Socket.IO events | Backend stage; add API Dockerfile and dev Compose service with the first runnable API |
| `packages/contracts/src` | Shared request/response/event types and server-used runtime validation | Define alongside the first actual API feature |
| `packages/database/src`, `migrations` | ORM decision, schema, data access, migrations | Before persisting real accounts/messages |
| `packages/sdk/src` | Typed HTTP/Socket.IO access | When connecting the frontend to a real API |
| `infra/proxy` | Production reverse proxy, TLS, SPA fallback, and WebSocket forwarding | Self-hosting/deployment work |
| `apps/desktop/resources`, `apps/mobile/resources` | Reviewed launcher/splash assets and later packaging resources | Native branding/release preparation; generated mobile icons are still templates |
| `packages/client/src/platform` | Shared capability interfaces if screens need native functionality | When a real platform-specific feature needs a shared contract |

`packages/client/src/router`, `stores`, `composables`, and `features`, and `packages/ui/src/components`/`styles` are reserved organizational folders. Working router, stores, components, and CSS currently live directly under `src`; do not fill the reserved folders with duplicate implementations. Existing `.gitkeep` files beside implemented source (for example web/desktop entry points and `infra/docker`) are simply scaffold remnants.

## Configuration checks

```sh
docker compose --env-file .env.example config --quiet
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml config --quiet
git diff --check
```
