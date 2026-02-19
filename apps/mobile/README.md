# FleetFeast Mobile Apps

This directory contains the mobile app layer scaffolding.

Current state:

1. `shared-kmp/` - Kotlin Multiplatform shared core (contracts + offline queue) with JVM tests
2. `consumer-android/` - Kotlin Android-shell module baseline with backend client and Gradle tests
3. `courier-android/` - Kotlin Android-shell module baseline with backend client and Gradle tests
4. `consumer-ios/` - Swift Package shell baseline with backend client and tests
5. `courier-ios/` - Swift Package shell baseline with backend client and tests

Short-term objective:

1. wire Android/iOS shells to shared-kmp use-cases
2. integrate app-session exchange and realtime subscriptions
3. expand offline queue semantics for courier action replay
