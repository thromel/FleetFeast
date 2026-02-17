# Release Rollout Runbook (E01-S06)

- Story: `E01-S06`
- Goal: enforce blue/green deployment for `core-api` and canary deployment for `dispatch-engine`.

## 1. Preconditions

- CI `lint`, `test`, `contract`, and `policy` gates are green.
- Deployment artifacts for `core-api` and `dispatch-engine` are built and tagged.
- Target environment (`dev`, `staging`, or `prod`) is selected.

## 2. Rollout Sequence

1. Run pre-deploy checks and policy validations.
2. Deploy `core-api` with blue/green strategy.
3. Deploy `dispatch-engine` with canary strategy.
4. Execute smoke tests:

```bash
SMOKE_BASE_URL="https://<env-host>" bash infra/scripts/release_smoke_test.sh
```

5. If smoke checks pass, finalize deployment and mark release successful.

## 3. Failure And Rollback

If any deployment or smoke step fails, trigger rollback:

```bash
DEPLOY_ENVIRONMENT="staging" bash infra/scripts/rollback_release.sh
```

Rollback actions:

- reset `core-api` service to previous stable task set,
- reset `dispatch-engine` service to previous stable revision,
- re-run smoke tests before closing incident.

## 4. Post-Deployment Evidence

Capture and attach:

- deployment job logs,
- smoke test output,
- rollback log (if executed),
- change ticket and sign-off references.
