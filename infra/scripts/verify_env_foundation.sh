#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

for env in dev staging prod; do
  env_dir="infra/environments/${env}"
  [[ -f "${env_dir}/main.tf" ]]
  [[ -f "${env_dir}/providers.tf" ]]
  [[ -f "${env_dir}/variables.tf" ]]
  [[ -f "${env_dir}/backend.hcl" ]]
  [[ -f "${env_dir}/terraform.tfvars" ]]
done

echo "Environment foundation structure looks valid"
