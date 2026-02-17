#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1:3000}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-5}"

run_check() {
  local name="$1"
  local method="$2"
  local url="$3"
  local expected_codes="$4"
  local status

  status="$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT_SECONDS" -X "$method" "$url")"

  if [[ ",$expected_codes," != *",$status,"* ]]; then
    echo "Smoke check '$name' failed. Expected one of [$expected_codes], got $status" >&2
    exit 1
  fi

  echo "Smoke check '$name' passed with status $status"
}

run_check "admin-health" "GET" "$BASE_URL/api/v1/admin/health" "200,401,403"
run_check "not-found-sanity" "GET" "$BASE_URL/healthz" "404"
run_check "observability-logs" "GET" "$BASE_URL/internal/observability/logs" "200"

echo "Release smoke tests passed"
