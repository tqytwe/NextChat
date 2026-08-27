#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/android-toolchain-env.sh"

readarray -t release_values < <(
  node -e '
    const release = require("./android/release/direct.json");
    for (const key of ["version", "versionCode"]) console.log(release[key]);
    for (const locale of ["zh", "en", "ja", "ko"]) console.log((release.notes?.[locale] || []).join(";"));
  '
)

if [[ "${#release_values[@]}" != "6" ]] || [[ -z "${release_values[0]}" || -z "${release_values[1]}" ]]; then
  echo "Invalid android/release/direct.json." >&2
  exit 1
fi

export ANDROID_VERSION_NAME="${release_values[0]}"
export ANDROID_VERSION_CODE="${release_values[1]}"
export NEXT_PUBLIC_ANDROID_VERSION="$ANDROID_VERSION_NAME"
export NEXT_PUBLIC_ANDROID_VERSION_CODE="$ANDROID_VERSION_CODE"
export ANDROID_RELEASE_NOTES_ZH="${release_values[2]}"
export ANDROID_RELEASE_NOTES_EN="${release_values[3]}"
export ANDROID_RELEASE_NOTES_JA="${release_values[4]}"
export ANDROID_RELEASE_NOTES_KO="${release_values[5]}"

exec "$@"
