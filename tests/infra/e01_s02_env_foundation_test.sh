#!/usr/bin/env bash
set -euo pipefail

required_paths=(
  "infra/README.md"
  "infra/environments/dev/main.tf"
  "infra/environments/dev/providers.tf"
  "infra/environments/dev/backend.hcl"
  "infra/environments/dev/variables.tf"
  "infra/environments/dev/terraform.tfvars"
  "infra/environments/staging/main.tf"
  "infra/environments/staging/providers.tf"
  "infra/environments/staging/backend.hcl"
  "infra/environments/staging/variables.tf"
  "infra/environments/staging/terraform.tfvars"
  "infra/environments/prod/main.tf"
  "infra/environments/prod/providers.tf"
  "infra/environments/prod/backend.hcl"
  "infra/environments/prod/variables.tf"
  "infra/environments/prod/terraform.tfvars"
  "infra/modules/environment_baseline/main.tf"
  "infra/modules/environment_baseline/variables.tf"
  "infra/modules/environment_baseline/outputs.tf"
  "infra/policy/iam-boundary.json"
  "infra/scripts/verify_env_foundation.sh"
)

for path in "${required_paths[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
done

for env in dev staging prod; do
  tfvars="infra/environments/${env}/terraform.tfvars"
  if ! rg -q "^environment\\s*=\\s*\"${env}\"" "$tfvars"; then
    echo "Expected environment name '${env}' in $tfvars" >&2
    exit 1
  fi

  main_tf="infra/environments/${env}/main.tf"
  if ! rg -q "module \"environment_baseline\"" "$main_tf"; then
    echo "Expected environment_baseline module in $main_tf" >&2
    exit 1
  fi

done

if ! rg -q "Deny" infra/policy/iam-boundary.json; then
  echo "IAM boundary policy must contain an explicit Deny statement" >&2
  exit 1
fi

if ! rg -q "set -euo pipefail" infra/scripts/verify_env_foundation.sh; then
  echo "Verification script must enable strict shell mode" >&2
  exit 1
fi

echo "E01-S02 environment foundation checks passed"
