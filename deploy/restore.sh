#!/bin/sh
# Restore a backup into the running database. DESTROYS the current data — for disasters
# and for the restore drill in docs/DEPLOYMENT.md.
#
#   cd deploy && sh restore.sh backups/shop-2026-10-12-2100.dump
set -eu
dump="${1:?usage: sh restore.sh backups/<file>.dump}"
[ -f "$dump" ] || { echo "no such file: $dump"; exit 1; }

printf 'This replaces ALL shop data with %s. Type RESTORE to continue: ' "$dump"
read -r answer
[ "$answer" = "RESTORE" ] || { echo "cancelled"; exit 1; }

docker compose stop api
docker compose exec -T db pg_restore --clean --if-exists --no-owner -U shop -d shop < "$dump"
docker compose start api
echo "restored $dump; the API is back up"
