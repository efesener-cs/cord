# Agent instructions

## Project and current scope

Cord is a self-hostable, Discord-like communication platform organized as a pnpm monorepo. Read `README.md` and `docs/architecture.md` before changing package boundaries or technology choices.

The repository currently contains a scaffold, configuration, documentation, and a development PostgreSQL Compose service. Application source code and framework dependencies have not been added. Do not describe planned features or commands as implemented. Add application code or dependencies when the user's task calls for implementation.

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
- Database: PostgreSQL. ORM selection is pending.
- Zod is a validation candidate, not an installed or finalized dependency.
- Keep Redis, object storage, and WebRTC media infrastructure deferred until required by the task.

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

For configuration-only changes, run `docker compose --env-file .env.example config --quiet` when Compose is affected, validate modified JSON, and check whitespace with `git diff --check`. Run relevant lint, type, build, or test scripts once they exist. Do not invent successful application checks while the repository has no runnable application.

Update `README.md` and the relevant `docs/` files when architecture, setup commands, or deployment behavior changes. Preserve user changes unrelated to the task. Do not force-push or rewrite shared Git history unless explicitly requested.
