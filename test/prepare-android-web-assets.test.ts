import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "@jest/globals";

const sourceScript = path.resolve(
  process.cwd(),
  "scripts/prepare-android-web-assets.mjs",
);
const temporaryRoots: string[] = [];

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "nextchat-android-assets-"));
  temporaryRoots.push(root);
  const scriptsDir = path.join(root, "scripts");
  const downloadsDir = path.join(root, "out/downloads");
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(downloadsDir, { recursive: true });
  cpSync(sourceScript, path.join(scriptsDir, "prepare-android-web-assets.mjs"));
  writeFileSync(
    path.join(downloadsDir, "android-version.json"),
    '{"version":"2.0.74","versionCode":274,"sha256":"stale"}\n',
  );
  writeFileSync(path.join(downloadsDir, "old.apk"), "old apk");
  return { root, downloadsDir };
}

function prepare(
  fixture: ReturnType<typeof createFixture>,
  environment: Record<string, string>,
) {
  return execFileSync(
    process.execPath,
    ["scripts/prepare-android-web-assets.mjs"],
    {
      cwd: fixture.root,
      encoding: "utf-8",
      env: { ...process.env, ...environment },
    },
  );
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Android embedded release metadata", () => {
  test("removes stale release assets before Capacitor sync", () => {
    const fixture = createFixture();
    const output = prepare(fixture, {});

    expect(output).toContain("removed bundled release asset");
    expect(() =>
      readFileSync(path.join(fixture.downloadsDir, "android-version.json")),
    ).toThrow();
    expect(() =>
      readFileSync(path.join(fixture.downloadsDir, "old.apk")),
    ).toThrow();
  });
});
