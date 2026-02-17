# E12-S04 Load Testing Plan (Early Scale Peak)

- Story: `E12-S04`
- Scope: checkout and order creation critical path plus timeline read under early-scale peak assumptions
- Target market profile: `US single metro`, `10k MAU`, `~1k peak-day orders`

## 1. Workload Profile

Source file:

- `/Users/romel/Documents/GitHub/FoodPanda/tests/performance/e12_s04_load_profile.json`

Key assumptions:

- Peak virtual users: `80`
- Peak request rate envelope: `35 rps`
- Test duration: `30 minutes`
- Journey mix: `70%` checkout/order creation, `30%` timeline reads

## 2. SLO Thresholds

- checkout latency: `p95 < 700 ms`
- timeline latency: `p95 < 400 ms`
- request failure rate: `<1%`
- check success rate: `>98.5%`

## 3. Test Artifacts

- k6 scenario script:
  - `/Users/romel/Documents/GitHub/FoodPanda/tests/performance/e12_s04_k6_checkout_orders.js`
- profile validator:
  - `/Users/romel/Documents/GitHub/FoodPanda/tests/performance/validate_load_profile.mjs`
- runner:
  - `/Users/romel/Documents/GitHub/FoodPanda/tests/performance/run_e12_s04_load_test.sh`
- gate test:
  - `/Users/romel/Documents/GitHub/FoodPanda/tests/performance/e12_s04_load_suite_test.sh`

## 4. Execution

Dry-run validation only:

```bash
bash tests/performance/e12_s04_load_suite_test.sh
```

Execute full load test (requires `k6` and target env):

```bash
LOAD_TEST_BASE_URL="https://staging-api.foodpanda.example" \
LOAD_TEST_AUTH_TOKEN="<token>" \
bash tests/performance/run_e12_s04_load_test.sh
```

## 5. Acceptance

`E12-S04` is considered passed when:

- load profile validation succeeds,
- k6 scenario is executable with no script errors,
- threshold assertions pass on staging during peak simulation,
- summary JSON artifact is stored under `tests/performance/results/`.
