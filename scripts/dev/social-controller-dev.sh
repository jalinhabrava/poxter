#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-social-controller-env.sh"
HOST="${SOCIAL_CONTROLLER_HOST:-127.0.0.1}"
PORT="${SOCIAL_CONTROLLER_PORT:-3000}"
exec pnpm exec next dev --hostname "$HOST" --port "$PORT"
