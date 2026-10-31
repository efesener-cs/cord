# Architecture

## Backend

The backend uses Express and TypeScript as a modular monolith. Auth, users, guilds, channels, messages, and realtime modules belong to the same API application. Separate microservices or an additional gateway service are not needed initially.

Each feature owns its router, controller, and service files. The HTTP layer handles request/response translation, while services own business rules. Socket.IO handlers use the same services. Shared validation, authentication, authorization, and error handling must be defined explicitly; Express does not impose a particular architecture.

Socket.IO is proposed for message events, presence, and typing indicators. PostgreSQL stores persistent messages. The Socket.IO protocol is different from plain WebSocket; the SDK encapsulates that distinction.

Voice, video, and screen sharing require a separate media design involving WebRTC, TURN, and an SFU for group calls. Media traffic does not pass through the messaging gateway. Media service selection is deferred.

## Shared client

- `apps/web`, the `apps/desktop` renderer, and `apps/mobile` use the shared Vue application in `packages/client`.
- `packages/client` contains shared screens and application state; `packages/ui` contains visual components and CSS custom properties.
- Platform differences are handled by adapters at application entry points. Electron/Capacitor imports stay out of shared packages.
- Electron main/preload code stays in `apps/desktop`. The renderer uses a limited API explicitly exposed by preload; it does not receive Node access.
- Capacitor provides the native mobile shell. Ionic Vue is an optional UI library. Mobile notifications, permissions, background behavior, and touch layouts need their own implementation work.

The Electron main/preload and renderer sources now build under `apps/desktop`. The main process loads only bundled assets, keeps the renderer sandboxed with Node disabled, and exposes only the OS name through the preload bridge. The native mobile adapter and Capacitor configuration live in `apps/mobile`, including generated Android and iOS projects, hash routing, safe-area styles, and Android back navigation. Native runtime and distribution validation is documented in [native-clients.md](native-clients.md).

## Frontend routing and state

`packages/client/src/router.ts` defines the public landing, registration, login, and dashboard routes. `apps/web` supplies `createWebHistory()` and mounts the router with Pinia. Electron and Capacitor adapters use `createWebHashHistory()` with the same routes, avoiding local-file path rewriting. Route components load lazily. Navigation is a client-side UI flow; the preview has no auth guards, server sessions, or account API.

The minimal session store contains only the display name. Preferences and local demo messages use separate Pinia stores; form fields and view-specific state remain local refs. Registration currently alerts and navigates to login; login accepts arbitrary nonempty credentials and opens the dashboard. This must be replaced by server-side authentication before real accounts or private data are introduced.

## Package boundaries

```text
web / desktop renderer / mobile
  -> client -> ui
            -> sdk -> contracts

api -> contracts
    -> database -> PostgreSQL
```

`contracts` will also contain runtime validation schemas; TypeScript types alone do not replace server-side validation. Client packages must not import `database` or server secrets.

Zod is a candidate for runtime validation of HTTP requests and Socket.IO events; it has not been added as a dependency. For example, a schema can check that message content is text and stays within its length limit. Schemas may be shared with clients, but the server must always validate incoming data independently.

## Data and infrastructure

PostgreSQL is the primary data store for users, guilds, memberships, roles, channels, and messages. JSONB can be used for flexible metadata when needed. MongoDB is not introduced as a second data store initially.

Redis can be added when multiple API instances, distributed presence, rate limiting, or background queues require it. Local storage or an S3-compatible service for uploads will be selected separately. These services are not part of the current scaffold.

## Toolchain

pnpm manages workspace packages. Vite+ handles browser development and builds using `apps/web/vite.config.ts`; `vue-tsc` checks Vue and TypeScript sources against the root `tsconfig.json`. No extra monorepo orchestrator is used. Lint and test scripts are not configured yet. The Express API's Node/TypeScript build configuration remains separate from client Vite settings.

`tsconfig.base.json` defines shared strict checking options only. The root `tsconfig.json` currently configures DOM/Node types, bundler module resolution, and no-emit checking for browser and shared Vue sources. Backend and native targets will require separate configurations.

## Official references

- [Express routing and modular routers](https://expressjs.com/en/guide/routing.html)
- [Zod](https://zod.dev/)
- [Installing Capacitor](https://capacitorjs.com/docs/getting-started)
- [Vite+ monorepos](https://www.viteplus.dev/guide/monorepo)
- [PostgreSQL data types](https://www.postgresql.org/docs/current/datatype.html)
