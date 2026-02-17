# E12-S05 Failure Injection Suite

- Story: `E12-S05`
- Scope: queue lag, DB failover, and provider outage fault scenarios

## 1. Suite Files

- Scenario catalog:
  - `/Users/romel/Documents/GitHub/FoodPanda/tests/resilience/e12_s05_failure_scenarios.json`
- Validator:
  - `/Users/romel/Documents/GitHub/FoodPanda/tests/resilience/validate_failure_scenarios.mjs`
- Runner:
  - `/Users/romel/Documents/GitHub/FoodPanda/tests/resilience/run_e12_s05_failure_injection.sh`
- Test gate:
  - `/Users/romel/Documents/GitHub/FoodPanda/tests/resilience/e12_s05_failure_injection_test.sh`

## 2. Scenarios

- `queue_lag`: pause/backlog queue consumers and verify catch-up and alerting.
- `db_failover`: force managed DB failover and validate write/read recovery behavior.
- `provider_outage`: blackhole external provider integration and verify fallback + escalation.

## 3. Execution

Dry-run validation (safe, no live fault injected):

```bash
bash tests/resilience/e12_s05_failure_injection_test.sh
```

Simulated execution report:

```bash
bash tests/resilience/run_e12_s05_failure_injection.sh
```

Live-execution mode placeholder (requires environment-specific hooks):

```bash
FAILURE_INJECTION_MODE=execute \
bash tests/resilience/run_e12_s05_failure_injection.sh
```

## 4. Evidence

Execution writes a timestamped report to:

- `/Users/romel/Documents/GitHub/FoodPanda/tests/resilience/results/`

Use this artifact as part of release gating evidence for resilience readiness.
