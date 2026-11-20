#!/usr/bin/env bash
# Resolve Android Gradle dependencies with backoff.
# A Maven Central 429 makes Gradle disable that repository for the rest of the
# build and report later artifacts as missing. Retrying in a new process, with
# --refresh-dependencies, clears that negative cache. The assemble step is not
# wrapped here and is not marked continue-on-error.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root}/apps/mobile/android"
chmod +x ./gradlew

max_attempts=3
delay_seconds=10
attempt=1

while true; do
  echo "Resolving Android Gradle dependencies (attempt ${attempt}/${max_attempts})"
  set +e
  ./gradlew --refresh-dependencies dependencies --no-daemon
  status=$?
  set -e
  if [ "${status}" -eq 0 ]; then
    echo "Gradle dependency resolution succeeded on attempt ${attempt}"
    exit 0
  fi
  if [ "${attempt}" -ge "${max_attempts}" ]; then
    echo "Gradle dependency resolution failed after ${max_attempts} attempts" >&2
    exit "${status}"
  fi
  echo "Gradle dependency resolution failed (attempt ${attempt}/${max_attempts}); retrying in ${delay_seconds}s"
  sleep "${delay_seconds}"
  attempt=$((attempt + 1))
  delay_seconds=$((delay_seconds * 2))
done
