#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECKLIST_FILE="$ROOT_DIR/tests/release/e12_s08_go_live_checklist.json"
VALIDATOR="$ROOT_DIR/tests/release/validate_go_live_checklist.mjs"
RUNNER="$ROOT_DIR/tests/release/run_e12_s08_go_live_readiness.sh"

[[ -f "$CHECKLIST_FILE" ]] || {
  echo "Missing go-live checklist: $CHECKLIST_FILE" >&2
  exit 1
}

node "$VALIDATOR" "$CHECKLIST_FILE"
bash "$RUNNER" --dry-run

grep -q 'contracts_gate' "$CHECKLIST_FILE"
grep -q 'resilience_gate' "$CHECKLIST_FILE"
grep -q 'security_gate' "$CHECKLIST_FILE"
grep -q 'cost_gate' "$CHECKLIST_FILE"

echo "E12-S08 go-live readiness suite checks passed."
