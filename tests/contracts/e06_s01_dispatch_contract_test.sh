#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROTO_FILE="$ROOT_DIR/contracts/protobuf/dispatch/v1/dispatch.proto"

[[ -f "$PROTO_FILE" ]] || {
  echo "Missing protobuf contract: $PROTO_FILE" >&2
  exit 1
}

grep -q 'syntax = "proto3";' "$PROTO_FILE"
grep -q '^package dispatch\.v1;' "$PROTO_FILE"
grep -q '^service DispatchService {' "$PROTO_FILE"
grep -q 'rpc Score(ScoreRequest) returns (ScoreResponse);' "$PROTO_FILE"
grep -q 'rpc Assign(AssignRequest) returns (AssignResponse);' "$PROTO_FILE"
grep -q 'rpc Reassign(ReassignRequest) returns (ReassignResponse);' "$PROTO_FILE"
grep -q 'rpc UpdateTelemetry(UpdateTelemetryRequest) returns (UpdateTelemetryResponse);' "$PROTO_FILE"

grep -q '^message ScoreRequest {' "$PROTO_FILE"
grep -q '^message ScoreResponse {' "$PROTO_FILE"
grep -q '^message AssignRequest {' "$PROTO_FILE"
grep -q '^message AssignResponse {' "$PROTO_FILE"
grep -q '^message ReassignRequest {' "$PROTO_FILE"
grep -q '^message ReassignResponse {' "$PROTO_FILE"
grep -q '^message UpdateTelemetryRequest {' "$PROTO_FILE"
grep -q '^message UpdateTelemetryResponse {' "$PROTO_FILE"

echo "E06-S01 protobuf contract checks passed."
