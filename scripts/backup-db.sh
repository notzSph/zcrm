#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${1:-$repo_dir/backups}"
mkdir -p "$output_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_file="$output_dir/zcrm-$timestamp.dump"

cd "$repo_dir"
docker compose --env-file infra/.env -f infra/docker-compose.yml exec -T postgres \
  sh -lc 'pg_dump --format=custom --no-owner --file=- "$POSTGRES_DB"' > "$output_file"
chmod 600 "$output_file"
echo "Created $output_file"
