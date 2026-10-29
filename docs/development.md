# Development

## Current scope

The workspace manifests, shared TypeScript settings, directory placeholders, and PostgreSQL Compose service are in place. Application source code and framework dependencies have not been added. Application development, build, and test commands are therefore not defined yet. The existing pnpm lockfile records the workspace scaffold and package manager; update and commit it when dependencies change.

## Database

Copy `.env.example` to `.env` at the repository root, then run:

```sh
docker compose config --quiet
docker compose up -d --wait
docker compose ps
```

Connect from the host at `127.0.0.1:5432` or from the Compose network at `postgres:5432`. The database name, user, password, and host port are configured through `.env`. When the API container is added, its database connection must use the service name rather than `localhost`.

Root scripts provide the same operations through `pnpm infra:up`, `pnpm infra:down`, `pnpm infra:logs`, and `pnpm infra:check`. The `down` command preserves the persistent volume.

## Upcoming implementation steps

1. Add project-local Vite+ and TypeScript tools with pnpm and update the lockfile.
2. Set up the shared Vue client and web entry point with scoped CSS and shared design tokens.
3. Set up the Express/TypeScript API, validation, configuration, and a health endpoint.
4. Once web/API entry points and build commands exist, add their Dockerfiles and a development Compose override with hot reload and source bind mounts. Continue subsequent web/API development through Compose.
5. Select the data model and ORM, then establish the migration workflow.
6. Connect the shared Vue client to the Electron renderer and Capacitor entry points.
7. Complete production Compose configuration, reverse proxy, TLS, migrations, and backup workflows.

Android/iOS directories will be generated with the Capacitor CLI. Native iOS builds and signing require macOS/Xcode. Native packaging runs separately from the PostgreSQL/web/API Compose workflow.

## When will Dockerfiles be added?

Compose describes how services run; a Dockerfile describes how an application image is built. The existing PostgreSQL service uses the prebuilt `postgres:18-alpine` image and does not need a custom Dockerfile. Web/API source code, dependencies, and startup commands do not exist yet. Their Dockerfiles will be added alongside the initial application setup so that development can use Compose from the first runnable web/API version.

## Scaffold checks

Validate the current Compose configuration without creating a local environment file or starting containers:

```sh
docker compose --env-file .env.example config --quiet
```

Check Git whitespace errors with `git diff --check`. Application tests and build checks become available when the relevant tools, source code, and scripts are introduced.
