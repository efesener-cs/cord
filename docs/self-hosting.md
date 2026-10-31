# Self-hosting target

## Bundled frontend preview

The base `compose.yaml` provides separate `web` (Caddy), `api` (Express), and development PostgreSQL services. This is a local preview of the frontend, not a complete deployable communication service; the API currently implements liveness and shared HTTP middleware only; authentication and persistent messaging are deferred.

```sh
cp .env.example .env # Only when a local .env does not already exist.
docker compose up -d --build --wait web postgres
```

Open http://localhost:8081. `WEB_PORT` changes the host port. Caddy listens on port 80 inside its container. The web service starts the API dependency but is independent of PostgreSQL and can be started with `docker compose up -d --build --wait web`.

`infra/docker/web.Dockerfile` uses a pinned Node/pnpm build stage and a Caddy 2.11.7 Alpine runtime stage. Only `apps/web/dist` and `infra/proxy/Caddyfile` enter the runtime; it does not run Node, Vite, or a package installer. There are no source bind mounts in this service. Rebuild after changing the frontend or Caddy configuration.

Caddy proxies `/api` and `/api/*` to `api:3000` without stripping the versioned path. Unknown API endpoints return backend JSON errors rather than the frontend document. The API is also mapped to host loopback port `API_PORT` (default 3001); see [api.md](api.md). Caddy provides compression, an HTTP health endpoint at `/healthz`, HTML5-history fallback for direct links such as `/dashboard`, non-cached HTML, and immutable caching for hashed `/assets/` files. Missing assets return 404 instead of the SPA document. `/healthz` only checks the static web server; it says nothing about database or future API health.

The local preview intentionally uses HTTP on a loopback-only binding. It does not issue certificates or expose a public listener. Caddy was chosen for its concise SPA/static configuration and automatic certificate management when a domain-based deployment is introduced. Nginx can also serve the same bundle; no performance comparison is implied.

## Development server

The optional `compose.dev.yaml` adds a separate `web-dev` service at http://localhost:5173 with hot-reload source mounts and switches the same `api` service to watched development sources:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up -d --build web-dev
```

The bundled `web` service and Vite `web-dev` service can run together on different ports. Use `--env-file .env.example` before the Compose command when you want the documented example values without a real `.env`.

## Database addresses and credentials

Development defaults are database `cord`, user `cord`, password `cord`, and host port `5433`. The PostgreSQL container still listens on its standard port `5432`. The host mapping avoids a host-installed PostgreSQL server on port 5432.

| Client location | Address | Example connection URL |
| --- | --- | --- |
| Host machine | `127.0.0.1:5433` | `postgresql://cord:cord@127.0.0.1:5433/cord` |
| Future API on the Compose network | `postgres:5432` | `postgresql://cord:cord@postgres:5432/cord` |

Compose uses service names for internal DNS. `localhost` inside a container refers to that container, not the host or another service. Port publishing is `host-port:container-port`; changing `POSTGRES_PORT` changes only the host binding.

There is no implicit database URL. The current `.env` contains initialization values and port bindings; the API foundation does not consume a `DATABASE_URL` or connect to PostgreSQL yet. The frontend is static and must never receive database credentials. Add a server-only connection URL when implementing the API.

The development password is a temporary local placeholder. PostgreSQL initialization environment variables only create credentials on a fresh data volume; changing `.env` does not alter an existing database user's password. Keep volumes intact and explicitly migrate credentials when needed. `docker compose down` preserves `postgres-data`; never use `down -v` unless deletion is explicitly requested.

## Future production deployment

A public deployment will need a separate configuration without development database host ports, a real domain and reachable HTTP/HTTPS ports, persistent Caddy certificate storage, strong operator-managed secrets, authenticated API features and WebSocket routing, database migrations, and backups with verified restores. Do not treat the current HTTP preview as that completed deployment.

The PostgreSQL 18 image mounts its volume at `/var/lib/postgresql`. Major version upgrades require a data migration; changing only the image tag is insufficient. Pin production images by reviewed versions/digests during deployment preparation.

Electron and Capacitor development shells reuse the shared client with bundled assets and hash routing; see [native-clients.md](native-clients.md). They currently show only the local UI preview. A configurable API address and real network integration are future work. TURN/SFU services and required UDP ports will be documented when voice/video features are added.

References: [Caddy SPA patterns](https://caddyserver.com/docs/caddyfile/patterns#single-page-apps-spas), [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Nginx try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files), and [PostgreSQL Docker image](https://hub.docker.com/_/postgres).
