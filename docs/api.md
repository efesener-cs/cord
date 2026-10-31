# Account API

The backend is an Express 5/TypeScript modular monolith with PostgreSQL and Prisma 7.10.1. It implements account registration, login, logout, and current-user lookup. Messages, servers/channels, uploads, and Socket.IO remain local previews or future features.

## URLs and ports

| Service | Host address | Compose-network address |
| --- | --- | --- |
| Bundled frontend/Caddy | `http://localhost:8081` | `web:80` |
| Vite frontend | `http://localhost:5173` | `web-dev:5173` |
| API | `http://127.0.0.1:3001` | `api:3000` |
| PostgreSQL | `127.0.0.1:5433` | `postgres:5432` |

Caddy and Vite forward `/api` without removing its prefix. Web requests use the current origin. Frontend pages such as `/dashboard` remain separate from `/api/v1/...`; unknown API paths always return JSON errors, never SPA HTML.

## Implemented endpoints

All paths below start with `/api/v1`. Request and response validation schemas live in `packages/contracts`.

| Method | Path | Successful response | Authentication |
| --- | --- | --- | --- |
| GET | `/health` | 200 `{ status, service, apiVersion, uptimeSeconds }` | None |
| POST | `/auth/register` | 201 `{ user: { id, username } }` | None |
| POST | `/auth/login` | 200 `{ user: { id, username }, token, expiresAt }` | None |
| POST | `/auth/logout` | 204, empty body | Bearer token syntax required; revocation is idempotent |
| GET | `/users/me` | 200 `{ user: { id, username } }` | Valid, unexpired Bearer session |

Registration body:

```json
{
  "username": "deniz",
  "email": "deniz@example.test",
  "password": "a-long-example-password"
}
```

Login accepts `username` and `password`. Usernames are trimmed, lowercased, and restricted to 3–32 ASCII letters/digits/underscores/dots/hyphens, beginning with a letter or digit. Email is validated and lowercased, with a maximum of 254 characters. Passwords are not trimmed and must contain 12–128 characters at registration. Login accepts 1–128 password characters. Unknown body fields are rejected. Registration does not automatically log in; the UI shows success on the login page. Email verification and password reset are not implemented.

Send `Authorization: Bearer <token>` on protected requests. Public user responses intentionally omit email and password hashes.

## Sessions and request protections

- Passwords use asynchronous Node `scrypt` with a random 16-byte salt, `N=131072`, `r=8`, `p=1`, and timing-safe hash comparison. Unknown usernames perform the same expensive hash operation. At most two hash operations run concurrently; excess requests return 503 instead of building an unbounded queue.
- Login issues a cryptographically random 32-byte opaque token. Only its SHA-256 digest is stored in PostgreSQL, together with its user and 24-hour expiry. Logout deletes the corresponding session; expired sessions cannot authenticate. Login removes expired sessions for that user. Global expiry cleanup and session management UI remain future work.
- The shared SDK attaches the token explicitly and uses `credentials: 'omit'`; no auth cookies are created. The Pinia store holds the token only in memory, never localStorage/sessionStorage. Reloading or restarting requires login again; any unreachable server session expires within 24 hours.
- Dashboard navigation calls `/users/me`; unauthenticated/invalid sessions go to login. This frontend check is not server authorization: `/users/me` independently validates the token. Local demo messages remain separate from real accounts.
- Both account-creation and login requests share a per-IP, in-memory limit of 30 requests per 15 minutes. It resets on API restart and is not a distributed protection. Proxy headers are not trusted: through Caddy the limit is conservatively shared by clients at that proxy address. A reviewed trusted-proxy policy is needed before public deployment.
- `API_ALLOWED_ORIGINS` is an explicit comma-separated CORS allowlist; no wildcard or credentialed CORS is enabled. Local Compose defaults to `null` solely for Electron's `file://` preview. This permits the origin class, not a particular file, and is not authentication. For same-origin public web hosting set it to an empty value; configure exact HTTPS native origins as needed.
- Use HTTPS outside the loopback development environment. Bearer tokens must not appear in URLs or logs. Persistent native credential storage is not implemented.

Responses include a fresh `X-Request-Id` and `Cache-Control: no-store`. JSON bodies are limited to 16 KiB. Helmet adds baseline headers. Request logging includes ID, method, status, and elapsed time; it omits request bodies, credentials, tokens, cookies, and query strings.

Errors use `{ "error": { "code", "message", "requestId" } }`:

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` / `INVALID_JSON` | Invalid fields / malformed JSON |
| 401 | `INVALID_CREDENTIALS` / `UNAUTHORIZED` | Incorrect login / missing, invalid, or expired session |
| 404 | `NOT_FOUND` | Unknown endpoint |
| 409 | `ACCOUNT_EXISTS` | Duplicate username or email |
| 413 | `PAYLOAD_TOO_LARGE` | Body exceeds 16 KiB |
| 429 | `RATE_LIMITED` | Account attempt limit reached |
| 503 | `SERVICE_BUSY` | Password-hashing concurrency limit reached |
| 500 | `INTERNAL_ERROR` | Redacted unexpected failure |

`GET /health` is process liveness, not an ongoing database readiness check. Startup connects to PostgreSQL first; Caddy's `/healthz` independently checks static web serving.

## Database and migrations

`packages/database` owns the Prisma schema, generated client boundary, and migrations. Only server code imports it. `User` has unique normalized username/email and a password hash; `Session` has a unique token digest, user foreign key, creation/expiry times, and lookup/expiry indexes. Deleting a user cascades sessions. The generated client and build outputs are ignored; commit schema and migration files.

Prisma 7.10.1 is pinned consistently for CLI/client/adapter, avoiding the registry's Prisma 8 release candidate. Configuration is in `packages/database/prisma7.config.ts`; Prisma commands explicitly select it. Its URL is taken from the process environment or root `.env`, with the documented local `cord` fallback. The API requires `DATABASE_URL`; host-run commands load root `.env` without overriding explicit environment values.

```sh
cp .env.example .env # only if no real .env exists
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm api:dev
```

The database must be running before the last two commands. Root `.env` uses host URL `postgresql://cord:cord@127.0.0.1:5433/cord`; Compose constructs its internal URL from `POSTGRES_*` values and `postgres:5432`. URL-encode special characters in credentials used inside connection URLs. Production secret delivery remains deployment work.

`pnpm db:migrate` applies committed migrations with `prisma migrate deploy`; it never resets the database. For a new schema change use `pnpm db:migrate:dev --name <description>` against an appropriate development database. Do not accept a reset against valuable data. Existing volumes are preserved.

## Containers

```sh
docker compose --env-file .env.example up -d --build --wait api web
```

Compose starts healthy PostgreSQL, runs the one-shot `migrate` service, then starts the API and Caddy. The migration image includes Prisma CLI tooling; the API runtime contains production dependencies and compiled API/contracts/database code and runs as non-root `node`. Existing database credentials must match the persistent volume; changing initialization variables does not change an existing user's password.

For watched API sources and Vite:

```sh
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml up -d --build api web-dev
```

The override mounts API/contracts/database sources, starts Node watch mode, and keeps API port 3001 distinct from Vite 5173. Rebuild after dependency or migration changes; restart the API after data-access package changes because its compiled dependency is built at startup. Return to compiled runtime with the base Compose command.

Electron's local renderer defaults to `http://127.0.0.1:3001`; `VITE_API_URL` at desktop build time selects an HTTP(S) origin and updates its CSP allowlist. The mobile browser preview uses its Vite `/api` proxy on port 5175. Native Capacitor builds require a reachable `VITE_API_URL`, appropriate server CORS, and platform networking/TLS configuration; native auth runtime has not been validated. Never set a frontend variable to a database URL.

## Tests

`apps/api/test/auth.integration.test.ts` contains eight PostgreSQL-backed HTTP tests: validation, normalized/hashed registration, uniqueness, invalid credentials, current-user lookup and token storage, revocation, expiry, rate limiting, and CORS. Supply a dedicated migrated test database; the tests remove only their randomly named test user and cascade its sessions. Do not point them at production. Without `TEST_DATABASE_URL` the integration suite is explicitly skipped, not evidence of a passing database run.

```sh
DATABASE_URL=postgresql://cord:cord@127.0.0.1:5433/cord_test pnpm db:migrate
TEST_DATABASE_URL=postgresql://cord:cord@127.0.0.1:5433/cord_test pnpm api:test
```

Create that dedicated database first. `pnpm api:test` builds database/contracts before running Vitest through Vite+. Additional foundation/security coverage remains open, including proxy policies and real native/browser verification.

## Deferred endpoint slices

These routes are proposed, not implemented:

| Methods | Path after `/api/v1` | Intended behavior |
| --- | --- | --- |
| GET / POST | `/servers` | List joined servers / create a server |
| GET / POST | `/servers/:serverId/channels` | List visible channels / create a permitted channel |
| GET / POST | `/channels/:channelId/messages` | Read paginated history / persist a message |
| GET / POST | `/conversations` | List DMs / find or create a permitted conversation |
| GET / POST | `/conversations/:conversationId/messages` | Read DM history / persist a DM |

Membership authorization, persistence, pagination, and contracts precede Socket.IO delivery. Uploads, invitations, friends, and notification synchronization follow their feature slices. HTTP and event handlers share business services; media transport remains separate.

References: [Prisma 7 PostgreSQL setup](https://www.prisma.io/docs/v7/prisma-orm/quickstart/postgresql), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
