#!/usr/bin/env bash
set -euo pipefail

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/home/dell/Android/Sdk}}"
ADB="${ADB:-$SDK_ROOT/platform-tools/adb}"
MAESTRO="${MAESTRO:-/home/codex/.maestro/bin/maestro}"
APK_PATH="${ANDROID_E2E_APK_PATH:-android/app/build/outputs/apk/debug/app-debug.apk}"
PACKAGE_NAME="${ANDROID_PACKAGE_NAME:-com.jisudeng.chat}"
MAIN_ACTIVITY="${ANDROID_MAIN_ACTIVITY:-.MainActivity}"
REFERENCE_IMAGE="${ANDROID_E2E_REFERENCE_IMAGE:-public/android-chrome-192x192.png}"

: "${E2E_EMAIL:?Set E2E_EMAIL without committing it to the repository.}"
: "${E2E_PASSWORD:?Set E2E_PASSWORD without committing it to the repository.}"

for executable in "$ADB" "$MAESTRO"; do
  if [[ ! -x "$executable" ]]; then
    echo "Missing executable: $executable" >&2
    exit 1
  fi
done

if [[ "${ANDROID_E2E_BUILD:-0}" == "1" ]]; then
  : "${NEXT_PUBLIC_SUB2API_BASE_URL:?Set NEXT_PUBLIC_SUB2API_BASE_URL for the Android build.}"
  : "${NEXT_PUBLIC_NEXTCHAT_WEB_URL:?Set NEXT_PUBLIC_NEXTCHAT_WEB_URL for the Android build.}"
  corepack yarn android:sync
  (cd android && ./gradlew assembleDebug)
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "Debug APK not found: $APK_PATH" >&2
  exit 1
fi

"$ADB" install -r "$APK_PATH" >/dev/null
"$ADB" push "$REFERENCE_IMAGE" /sdcard/Pictures/jisudeng-e2e-reference.png >/dev/null
"$ADB" shell am broadcast \
  -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
  -d file:///sdcard/Pictures/jisudeng-e2e-reference.png >/dev/null
"$ADB" shell pm clear "$PACKAGE_NAME" >/dev/null
"$ADB" shell pm grant "$PACKAGE_NAME" android.permission.POST_NOTIFICATIONS || true

run_flow() {
  "$MAESTRO" test \
    -e E2E_EMAIL="$E2E_EMAIL" \
    -e E2E_PASSWORD="$E2E_PASSWORD" \
    "$1"
}

ensure_logged_in() {
  if ! run_flow .maestro/subflows/ensure-login.yaml; then
    run_flow .maestro/subflows/ensure-login.yaml
  fi
}

"$ADB" shell am start -W -n "$PACKAGE_NAME/$MAIN_ACTIVITY" >/dev/null
ensure_logged_in
run_flow .maestro/flows/01-cold-start-group.yaml
run_flow .maestro/flows/02-first-message-session.yaml
run_flow .maestro/flows/03-native-long-press.yaml
run_flow .maestro/flows/04-network-recovery.yaml
run_flow .maestro/flows/10-local-chat-attachment.yaml
run_flow .maestro/flows/11-content-kit-output-plan.yaml

"$ADB" shell am force-stop "$PACKAGE_NAME"
"$ADB" shell am start -W -n "$PACKAGE_NAME/$MAIN_ACTIVITY" \
  --ez e2eFirstBootstrap401 true >/dev/null
run_flow .maestro/flows/05-session-credential-recovery.yaml

"$ADB" shell am force-stop "$PACKAGE_NAME"
"$ADB" shell pm clear "$PACKAGE_NAME" >/dev/null
"$ADB" shell pm grant "$PACKAGE_NAME" android.permission.POST_NOTIFICATIONS || true
"$ADB" shell am start -W -n "$PACKAGE_NAME/$MAIN_ACTIVITY" \
  --ez e2eFirstImage502 true >/dev/null
ensure_logged_in
run_flow .maestro/flows/06-local-reference-image.yaml

"$ADB" shell am force-stop "$PACKAGE_NAME"
"$ADB" shell pm clear "$PACKAGE_NAME" >/dev/null
"$ADB" shell pm grant "$PACKAGE_NAME" android.permission.POST_NOTIFICATIONS || true
"$ADB" shell am start -W -n "$PACKAGE_NAME/$MAIN_ACTIVITY" \
  --ez e2eFirstImage502 true >/dev/null
ensure_logged_in
run_flow .maestro/flows/07-retry-502.yaml
run_flow .maestro/flows/08-local-gallery-restart.yaml
