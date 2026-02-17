#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="$ROOT_DIR/tests/performance/e12_s04_load_profile.json"
VALIDATOR="$ROOT_DIR/tests/performance/validate_load_profile.mjs"
K6_SCRIPT="$ROOT_DIR/tests/performance/e12_s04_k6_checkout_orders.js"
RESULTS_DIR="$ROOT_DIR/tests/performance/results"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

node "$VALIDATOR" "$PROFILE"

if [[ ! -f "$K6_SCRIPT" ]]; then
  echo "Missing k6 script: $K6_SCRIPT" >&2
  exit 1
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "E12-S04 dry-run complete. Load profile and scripts are valid."
  exit 0
fi

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is required to execute E12-S04 load tests. Install k6 and retry." >&2
  exit 1
fi

mkdir -p "$RESULTS_DIR"
RUN_ID="$(date +%Y%m%d%H%M%S)"
SUMMARY_FILE="$RESULTS_DIR/e12_s04_summary_${RUN_ID}.json"

LOAD_TEST_BASE_URL="${LOAD_TEST_BASE_URL:-http://127.0.0.1:3000}"
LOAD_TEST_AUTH_TOKEN="${LOAD_TEST_AUTH_TOKEN:-}"

k6 run \
  --summary-export "$SUMMARY_FILE" \
  -e LOAD_TEST_BASE_URL="$LOAD_TEST_BASE_URL" \
  -e LOAD_TEST_AUTH_TOKEN="$LOAD_TEST_AUTH_TOKEN" \
  "$K6_SCRIPT"

echo "E12-S04 load test completed. Summary: $SUMMARY_FILE"
