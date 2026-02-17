#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECKER="$ROOT_DIR/tests/contracts/scripts/protobuf_compat_check.mjs"
BASELINE_PROTO="$ROOT_DIR/contracts/protobuf/dispatch/v1/baseline/dispatch.proto"
CURRENT_PROTO="$ROOT_DIR/contracts/protobuf/dispatch/v1/dispatch.proto"
BROKEN_PROTO="$ROOT_DIR/tests/contracts/fixtures/e12_s02/dispatch-breaking.proto"

node "$CHECKER" "$BASELINE_PROTO" "$CURRENT_PROTO"

if node "$CHECKER" "$BASELINE_PROTO" "$BROKEN_PROTO" >/dev/null 2>&1; then
  echo "Expected protobuf compatibility checker to fail for breaking fixture." >&2
  exit 1
fi

echo "E12-S02 gRPC/protobuf compatibility checks passed."
