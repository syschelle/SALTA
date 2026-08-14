#!/usr/bin/env sh
set -eu

if [ ! -f .env ]; then
  echo ".env is missing. Run ./install.sh first." >&2
  exit 1
fi

compose() {
  docker compose --env-file .env -f docker-compose.image.yml "$@"
}

git pull --ff-only
compose config >/dev/null
if [ -x ./migrate-homekit-storage.sh ]; then
  ./migrate-homekit-storage.sh
fi
compose pull
compose up -d --force-recreate --remove-orphans
docker image prune -f
compose ps
