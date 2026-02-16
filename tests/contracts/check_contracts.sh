#!/usr/bin/env bash
set -euo pipefail

for path in contracts/openapi contracts/protobuf contracts/events; do
  [[ -d "$path" ]]
  [[ -n "$(find "$path" -maxdepth 1 -type f -name '*.md' -o -name '*.yaml' -o -name '*.yml' -o -name '*.json')" ]]
done

echo "Contract checks passed"
