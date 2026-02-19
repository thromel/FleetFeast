# Consumer Android Shell

Kotlin module baseline for FleetFeast consumer Android shell.

Current scope:

1. typed shell config validation for BFF base URL
2. startup summary and route helpers for consumer order + feature-flag paths
3. backend connectivity client (`ConsumerBackendClient`) for consumer order + feature-flag calls
4. Gradle-based unit tests for shell config, path generation, and backend client request mapping

Run tests:

```bash
cd apps/mobile/consumer-android
gradle test
```
