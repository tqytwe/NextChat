import { execFileSync, spawnSync } from "child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import path from "path";

import { afterEach, describe, expect, test } from "@jest/globals";

const packageScript = path.resolve(
  process.cwd(),
  "scripts/package-android-release.mjs",
);
const temporaryRoots: string[] = [];

type FixtureOptions = {
  actualVersion?: string;
  actualVersionCode?: number;
  outputVersion?: string;
  outputVersionCode?: number;
  embeddedVersion?: string;
  embeddedVersionCode?: number;
  embeddedApkUrl?: string;
  includeEmbeddedManifest?: boolean;
  includeAndroidReleaseVersion?: boolean;
  signingCertificateSha256?: string;
  publishedManifest?: Record<string, unknown>;
};

const releaseSigningCertificateSha256 =
  "cd7abbd79daf6648a429ff34d7450b18cfb6b416e660b2f5169178e0a488627e";

function writeJson(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function git(root: string, args: string[]) {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
}

function createFixture(options: FixtureOptions = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "nextchat-android-release-"));
  temporaryRoots.push(root);

  const releaseDir = path.join(root, "android/app/build/outputs/apk/release");
  const embeddedAssetsDir = path.join(
    root,
    "android/app/src/main/assets/public",
  );
  const embeddedDownloadsDir = path.join(embeddedAssetsDir, "downloads");
  const downloadsDir = path.join(root, "public/downloads");
  const toolsDir = path.join(root, "tools");
  mkdirSync(releaseDir, { recursive: true });
  mkdirSync(embeddedAssetsDir, { recursive: true });
  mkdirSync(embeddedDownloadsDir, { recursive: true });
  mkdirSync(downloadsDir, { recursive: true });
  mkdirSync(toolsDir, { recursive: true });

  const sourceApk = path.join(releaseDir, "app-release.apk");
  const publishedApk = path.join(downloadsDir, "jisudengchat-android.apk");
  const manifestPath = path.join(downloadsDir, "android-version.json");
  writeFileSync(sourceApk, "new release APK bytes");
  writeFileSync(publishedApk, "previous release APK bytes");
  writeJson(path.join(releaseDir, "output-metadata.json"), {
    version: 3,
    artifactType: { type: "APK", kind: "Directory" },
    applicationId: "com.jisudeng.chat",
    variantName: "release",
    elements: [
      {
        type: "SINGLE",
        filters: [],
        attributes: [],
        versionCode: options.outputVersionCode ?? 266,
        versionName: options.outputVersion ?? "2.0.66",
        outputFile: "app-release.apk",
      },
    ],
    elementType: "File",
  });
  writeJson(
    manifestPath,
    options.publishedManifest ?? {
      platform: "android",
      version: "2.0.65",
      versionCode: 265,
      apkUrl: "/downloads/jisudengchat-android.apk?v=2.0.65-265",
    },
  );
  const embeddedVersion = options.embeddedVersion ?? "2.0.66";
  const embeddedVersionCode = options.embeddedVersionCode ?? 266;
  const embeddedApkUrl =
    options.embeddedApkUrl ??
    `/downloads/jisudengchat-android.apk?v=${embeddedVersion}-${embeddedVersionCode}`;
  const embeddedConfig = JSON.stringify({
    // The web bundle version is intentionally independent from Android release
    // metadata. The release gate validates only Android release fields.
    version: "v2.16.1",
    webVersion: "v2.16.1",
    isAndroidApp: true,
    ...(options.includeAndroidReleaseVersion === false
      ? {}
      : { androidReleaseVersion: embeddedVersion }),
    androidVersion: embeddedVersion,
    androidVersionCode: embeddedVersionCode,
    androidApkUrl: embeddedApkUrl,
  }).replace(/"/g, "&quot;");
  writeFileSync(
    path.join(embeddedAssetsDir, "index.html"),
    `<meta name="config" content="${embeddedConfig}">`,
  );
  if (options.includeEmbeddedManifest) {
    writeJson(path.join(embeddedDownloadsDir, "android-version.json"), {
      platform: "android",
      version: "2.0.74",
      versionCode: 274,
      sha256: "stale-self-checksum",
    });
  }

  const aaptPath = path.join(toolsDir, "aapt");
  writeFileSync(
    aaptPath,
    [
      "#!/bin/sh",
      `printf '%s\\n' \"package: name='com.jisudeng.chat' versionCode='${
        options.actualVersionCode ?? 266
      }' versionName='${options.actualVersion ?? "2.0.66"}'\"`,
    ].join("\n"),
  );
  chmodSync(aaptPath, 0o755);

  const apksignerPath = path.join(toolsDir, "apksigner");
  writeFileSync(
    apksignerPath,
    [
      "#!/bin/sh",
      `printf '%s\\n' "Signer #1 certificate SHA-256 digest: ${
        options.signingCertificateSha256 ?? releaseSigningCertificateSha256
      }"`,
    ].join("\n"),
  );
  chmodSync(apksignerPath, 0o755);

  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Release Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "release fixture"]);

  return { apksignerPath, aaptPath, manifestPath, publishedApk, root };
}

function packageRelease(
  fixture: ReturnType<typeof createFixture>,
  env: Record<string, string>,
) {
  const releaseEnv = { ...process.env };
  delete releaseEnv.ANDROID_VERSION_NAME;
  delete releaseEnv.ANDROID_VERSION_CODE;

  return spawnSync(process.execPath, [packageScript], {
    cwd: fixture.root,
    encoding: "utf-8",
    env: {
      ...releaseEnv,
      AAPT_PATH: fixture.aaptPath,
      APKSIGNER_PATH: fixture.apksignerPath,
      ...env,
    },
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Android release package version gate", () => {
  test("derives every published version field from the APK output metadata", () => {
    const fixture = createFixture();

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "v2.0.66",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).toBe(0);
    expect(
      JSON.parse(readFileSync(fixture.manifestPath, "utf-8")),
    ).toMatchObject({
      channel: "direct",
      version: "2.0.66",
      latestVersion: "2.0.66",
      versionCode: 266,
      apkUrl:
        "/downloads/jisudengchat-android.apk?v=2.0.66-266-90ad4c76a531bcd5e5d188e3c2d5670d77e311ad7b844d93374259cc33c3a2cc",
      builtFromCommit: expect.any(String),
      signingCertificateSha256: releaseSigningCertificateSha256,
    });
    expect(readFileSync(fixture.publishedApk, "utf-8")).toBe(
      "new release APK bytes",
    );
  });

  test("allows staged and unstaged release artifacts without masking source changes", () => {
    const fixture = createFixture();
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf-8"));
    writeJson(fixture.manifestPath, { ...manifest, notes: ["staged"] });
    git(fixture.root, ["add", "public/downloads/android-version.json"]);
    writeFileSync(fixture.publishedApk, "locally rebuilt APK bytes");

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).toBe(0);
  });

  test("rejects a reused version code after a manifest was manually downgraded", () => {
    const fixture = createFixture();
    const originalManifest = JSON.parse(
      readFileSync(fixture.manifestPath, "utf-8"),
    );
    writeJson(fixture.manifestPath, {
      ...originalManifest,
      version: "2.0.66",
      latestVersion: "2.0.66",
      versionCode: 266,
      apkUrl:
        "/downloads/jisudengchat-android.apk?v=2.0.66-266-90ad4c76a531bcd5e5d188e3c2d5670d77e311ad7b844d93374259cc33c3a2cc",
    });
    git(fixture.root, ["add", "public/downloads/android-version.json"]);
    git(fixture.root, ["commit", "--quiet", "-m", "publish 266"]);

    writeJson(fixture.manifestPath, originalManifest);
    git(fixture.root, ["add", "public/downloads/android-version.json"]);
    git(fixture.root, ["commit", "--quiet", "-m", "bad downgrade"]);

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Android versionCode must exceed every previously published versionCode (highest 266, received 266)",
    );
    expect(JSON.parse(readFileSync(fixture.manifestPath, "utf-8"))).toEqual(
      originalManifest,
    );
  });

  test("rejects an environment version mismatch before replacing public files", () => {
    const fixture = createFixture();
    const originalManifest = readFileSync(fixture.manifestPath, "utf-8");
    const originalApk = readFileSync(fixture.publishedApk, "utf-8");

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.67",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "ANDROID_VERSION_NAME/CODE does not match the release APK",
    );
    expect(readFileSync(fixture.manifestPath, "utf-8")).toBe(originalManifest);
    expect(readFileSync(fixture.publishedApk, "utf-8")).toBe(originalApk);
  });

  test("rejects an environment version code mismatch before replacing public files", () => {
    const fixture = createFixture();
    const originalManifest = readFileSync(fixture.manifestPath, "utf-8");
    const originalApk = readFileSync(fixture.publishedApk, "utf-8");

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
      ANDROID_VERSION_CODE: "267",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "ANDROID_VERSION_NAME/CODE does not match the release APK",
    );
    expect(readFileSync(fixture.manifestPath, "utf-8")).toBe(originalManifest);
    expect(readFileSync(fixture.publishedApk, "utf-8")).toBe(originalApk);
  });

  test("rejects an embedded web config that disagrees with the APK release", () => {
    const fixture = createFixture({
      embeddedVersion: "2.16.1",
      embeddedVersionCode: 21601,
    });
    const originalManifest = readFileSync(fixture.manifestPath, "utf-8");
    const originalApk = readFileSync(fixture.publishedApk, "utf-8");

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Embedded Android web build config does not match the release APK",
    );
    expect(readFileSync(fixture.manifestPath, "utf-8")).toBe(originalManifest);
    expect(readFileSync(fixture.publishedApk, "utf-8")).toBe(originalApk);
  });

  test("rejects an embedded APK URL on a different host", () => {
    const fixture = createFixture({
      embeddedApkUrl:
        "https://wrong.example/downloads/jisudengchat-android.apk?v=2.0.66-266",
    });

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Embedded Android APK URL must be a relative canonical URL",
    );
  });

  test("rejects an embedded web build without explicit Android release metadata", () => {
    const fixture = createFixture({ includeAndroidReleaseVersion: false });
    const originalManifest = readFileSync(fixture.manifestPath, "utf-8");
    const originalApk = readFileSync(fixture.publishedApk, "utf-8");

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "androidReleaseVersion is missing versionName",
    );
    expect(readFileSync(fixture.manifestPath, "utf-8")).toBe(originalManifest);
    expect(readFileSync(fixture.publishedApk, "utf-8")).toBe(originalApk);
  });

  test("rejects an embedded Android release manifest before publishing", () => {
    const fixture = createFixture({ includeEmbeddedManifest: true });
    const originalManifest = readFileSync(fixture.manifestPath, "utf-8");
    const originalApk = readFileSync(fixture.publishedApk, "utf-8");

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Embedded Android release manifest must not be bundled",
    );
    expect(readFileSync(fixture.manifestPath, "utf-8")).toBe(originalManifest);
    expect(readFileSync(fixture.publishedApk, "utf-8")).toBe(originalApk);
  });

  test("requires both release environment values during packaging", () => {
    const fixture = createFixture();

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "ANDROID_VERSION_NAME and ANDROID_VERSION_CODE must be provided together",
    );
  });

  test("rejects an internally inconsistent published manifest", () => {
    const fixture = createFixture({
      publishedManifest: {
        platform: "android",
        version: "2.0.65",
        latestVersion: "2.0.64",
        versionCode: 265,
      },
    });

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Published Android manifest version and latestVersion are inconsistent",
    );
  });

  test("rejects output metadata that does not describe the actual APK", () => {
    const fixture = createFixture({
      actualVersion: "2.0.65",
      actualVersionCode: 265,
    });
    const originalManifest = readFileSync(fixture.manifestPath, "utf-8");
    const originalApk = readFileSync(fixture.publishedApk, "utf-8");

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "APK output metadata does not match the release APK",
    );
    expect(readFileSync(fixture.manifestPath, "utf-8")).toBe(originalManifest);
    expect(readFileSync(fixture.publishedApk, "utf-8")).toBe(originalApk);
  });

  test("rejects a release APK signed with an unexpected certificate before publishing", () => {
    const fixture = createFixture({
      signingCertificateSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    const originalManifest = readFileSync(fixture.manifestPath, "utf-8");
    const originalApk = readFileSync(fixture.publishedApk, "utf-8");

    const result = packageRelease(fixture, {
      ANDROID_VERSION_NAME: "2.0.66",
      ANDROID_VERSION_CODE: "266",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Release APK signing certificate expected");
    expect(readFileSync(fixture.manifestPath, "utf-8")).toBe(originalManifest);
    expect(readFileSync(fixture.publishedApk, "utf-8")).toBe(originalApk);
  });
});
