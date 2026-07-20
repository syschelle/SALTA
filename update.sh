#!/usr/bin/env sh
set -eu
git pull --ff-only
docker compose up -d --build --remove-orphans
docker image prune -f
docker compose ps
