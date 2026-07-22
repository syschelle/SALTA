#!/usr/bin/env sh
set -eu

mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
output="backups/salta-${stamp}.dump"

docker compose --env-file .env -f docker-compose.yml -f docker-compose.image.yml \
  exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$output"

echo "Backup written to $output"
