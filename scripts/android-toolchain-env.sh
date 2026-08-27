#!/usr/bin/env bash
set -euo pipefail

readonly JISUDENG_ANDROID_CONFIG="${JISUDENG_ANDROID_CONFIG:-/home/codex/.config/jisudeng-mobile/android-release.env}"

if [[ "$(id -un)" != "codex" ]]; then
  echo "Jisudeng Android commands must run as the Dell build user codex." >&2
  exit 1
fi
if [[ ! -f "$JISUDENG_ANDROID_CONFIG" ]]; then
  echo "Missing Dell Android host configuration: $JISUDENG_ANDROID_CONFIG" >&2
  exit 1
fi
if [[ "$(stat -c '%a' "$JISUDENG_ANDROID_CONFIG")" != "600" ]]; then
  echo "Dell Android host configuration must have mode 0600: $JISUDENG_ANDROID_CONFIG" >&2
  exit 1
fi

# The host-owned file contains only reviewed paths and release environment values.
source "$JISUDENG_ANDROID_CONFIG"

for required in ANDROID_HOME ANDROID_SDK_ROOT ANDROID_AVD_HOME GRADLE_USER_HOME JAVA_HOME \
  JISUDENG_MAESTRO_BIN PLAYWRIGHT_BROWSERS_PATH JISUDENG_ANDROID_SECRETS_DIR \
  JISUDENG_ANDROID_RESULTS_ROOT JISUDENG_DIRECT_RELEASE_AVD JISUDENG_DIRECT_E2E_AVD \
  JISUDENG_PLAY_AVD JISUDENG_DIRECT_RELEASE_SERIAL JISUDENG_DIRECT_E2E_SERIAL \
  JISUDENG_PLAY_SERIAL; do
  if [[ -z "${!required:-}" ]]; then
    echo "Missing required Dell Android setting: $required" >&2
    exit 1
  fi
done

if [[ "$ANDROID_HOME" != "/home/dell/Android/Sdk" || "$ANDROID_SDK_ROOT" != "$ANDROID_HOME" ]]; then
  echo "Android SDK must be fixed to /home/dell/Android/Sdk." >&2
  exit 1
fi

export ANDROID_HOME ANDROID_SDK_ROOT ANDROID_AVD_HOME GRADLE_USER_HOME JAVA_HOME
export PLAYWRIGHT_BROWSERS_PATH PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
