# Consumer iOS Shell

Swift Package-based iOS shell baseline for FleetFeast consumer app.

Current scope:

1. typed shell config validation for BFF base URL
2. startup summary and route helpers for consumer order + feature-flag paths
3. backend connectivity client (`ConsumerBackendClient`) for consumer order + feature-flag calls
4. package-level unit tests for shell config, path generation, and backend client request mapping

Run tests:

```bash
cd apps/mobile/consumer-ios
swift test
```
