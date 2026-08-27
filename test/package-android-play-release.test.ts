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
  "scripts/package-android-play-release.mjs",
);
const temporaryRoots: string[] = [];
const releaseCertificate =
  "cd7abbd79daf6648a429ff34d7450b18cfb6b416e660b2f5169178e0a488627e";

function fixture(certificate = releaseCertificate) {
  const root = mkdtempSync(path.join(tmpdir(), "nextchat-play-release-"));
  temporaryRoots.push(root);
  const bundleDir = path.join(
    root,
    "android/app/build/outputs/bundle/playRelease",
  );
  const toolsDir = path.join(root, "tools");
  mkdirSync(bundleDir, { recursive: true });
  mkdirSync(toolsDir, { recursive: true });
  writeFileSync(path.join(bundleDir, "app-play-release.aab"), "signed aab");

  const jarsigner = path.join(toolsDir, "jarsigner");
  writeFileSync(jarsigner, "#!/bin/sh\nexit 0\n");
  chmodSync(jarsigner, 0o755);

  const keytool = path.join(toolsDir, "keytool");
  const formatted = certificate.match(/.{2}/g)?.join(":") || certificate;
  writeFileSync(keytool, `#!/bin/sh\nprintf '%s\\n' 'SHA256: ${formatted}'\n`);
  chmodSync(keytool, 0o755);

  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: root,
  });
  execFileSync("git", ["config", "user.name", "Release Test"], {
    cwd: root,
  });
  writeFileSync(path.join(root, "source.txt"), "source");
  execFileSync("git", ["add", "source.txt"], { cwd: root });
  execFileSync("git", ["commit", "--quiet", "-m", "source"], {
    cwd: root,
  });
  return { jarsigner, keytool, root };
}

function packageRelease(
  subject: ReturnType<typeof fixture>,
  extraEnv: Record<string, string> = {},
) {
  return spawnSync(process.execPath, [packageScript], {
    cwd: subject.root,
    encoding: "utf-8",
    env: {
      ...process.env,
      ANDROID_VERSION_NAME: "3.0.3",
      ANDROID_VERSION_CODE: "303",
      ANDROID_RELEASE_NOTES_ZH: "项目中心；任务详情",
      ANDROID_RELEASE_NOTES_EN: "Projects;Task details",
      ANDROID_RELEASE_NOTES_JA: "プロジェクト;タスク詳細",
      ANDROID_RELEASE_NOTES_KO: "프로젝트;작업 상세",
      JARSIGNER_PATH: subject.jarsigner,
      KEYTOOL_PATH: subject.keytool,
      ...extraEnv,
    },
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Android Play release packager", () => {
  test("records version, source, hash, signing certificate and localized notes", () => {
    const subject = fixture();
    const result = packageRelease(subject);

    expect(result.status).toBe(0);
    const manifest = JSON.parse(
      readFileSync(
        path.join(
          subject.root,
          "dist/android/play/app-play-release-3.0.3-303.json",
        ),
        "utf-8",
      ),
    );
    expect(manifest).toMatchObject({
      channel: "play",
      artifactType: "aab",
      packageName: "com.jisudeng.chat",
      version: "3.0.3",
      versionCode: 303,
      sourceCommit: expect.any(String),
      builtFromCommit: expect.any(String),
      signingCertificateSha256: releaseCertificate,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      notesByLocale: {
        "zh-CN": ["项目中心", "任务详情"],
        en: ["Projects", "Task details"],
        ja: ["プロジェクト", "タスク詳細"],
        ko: ["프로젝트", "작업 상세"],
      },
    });
    expect(manifest.sourceCommit).toBe(manifest.builtFromCommit);
  });

  test("rejects an unexpected upload signing certificate", () => {
    const subject = fixture("11".repeat(32));
    const result = packageRelease(subject);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Play AAB signing certificate expected");
  });
});
