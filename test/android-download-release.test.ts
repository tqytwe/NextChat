import { describe, expect, test } from "@jest/globals";

import { canonicalAndroidApkPath } from "../app/download/android/android-download-release";

describe("Android download manifest APK URL", () => {
  test("accepts only the relative canonical APK URL with a version-code cache key", () => {
    expect(
      canonicalAndroidApkPath(
        "/downloads/jisudengchat-android.apk?v=2.0.74-274",
      ),
    ).toBe("/downloads/jisudengchat-android.apk?v=2.0.74-274");
  });

  test.each([
    "https://wrong.example/downloads/jisudengchat-android.apk?v=2.0.74-274",
    "//wrong.example/downloads/jisudengchat-android.apk?v=2.0.74-274",
    "/downloads/other.apk?v=2.0.74-274",
    "/downloads/jisudengchat-android.apk?v=2.0.74",
    "/downloads/jisudengchat-android.apk?v=2.0.74-274&source=unknown",
  ])("rejects untrusted or non-canonical paths: %s", (value) => {
    expect(canonicalAndroidApkPath(value)).toBe("");
  });
});
