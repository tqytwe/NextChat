#!/usr/bin/env bash
set -euo pipefail

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/home/dell/Android/Sdk}}"
ADB="${ADB:-$SDK_ROOT/platform-tools/adb}"
EMULATOR="${EMULATOR:-$SDK_ROOT/emulator/emulator}"
AVD_NAME="${ANDROID_AVD_NAME:-Jisudeng_Play_API35}"
AVD_HOME="${ANDROID_AVD_HOME:-/home/codex/.android/avd}"
BOOT_TIMEOUT_SECONDS="${ANDROID_BOOT_TIMEOUT_SECONDS:-180}"
EMULATOR_LOG="${ANDROID_EMULATOR_LOG:-/tmp/jisudeng-android-emulator.log}"

for executable in "$ADB" "$EMULATOR"; do
  if [[ ! -x "$executable" ]]; then
    echo "Missing executable: $executable" >&2
    exit 1
  fi
done

if [[ ! -f "$AVD_HOME/$AVD_NAME.ini" ]]; then
  echo "Android AVD not found: $AVD_HOME/$AVD_NAME.ini" >&2
  echo "Create Android API 35 AVD '$AVD_NAME' before running this script." >&2
  exit 1
fi

export ANDROID_SDK_ROOT="$SDK_ROOT"
export ANDROID_AVD_HOME="$AVD_HOME"

if "$ADB" devices | awk 'NR > 1 && $2 == "device" { found = 1 } END { exit !found }'; then
  echo "Reusing connected Android device."
else
  echo "Starting $AVD_NAME in headless mode. Log: $EMULATOR_LOG"
  nohup "$EMULATOR" \
    -avd "$AVD_NAME" \
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
  if [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    "$ADB" shell settings put global window_animation_scale 0
    "$ADB" shell settings put global transition_animation_scale 0
    "$ADB" shell settings put global animator_duration_scale 0
    "$ADB" shell input keyevent 82 >/dev/null
    echo "Android device is ready: $("$ADB" get-serialno)"
    exit 0
  fi
  sleep 2
done

echo "Android device did not finish booting within ${BOOT_TIMEOUT_SECONDS}s." >&2
exit 1
