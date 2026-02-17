# openapi

Place versioned REST interface definitions here.

Current layout:

- `v1/baseline/public-api.json`: frozen baseline contract for compatibility checks
- `v1/current/public-api.json`: candidate contract under active development

Compatibility tests in `tests/contracts/e12_s01_rest_contract_test.sh` compare
`baseline` -> `current` and fail on breaking changes.
