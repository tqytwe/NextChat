import { describe, expect, test } from "@jest/globals";

import { canonicalAndroidApkPath } from "../app/download/android/android-download-release";

describe("Android download manifest APK URL", () => {
  test("accepts the relative canonical APK URL with a content hash cache key", () => {
    expect(
      canonicalAndroidApkPath(
        "/downloads/jisudengchat-android.apk?v=2.0.74-274-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).toBe(
      "/downloads/jisudengchat-android.apk?v=2.0.74-274-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  test("continues to accept legacy release URLs during upgrades", () => {
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
    "/downloads/jisudengchat-android.apk?v=2.0.74-274-aaaa",
    "/downloads/jisudengchat-android.apk?v=2.0.74-274&source=unknown",
  ])("rejects untrusted or non-canonical paths: %s", (value) => {
    expect(canonicalAndroidApkPath(value)).toBe("");
  });
});
