#!/bin/sh
set -eu
DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"
umask 077
if [ ! -f "$DATA_DIR/master.key" ]; then
  head -c 32 /dev/urandom > "$DATA_DIR/master.key"
fi
chmod 600 "$DATA_DIR/master.key"
if [ -z "${DATABASE_URL:-}" ]; then
  i=0
  while [ ! -s "$DATA_DIR/db-password" ] && [ "$i" -lt 60 ]; do
    i=$((i + 1))
    sleep 0.5
  done
  if [ ! -s "$DATA_DIR/db-password" ]; then
    echo "database password was not created" >&2
    exit 1
  fi
  password=$(cat "$DATA_DIR/db-password")
  host="${DB_HOST:-db}"
  export DATABASE_URL="postgres://harbor:${password}@${host}:5432/harbor"
fi
chown -R node:node "$DATA_DIR"
exec su-exec node node /app/server.js
