#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODELED="$ROOT_DIR/tests/cost/e12_s07_modeled_costs_stage_b.json"
OBSERVED="$ROOT_DIR/tests/cost/e12_s07_observed_usage_sample.json"
ALARM_CONFIG="$ROOT_DIR/infra/alerts/cost-anomaly-thresholds.json"
VALIDATOR="$ROOT_DIR/tests/cost/validate_cost_model_inputs.mjs"
RECONCILER="$ROOT_DIR/tests/cost/reconcile_cost_model.mjs"
RESULTS_DIR="$ROOT_DIR/tests/cost/results"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

node "$VALIDATOR" "$MODELED" "$OBSERVED"

if [[ ! -f "$ALARM_CONFIG" ]]; then
  echo "Missing alarm config: $ALARM_CONFIG" >&2
  exit 1
fi

mkdir -p "$RESULTS_DIR"
REPORT_PATH="$RESULTS_DIR/e12_s07_cost_reconciliation_$(date +%Y%m%d%H%M%S).json"

node "$RECONCILER" "$MODELED" "$OBSERVED" "$ALARM_CONFIG" "$REPORT_PATH"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "E12-S07 dry-run complete. Report: $REPORT_PATH"
  exit 0
fi

echo "E12-S07 cost validation completed. Report: $REPORT_PATH"
