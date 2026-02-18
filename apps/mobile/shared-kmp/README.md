# FleetFeast Shared KMP Core

This module holds the first Kotlin Multiplatform shared core slice for mobile apps.

Current scope:

1. shared app-layer contract models (`AppSession*`, feature flags, geo contract)
2. offline action queue semantics with idempotency + retry transitions
3. JVM-testable baseline for iterative expansion into full iOS/Android clients

## Run Tests (Docker)

```bash
docker run --rm \
  -v "$PWD":/workspace \
  -w /workspace/apps/mobile/shared-kmp \
  gradle:8.10-jdk17 \
  gradle test --no-daemon
```
