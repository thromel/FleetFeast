# Courier Android Shell

Kotlin module baseline for FleetFeast courier Android shell.

Current scope:

1. typed shell config validation for BFF and realtime base URLs
2. startup summary and route helpers for jobs, feature flags, and realtime connect
3. backend connectivity client (`CourierBackendClient`) for jobs + feature-flag calls
4. Gradle-based unit tests for shell config, path generation, and backend client request mapping

Run tests:

```bash
cd apps/mobile/courier-android
gradle test
```
