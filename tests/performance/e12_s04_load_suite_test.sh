#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="$ROOT_DIR/tests/performance/e12_s04_load_profile.json"
VALIDATOR="$ROOT_DIR/tests/performance/validate_load_profile.mjs"
K6_SCRIPT="$ROOT_DIR/tests/performance/e12_s04_k6_checkout_orders.js"
RUNNER="$ROOT_DIR/tests/performance/run_e12_s04_load_test.sh"

[[ -f "$PROFILE" ]] || {
  echo "Missing load profile: $PROFILE" >&2
  exit 1
}

[[ -f "$K6_SCRIPT" ]] || {
  echo "Missing k6 load script: $K6_SCRIPT" >&2
  exit 1
}

node "$VALIDATOR" "$PROFILE"
bash "$RUNNER" --dry-run

grep -q 'checkoutP95' "$PROFILE"
grep -q 'timelineP95' "$PROFILE"
grep -q 'http_req_duration{endpoint:checkout}' "$K6_SCRIPT"
grep -q 'http_req_duration{endpoint:timeline}' "$K6_SCRIPT"

echo "E12-S04 load testing suite checks passed."
