#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$REPO_ROOT/scripts/dev/load-poxter-env.sh"
cd "$REPO_ROOT"
if [ "${1:-}" = buffer ]; then
  exec node --import tsx "$REPO_ROOT/scripts/onboarding/buffer-key.ts"
fi
exec node --import tsx "$REPO_ROOT/scripts/onboarding/cli.ts" "$@"
