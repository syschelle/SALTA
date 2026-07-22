#!/usr/bin/env sh
set -eu

random_hex_32() {
  openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
}

read_env_value() {
  key="$1"
  sed -n "s/^${key}=//p" .env | tail -n 1
}

if [ ! -f .env ]; then
  echo ".env is missing. Run ./deploy.sh first." >&2
  exit 1
fi

admin_password="$(read_env_value ADMIN_PASSWORD)"
if [ "${#admin_password}" -lt 16 ] || printf '%s' "$admin_password" | grep -Eiq 'change[_-]?me|change-this|example'; then
  echo "ADMIN_PASSWORD in .env must be replaced with a non-placeholder value of at least 16 characters before updating." >&2
  exit 1
fi

health_token="$(read_env_value SALTA_HEALTH_TOKEN)"
if [ "${#health_token}" -lt 32 ] || printf '%s' "$health_token" | grep -Eiq 'change[_-]?me|change-this|example'; then
  sed -i '/^SALTA_HEALTH_TOKEN=/d' .env
  printf '\nSALTA_HEALTH_TOKEN=%s\n' "$(random_hex_32)" >> .env
  echo "Added a generated SALTA_HEALTH_TOKEN to .env."
fi

if ! grep -q '^SALTA_BIND_ADDRESS=' .env; then
  printf 'SALTA_BIND_ADDRESS=127.0.0.1\n' >> .env
fi

if ! grep -q '^TRUSTED_PROXIES=' .env; then
  printf 'TRUSTED_PROXIES=\n' >> .env
fi

chmod 600 .env

git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker image prune -f
docker compose -f docker-compose.yml -f docker-compose.image.yml ps
