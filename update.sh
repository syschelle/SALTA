#!/usr/bin/env sh
set -eu

git pull --ff-only
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f
docker compose ps
