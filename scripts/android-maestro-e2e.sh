#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/android-toolchain-env.sh"
export JISUDENG_ANDROID_PROFILE="${JISUDENG_ANDROID_PROFILE:-direct-e2e}"
source "$SCRIPT_DIR/android-device.sh"
assert_expected_avd
ADB="$SCRIPT_DIR/android-adb.sh"
MAESTRO="$JISUDENG_MAESTRO_BIN"
# Maestro uses native, debug-only transport fixtures for deterministic 401/502
# recovery coverage. Release acceptance is covered separately by the signed-APK
# smoke test; never run these fixtures against the public handoff artifact.
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

if [[ "${ANDROID_E2E_BUILD:-1}" == "1" ]]; then
  : "${NEXT_PUBLIC_SUB2API_BASE_URL:?Set NEXT_PUBLIC_SUB2API_BASE_URL for the Android build.}"
  : "${NEXT_PUBLIC_NEXTCHAT_WEB_URL:?Set NEXT_PUBLIC_NEXTCHAT_WEB_URL for the Android build.}"
  # The debug APK must report the same release version as the canonical
  # artifact. Otherwise the background update prompt correctly treats
  # 0.0.0-dev as obsolete and blocks every fixture flow with its dialog.
  if [[ -z "${ANDROID_VERSION_NAME:-}" || -z "${ANDROID_VERSION_CODE:-}" ]]; then
    readarray -t E2E_RELEASE_VERSION < <(
      node -e 'const release = require("./public/downloads/android-version.json"); console.log(release.version); console.log(release.versionCode);'
    )
    export ANDROID_VERSION_NAME="${ANDROID_VERSION_NAME:-${E2E_RELEASE_VERSION[0]}}"
    export ANDROID_VERSION_CODE="${ANDROID_VERSION_CODE:-${E2E_RELEASE_VERSION[1]}}"
  fi
  export NEXT_PUBLIC_ANDROID_VERSION="${NEXT_PUBLIC_ANDROID_VERSION:-$ANDROID_VERSION_NAME}"
  export NEXT_PUBLIC_ANDROID_VERSION_CODE="${NEXT_PUBLIC_ANDROID_VERSION_CODE:-$ANDROID_VERSION_CODE}"
  corepack yarn android:sync
  (cd android && ./gradlew assembleDebug)
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "E2E debug APK not found: $APK_PATH" >&2
  exit 1
fi

# Debug fixtures cannot replace the production-signed package in place. This
# script is an isolated test-device workflow and clears app state below anyway,
# so remove an incompatible signing lineage before installing the debug build.
if ! "$ADB" install -r "$APK_PATH" >/dev/null 2>&1; then
  "$ADB" uninstall "$PACKAGE_NAME" >/dev/null 2>&1 || true
  "$ADB" install "$APK_PATH" >/dev/null
fi
"$ADB" push "$REFERENCE_IMAGE" /sdcard/Pictures/jisudeng-e2e-reference.png >/dev/null
"$ADB" shell am broadcast \
  -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
  -d file:///sdcard/Pictures/jisudeng-e2e-reference.png >/dev/null
"$ADB" shell pm clear "$PACKAGE_NAME" >/dev/null
"$ADB" shell pm grant "$PACKAGE_NAME" android.permission.POST_NOTIFICATIONS || true

run_flow() {
  local status
  if "$MAESTRO" test \
      -e E2E_EMAIL="$E2E_EMAIL" \
      -e E2E_PASSWORD="$E2E_PASSWORD" \
      "$1"; then
    status=0
  else
    status=$?
  fi

  # Maestro records -e values in its debug JSON/log files. Scrub only the
  # exact test values after each flow so credentials never remain on disk.
  local debug_root="${MAESTRO_DEBUG_ROOT:-/home/codex/.maestro/tests}"
  if [[ -d "$debug_root" ]] && command -v perl >/dev/null 2>&1; then
    while IFS= read -r -d '' debug_file; do
      E2E_EMAIL="$E2E_EMAIL" E2E_PASSWORD="$E2E_PASSWORD" perl -pi -e '
        my $email = $ENV{E2E_EMAIL} // "";
        my $password = $ENV{E2E_PASSWORD} // "";
        s/\Q$email\E/[redacted-email]/g if length $email;
        s/\Q$password\E/[redacted-password]/g if length $password;
      ' "$debug_file"
    done < <(find "$debug_root" -type f -print0)
  fi
  return "$status"
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
run_flow .maestro/flows/09-content-kit.yaml
