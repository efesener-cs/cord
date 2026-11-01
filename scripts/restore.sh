#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
restore_env=${CORD_ENV_FILE:-.env}
restore_compose=${CORD_COMPOSE_FILE:-compose.yaml}
restore_directory=${1:?Pass the backup directory}
if [[ ${CORD_CONFIRM_RESTORE:-} != REPLACE_CURRENT_DATA ]]; then
  printf '%s\n' 'Restore replaces current database and uploaded files. Back up first, then set CORD_CONFIRM_RESTORE=REPLACE_CURRENT_DATA.' >&2
  exit 1
fi
restore_directory=$(realpath "$restore_directory")
[[ -f "$restore_directory/database.dump" && -f "$restore_directory/uploads.tar.gz" ]]
docker compose --env-file "$restore_env" -f "$restore_compose" stop api
# Keep API stopped if restore fails; do not serve an inconsistent database/files pair.
docker compose --env-file "$restore_env" -f "$restore_compose" exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --exit-on-error' < "$restore_directory/database.dump"
docker compose --env-file "$restore_env" -f "$restore_compose" run --rm -T --no-deps --entrypoint sh api -c 'find /app/data/uploads -mindepth 1 -maxdepth 1 -type f -delete; tar -C /app/data/uploads -xzf -' < "$restore_directory/uploads.tar.gz"
docker compose --env-file "$restore_env" -f "$restore_compose" start api
