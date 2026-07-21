#!/usr/bin/env sh
set -eu

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker was not found. Install Docker Engine with the Compose plugin first." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "The Docker Compose plugin was not found." >&2
  exit 1
fi

if [ ! -f .env ]; then
  db_password="$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  admin_password="$(openssl rand -base64 24 2>/dev/null | tr -d '/+=' | cut -c1-24 || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-24)"
  encryption_key="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  sed \
    -e "0,/POSTGRES_PASSWORD=CHANGE_ME/s//POSTGRES_PASSWORD=${db_password}/" \
    -e "0,/ADMIN_PASSWORD=CHANGE_ME/s//ADMIN_PASSWORD=${admin_password}/" \
    -e "0,/SALTA_ENCRYPTION_KEY=CHANGE_ME_TO_A_LONG_RANDOM_SECRET/s//SALTA_ENCRYPTION_KEY=${encryption_key}/" \
    .env.example > .env
  chmod 600 .env
  echo "Created .env with generated credentials."
  echo "Web login: admin / ${admin_password}"
  echo
  echo "Review .env, then run ./deploy.sh again."
  exit 0
fi

docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --remove-orphans

echo
echo "SALTA is starting."
echo "Open: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo localhost):$(grep '^WEB_PORT=' .env | cut -d= -f2)"
echo "Status: docker compose -f docker-compose.yml -f docker-compose.image.yml ps"
echo "Logs:   docker compose -f docker-compose.yml -f docker-compose.image.yml logs -f salta"
