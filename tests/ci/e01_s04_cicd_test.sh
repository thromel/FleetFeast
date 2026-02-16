#!/usr/bin/env bash
set -euo pipefail

required_files=(
  ".github/workflows/ci.yml"
  ".github/workflows/deploy.yml"
  ".github/workflows/security.yml"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing workflow: $file" >&2
    exit 1
  fi
done

ci_file=".github/workflows/ci.yml"
security_file=".github/workflows/security.yml"
deploy_file=".github/workflows/deploy.yml"

# CI gates
for token in "lint" "test" "contract" "policy"; do
  if ! rg -q "$token" "$ci_file"; then
    echo "Expected '$token' gate in $ci_file" >&2
    exit 1
  fi
done

# Security gates
for token in "dependency-review" "codeql"; do
  if ! rg -q "$token" "$security_file"; then
    echo "Expected '$token' security job in $security_file" >&2
    exit 1
  fi
done

# Deployment gates
for token in "workflow_dispatch" "environment" "prod" "needs"; do
  if ! rg -q "$token" "$deploy_file"; then
    echo "Expected '$token' deployment gate in $deploy_file" >&2
    exit 1
  fi
done

echo "E01-S04 CI/CD workflow checks passed"
