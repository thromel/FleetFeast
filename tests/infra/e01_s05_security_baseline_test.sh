#!/usr/bin/env bash
set -euo pipefail

required=(
  "infra/modules/security_baseline/main.tf"
  "infra/modules/security_baseline/variables.tf"
  "infra/modules/security_baseline/outputs.tf"
)
for f in "${required[@]}"; do
  [[ -f "$f" ]] || { echo "Missing security module file: $f" >&2; exit 1; }
done

main_tf="infra/modules/security_baseline/main.tf"
for token in "aws_kms_key" "aws_kms_alias" "aws_secretsmanager_secret" "aws_secretsmanager_secret_version"; do
  if ! rg -q "$token" "$main_tf"; then
    echo "Expected '$token' in $main_tf" >&2
    exit 1
  fi
done

for env in dev staging prod; do
  env_main="infra/environments/${env}/main.tf"
  env_vars="infra/environments/${env}/variables.tf"
  env_tfvars="infra/environments/${env}/terraform.tfvars"

  rg -q "module \"security_baseline\"" "$env_main" || { echo "Missing security_baseline module in $env_main" >&2; exit 1; }
  rg -q "payment_provider_api_key" "$env_vars" || { echo "Missing payment_provider_api_key variable in $env_vars" >&2; exit 1; }
  rg -q "maps_api_key" "$env_vars" || { echo "Missing maps_api_key variable in $env_vars" >&2; exit 1; }
  rg -q "payment_provider_api_key" "$env_tfvars" || { echo "Missing payment_provider_api_key in $env_tfvars" >&2; exit 1; }
  rg -q "maps_api_key" "$env_tfvars" || { echo "Missing maps_api_key in $env_tfvars" >&2; exit 1; }
done

echo "E01-S05 security baseline checks passed"
