#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/CourierIOSDemo.xcodeproj"
DERIVED_DATA_PATH="${TMPDIR%/}/courier-ios-demo-derived"

if [[ ! -d "$PROJECT_PATH" ]]; then
  echo "missing project: $PROJECT_PATH" >&2
  exit 1
fi

rm -rf "$DERIVED_DATA_PATH"

xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme CourierIOSDemo \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  build >/tmp/courier-ios-demo-build.log

APP_BUNDLE_PATH="$(find "$DERIVED_DATA_PATH/Build/Products/Debug-iphonesimulator" -maxdepth 1 -name '*.app' -print -quit)"

if [[ -z "$APP_BUNDLE_PATH" ]]; then
  echo "no iOS app bundle produced" >&2
  exit 1
fi

echo "$APP_BUNDLE_PATH"
