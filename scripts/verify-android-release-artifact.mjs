import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";

const root = process.cwd();

function resolveArtifactPath(value, fallback) {
  const selected = String(value || fallback).trim();
  return path.isAbsolute(selected) ? selected : path.join(root, selected);
}

const apkPath = resolveArtifactPath(
  process.env.ANDROID_RELEASE_APK_PATH,
  "public/downloads/jisudengchat-android.apk",
);
const manifestPath = resolveArtifactPath(
  process.env.ANDROID_RELEASE_MANIFEST_PATH,
  "public/downloads/android-version.json",
);
const apk = readFileSync(apkPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const sha256 = createHash("sha256").update(apk).digest("hex");
const canonicalApkPath = "/downloads/jisudengchat-android.apk";

function normalizeVersionName(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "");
}

function versionCode(value) {
  const raw = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(raw)) return undefined;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function isReleaseCacheKey(value, version, code, { requireHash = false } = {}) {
  const raw = String(value || "").trim();
  const prefix = `${version}-${code}`;
  if (raw === prefix) return !requireHash;
  return (
    raw.startsWith(`${prefix}-`) &&
    /^[0-9a-f]{64}$/i.test(raw.slice(prefix.length + 1))
  );
}

function canonicalManifestApkUrl(value, version, code, options = {}) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return false;
  }
  try {
    const url = new URL(value, "https://android-release.invalid");
    const cacheKey = url.searchParams.get("v") || "";
    return (
      url.origin === "https://android-release.invalid" &&
      url.pathname === canonicalApkPath &&
      [...url.searchParams.keys()].length === 1 &&
      isReleaseCacheKey(cacheKey, version, code, options) &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function aaptCandidates() {
  const candidates = [];
  const configured = (process.env.AAPT_PATH || "").trim();
  if (configured) candidates.push(configured);

  for (const sdkRoot of [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
  ]) {
    if (!sdkRoot) continue;
    const buildTools = path.join(sdkRoot, "build-tools");
    if (!existsSync(buildTools)) continue;
    for (const version of readdirSync(buildTools).sort().reverse()) {
      const candidate = path.join(buildTools, version, "aapt");
      if (existsSync(candidate)) candidates.push(candidate);
    }
  }

  candidates.push("aapt");
  return [...new Set(candidates)];
}

function readNativePackageMetadata() {
  let output = "";
  let used = "";
  let missingTool;
  for (const candidate of aaptCandidates()) {
    try {
      output = execFileSync(candidate, ["dump", "badging", apkPath], {
        encoding: "utf-8",
      });
      used = candidate;
      break;
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        missingTool = error;
        continue;
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to inspect canonical APK with ${candidate}: ${reason}`,
      );
    }
  }

  if (!used) {
    const hint = missingTool ? ` (${missingTool.message})` : "";
    throw new Error(
      `Unable to find Android aapt. Set AAPT_PATH or ANDROID_HOME before verification${hint}`,
    );
  }

  const packageLine = output
    .split(/\r?\n/)
    .find((line) => line.startsWith("package: "));
  const packageMatch = packageLine?.match(/name='([^']+)'/);
  const nameMatch = packageLine?.match(/versionName='([^']+)'/);
  const codeMatch = packageLine?.match(/versionCode='([^']+)'/);
  if (!packageMatch || !nameMatch || !codeMatch) {
    throw new Error(`aapt did not return APK package metadata for ${apkPath}`);
  }

  return {
    packageName: packageMatch[1],
    version: normalizeVersionName(nameMatch[1]),
    versionCode: versionCode(codeMatch[1]),
  };
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&");
}

function readEmbeddedAndroidBuildConfig() {
  const unzip = (process.env.UNZIP_PATH || "unzip").trim();
  let html;
  try {
    html = execFileSync(unzip, ["-p", apkPath, "assets/public/index.html"], {
      encoding: "utf-8",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read embedded Android web index: ${reason}`);
  }

  const configTag = html.match(/<meta\b[^>]*\bname=["']config["'][^>]*>/i)?.[0];
  const encodedConfig = configTag?.match(/\bcontent=["']([^"']*)["']/i)?.[1];
  if (!encodedConfig) {
    throw new Error("Embedded Android web index is missing its build config");
  }

  try {
    return JSON.parse(decodeHtmlAttribute(encodedConfig));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Embedded Android build config is invalid: ${reason}`);
  }
}

function assertNoEmbeddedAndroidManifest() {
  const unzip = (process.env.UNZIP_PATH || "unzip").trim();
  let listing;
  try {
    listing = execFileSync(unzip, ["-Z1", apkPath], { encoding: "utf-8" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to inspect embedded Android assets: ${reason}`);
  }

  if (
    listing
      .split(/\r?\n/)
      .some(
        (entry) =>
          entry.trim() === "assets/public/downloads/android-version.json",
      )
  ) {
    throw new Error(
      "Embedded Android release manifest must not be bundled in the APK",
    );
  }
}

const manifestVersion = normalizeVersionName(manifest.version);
const manifestVersionCode = versionCode(manifest.versionCode);

if (!/^\d+(?:\.\d+)+$/.test(manifestVersion)) {
  throw new Error("Android manifest has no valid version");
}
if (!manifestVersionCode) {
  throw new Error("Android manifest has no valid versionCode");
}
if (manifest.packageName !== "com.jisudeng.chat") {
  throw new Error("Android manifest packageName is invalid");
}
if (
  !canonicalManifestApkUrl(
    manifest.apkUrl,
    manifestVersion,
    manifestVersionCode,
    { requireHash: true },
  )
) {
  throw new Error(
    "Android manifest does not use the canonical content-addressed APK URL",
  );
}
if (manifest.sha256 !== sha256 || manifest.bytes !== apk.length) {
  throw new Error("Android manifest does not match the canonical APK file");
}

const native = readNativePackageMetadata();
if (
  native.packageName !== manifest.packageName ||
  native.version !== manifestVersion ||
  native.versionCode !== manifestVersionCode
) {
  throw new Error(
    "Canonical APK native package metadata does not match the Android release manifest",
  );
}

const embedded = readEmbeddedAndroidBuildConfig();
if (embedded?.isAndroidApp !== true) {
  throw new Error("Embedded build config is not marked as an Android app");
}
if (normalizeVersionName(embedded.androidReleaseVersion) !== manifestVersion) {
  throw new Error(
    "Embedded Android androidReleaseVersion does not match the release manifest",
  );
}
if (versionCode(embedded.androidVersionCode) !== manifestVersionCode) {
  throw new Error(
    "Embedded Android androidVersionCode does not match the release manifest",
  );
}
if (
  !canonicalManifestApkUrl(
    embedded.androidApkUrl,
    manifestVersion,
    manifestVersionCode,
  )
) {
  throw new Error(
    "Embedded Android APK URL is not a canonical URL for the release",
  );
}
assertNoEmbeddedAndroidManifest();
if (
  typeof embedded.webVersion !== "string" ||
  !embedded.webVersion.trim() ||
  embedded.version !== embedded.webVersion
) {
  throw new Error(
    "Embedded build config must expose webVersion and retain version only as its compatibility alias",
  );
}
if (
  typeof manifest.builtFromCommit !== "string" ||
  !/^[0-9a-f]{40}$/i.test(manifest.builtFromCommit) ||
  manifest.sourceCommit !== manifest.builtFromCommit
) {
  throw new Error(
    "Android manifest must expose matching sourceCommit and builtFromCommit source metadata",
  );
}

console.log(
  `Verified canonical Android artifact: ${path.relative(root, apkPath)}`,
);
