# Self-hosting target

The current `compose.yaml` runs only a development PostgreSQL service. The optional `compose.dev.yaml` adds the runnable Vue frontend using `infra/docker/web.Dockerfile`, hot-reload source mounts, and a loopback-only port 5173. Start it with `docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml up --build web`. This is a development preview with demo data; a deployable communication application is not available yet.

Once the applications are implemented, the deployment target is static web assets and an API behind a reverse proxy, PostgreSQL accessible only on the internal network, and persistent database/file volumes. Production settings will use a separate Compose configuration without development port bindings or source mounts.

The deployment workflow will include TLS, WebSocket proxy support, operator-provided strong secrets, database migrations, and backups with verified restores. The password in `.env.example` is for local development only.

The PostgreSQL 18 image mounts its volume at `/var/lib/postgresql`. Major version upgrades require a data migration; changing only the image tag is insufficient. Production image versions/digests will be pinned during deployment setup.

Electron and Capacitor development shells now reuse the shared client with bundled assets and hash routing; see [native-clients.md](native-clients.md). They currently show only the local UI preview. A configurable self-hosted API address and real network integration are still future work. TURN/SFU services and required UDP ports will be documented when voice/video features are added.

Reference: [Official PostgreSQL Docker image](https://hub.docker.com/_/postgres).
