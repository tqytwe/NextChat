#!/usr/bin/env bash
set -euo pipefail

: "${ANDROID_HOME:?ANDROID_HOME must be set by android-toolchain-env.sh}"
: "${ANDROID_SERIAL:?ANDROID_SERIAL must be set by android-device.sh}"
exec "$ANDROID_HOME/platform-tools/adb" -s "$ANDROID_SERIAL" "$@"
