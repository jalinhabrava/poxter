#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required." >&2
  exit 1
fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  echo "Node.js 20+ is required." >&2
  exit 1
fi
if command -v corepack >/dev/null 2>&1; then
  package_manager=(corepack pnpm)
elif command -v pnpm >/dev/null 2>&1; then
  package_manager=(pnpm)
else
  echo "pnpm or Corepack is required." >&2
  exit 1
fi

"${package_manager[@]}" install --frozen-lockfile
./node_modules/.bin/prisma generate

CONFIG_DIR="$HOME/.config/poxter"
ENV_FILE="$CONFIG_DIR/env"
umask 077
mkdir -p "$CONFIG_DIR"
if [ ! -e "$ENV_FILE" ]; then
  printf 'DATABASE_URL=%q\nPOXTER_HOST=%q\nPOXTER_PORT=%q\n' "${DATABASE_URL:-file:$REPO_ROOT/dev.db}" "${POXTER_HOST:-127.0.0.1}" "${POXTER_PORT:-3000}" > "$ENV_FILE"
fi
source "$REPO_ROOT/scripts/dev/load-poxter-env.sh"
./node_modules/.bin/prisma db push --skip-generate
echo "PoXter is prepared. Continue with: ${package_manager[*]} onboard status"
