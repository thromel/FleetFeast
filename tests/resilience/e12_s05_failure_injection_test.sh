#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCENARIO_FILE="$ROOT_DIR/tests/resilience/e12_s05_failure_scenarios.json"
VALIDATOR="$ROOT_DIR/tests/resilience/validate_failure_scenarios.mjs"
RUNNER="$ROOT_DIR/tests/resilience/run_e12_s05_failure_injection.sh"

[[ -f "$SCENARIO_FILE" ]] || {
  echo "Missing failure scenario file: $SCENARIO_FILE" >&2
  exit 1
}

node "$VALIDATOR" "$SCENARIO_FILE"
bash "$RUNNER" --dry-run

grep -q 'queue_lag' "$SCENARIO_FILE"
grep -q 'db_failover' "$SCENARIO_FILE"
grep -q 'provider_outage' "$SCENARIO_FILE"

echo "E12-S05 failure injection suite checks passed."
