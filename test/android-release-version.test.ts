import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  androidManifestReleaseVersion,
  evaluateAndroidUpdate,
  formatAndroidReleaseVersion,
  normalizeAndroidReleaseVersion,
} from "../app/client/android-release-version";

describe("Android release version contract", () => {
  const installed = normalizeAndroidReleaseVersion({
    appVersionName: "2.0.72",
    appVersionCode: 272,
  });

  test("uses native package metadata instead of the embedded web resource version", () => {
    const native = normalizeAndroidReleaseVersion({
      appVersionName: "2.0.72",
      appVersionCode: "272",
      // A real native payload will not contain these. Keep them here so a
      // future broad object spread cannot accidentally make them authoritative.
      ...({
        version: "v2.16.1",
        androidVersion: "v2.16.1",
      } as Record<string, unknown>),
    });

    expect(native).toEqual({ name: "2.0.72", code: 272 });
    expect(formatAndroidReleaseVersion(native)).toBe("2.0.72 (272)");
  });

  test("keeps both Android native bridges able to report package version metadata", () => {
    const sources = [
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
      "android/app/src/main/java/com/jisudeng/chat/NextChatNativePlugin.java",
    ].map((file) => readFileSync(resolve(process.cwd(), file), "utf8"));

    for (const source of sources) {
      expect(source).toContain('"appVersionName"');
      expect(source).toContain('"appVersionCode"');
    }
  });

  test("offers an APK update only when the manifest versionCode increases", () => {
    expect(
      androidManifestReleaseVersion({
        version: "2.0.73",
        versionCode: "273",
      }),
    ).toEqual({ name: "2.0.73", code: 273 });

    expect(
      evaluateAndroidUpdate(installed, {
        version: "2.0.73",
        versionCode: 273,
      }),
    ).toMatchObject({
      hasUpdate: true,
      required: false,
      latest: { name: "2.0.73", code: 273 },
    });
  });

  test("does not offer an update when versionCode is unchanged, even if a web version looks newer", () => {
    expect(
      evaluateAndroidUpdate(installed, {
        version: "v2.16.1",
        versionCode: 272,
      }),
    ).toMatchObject({
      hasUpdate: false,
      required: false,
      latest: { name: "2.16.1", code: 272 },
    });
  });

  test("fails closed for a legacy manifest without versionCode", () => {
    expect(
      evaluateAndroidUpdate(installed, {
        latestVersion: "9.99.99",
      }),
    ).toMatchObject({
      hasUpdate: false,
      required: false,
      latest: { name: "9.99.99", code: undefined },
    });
  });

  test("uses minSupportedVersionCode for a mandatory APK update", () => {
    expect(
      evaluateAndroidUpdate(installed, {
        version: "2.0.74",
        versionCode: 274,
        minSupportedVersionCode: 273,
      }),
    ).toMatchObject({ hasUpdate: true, required: true });
  });

  test("keeps the Android UI on the native release contract", () => {
    const mobileApp = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );

    expect(mobileApp).toContain("<AndroidReleaseVersionProvider>");
    expect(mobileApp).toContain("useInstalledAndroidReleaseVersion()");
    expect(mobileApp).toContain(
      "evaluateAndroidUpdate(installedRelease, manifest)",
    );
    expect(mobileApp).not.toContain("compareVersions(");
    expect(mobileApp).not.toContain(
      "clientConfig?.androidVersion || clientConfig?.version",
    );
  });

  test("does not default Android build metadata to the web bundle version", () => {
    const buildConfig = readFileSync(
      resolve(process.cwd(), "app/config/build.ts"),
      "utf8",
    );

    expect(buildConfig).not.toContain('isAndroidApp ? "0.0.0-dev" : version');
    expect(buildConfig).toContain("androidVersionCode");
    expect(buildConfig).not.toContain(
      "const androidVersion = process.env.NEXT_PUBLIC_ANDROID_VERSION ?? version",
    );
  });
});
