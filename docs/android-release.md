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
ANDROID_VERSION_NAME=2.0.69 ANDROID_VERSION_CODE=269 yarn android:release
```

The release packager verifies the APK package ID, version, signing certificate and
SHA-256 before replacing the canonical artifact and `public/downloads/android-version.json`.
