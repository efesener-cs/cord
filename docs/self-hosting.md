# Self-hosting

This repository provides a loopback development stack and a standalone self-hosting stack. The new communication/media implementation is not yet verified; run the handoff in [verification.md](verification.md).

## Local stack

```sh
docker compose --env-file .env.example up -d --build --wait web api media
```

Caddy serves the bundled client at `http://localhost:8081`, proxies HTTP/Socket.IO `/api` paths to Express, and provides SPA fallback. API and PostgreSQL host bindings are loopback ports 3001 and 5433. The `migrate` service applies committed migrations before API starts. Development defaults are `cord` database/user/password; use them only locally. Existing PostgreSQL initialization values do not change credentials on an existing volume.

`postgres-data` holds PostgreSQL 18 data at `/var/lib/postgresql`; `uploads-data` holds private uploaded files. Preserve both. `docker compose down` retains volumes; do not use `down -v` for an upgrade.

LiveKit signaling is loopback port 7880, ICE TCP 7881, and UDP mux 7882. `infra/media/livekit.local.yaml` advertises loopback, so it is for clients on the same machine. `LIVEKIT_URL` is the URL returned to clients; `LIVEKIT_INTERNAL_URL` is server-only administration access. The API/LiveKit keypair must match. Local placeholder media keys in `.env.example` must be replaced before sharing a deployment.

For source-watched API/Vite:

```sh
docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml up --build api web-dev media
```

Vite runs at port 5173. Both Vite adapters proxy WebSocket upgrades. Rebuild after dependency/migration changes. Root host commands use `.env` and `127.0.0.1:5433`; containers use `postgres:5432`. Never expose database credentials through a Vite variable.

## Standalone self-hosting stack

`compose.self-host.yaml` is a separate file, not a merge override. It publishes web HTTPS and media ICE/TURN ports, without API/database development host ports.

Create `.env.production` outside Git. Supply real `CORD_DOMAIN` and `MEDIA_DOMAIN` DNS names; both must resolve to the host. Supply `POSTGRES_DB`, `POSTGRES_USER`, a strong URL-safe `POSTGRES_PASSWORD`, and a distinct `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` (at least 32 characters). `API_ALLOWED_ORIGINS` must list only native origins you intentionally support; add `null` only if the packaged desktop file renderer is supported. Browser API calls remain same-origin and use the exact HTTPS `API_WEB_ORIGINS` configured by Compose.

```sh
docker compose --env-file .env.production -f compose.self-host.yaml up -d --build
```

Caddy terminates HTTPS for both domains and persists certificates in `caddy-data`/`caddy-config`. The app domain proxies `/api` including Socket.IO; the media domain proxies LiveKit signaling. Secure host-only cookies are enabled. Allow inbound 80/443 TCP, optional 443 UDP for HTTP/3, media 7881 TCP and 7882 UDP, and TURN 3478 UDP. Configure NAT port forwarding/public IP discovery appropriately. The self-host media configuration includes embedded UDP TURN. Networks permitting only TURN/TLS on 443 need a dedicated TURN domain/IP/certificate configuration; the included stack does not claim that network restriction is solved by HTTP reverse proxying.

The API is one instance; rate limits, Socket.IO presence, and typing are process-local. A distributed deployment would require a shared adapter and reviewed proxy policy. Uploads are private local-volume files, not public static assets. Consider operator quotas, malware scanning, and retention requirements for your deployment. No secret manager, automatic updates, or public runtime validation is implied.

## Backups and restoration

`pnpm backup [directory]` uses `.env` and `compose.yaml` by default. It stops API writers, creates a custom-format PostgreSQL dump and an uploads archive with restrictive local permissions, then restarts the API. Set `CORD_ENV_FILE=.env.production` and `CORD_COMPOSE_FILE=compose.self-host.yaml` for self-hosting.

```sh
CORD_ENV_FILE=.env.production CORD_COMPOSE_FILE=compose.self-host.yaml pnpm backup
```

Store environment/secrets and certificate/operator configuration separately in protected storage. Test restores on a disposable stack before relying on backups.

`pnpm restore <directory>` refuses to replace current data unless `CORD_CONFIRM_RESTORE=REPLACE_CURRENT_DATA` is explicitly set. Restoration stops the API, replaces database contents and uploaded files, then starts it only after success. Failed restoration leaves the API stopped. This is destructive; take a separate current backup first. These scripts have not been executed for this slice.

## Media references

[LiveKit deployment](https://docs.livekit.io/transport/self-hosting/deployment/), [ports/firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/), and [pinned server configuration](https://github.com/livekit/livekit/blob/v1.13.11/config-sample.yaml) describe the separate signaling and media-plane requirements. Image `livekit/livekit-server:v1.13.11` is pinned to a published release; an image pull/runtime check remains part of user verification.

## Optional Android FCM delivery

The default stack remains usable without external push. For background/killed-app Android delivery, supply the private client/provider configuration described in [native-clients.md](native-clients.md). Set `PUSH_CREDENTIALS_FILE` to the external server service-account JSON and merge `compose.push.yaml` with the selected stack:

```sh
docker compose --env-file .env.production -f compose.self-host.yaml -f compose.push.yaml up -d --build
```

The override enables push and mounts credentials read-only; no credentials are committed. Provider project setup, policies, availability, and actual device delivery are operator verification tasks. The optional provider does not make local self-hosting dependent on Firebase.
