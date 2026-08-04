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
ANDROID_VERSION_NAME=2.0.77 ANDROID_VERSION_CODE=277 yarn android:release
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

The published manifest uses a content-addressed cache key
`?v=<versionName>-<versionCode>-<sha256>`. The SHA-256 is calculated from the
signed APK, so replacing an artifact can never reuse a Cloudflare/browser cache
entry. Older embedded bundles may still advertise the legacy
`?v=<versionName>-<versionCode>` fallback; it is accepted only for that same
release and the update/download pages always prefer the manifest URL.

The APK must not bundle `assets/public/downloads/android-version.json` or an APK
copy. Those are downloadable release artifacts, not application resources. The
Android update probe resolves the authoritative manifest from the official web
host, while the release verifier rejects any embedded copy so an older manifest
cannot survive an upgrade.

The generated manifest records `builtFromCommit` (also retained as the legacy
`sourceCommit` field) so the source revision used for the APK cannot be confused
with the later Git commit that records the release artifact.

The public Android download page refreshes its APK link and QR code from the
same release manifest. It accepts only the relative canonical APK path, so a
stale build variable or an unexpected download host cannot redirect users.

`scripts/verify-android-release-artifact.mjs` is the final artifact gate. It
checks the canonical APK hash, the native APK package/version, the embedded
Android release config, and the public manifest together. It also requires the
embedded web bundle to expose `webVersion` separately from the APK release
fields. Do not manually replace the APK or downgrade the manifest: the
packager rejects any `versionCode` that is not greater than every version code
already recorded in Git history.

For a mandatory update, publish `minSupportedVersionCode` in
`public/downloads/android-version.json`. Do not use a semantic string version
for mandatory-update policy.
