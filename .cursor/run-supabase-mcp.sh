#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ROOT_DIR}/web/.env.local"

if [ -f "${ENV_FILE}" ]; then
  # Export variables defined in the env file
  set -a
  source "${ENV_FILE}"
  set +a
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN is not set. Add it to web/.env.local or export it before launching MCP." >&2
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-cstfsdltkjaakgwtnhdb}"

exec npx -y @supabase/mcp-server-supabase@latest \
  --access-token "${SUPABASE_ACCESS_TOKEN}" \
  --project-ref "${PROJECT_REF}"
