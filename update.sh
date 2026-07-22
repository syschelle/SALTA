#!/usr/bin/env sh
set -eu

if [ ! -f .env ]; then
  echo ".env is missing. Run ./install.sh first." >&2
  exit 1
fi

compose() {
  docker compose --env-file .env -f docker-compose.yml -f docker-compose.image.yml "$@"
}

compose config >/dev/null
git pull --ff-only
compose pull
compose up -d --force-recreate --remove-orphans
docker image prune -f
compose ps
