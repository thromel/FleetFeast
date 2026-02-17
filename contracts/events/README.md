# events

Place versioned event schemas and envelopes here.

Current layout:

- `v1/baseline/*.schema.json`: frozen event schemas used as compatibility baseline
- `v1/current/*.schema.json`: current event schemas under active development

Compatibility tests in `tests/contracts/e12_s03_event_contract_test.sh` compare
baseline and current schemas and fail on breaking changes (required-field drift,
type changes, envelope contract drift, or missing topics).
