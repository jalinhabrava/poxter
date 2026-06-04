#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="$HOME/.config/social-controller/env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "Social Controller env file missing: $ENV_FILE" >&2
fi
