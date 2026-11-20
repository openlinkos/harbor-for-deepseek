#!/bin/sh
# Smoke-test a running harbor-web container. Usage: smoke.sh [base-url]
set -eu
base="${1:-http://127.0.0.1:8080}"

health="$(curl -fsS "$base/healthz")"
printf '%s' "$health" | grep -q '^ok'

home="$(curl -fsS "$base/")"
printf '%s' "$home" | grep -q 'DeepAPI'
deep="$(curl -fsS "$base/some/deep/route")"
test "$home" = "$deep"

headers="$(curl -fsSI "$base/")"
printf '%s' "$headers" | grep -qi 'content-security-policy:.*api.deepseek.com'
printf '%s' "$headers" | grep -qi 'x-content-type-options: nosniff'
printf '%s' "$headers" | grep -qi 'x-frame-options: DENY'
printf '%s' "$headers" | grep -qi 'referrer-policy: no-referrer'
printf '%s' "$headers" | grep -qi 'cache-control: no-cache'

index_headers="$(curl -fsSI "$base/index.html")"
printf '%s' "$index_headers" | grep -qi 'cache-control: no-cache'
manifest_headers="$(curl -fsSI "$base/manifest.webmanifest")"
printf '%s' "$manifest_headers" | grep -qi 'cache-control: no-cache'

asset="$(printf '%s' "$home" | sed -n 's/.*src="\(\/assets\/[^"]*\)".*/\1/p' | head -n 1)"
test -n "$asset"
asset_headers="$(curl -fsSI "$base$asset")"
printf '%s' "$asset_headers" | grep -qi 'cache-control: public, max-age=31536000, immutable'

curl -fsS "$base/LICENSE" | grep -q 'MIT License'
curl -fsS "$base/NOTICE" | grep -q 'DeepAPI'

version_headers="$(curl -fsSI "$base/version.json")"
printf '%s' "$version_headers" | grep -qi 'cache-control: no-store'
version_body="$(curl -fsS "$base/version.json")"
printf '%s' "$version_body" | grep -q '"version"'
printf '%s' "$version_body" | grep -q '"commit"'
printf '%s' "$version_body" | grep -q '"builtAt"'

echo "harbor-web smoke ok"
