#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || "$1" == "--help" ]]; then
  echo "Usage: $0 /absolute/path/to/zcrm.dump" >&2
  exit 2
fi
backup_file="$1"
if [[ ! -f "$backup_file" ]]; then
  echo "Backup file not found: $backup_file" >&2
  exit 1
fi
if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Refusing to restore without CONFIRM_RESTORE=yes; this replaces current database data." >&2
  exit 1
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
docker compose --env-file infra/.env -f infra/docker-compose.yml exec -T postgres \
  sh -lc 'pg_restore --clean --if-exists --no-owner --dbname="$POSTGRES_DB"' < "$backup_file"
echo "Restored $backup_file"
