# Courier iOS Shell

Swift Package-based iOS shell baseline for FleetFeast courier app.

Current scope:

1. typed shell config validation for BFF + realtime base URLs
2. startup summary and route helpers for jobs, feature flags, and realtime connect path
3. backend connectivity client (`CourierBackendClient`) for jobs + feature-flag calls
4. package-level unit tests for shell config, path generation, and backend client request mapping
5. installable `CourierIOSDemo.xcodeproj` wrapper for simulator builds

Run tests:

```bash
cd apps/mobile/courier-ios
swift test
```

Build the simulator app bundle:

```bash
cd apps/mobile/courier-ios
./scripts/smoke-test-ios-demo.sh
```
