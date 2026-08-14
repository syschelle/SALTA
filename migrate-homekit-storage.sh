#!/usr/bin/env sh
set -eu

CONTAINER_NAME="${SALTA_CONTAINER_NAME:-salta}"
VOLUME_NAME="${SALTA_RUNTIME_VOLUME:-salta_runtime_data}"
LEGACY_PATH="/app/persist"

tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT INT TERM

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "SALTA container '$CONTAINER_NAME' is not running/available; no legacy HomeKit state to migrate."
  exit 0
fi

if ! docker cp "$CONTAINER_NAME:$LEGACY_PATH/." "$tmp_dir/" >/dev/null 2>&1; then
  echo "No legacy HomeKit persistence found at $LEGACY_PATH; migration is not required."
  exit 0
fi

if ! find "$tmp_dir" -type f -print -quit | grep -q .; then
  echo "Legacy HomeKit persistence is empty; migration is not required."
  exit 0
fi

image="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER_NAME")"
uid="$(docker exec "$CONTAINER_NAME" id -u)"
gid="$(docker exec "$CONTAINER_NAME" id -g)"
docker volume create "$VOLUME_NAME" >/dev/null

if docker run --rm --entrypoint sh -v "$VOLUME_NAME:/target" "$image" -c 'find /target/homekit -type f -print -quit 2>/dev/null | grep -q .' >/dev/null 2>&1; then
  echo "Persistent HomeKit storage already contains pairing data; legacy migration is not required."
  exit 0
fi

docker run --rm --user 0:0 --entrypoint sh \
  -v "$tmp_dir:/source:ro" \
  -v "$VOLUME_NAME:/target" \
  "$image" -c "set -eu; mkdir -p /target/homekit /target/runtime; cp -a /source/. /target/homekit/; chown -R $uid:$gid /target"

echo "Migrated legacy HomeKit pairing state into Docker volume '$VOLUME_NAME'."
