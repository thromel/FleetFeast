#!/usr/bin/env bash
set -euo pipefail

required_files=(
  ".github/workflows/deploy.yml"
  "infra/scripts/release_smoke_test.sh"
  "infra/scripts/rollback_release.sh"
  "docs/architecture/release-rollout-runbook.md"
)

for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || {
    echo "Missing required file: $file" >&2
    exit 1
  }
done

for script in "infra/scripts/release_smoke_test.sh" "infra/scripts/rollback_release.sh"; do
  if ! rg -q "set -euo pipefail" "$script"; then
    echo "Expected strict shell mode in $script" >&2
    exit 1
  fi
done

deploy_file=".github/workflows/deploy.yml"

for token in "core_blue_green_deploy" "dispatch_canary_deploy" "release_smoke_gate" "rollback_on_failure"; do
  if ! rg -q "$token" "$deploy_file"; then
    echo "Expected deploy job '$token' in $deploy_file" >&2
    exit 1
  fi
done

if ! rg -q "needs: \[pre_deploy_checks, core_blue_green_deploy, dispatch_canary_deploy\]" "$deploy_file"; then
  echo "release_smoke_gate must depend on pre checks, core blue/green, and dispatch canary jobs" >&2
  exit 1
fi

if ! rg -F -q 'if: ${{ failure() }}' "$deploy_file"; then
  echo "Expected rollback_on_failure guard with failure() condition" >&2
  exit 1
fi

echo "E01-S06 release strategy checks passed"
