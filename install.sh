#!/usr/bin/env sh
set -eu

compose() {
  docker compose --env-file .env -f docker-compose.yml -f docker-compose.image.yml "$@"
}

postgres_volume_name() {
  docker inspect salta-postgres \
    --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' \
    2>/dev/null || true
}

random_hex() {
  bytes="$1"
  openssl rand -hex "$bytes" 2>/dev/null || head -c "$bytes" /dev/urandom | od -An -tx1 | tr -d ' \n'
}

random_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '/+=' | cut -c1-24
  else
    random_hex 16
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker was not found. Install Docker Engine with the Compose plugin first." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "The Docker Compose plugin was not found." >&2
  exit 1
fi

reset_data=false
new_secrets=false
case "${1:-}" in
  "") ;;
  --reset) reset_data=true ;;
  --fresh) reset_data=true; new_secrets=true ;;
  *)
    echo "Usage: ./install.sh [--reset|--fresh]" >&2
    exit 1
    ;;
esac

if [ "$reset_data" = true ]; then
  attached_volume="$(postgres_volume_name)"
  docker rm -f salta salta-postgres 2>/dev/null || true
  if [ -n "$attached_volume" ]; then
    docker volume rm "$attached_volume" 2>/dev/null || true
  fi
  docker volume rm salta_salta_postgres_data 2>/dev/null || true
  docker network rm salta_frontend salta_backend 2>/dev/null || true
  echo "Removed the existing SALTA containers, PostgreSQL volume and application networks."
fi
if [ "$new_secrets" = true ]; then
  rm -f .env
  echo "Removed the previous SALTA environment file. New secrets will be generated."
fi

created_env=false
if [ ! -f .env ]; then
  db_password="$(random_hex 24)"
  admin_password="$(random_password)"
  encryption_key="$(random_hex 32)"
  health_token="$(random_hex 32)"
  sed \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${db_password}|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${admin_password}|" \
    -e "s|^SALTA_ENCRYPTION_KEY=.*|SALTA_ENCRYPTION_KEY=${encryption_key}|" \
    -e "s|^SALTA_HEALTH_TOKEN=.*|SALTA_HEALTH_TOKEN=${health_token}|" \
    .env.example > .env
  chmod 600 .env
  created_env=true
fi

attached_volume="$(postgres_volume_name)"
database_volume="${attached_volume:-salta_salta_postgres_data}"
existing_schema_label="$(docker volume inspect "$database_volume" --format '{{ index .Labels "com.syschelle.salta.schema" }}' 2>/dev/null || true)"
if [ -n "$existing_schema_label" ] && [ "$existing_schema_label" != "0.5" ]; then
  echo "An incompatible SALTA PostgreSQL volume was detected." >&2
  echo "Run './install.sh --fresh' to delete the old installation and generate new secrets." >&2
  exit 1
fi
if docker volume inspect "$database_volume" >/dev/null 2>&1 && [ -z "$existing_schema_label" ]; then
  echo "An unversioned legacy SALTA PostgreSQL volume was detected." >&2
  echo "Run './install.sh --fresh' to delete the old installation and generate new secrets." >&2
  exit 1
fi

compose config >/dev/null
compose pull
compose up -d --force-recreate --remove-orphans

echo
echo "SALTA v0.5.2 is starting."
bind_address="$(sed -n 's/^SALTA_BIND_ADDRESS=//p' .env | tail -n1)"
web_port="$(sed -n 's/^WEB_PORT=//p' .env | tail -n1)"
case "$bind_address" in
  0.0.0.0|::)
    display_host="$(hostname -I 2>/dev/null | awk '{print $1}')"
    [ -n "$display_host" ] || display_host="IP-OF-THE-SALTA-HOST"
    ;;
  *) display_host="$bind_address" ;;
esac
echo "Open: http://${display_host}:${web_port}"
echo "Status: docker compose --env-file .env -f docker-compose.yml -f docker-compose.image.yml ps"
echo "Logs:   docker compose --env-file .env -f docker-compose.yml -f docker-compose.image.yml logs -f salta"
if [ "$created_env" = true ]; then
  echo
  echo "Generated administrator login:"
  echo "Username: $(sed -n 's/^ADMIN_USERNAME=//p' .env | tail -n1)"
  echo "Password: ${admin_password}"
  echo "Store this password securely. It is not printed again."
fi
