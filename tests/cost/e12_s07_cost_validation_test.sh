#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASELINE_MODEL="$ROOT_DIR/tests/cost/e12_s07_modeled_costs_stage_b.json"
OBSERVED_USAGE="$ROOT_DIR/tests/cost/e12_s07_observed_usage_sample.json"
VALIDATOR="$ROOT_DIR/tests/cost/validate_cost_model_inputs.mjs"
RUNNER="$ROOT_DIR/tests/cost/run_e12_s07_cost_validation.sh"
ALARM_CONFIG="$ROOT_DIR/infra/alerts/cost-anomaly-thresholds.json"

[[ -f "$BASELINE_MODEL" ]] || {
  echo "Missing modeled cost baseline: $BASELINE_MODEL" >&2
  exit 1
}

[[ -f "$OBSERVED_USAGE" ]] || {
  echo "Missing observed usage sample: $OBSERVED_USAGE" >&2
  exit 1
}

[[ -f "$ALARM_CONFIG" ]] || {
  echo "Missing cost anomaly alarm config: $ALARM_CONFIG" >&2
  exit 1
}

node "$VALIDATOR" "$BASELINE_MODEL" "$OBSERVED_USAGE"
bash "$RUNNER" --dry-run

grep -q 'varianceThresholdPercent' "$ALARM_CONFIG"
grep -q 'unitEconomicsDriftPercent' "$ALARM_CONFIG"

echo "E12-S07 cost validation suite checks passed."
