#!/usr/bin/env sh
set -eu
if [ "$#" -ne 1 ]; then echo "Usage: ./restore.sh backups/file.dump" >&2; exit 1; fi
set -a
. ./.env
set +a
cat "$1" | docker compose exec -T postgres pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"
echo "Restore completed."
