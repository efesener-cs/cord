#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
backup_env=${CORD_ENV_FILE:-.env}
backup_compose=${CORD_COMPOSE_FILE:-compose.yaml}
backup_directory=${1:-backups/$(date -u +%Y%m%dT%H%M%SZ)}
mkdir -p "$backup_directory"
backup_directory=$(realpath "$backup_directory")
# Stop writers for a consistent database/files snapshot; retain the database volume.
docker compose --env-file "$backup_env" -f "$backup_compose" stop api
trap 'docker compose --env-file "$backup_env" -f "$backup_compose" start api' EXIT
docker compose --env-file "$backup_env" -f "$backup_compose" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_directory/database.dump"
docker compose --env-file "$backup_env" -f "$backup_compose" run --rm -T --no-deps --entrypoint tar api -C /app/data/uploads -czf - . > "$backup_directory/uploads.tar.gz"
printf '%s\n' "Cord backup created at $backup_directory" "Store operator environment/secrets separately. A backup is not verified until restored."
