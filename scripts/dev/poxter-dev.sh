#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-poxter-env.sh"
HOST="$POXTER_HOST"
PORT="$POXTER_PORT"
exec pnpm exec next dev --hostname "$HOST" --port "$PORT"
