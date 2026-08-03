import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "@jest/globals";

const verificationScript = path.resolve(
  process.cwd(),
  "scripts/verify-android-release-artifact.mjs",
);
const temporaryRoots: string[] = [];

type FixtureOptions = {
  embeddedReleaseVersion?: string;
  embeddedVersionCode?: number;
  nativeVersion?: string;
  nativeVersionCode?: number;
  includeAndroidReleaseVersion?: boolean;
};

function writeJson(file: string, value: unknown) {
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function createFixture(options: FixtureOptions = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "nextchat-android-verify-"));
  temporaryRoots.push(root);
  const payloadRoot = path.join(root, "payload");
  const embeddedDir = path.join(payloadRoot, "assets/public");
  const downloadsDir = path.join(root, "public/downloads");
  const toolsDir = path.join(root, "tools");
  mkdirSync(embeddedDir, { recursive: true });
  mkdirSync(downloadsDir, { recursive: true });
  mkdirSync(toolsDir, { recursive: true });

  const releaseVersion = "2.0.76";
  const releaseVersionCode = 276;
  const apkPath = path.join(downloadsDir, "jisudengchat-android.apk");
  const manifestPath = path.join(downloadsDir, "android-version.json");
  const embeddedConfig = JSON.stringify({
    version: "v2.16.1",
    webVersion: "v2.16.1",
    isAndroidApp: true,
    ...(options.includeAndroidReleaseVersion === false
      ? {}
      : {
          androidReleaseVersion:
            options.embeddedReleaseVersion ?? releaseVersion,
        }),
    androidVersionCode: options.embeddedVersionCode ?? releaseVersionCode,
    androidApkUrl:
      "/downloads/jisudengchat-android.apk?v=" +
      releaseVersion +
      "-" +
      releaseVersionCode,
  }).replace(/"/g, "&quot;");
  writeFileSync(
    path.join(embeddedDir, "index.html"),
    '<meta name="config" content="' + embeddedConfig + '">',
  );
  execFileSync("zip", ["-q", apkPath, "assets/public/index.html"], {
    cwd: payloadRoot,
  });

  const apk = readFileSync(apkPath);
  writeJson(manifestPath, {
    platform: "android",
    version: releaseVersion,
    latestVersion: releaseVersion,
    versionCode: releaseVersionCode,
    packageName: "com.jisudeng.chat",
    apkUrl:
      "/downloads/jisudengchat-android.apk?v=" +
      releaseVersion +
      "-" +
      releaseVersionCode,
    sha256: createHash("sha256").update(apk).digest("hex"),
    bytes: apk.length,
    sourceCommit: "a".repeat(40),
    builtFromCommit: "a".repeat(40),
  });

  const aaptPath = path.join(toolsDir, "aapt");
  const nativeVersionCode = options.nativeVersionCode ?? releaseVersionCode;
  const nativeVersion = options.nativeVersion ?? releaseVersion;
  writeFileSync(
    aaptPath,
    "#!/bin/sh\n" +
      "printf '%s\\n' \"package: name='com.jisudeng.chat' versionCode='" +
      nativeVersionCode +
      "' versionName='" +
      nativeVersion +
      "'\"\n",
  );
  chmodSync(aaptPath, 0o755);

  return { aaptPath, apkPath, manifestPath, root };
}

function verify(fixture: ReturnType<typeof createFixture>) {
  return spawnSync(process.execPath, [verificationScript], {
    cwd: fixture.root,
    encoding: "utf-8",
    env: {
      ...process.env,
      ANDROID_RELEASE_APK_PATH: fixture.apkPath,
      ANDROID_RELEASE_MANIFEST_PATH: fixture.manifestPath,
      AAPT_PATH: fixture.aaptPath,
    },
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("canonical Android release verification", () => {
  test("requires matching APK, manifest, and embedded Android release metadata", () => {
    const result = verify(createFixture());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Verified canonical Android artifact");
  });

  test("rejects a legacy embedded web bundle without androidReleaseVersion", () => {
    const result = verify(
      createFixture({ includeAndroidReleaseVersion: false }),
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Embedded Android androidReleaseVersion does not match the release manifest",
    );
  });

  test("rejects an APK whose native version does not match the manifest", () => {
    const result = verify(createFixture({ nativeVersionCode: 275 }));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Canonical APK native package metadata does not match the Android release manifest",
    );
  });
});
