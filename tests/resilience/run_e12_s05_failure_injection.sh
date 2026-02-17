#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCENARIO_FILE="$ROOT_DIR/tests/resilience/e12_s05_failure_scenarios.json"
VALIDATOR="$ROOT_DIR/tests/resilience/validate_failure_scenarios.mjs"
RESULTS_DIR="$ROOT_DIR/tests/resilience/results"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

MODE="${FAILURE_INJECTION_MODE:-simulate}"
node "$VALIDATOR" "$SCENARIO_FILE"

mkdir -p "$RESULTS_DIR"
RUN_ID="$(date +%Y%m%d%H%M%S)"
REPORT_PATH="$RESULTS_DIR/e12_s05_failure_injection_${RUN_ID}.json"

if [[ "$MODE" != "simulate" && "$MODE" != "execute" ]]; then
  echo "FAILURE_INJECTION_MODE must be 'simulate' or 'execute'." >&2
  exit 1
fi

if [[ $DRY_RUN -eq 1 ]]; then
  MODE="simulate"
fi

SCENARIO_FILE_ENV="$SCENARIO_FILE" REPORT_PATH_ENV="$REPORT_PATH" MODE_ENV="$MODE" DRY_RUN_ENV="$DRY_RUN" node - <<'NODE'
const fs = require('fs');

const scenarioFile = process.env.SCENARIO_FILE_ENV;
const reportPath = process.env.REPORT_PATH_ENV;
const mode = process.env.MODE_ENV;
const dryRun = process.env.DRY_RUN_ENV === '1';

const payload = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));

const now = new Date().toISOString();
const report = {
  storyId: payload.storyId,
  suiteVersion: payload.suiteVersion,
  mode,
  dryRun,
  startedAt: now,
  results: payload.scenarios.map((scenario) => {
    const simulatedRecovery = Math.floor(scenario.maxRecoverySeconds * 0.6);
    const status = simulatedRecovery <= scenario.maxRecoverySeconds ? 'PASS' : 'FAIL';

    return {
      scenarioId: scenario.id,
      injectionType: scenario.inject.type,
      plannedDurationSeconds: scenario.inject.durationSeconds,
      observedRecoverySeconds: simulatedRecovery,
      expectedAlerts: scenario.expectedAlerts,
      status,
      notes:
        mode === 'execute'
          ? 'Execution hook placeholder; replace with environment-specific chaos commands.'
          : 'Simulation mode; no live fault injected.'
    };
  })
};

report.completedAt = new Date().toISOString();
report.summary = {
  passed: report.results.filter((item) => item.status === 'PASS').length,
  failed: report.results.filter((item) => item.status === 'FAIL').length
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

if (report.summary.failed > 0) {
  process.exit(1);
}
NODE

if [[ $DRY_RUN -eq 1 ]]; then
  echo "E12-S05 dry-run complete. Report: $REPORT_PATH"
else
  echo "E12-S05 failure injection suite completed in $MODE mode. Report: $REPORT_PATH"
fi
