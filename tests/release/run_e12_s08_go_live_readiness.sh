#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECKLIST_FILE="$ROOT_DIR/tests/release/e12_s08_go_live_checklist.json"
VALIDATOR="$ROOT_DIR/tests/release/validate_go_live_checklist.mjs"
EXECUTOR="$ROOT_DIR/tests/release/execute_go_live_checklist.mjs"
RESULTS_DIR="$ROOT_DIR/tests/release/results"

MODE="run"
if [[ "${1:-}" == "--dry-run" ]]; then
  MODE="dry-run"
fi

node "$VALIDATOR" "$CHECKLIST_FILE"
mkdir -p "$RESULTS_DIR"
REPORT_PATH="$RESULTS_DIR/e12_s08_go_live_report_$(date +%Y%m%d%H%M%S).json"

node "$EXECUTOR" "$CHECKLIST_FILE" "$REPORT_PATH" "$MODE"

if [[ "$MODE" == "dry-run" ]]; then
  echo "E12-S08 dry-run complete. Report: $REPORT_PATH"
else
  echo "E12-S08 go-live readiness execution completed. Report: $REPORT_PATH"
fi
