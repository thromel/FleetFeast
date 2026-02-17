#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECKER="$ROOT_DIR/tests/contracts/scripts/openapi_compat_check.mjs"
BASELINE_SPEC="$ROOT_DIR/contracts/openapi/v1/baseline/public-api.json"
CURRENT_SPEC="$ROOT_DIR/contracts/openapi/v1/current/public-api.json"
BROKEN_SPEC="$ROOT_DIR/tests/contracts/fixtures/e12_s01/openapi-breaking.json"

node "$CHECKER" "$BASELINE_SPEC" "$CURRENT_SPEC"

if node "$CHECKER" "$BASELINE_SPEC" "$BROKEN_SPEC" >/dev/null 2>&1; then
  echo "Expected compatibility checker to fail for breaking schema fixture." >&2
  exit 1
fi

echo "E12-S01 REST contract compatibility checks passed."
