#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="$HOME/.config/poxter/env"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "Optional local env file not found; using repo-local defaults." >&2
fi
export DATABASE_URL="${DATABASE_URL:-file:${REPO_ROOT}/dev.db}"
export POXTER_HOST="${POXTER_HOST:-0.0.0.0}"
export POXTER_PORT="${POXTER_PORT:-3000}"
