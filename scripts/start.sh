#!/usr/bin/env bash
# Usage: ./scripts/start.sh [path/to/.env]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-${ROOT}/.env}"

if [[ ! -f "${ENV_FILE}" ]]; then
	echo "Missing env file: ${ENV_FILE}. Copy env.example to .env" >&2
	exit 1
fi

set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

exec node "${ROOT}/build/index.js"
