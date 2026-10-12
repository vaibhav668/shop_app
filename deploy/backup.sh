#!/bin/sh
# Nightly database backup (runs inside the "backup" container).
# Writes /backups/shop-YYYY-MM-DD-HHMM.dump (pg_dump custom format) once a day at about 02:30
# shop time, and deletes dumps older than KEEP_DAYS. Copy deploy/backups/ off the server
# regularly (see docs/DEPLOYMENT.md) — a backup on the same disk is not a backup.
set -eu
KEEP_DAYS="${KEEP_DAYS:-14}"

backup() {
  stamp=$(date -u +%Y-%m-%d-%H%M)
  file="/backups/shop-$stamp.dump"
  echo "backup: writing $file"
  pg_dump --format=custom --no-owner --file="$file.partial"
  mv "$file.partial" "$file"
  find /backups -name 'shop-*.dump' -mtime +"$KEEP_DAYS" -delete
  echo "backup: done ($(du -h "$file" | cut -f1))"
}

# One backup at start-up, so a fresh server has one immediately.
backup
while true; do
  # 21:00 UTC is 02:30 IST.
  now=$(date -u +%s)
  next=$(date -u -d "$(date -u +%Y-%m-%d) 21:00" +%s 2>/dev/null || echo $((now + 86400)))
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  backup || echo "backup: FAILED"
done
