#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECKER="$ROOT_DIR/tests/contracts/scripts/event_schema_compat_check.mjs"
BASELINE_DIR="$ROOT_DIR/contracts/events/v1/baseline"
CURRENT_DIR="$ROOT_DIR/contracts/events/v1/current"
BROKEN_DIR="$ROOT_DIR/tests/contracts/fixtures/e12_s03/breaking"

node "$CHECKER" "$BASELINE_DIR" "$CURRENT_DIR"

if node "$CHECKER" "$BASELINE_DIR" "$BROKEN_DIR" >/dev/null 2>&1; then
  echo "Expected event schema compatibility checker to fail for breaking fixture." >&2
  exit 1
fi

echo "E12-S03 event schema compatibility checks passed."
