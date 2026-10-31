# API foundation

The API is a separate Express 5/TypeScript application and Docker service. It is the first backend slice, not an authentication or messaging implementation. PostgreSQL connectivity, accounts, authorization, business resources, and Socket.IO are still deferred.

## URLs and ports

| Service | Host address | Compose-network address |
| --- | --- | --- |
| Bundled frontend/Caddy | `http://localhost:8081` | `web:80` |
| Vite frontend | `http://localhost:5173` | `web-dev:5173` when running the development override |
| API | `http://127.0.0.1:3001` | `api:3000` |
| PostgreSQL | `127.0.0.1:5433` | `postgres:5432` |

Frontend pages use URLs such as `/dashboard`. Every API endpoint belongs under `/api/v1/`; prefer resource names such as `/api/v1/users` or `/api/v1/channels` when those features are implemented, rather than duplicating screen names. API versioning concerns the HTTP contract, not the frontend page URL.

Caddy and Vite forward `/api` paths to the API without removing the prefix. Examples:

- Browser on Caddy: `fetch('/api/v1/health')` reaches `api:3000/api/v1/health`.
- Browser on Vite: the same relative request uses the Vite proxy.
- Direct API check: `http://127.0.0.1:3001/api/v1/health`.
- `/dashboard` returns the frontend document; `/api/v1/dashboard` returns a JSON 404 until an actual endpoint exists.

There is no reason to put the frontend and API listeners on the same host port. Caddy exposes a single browser-facing origin while proxying to different containers. API routes, including errors and unknown versions, must never fall through to SPA HTML.

## Implemented endpoint

`GET /api/v1/health` returns status 200 and JSON:

```json
{
  "status": "ok",
  "service": "cord-api",
  "apiVersion": "v1",
  "uptimeSeconds": 42
}
```

This is process liveness only. It does not check PostgreSQL, authenticate a user, or certify readiness for real communication. Caddy's `/healthz` separately checks the static web server.

Responses include a server-generated `X-Request-Id` and `Cache-Control: no-store`. Unknown API endpoints return 404:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "API endpoint not found.",
    "requestId": "server-generated-uuid"
  }
}
```

The versioned router accepts JSON bodies up to 16 KiB. Malformed JSON returns 400 (`INVALID_JSON`); an oversized JSON body returns 413 (`PAYLOAD_TOO_LARGE`). Unexpected errors return a generic 500 (`INTERNAL_ERROR`) without stack traces. Request logs contain ID, method, status, and elapsed time, not bodies, cookies, credentials, or query strings. Helmet adds baseline HTTP headers; this is not a completed security review.

## Run with Docker

```sh
docker compose --env-file .env.example up -d --build --wait api web
```

`web` depends on a healthy API. The API does not depend on PostgreSQL yet. `API_PORT` controls the loopback-only host mapping (default 3001); the container listens on 3000. Existing database volumes are not changed by this setup.

For watched TypeScript sources and Vite hot reload:

```sh
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml up -d --build api web-dev
```

The override switches the same `api` service to its development target, mounts API/contracts sources, and uses Node's watch mode. It does not create another API listener. `web-dev` uses `API_PROXY_TARGET=http://api:3000`. You can keep the bundled Caddy service running; to return the API to its compiled runtime target, run `docker compose up -d --build --wait api web` with the base Compose file again. The development override uses the separate image tag `cord-api-dev`, so it does not replace the compiled runtime image tag.

The API Dockerfile builds contracts and server JavaScript in a build stage. The runtime installs only production dependencies, runs as the Node image's non-root `node` user, and starts compiled JavaScript. Development tooling and sources are not needed in the runtime.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm api:dev
```

Without environment overrides, the local server binds `127.0.0.1:3001`. Node 24 executes the erasable TypeScript directly in watch mode; `pnpm api:build` compiles it to `apps/api/dist`. Imports use `.ts` in source and are rewritten to `.js` by the TypeScript build. Shared response contracts compile to `packages/contracts/dist` first.

Configuration is read from the process environment; the local API command does not silently load the repository's `.env`. Compose passes its container environment explicitly. `PORT` must be an integer from 1 to 65535, `HOST` must be nonempty without surrounding whitespace, and `NODE_ENV` must be `development`, `test`, or `production`. Bad configuration fails before a listener starts.

For a compiled local process:

```sh
pnpm api:build
pnpm --filter @cord/api start
```

Vite's local proxy defaults to `http://127.0.0.1:3001`; set `API_PROXY_TARGET` in the Vite process environment if using another backend address. This is a server-side Vite setting, not a client-exposed `VITE_` secret. No permissive CORS configuration is added: browser development uses the same-origin proxy. Native clients will need a separately reviewed API origin/network policy when they begin calling the backend.

## Structure and tests

`src/server.ts` owns the HTTP listener, timeouts, startup errors, and graceful shutdown. `src/app.ts` exports `createApp()` without starting a socket. `src/config` validates runtime configuration; `src/common` holds request/error middleware; feature modules own their router and service. `packages/contracts` contains public response types only. Incoming business payload validation will be implemented with actual features; no ORM or runtime-schema library is selected by this foundation.

Vitest is supplied by the existing Vite+ toolchain. `apps/api/vite.config.ts` selects the Node environment and `test/**/*.test.ts`. Use:

```sh
pnpm api:test
pnpm --filter @cord/api test:watch
```

The user is handling test cases; none are included yet. A no-test-files exit is not a passing suite, and `passWithNoTests` is intentionally not enabled. See `apps/api/test/README.md` for entry points and suggested first cases. Comprehensive security tests follow the actual auth/authorization features; health smoke checks are not a substitute for them.

Validation commands:

```sh
pnpm api:build
pnpm typecheck
pnpm build
docker compose --env-file .env.example config --quiet
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml config --quiet
git diff --check
```

For manual checks, request the health URL directly and through Caddy/Vite. Verify that `/dashboard` is HTML, `/api/v1/dashboard` is JSON 404, invalid JSON is 400, large JSON is 413, and request IDs are freshly generated. Test shutdown independently of frontend behavior.
