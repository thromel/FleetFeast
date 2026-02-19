# FleetFeast Shared KMP Core

This module holds the first Kotlin Multiplatform shared core slice for mobile apps.

Current scope:

1. shared app-layer contract models (`AppSession*`, feature flags, geo contract)
2. offline action queue semantics with idempotency + retry transitions
3. typed BFF/realtime client adapters over an abstract transport (`BffTransport`)
4. queue persistence abstraction (`OfflineActionStore`) with restart rehydration semantics
5. feature flag client with snapshot TTL caching semantics
6. HTTP transport adapter contract (`HttpBffTransport`) for URL/query/header/body mapping
7. default JSON body mapper (`DefaultJsonHttpBodyMapper`) for app contract encode/decode
8. JVM HTTP executor (`JvmHttpTransportExecutor`) for live BFF connectivity
9. JVM file-backed persistent store (`JvmJsonFileOfflineActionStore`) for durable offline queue state
10. courier workflow service that combines feature flags with persistent offline replay
11. JVM-testable baseline for iterative expansion into full iOS/Android clients

## Run Tests (Docker)

```bash
docker run --rm \
  --user 0:0 \
  -v "$PWD":/workspace \
  -w /workspace/apps/mobile/shared-kmp \
  gradle:8.10-jdk17 \
  gradle -Dorg.gradle.project.buildDir=/tmp/fleetfeast-kmp-build jvmTest --no-daemon
```
