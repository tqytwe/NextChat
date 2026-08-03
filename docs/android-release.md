# Android Release Artifact

The only Android APK handoff path is:

`public/downloads/jisudengchat-android.apk`

The Android download page, update manifest, emulator smoke test, Maestro E2E flow,
and the repository release artifact all use this path. It is checked into Git and
is the file that deployment must publish.

`android/app/build/outputs/apk/release/app-release.apk` is a Gradle intermediate.
It must never be sent to testers or referenced by deployment instructions.

Create a release with one command after setting the version environment values:

```bash
ANDROID_VERSION_NAME=2.0.74 ANDROID_VERSION_CODE=274 yarn android:release
```

The release packager verifies the APK package ID, version, signing certificate and
SHA-256 before replacing the canonical artifact and `public/downloads/android-version.json`.

## Version contract

`ANDROID_VERSION_NAME` is the user-visible Android application version and
`ANDROID_VERSION_CODE` is the monotonically increasing Android release number.
The installed APK is authoritative: the account page, analytics, and update
checks read these fields from Android package metadata. Update eligibility is
compared only by `versionCode`; an APK with the same code is never treated as an
update.

The NextChat/Tauri version embedded in the web resources is a separate web
bundle version (`webVersion`, retained as the legacy `version` field for
desktop callers). The Android build config uses the explicit
`androidReleaseVersion`/`androidVersionCode` fields. The web value must never be
shown as the installed APK version or used for APK update comparisons.

Before replacing the canonical APK, the packager rejects a build unless all of
the following agree on both version name and version code:

- the Gradle output metadata;
- the actual signed APK manifest;
- `ANDROID_VERSION_NAME` and `ANDROID_VERSION_CODE`;
- the Android metadata embedded in `assets/public/index.html`
  (`androidReleaseVersion` and `androidVersionCode`).

It also requires the embedded APK URL to use the canonical cache key
`?v=<versionName>-<versionCode>`. This makes a stale web-resource Android
version a release-time error rather than a user-visible version mismatch.

The generated manifest records `builtFromCommit` (also retained as the legacy
`sourceCommit` field) so the source revision used for the APK cannot be confused
with the later Git commit that records the release artifact.

The public Android download page refreshes its APK link and QR code from the
same release manifest. It accepts only the relative canonical APK path, so a
stale build variable or an unexpected download host cannot redirect users.

For a mandatory update, publish `minSupportedVersionCode` in
`public/downloads/android-version.json`. Do not use a semantic string version
for mandatory-update policy.
