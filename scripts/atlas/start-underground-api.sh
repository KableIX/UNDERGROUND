#!/usr/bin/env bash
# Start the UNDERGROUND app API from the monorepo root.
# Secrets come from the systemd EnvironmentFile or the process environment.
# Do not echo env values.
set -euo pipefail

ROOT="${UNDERGROUND_ROOT:-/data/underground}"
cd "$ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not installed. Enable corepack or install pnpm, then retry." >&2
  exit 1
fi

export UNDERGROUND_API_AUTOSTART="${UNDERGROUND_API_AUTOSTART:-1}"
exec pnpm --filter @underground/api start