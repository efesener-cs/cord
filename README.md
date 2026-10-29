# Cord

A pnpm monorepo scaffold for a self-hostable, Discord-like communication platform.

This repository currently contains the project structure and infrastructure configuration. Application code, framework dependencies, a database schema, and runnable clients/API have not been added. Docker Compose currently provides only a development PostgreSQL service.

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

These choices describe the intended architecture. Framework dependencies have not been added to the manifests. The ORM will be selected when the database schema is designed.

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
infra/
  docker/          Future application Dockerfiles
  proxy/           Future reverse proxy configuration
```

Empty directories are preserved with `.gitkeep` files. Native Android/iOS projects will be generated when Capacitor is set up.

## Getting started

The Node version is pinned in `.node-version`, and the pnpm version is pinned in the root `package.json`. Vite+ is the intended toolchain; project-local tooling dependencies have not been added yet.

```sh
cp .env.example .env
docker compose config --quiet
docker compose up -d --wait
```

These commands start only the database. `docker compose down` preserves the database volume. There are no application `dev`, `build`, `test`, or mobile/desktop packaging commands yet.

See [architecture](docs/architecture.md), [development](docs/development.md), [self-hosting](docs/self-hosting.md), and [agent instructions](AGENTS.md).
