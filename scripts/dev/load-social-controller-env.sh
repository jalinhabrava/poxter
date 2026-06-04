#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REBUILD_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$HOME/.config/social-controller/env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "Social Controller env file missing: $ENV_FILE" >&2
fi
if [ -z "${DATABASE_URL:-}" ] || [[ "${DATABASE_URL}" == *"/Social Controller/"* ]]; then
  export DATABASE_URL="file:$REBUILD_ROOT/dev.db"
fi
