#!/usr/bin/env sh
set -eu
mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
set -a
. ./.env
set +a
docker compose -f docker-compose.yml -f docker-compose.image.yml exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backups/salta-${stamp}.dump"
echo "Backup written to backups/salta-${stamp}.dump"
