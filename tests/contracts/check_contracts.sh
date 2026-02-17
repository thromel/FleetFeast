#!/usr/bin/env bash
set -euo pipefail

for path in contracts/openapi contracts/protobuf contracts/events; do
  [[ -d "$path" ]]
  [[ -n "$(find "$path" -maxdepth 1 -type f -name '*.md' -o -name '*.yaml' -o -name '*.yml' -o -name '*.json')" ]]
done

bash tests/contracts/e06_s01_dispatch_contract_test.sh
bash tests/contracts/e12_s01_rest_contract_test.sh

echo "Contract checks passed"
