# protobuf

Place shared protobuf schemas here.

Current layout:

- `dispatch/v1/baseline/dispatch.proto`: frozen protobuf baseline for compatibility
- `dispatch/v1/dispatch.proto`: current dispatch contract

Compatibility tests in `tests/contracts/e12_s02_grpc_contract_test.sh` compare
`baseline` -> `current` and fail on removed RPCs, removed fields, field-number reuse,
or type/signature changes.
