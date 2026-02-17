#!/usr/bin/env bash
set -euo pipefail

script="infra/scripts/capture_dr_drill_evidence.sh"
[[ -x "$script" ]] || {
  echo "Missing executable script: $script" >&2
  exit 1
}

output_file="/tmp/foodpanda-dr-evidence-test.md"
rm -f "$output_file"

"$script" \
  --environment staging \
  --scenario-id E11-S05-test \
  --rpo-minutes 9 \
  --rto-minutes 42 \
  --output "$output_file"

[[ -f "$output_file" ]] || {
  echo "Expected evidence file to be created" >&2
  exit 1
}

rg -q "Scenario ID: E11-S05-test" "$output_file" || {
  echo "Evidence file missing scenario id" >&2
  exit 1
}
rg -q "RPO Minutes: 9" "$output_file" || {
  echo "Evidence file missing RPO" >&2
  exit 1
}
rg -q "RTO Minutes: 42" "$output_file" || {
  echo "Evidence file missing RTO" >&2
  exit 1
}
rg -q "Release Gate Status: PASS" "$output_file" || {
  echo "Evidence file missing release gate status" >&2
  exit 1
}

echo "E11-S05 DR evidence capture checks passed"
