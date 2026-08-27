#!/usr/bin/env bash
set -euo pipefail

ANDROID_TEST_PROFILE="${JISUDENG_ANDROID_PROFILE:-direct-release}"
case "$ANDROID_TEST_PROFILE" in
  direct-release)
    ANDROID_AVD_NAME="$JISUDENG_DIRECT_RELEASE_AVD"
    ANDROID_SERIAL="$JISUDENG_DIRECT_RELEASE_SERIAL"
    ANDROID_EMULATOR_PORT=5554
    ANDROID_TEST_CHANNEL=direct
    ;;
  direct-e2e)
    ANDROID_AVD_NAME="$JISUDENG_DIRECT_E2E_AVD"
    ANDROID_SERIAL="$JISUDENG_DIRECT_E2E_SERIAL"
    ANDROID_EMULATOR_PORT=5556
    ANDROID_TEST_CHANNEL=direct
    ;;
  play)
    ANDROID_AVD_NAME="$JISUDENG_PLAY_AVD"
    ANDROID_SERIAL="$JISUDENG_PLAY_SERIAL"
    ANDROID_EMULATOR_PORT=5558
    ANDROID_TEST_CHANNEL=play
    ;;
  *)
    echo "Unknown JISUDENG_ANDROID_PROFILE: $ANDROID_TEST_PROFILE" >&2
    exit 1
    ;;
esac

ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"
export ANDROID_SERIAL ANDROID_AVD_NAME ANDROID_TEST_CHANNEL

connected_android_devices() {
  "$ADB" devices | awk 'NR > 1 && $2 == "device" { print $1 }'
}

assert_only_expected_device() {
  mapfile -t devices < <(connected_android_devices)
  if (( ${#devices[@]} == 0 )); then
    return 1
  fi
  if (( ${#devices[@]} != 1 )) || [[ "${devices[0]}" != "$ANDROID_SERIAL" ]]; then
    echo "Expected only $ANDROID_SERIAL for $ANDROID_TEST_PROFILE; found: ${devices[*]}" >&2
    exit 1
  fi
  return 0
}

assert_expected_avd() {
  assert_only_expected_device
  local actual_avd
  actual_avd="$($ADB -s "$ANDROID_SERIAL" shell getprop ro.boot.qemu.avd_name 2>/dev/null | tr -d '\r')"
  if [[ "$actual_avd" != "$ANDROID_AVD_NAME" ]]; then
    echo "Expected AVD $ANDROID_AVD_NAME on $ANDROID_SERIAL, got ${actual_avd:-unknown}." >&2
    exit 1
  fi
}
