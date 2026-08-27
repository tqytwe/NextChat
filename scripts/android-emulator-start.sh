#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/android-toolchain-env.sh"
source "$SCRIPT_DIR/android-device.sh"
AVD_HOME="$ANDROID_AVD_HOME"
BOOT_TIMEOUT_SECONDS="${ANDROID_BOOT_TIMEOUT_SECONDS:-180}"
EMULATOR_LOG="${ANDROID_EMULATOR_LOG:-$JISUDENG_ANDROID_RESULTS_ROOT/$ANDROID_TEST_CHANNEL/toolchain/$ANDROID_AVD_NAME-emulator.log}"

for executable in "$ADB" "$EMULATOR"; do
  if [[ ! -x "$executable" ]]; then
    echo "Missing executable: $executable" >&2
    exit 1
  fi
done

if [[ ! -f "$AVD_HOME/$ANDROID_AVD_NAME.ini" ]]; then
  echo "Android AVD not found: $AVD_HOME/$ANDROID_AVD_NAME.ini" >&2
  echo "Provision Android API 35 AVD '$ANDROID_AVD_NAME' before running this script." >&2
  exit 1
fi

mkdir -p "$(dirname "$EMULATOR_LOG")"

if assert_only_expected_device; then
  assert_expected_avd
  echo "Reusing $ANDROID_AVD_NAME on $ANDROID_SERIAL."
else
  echo "Starting $ANDROID_AVD_NAME in headless mode. Log: $EMULATOR_LOG"
  nohup "$EMULATOR" \
    -avd "$ANDROID_AVD_NAME" \
    -port "$ANDROID_EMULATOR_PORT" \
    -no-window \
    -gpu swiftshader_indirect \
    -no-audio \
    -no-boot-anim \
    -netdelay none \
    -netspeed full \
    >"$EMULATOR_LOG" 2>&1 &
fi

deadline=$((SECONDS + BOOT_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  if [[ "$("$ADB" -s "$ANDROID_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    assert_expected_avd
    "$ADB" -s "$ANDROID_SERIAL" shell settings put global window_animation_scale 0
    "$ADB" -s "$ANDROID_SERIAL" shell settings put global transition_animation_scale 0
    "$ADB" -s "$ANDROID_SERIAL" shell settings put global animator_duration_scale 0
    "$ADB" -s "$ANDROID_SERIAL" shell input keyevent 82 >/dev/null
    echo "Android device is ready: $ANDROID_SERIAL ($ANDROID_AVD_NAME)"
    exit 0
  fi
  sleep 2
done

echo "Android device did not finish booting within ${BOOT_TIMEOUT_SECONDS}s." >&2
exit 1
