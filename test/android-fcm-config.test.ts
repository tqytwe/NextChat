import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import { afterEach, describe, expect, test } from "@jest/globals";

const script = path.resolve(
  process.cwd(),
  "scripts/validate-android-fcm-config.mjs",
);
const temporaryRoots: string[] = [];

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "nextchat-android-fcm-"));
  temporaryRoots.push(root);
  mkdirSync(path.join(root, "android/app/src/play"), { recursive: true });
  mkdirSync(path.join(root, "android/app/src/direct"), { recursive: true });
  return root;
}

function writeGoogleServices(root: string, relativePath: string, packageName: string) {
  writeFileSync(
    path.join(root, relativePath),
    JSON.stringify(
      {
        project_info: {
          project_id: "jisudeng-test",
          project_number: "1234567890",
        },
        client: [
          {
            client_info: {
              mobilesdk_app_id: "1:1234567890:android:test",
              android_client_info: {
                package_name: packageName,
              },
            },
            api_key: [{ current_key: "test-api-key" }],
          },
        ],
      },
      null,
      2,
    ),
  );
}

function validate(root: string, distribution = "play") {
  return spawnSync(
    process.execPath,
    [script, `--distribution=${distribution}`],
    {
      cwd: root,
      encoding: "utf-8",
    },
  );
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Android FCM config release gate", () => {
  test("fails release validation when no Firebase Android config is present", () => {
    const root = createFixture();

    const result = validate(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Release builds require a real Firebase google-services.json",
    );
    expect(result.stderr).toContain("com.jisudeng.chat");
  });

  test("rejects Firebase configs for a different Android package", () => {
    const root = createFixture();
    writeGoogleServices(
      root,
      "android/app/src/play/google-services.json",
      "com.example.wrong",
    );

    const result = validate(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "does not contain Firebase Android client package com.jisudeng.chat",
    );
    expect(result.stderr).toContain("com.example.wrong");
  });

  test("accepts a flavor-specific Firebase config for the app package", () => {
    const root = createFixture();
    writeGoogleServices(
      root,
      "android/app/src/play/google-services.json",
      "com.jisudeng.chat",
    );

    const result = validate(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "using android/app/src/play/google-services.json",
    );
    expect(result.stdout).toContain("jisudeng-test");
  });
});
