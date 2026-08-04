import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// This is an artifact-only gate. It never calls adb, changes a device, or
// reads credentials. Runtime preservation still needs the dedicated AVD flow.
const root = process.cwd();
const oldApkPath = resolvePath(
  process.env.ANDROID_OVERLAY_OLD_APK_PATH,
  path.join(
    root,
    "../sub2api-mobile-platform-20260804/frontend/public/downloads/jisudengchat-android.apk",
  ),
);
const newApkPath = resolvePath(
  process.env.ANDROID_OVERLAY_NEW_APK_PATH,
  path.join(root, "public/downloads/jisudengchat-android.apk"),
);
const expectedPackage = "com.jisudeng.chat";

function resolvePath(value, fallback) {
  const selected = String(value || fallback).trim();
  return path.isAbsolute(selected) ? selected : path.resolve(root, selected);
}

function requireFile(file, label) {
  if (!existsSync(file)) {
    throw new Error(`${label} APK is missing: ${file}`);
  }
}

function sdkToolCandidates(tool, configured) {
  const candidates = [];
  if (configured) candidates.push(configured);

  for (const sdkRoot of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]) {
    if (!sdkRoot) continue;
    const buildTools = path.join(sdkRoot, "build-tools");
    if (!existsSync(buildTools)) continue;
    for (const version of readdirSync(buildTools).sort().reverse()) {
      const candidate = path.join(buildTools, version, tool);
      if (existsSync(candidate)) candidates.push(candidate);
    }
  }

  candidates.push(tool);
  return [...new Set(candidates)];
}

function runFirstAvailable(candidates, args, label) {
  let missing;
  for (const candidate of candidates) {
    try {
      return {
        tool: candidate,
        output: execFileSync(candidate, args, { encoding: "utf8" }),
      };
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        missing = error;
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${label} failed with ${candidate}: ${message}`);
    }
  }
  const hint = missing instanceof Error ? ` (${missing.message})` : "";
  throw new Error(`No usable Android tool for ${label}${hint}`);
}

function readApk(apkPath) {
  const badging = runFirstAvailable(
    sdkToolCandidates("aapt", process.env.AAPT_PATH),
    ["dump", "badging", apkPath],
    `aapt package inspection for ${apkPath}`,
  );
  const packageLine = badging.output
    .split(/\r?\n/)
    .find((line) => line.startsWith("package: "));
  const packageName = packageLine?.match(/name='([^']+)'/)?.[1];
  const versionName = packageLine?.match(/versionName='([^']+)'/)?.[1];
  const versionCode = Number(packageLine?.match(/versionCode='([^']+)'/)?.[1]);
  if (!packageName || !versionName || !Number.isSafeInteger(versionCode)) {
    throw new Error(`aapt did not return valid package metadata for ${apkPath}`);
  }

  const signing = runFirstAvailable(
    sdkToolCandidates("apksigner", process.env.APKSIGNER_PATH),
    ["verify", "--verbose", "--print-certs", apkPath],
    `APK signature verification for ${apkPath}`,
  );
  const certificateSha256 = signing.output.match(
    /certificate SHA-256 digest:\s*([0-9a-f]{64})/i,
  )?.[1]?.toLowerCase();
  if (!certificateSha256) {
    throw new Error(`apksigner did not return a signing certificate for ${apkPath}`);
  }

  return {
    apkPath,
    packageName,
    versionName,
    versionCode,
    certificateSha256,
    sha256: createHash("sha256").update(readFileSync(apkPath)).digest("hex"),
  };
}

function assertCompatible(oldApk, newApk) {
  if (oldApk.packageName !== expectedPackage || newApk.packageName !== expectedPackage) {
    throw new Error(
      `Expected package ${expectedPackage}; received ${oldApk.packageName} -> ${newApk.packageName}`,
    );
  }
  if (oldApk.packageName !== newApk.packageName) {
    throw new Error("APK package names differ; Android cannot retain app data.");
  }
  if (newApk.versionCode <= oldApk.versionCode) {
    throw new Error(
      `New versionCode must increase (${oldApk.versionCode} -> ${newApk.versionCode}).`,
    );
  }
  if (oldApk.certificateSha256 !== newApk.certificateSha256) {
    throw new Error("APK signing certificates differ; adb install -r will not preserve app data.");
  }
}

requireFile(oldApkPath, "Old");
requireFile(newApkPath, "New");
const oldApk = readApk(oldApkPath);
const newApk = readApk(newApkPath);
assertCompatible(oldApk, newApk);

console.log("Android overlay upgrade eligibility verified.");
console.log(
  `Package: ${oldApk.packageName} | ${oldApk.versionName} (${oldApk.versionCode}) -> ${newApk.versionName} (${newApk.versionCode})`,
);
console.log(`Signing certificate SHA-256: ${newApk.certificateSha256}`);
console.log(`Old APK SHA-256: ${oldApk.sha256}`);
console.log(`New APK SHA-256: ${newApk.sha256}`);
console.log("This proves install -r eligibility only; run the isolated AVD data-preservation flow before release.");
