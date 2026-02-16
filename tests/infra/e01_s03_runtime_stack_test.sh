#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "infra/modules/runtime_baseline/main.tf"
  "infra/modules/runtime_baseline/variables.tf"
  "infra/modules/runtime_baseline/outputs.tf"
)

for f in "${required_files[@]}"; do
  [[ -f "$f" ]] || { echo "Missing runtime module file: $f" >&2; exit 1; }
done

main_tf="infra/modules/runtime_baseline/main.tf"
for resource in "aws_vpc" "aws_subnet" "aws_security_group" "aws_lb" "aws_lb_target_group" "aws_ecs_cluster" "aws_ecs_service"; do
  if ! rg -q "$resource" "$main_tf"; then
    echo "Expected resource '$resource' in $main_tf" >&2
    exit 1
  fi
done

for env in dev staging prod; do
  env_main="infra/environments/${env}/main.tf"
  env_vars="infra/environments/${env}/variables.tf"
  env_tfvars="infra/environments/${env}/terraform.tfvars"

  if ! rg -q "module \"runtime_baseline\"" "$env_main"; then
    echo "Missing runtime_baseline module in $env_main" >&2
    exit 1
  fi

  if ! rg -q "vpc_cidr" "$env_vars"; then
    echo "Missing vpc_cidr variable in $env_vars" >&2
    exit 1
  fi

  if ! rg -q "vpc_cidr" "$env_tfvars"; then
    echo "Missing vpc_cidr value in $env_tfvars" >&2
    exit 1
  fi

done

echo "E01-S03 runtime baseline checks passed"
