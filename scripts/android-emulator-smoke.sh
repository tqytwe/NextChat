#!/usr/bin/env bash
set -euo pipefail

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/home/dell/Android/Sdk}}"
ADB="${ADB:-$SDK_ROOT/platform-tools/adb}"
APK_PATH="${ANDROID_APK_PATH:-public/downloads/jisudengchat-android.apk}"
PACKAGE_NAME="${ANDROID_PACKAGE_NAME:-com.jisudeng.chat}"
MAIN_ACTIVITY="${ANDROID_MAIN_ACTIVITY:-.MainActivity}"
EXPECTED_VERSION="${ANDROID_EXPECTED_VERSION:-}"
NETWORK_CYCLE="${ANDROID_SMOKE_NETWORK_CYCLE:-0}"
ARTIFACT_DIR="${ANDROID_SMOKE_ARTIFACT_DIR:-test-results/android-emulator}"
BOOT_TIMEOUT_SECONDS="${ANDROID_BOOT_TIMEOUT_SECONDS:-180}"
NETWORK_WAS_DISABLED=0

if [[ ! -x "$ADB" ]]; then
  echo "Missing adb executable: $ADB" >&2
  exit 1
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "APK not found: $APK_PATH" >&2
  exit 1
fi

mkdir -p "$ARTIFACT_DIR"

restore_network() {
  if [[ "$NETWORK_WAS_DISABLED" == "1" ]]; then
    "$ADB" shell svc wifi enable >/dev/null 2>&1 || true
    "$ADB" shell svc data enable >/dev/null 2>&1 || true
  fi
}
trap restore_network EXIT

deadline=$((SECONDS + BOOT_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  if [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    break
  fi
  sleep 2
done

if [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]]; then
  echo "No booted Android device after ${BOOT_TIMEOUT_SECONDS}s." >&2
  exit 1
fi

echo "Installing $APK_PATH"
"$ADB" install -r "$APK_PATH" >/dev/null
"$ADB" logcat -c
"$ADB" shell am force-stop "$PACKAGE_NAME"
"$ADB" shell am start -W -n "$PACKAGE_NAME/$MAIN_ACTIVITY" >"$ARTIFACT_DIR/activity-start.txt"

deadline=$((SECONDS + 30))
while (( SECONDS < deadline )); do
  resumed_activity="$("$ADB" shell dumpsys activity activities | sed -n 's/.*topResumedActivity=//p' | head -1)"
  if [[ "$resumed_activity" == *"$PACKAGE_NAME"* ]]; then
    break
  fi
  sleep 1
done

if ! "$ADB" shell pidof "$PACKAGE_NAME" >"$ARTIFACT_DIR/app-pid.txt"; then
  echo "App process is not running after launch." >&2
  exit 1
fi

"$ADB" shell dumpsys package "$PACKAGE_NAME" >"$ARTIFACT_DIR/package.txt"
installed_version="$(sed -n 's/.*versionName=//p' "$ARTIFACT_DIR/package.txt" | head -1 | tr -d '\r')"
installed_version_code="$(sed -n 's/.*versionCode=\([0-9]*\).*/\1/p' "$ARTIFACT_DIR/package.txt" | head -1)"
if [[ -n "$EXPECTED_VERSION" && "$installed_version" != "$EXPECTED_VERSION" ]]; then
  echo "Installed version is $installed_version, expected $EXPECTED_VERSION." >&2
  exit 1
fi

ui_ready=0
deadline=$((SECONDS + 30))
while (( SECONDS < deadline )); do
  "$ADB" shell uiautomator dump "/sdcard/$PACKAGE_NAME-ready.xml" >/dev/null 2>&1 || true
  "$ADB" pull "/sdcard/$PACKAGE_NAME-ready.xml" "$ARTIFACT_DIR/ready.xml" >/dev/null 2>&1 || true
  if [[ -s "$ARTIFACT_DIR/ready.xml" ]] &&
    rg -q 'text="[^"]+"[^>]*class="android\.widget\.(TextView|Button)"' "$ARTIFACT_DIR/ready.xml"; then
    ui_ready=1
    break
  fi
  sleep 1
done
if [[ "$ui_ready" != "1" ]]; then
  echo "App WebView did not render accessible UI within 30 seconds." >&2
  exit 1
fi

capture_state() {
  local label="$1"
  "$ADB" exec-out screencap -p >"$ARTIFACT_DIR/$label.png"
  "$ADB" shell uiautomator dump "/sdcard/$PACKAGE_NAME-$label.xml" >/dev/null
  "$ADB" pull "/sdcard/$PACKAGE_NAME-$label.xml" "$ARTIFACT_DIR/$label.xml" >/dev/null

  local screenshot_bytes
  screenshot_bytes="$(wc -c <"$ARTIFACT_DIR/$label.png")"
  if (( screenshot_bytes < 4096 )); then
    echo "Screenshot $label is unexpectedly small (${screenshot_bytes} bytes)." >&2
    exit 1
  fi

  if command -v identify >/dev/null 2>&1; then
    local color_count
    color_count="$(identify -format '%k' "$ARTIFACT_DIR/$label.png")"
    if (( color_count < 16 )); then
      echo "Screenshot $label appears blank (${color_count} colors)." >&2
      exit 1
    fi
  fi
}

capture_state "launch"

if [[ "$NETWORK_CYCLE" == "1" ]]; then
  NETWORK_WAS_DISABLED=1
  "$ADB" shell svc wifi disable
  "$ADB" shell svc data disable
  sleep 2
  capture_state "offline"

  "$ADB" shell svc wifi enable
  "$ADB" shell svc data enable
  NETWORK_WAS_DISABLED=0
  sleep 3
  capture_state "network-restored"

  if ! "$ADB" shell pidof "$PACKAGE_NAME" >/dev/null; then
    echo "App process stopped during network transition." >&2
    exit 1
  fi
fi

"$ADB" logcat -d -v threadtime >"$ARTIFACT_DIR/logcat.txt"
if rg -q "FATAL EXCEPTION:.*|ANR in $PACKAGE_NAME" "$ARTIFACT_DIR/logcat.txt"; then
  echo "Crash or ANR detected. See $ARTIFACT_DIR/logcat.txt" >&2
  exit 1
fi

resumed_activity="$("$ADB" shell dumpsys activity activities | sed -n 's/.*topResumedActivity=//p' | head -1)"
if [[ "$resumed_activity" != *"$PACKAGE_NAME"* ]]; then
  echo "App is not the resumed activity: $resumed_activity" >&2
  exit 1
fi

echo "Android smoke test passed."
echo "Package: $PACKAGE_NAME"
echo "Version: $installed_version ($installed_version_code)"
echo "Artifacts: $ARTIFACT_DIR"
