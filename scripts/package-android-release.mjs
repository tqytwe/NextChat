import { createHash } from "crypto";
import { execFileSync } from "child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import path from "path";

const root = process.cwd();

function resolveReleaseBuildOutput(configured, candidates) {
  const selected = String(configured || "").trim();
  if (selected)
    return path.isAbsolute(selected) ? selected : path.join(root, selected);
  for (const candidate of candidates) {
    const resolved = path.join(root, candidate);
    if (existsSync(resolved)) return resolved;
  }
  return path.join(root, candidates[0]);
}

const apkSource = resolveReleaseBuildOutput(
  process.env.ANDROID_RELEASE_APK_SOURCE,
  [
    "android/app/build/outputs/apk/direct/release/app-direct-release.apk",
    "android/app/build/outputs/apk/release/app-release.apk",
  ],
);
const metadataPath = resolveReleaseBuildOutput(
  process.env.ANDROID_RELEASE_METADATA_SOURCE,
  [
    "android/app/build/outputs/apk/direct/release/output-metadata.json",
    "android/app/build/outputs/apk/release/output-metadata.json",
  ],
);
const embeddedWebIndexPath = path.join(
  root,
  "android/app/src/main/assets/public/index.html",
);
const embeddedWebManifestPath = path.join(
  root,
  "android/app/src/main/assets/public/downloads/android-version.json",
);
const downloadsDir = path.join(root, "public/downloads");
const apkTarget = path.join(downloadsDir, "jisudengchat-android.apk");
const manifestPath = path.join(downloadsDir, "android-version.json");
const legacyApkTarget = path.join(downloadsDir, "nextchat-android.apk");
const androidPackageName = "com.jisudeng.chat";
const releaseSigningCertificateSha256 =
  "cd7abbd79daf6648a429ff34d7450b18cfb6b416e660b2f5169178e0a488627e";
const releaseArtifactPaths = new Set([
  "public/downloads/android-version.json",
  "public/downloads/jisudengchat-android.apk",
]);
const canonicalApkPath = "/downloads/jisudengchat-android.apk";

function gitOutput(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf-8" }).trim();
}

function gitSourceIsDirty() {
  return Boolean(
    execFileSync("git", ["status", "--porcelain=v1"], {
      cwd: root,
      encoding: "utf-8",
    }).trim(),
  );
}

function assertReleaseSourceIsClean() {
  if (process.env.ANDROID_RELEASE_ALLOW_DIRTY === "1") {
    return;
  }
  // Do not trim the complete porcelain output: a leading space is meaningful
  // for an unstaged first entry and trimming it corrupts that file's path.
  const statusOutput = execFileSync("git", ["status", "--porcelain=v1"], {
    cwd: root,
    encoding: "utf-8",
  });
  const dirtyPaths = statusOutput
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((file) => !releaseArtifactPaths.has(file));
  if (dirtyPaths.length) {
    throw new Error(
      `Refusing to package from a dirty source tree: ${dirtyPaths.join(", ")}`,
    );
  }
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read JSON from ${file}: ${reason}`);
  }
}

function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function parseNotes(raw) {
  return (raw || "")
    .split(/[;\n；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLocalizedNotes() {
  const entries = [
    ["zh", process.env.ANDROID_RELEASE_NOTES_ZH],
    ["en", process.env.ANDROID_RELEASE_NOTES_EN],
    ["ja", process.env.ANDROID_RELEASE_NOTES_JA],
    ["ko", process.env.ANDROID_RELEASE_NOTES_KO],
  ]
    .map(([locale, raw]) => [locale, parseNotes(raw)])
    .filter(([, notes]) => notes.length);
  return Object.fromEntries(entries);
}

const defaultLocalizedNotes = {
  zh: ["平台账号登录", "余额、分组和模型自动同步", "生图结果保存在 APP 本机"],
  en: ["Account login", "Balance, groups, and models sync automatically", "Image results stay on this device"],
  ja: ["アカウントログイン", "残高・グループ・モデルを自動同期", "画像結果は端末に保存"],
  ko: ["계정 로그인", "잔액·그룹·모델 자동 동기화", "이미지 결과는 기기에 저장"],
};

function notesByLocaleForClient(notes) {
  return {
    "zh-CN": notes.zh,
    en: notes.en,
    ja: notes.ja,
    ko: notes.ko,
  };
}

function normalizeLocalizedNotes(value) {
  const normalized = {};
  for (const [locale, notes] of Object.entries(value || {})) {
    const key = locale === "zh-CN" ? "zh" : locale;
    if (!["zh", "en", "ja", "ko"].includes(key)) continue;
    const parsed = Array.isArray(notes)
      ? notes.map(String).map((note) => note.trim()).filter(Boolean)
      : parseNotes(notes);
    if (parsed.length) normalized[key] = parsed;
  }
  return normalized;
}

function requireLocalizedNotes(notes) {
  const missing = ["zh", "en", "ja", "ko"].filter(
    (locale) => !notes[locale]?.length,
  );
  if (missing.length) {
    throw new Error(
      `Android release requires localized notes for: ${missing.join(", ")}`,
    );
  }
}

function normalizeVersionName(value, source) {
  const version = String(value ?? "").trim();
  if (!version) {
    throw new Error(`${source} is missing versionName`);
  }
  return version;
}

function normalizeVersionCode(value, source) {
  const raw = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${source} must contain a positive integer versionCode`);
  }

  const versionCode = Number(raw);
  if (!Number.isSafeInteger(versionCode)) {
    throw new Error(`${source} versionCode is outside the safe integer range`);
  }
  return versionCode;
}

function releaseCacheKey(version, versionCode, sha256) {
  const hash = String(sha256 || "")
    .trim()
    .toLowerCase();
  return `${version}-${versionCode}${hash ? `-${hash}` : ""}`;
}

function buildCanonicalApkUrl(cacheKey) {
  return `${canonicalApkPath}?v=${encodeURIComponent(cacheKey)}`;
}

function isReleaseCacheKey(value, release) {
  const raw = String(value || "").trim();
  const prefix = `${release.version}-${release.versionCode}`;
  return (
    raw === prefix ||
    (raw.startsWith(`${prefix}-`) &&
      /^[0-9a-f]{64}$/i.test(raw.slice(prefix.length + 1)))
  );
}

function readApkReleaseVersion() {
  if (!existsSync(metadataPath)) {
    throw new Error(`Release APK metadata not found: ${metadataPath}`);
  }

  const metadata = readJson(metadataPath);
  const elements = Array.isArray(metadata?.elements) ? metadata.elements : [];
  const outputFile = path.basename(apkSource);
  const matchingElements = elements.filter(
    (element) => element?.outputFile === outputFile,
  );

  if (matchingElements.length !== 1) {
    throw new Error(
      `Release APK metadata must contain exactly one entry for ${outputFile}`,
    );
  }

  const output = matchingElements[0];
  return {
    version: normalizeVersionName(
      output.versionName,
      `Release APK metadata for ${outputFile}`,
    ),
    versionCode: normalizeVersionCode(
      output.versionCode,
      `Release APK metadata for ${outputFile}`,
    ),
  };
}

function aaptCandidates() {
  const candidates = [];
  const configuredPath = (process.env.AAPT_PATH || "").trim();
  if (configuredPath) {
    candidates.push(configuredPath);
  }

  const sdkRoots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]
    .map((root) => (root || "").trim())
    .filter(Boolean);
  for (const sdkRoot of sdkRoots) {
    const buildToolsDir = path.join(sdkRoot, "build-tools");
    if (!existsSync(buildToolsDir)) continue;

    for (const version of readdirSync(buildToolsDir).sort().reverse()) {
      const candidate = path.join(buildToolsDir, version, "aapt");
      if (existsSync(candidate)) candidates.push(candidate);
    }
  }

  candidates.push("aapt");
  return [...new Set(candidates)];
}

function apksignerCandidates() {
  const candidates = [];
  const configuredPath = (process.env.APKSIGNER_PATH || "").trim();
  if (configuredPath) {
    candidates.push(configuredPath);
  }

  const sdkRoots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]
    .map((root) => (root || "").trim())
    .filter(Boolean);
  for (const sdkRoot of sdkRoots) {
    const buildToolsDir = path.join(sdkRoot, "build-tools");
    if (!existsSync(buildToolsDir)) continue;

    for (const version of readdirSync(buildToolsDir).sort().reverse()) {
      const candidate = path.join(buildToolsDir, version, "apksigner");
      if (existsSync(candidate)) candidates.push(candidate);
    }
  }

  candidates.push("apksigner");
  return [...new Set(candidates)];
}

function readActualApkReleaseVersion() {
  let badging = "";
  let inspectedBy = "";
  let lastMissingToolError;
  for (const candidate of aaptCandidates()) {
    try {
      badging = execFileSync(candidate, ["dump", "badging", apkSource], {
        encoding: "utf-8",
      });
      inspectedBy = candidate;
      break;
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        lastMissingToolError = error;
        continue;
      }

      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to inspect the release APK with ${candidate}: ${reason}`,
      );
    }
  }

  if (!inspectedBy) {
    const reason = lastMissingToolError
      ? ` (${lastMissingToolError.message})`
      : "";
    throw new Error(
      `Unable to find Android aapt. Set AAPT_PATH or ANDROID_HOME before packaging${reason}`,
    );
  }

  const packageLine = badging
    .split(/\r?\n/)
    .find((line) => line.startsWith("package: "));
  const packageMatch = packageLine?.match(/name='([^']+)'/);
  const versionCodeMatch = packageLine?.match(/versionCode='([^']+)'/);
  const versionMatch = packageLine?.match(/versionName='([^']+)'/);
  if (!packageMatch || !versionCodeMatch || !versionMatch) {
    throw new Error(
      `aapt did not return package name and version metadata for ${apkSource}`,
    );
  }
  if (packageMatch[1] !== androidPackageName) {
    throw new Error(
      `Release APK package name expected ${androidPackageName}, received ${packageMatch[1]}`,
    );
  }

  return {
    version: normalizeVersionName(
      versionMatch[1],
      `Release APK inspected by ${inspectedBy}`,
    ),
    versionCode: normalizeVersionCode(
      versionCodeMatch[1],
      `Release APK inspected by ${inspectedBy}`,
    ),
  };
}

function readActualApkSigningCertificate() {
  let output = "";
  let inspectedBy = "";
  let lastMissingToolError;
  for (const candidate of apksignerCandidates()) {
    try {
      output = execFileSync(
        candidate,
        ["verify", "--verbose", "--print-certs", apkSource],
        { encoding: "utf-8" },
      );
      inspectedBy = candidate;
      break;
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        lastMissingToolError = error;
        continue;
      }

      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to verify the release APK signature with ${candidate}: ${reason}`,
      );
    }
  }

  if (!inspectedBy) {
    const reason = lastMissingToolError
      ? ` (${lastMissingToolError.message})`
      : "";
    throw new Error(
      `Unable to find Android apksigner. Set APKSIGNER_PATH or ANDROID_HOME before packaging${reason}`,
    );
  }

  const certificates = [
    ...output.matchAll(
      /^Signer #\d+ certificate SHA-256 digest:\s*([0-9a-f]{64})\s*$/gim,
    ),
  ].map((match) => match[1].toLowerCase());
  if (certificates.length !== 1) {
    throw new Error(
      `apksigner inspected by ${inspectedBy} must report exactly one release signing certificate`,
    );
  }

  const certificate = certificates[0];
  if (certificate !== releaseSigningCertificateSha256) {
    throw new Error(
      `Release APK signing certificate expected ${releaseSigningCertificateSha256}, received ${certificate}`,
    );
  }
  return certificate;
}

function readConfiguredReleaseVersion() {
  const rawVersion = process.env.ANDROID_VERSION_NAME;
  const rawVersionCode = process.env.ANDROID_VERSION_CODE;
  if (!rawVersion && !rawVersionCode) {
    throw new Error(
      "ANDROID_VERSION_NAME and ANDROID_VERSION_CODE are required when packaging an Android release",
    );
  }
  if (!rawVersion || !rawVersionCode) {
    throw new Error(
      "ANDROID_VERSION_NAME and ANDROID_VERSION_CODE must be provided together when packaging an Android release",
    );
  }

  // build.gradle removes one optional leading v from the release version name.
  return {
    version: normalizeVersionName(rawVersion, "ANDROID_VERSION_NAME").replace(
      /^v/,
      "",
    ),
    versionCode: normalizeVersionCode(rawVersionCode, "ANDROID_VERSION_CODE"),
  };
}

function assertReleaseVersionsMatch(expected, actual, source) {
  const mismatches = [];
  if (expected.version !== actual.version) {
    mismatches.push(
      `versionName expected ${expected.version}, received ${actual.version}`,
    );
  }
  if (expected.versionCode !== actual.versionCode) {
    mismatches.push(
      `versionCode expected ${expected.versionCode}, received ${actual.versionCode}`,
    );
  }
  if (mismatches.length) {
    throw new Error(
      `${source} does not match the release APK: ${mismatches.join("; ")}`,
    );
  }
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&");
}

function readEmbeddedAndroidBuildConfig() {
  if (!existsSync(embeddedWebIndexPath)) {
    throw new Error(
      `Embedded Android web index not found: ${embeddedWebIndexPath}`,
    );
  }

  const html = readFileSync(embeddedWebIndexPath, "utf-8");
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

function assertEmbeddedAndroidBuildMatchesApk(apkRelease) {
  const config = readEmbeddedAndroidBuildConfig();
  if (config?.isAndroidApp !== true) {
    throw new Error("Embedded build config is not marked as an Android app");
  }

  const embeddedRelease = {
    version: normalizeVersionName(
      config.androidReleaseVersion,
      "Embedded Android build config androidReleaseVersion",
    ).replace(/^v/i, ""),
    versionCode: normalizeVersionCode(
      config.androidVersionCode,
      "Embedded Android build config",
    ),
  };
  assertReleaseVersionsMatch(
    apkRelease,
    embeddedRelease,
    "Embedded Android web build config",
  );

  let embeddedUrl;
  try {
    embeddedUrl = new URL(
      String(config.androidApkUrl || ""),
      "https://android-release.invalid",
    );
  } catch {
    embeddedUrl = null;
  }
  const embeddedCacheKey = embeddedUrl?.searchParams.get("v") || "";
  if (
    !embeddedUrl ||
    embeddedUrl.origin !== "https://android-release.invalid" ||
    embeddedUrl.pathname !== canonicalApkPath ||
    [...embeddedUrl.searchParams.keys()].length !== 1 ||
    !isReleaseCacheKey(embeddedCacheKey, apkRelease) ||
    embeddedUrl.hash
  ) {
    throw new Error(
      `Embedded Android APK URL must be a relative canonical URL for ${apkRelease.version}-${apkRelease.versionCode}`,
    );
  }
}

function assertNoEmbeddedAndroidManifest() {
  if (existsSync(embeddedWebManifestPath)) {
    throw new Error(
      `Embedded Android release manifest must not be bundled: ${embeddedWebManifestPath}`,
    );
  }
}

function readPreviousManifest() {
  if (!existsSync(manifestPath)) {
    return {};
  }

  const manifest = readJson(manifestPath);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(
      `Published Android manifest must be a JSON object: ${manifestPath}`,
    );
  }
  if (manifest.versionCode === undefined || manifest.versionCode === null) {
    return manifest;
  }

  const version = normalizeVersionName(
    manifest.version ?? manifest.latestVersion,
    "Published Android manifest",
  );
  if (
    manifest.latestVersion !== undefined &&
    normalizeVersionName(
      manifest.latestVersion,
      "Published Android manifest",
    ) !== version
  ) {
    throw new Error(
      "Published Android manifest version and latestVersion are inconsistent",
    );
  }

  return {
    ...manifest,
    version,
    versionCode: normalizeVersionCode(
      manifest.versionCode,
      "Published Android manifest",
    ),
  };
}

function highestPublishedVersionCode() {
  const commits = gitOutput([
    "log",
    "--format=%H",
    "--",
    "public/downloads/android-version.json",
  ])
    .split(/\r?\n/)
    .filter(Boolean);
  let highest = 0;

  for (const commit of commits) {
    try {
      const raw = execFileSync(
        "git",
        ["show", `${commit}:public/downloads/android-version.json`],
        { cwd: root, encoding: "utf-8" },
      );
      const manifest = JSON.parse(raw);
      const versionCode = normalizeVersionCode(
        manifest?.versionCode,
        `Published Android manifest at ${commit.slice(0, 12)}`,
      );
      highest = Math.max(highest, versionCode);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to inspect historical Android release manifest ${commit.slice(
          0,
          12,
        )}: ${reason}`,
      );
    }
  }

  return highest;
}

function assertManifestMatchesApk(manifest, apkRelease, source) {
  const manifestRelease = {
    version: normalizeVersionName(manifest.version, `${source} manifest`),
    versionCode: normalizeVersionCode(
      manifest.versionCode,
      `${source} manifest`,
    ),
  };
  assertReleaseVersionsMatch(apkRelease, manifestRelease, `${source} manifest`);

  if (
    normalizeVersionName(manifest.latestVersion, `${source} manifest`) !==
    apkRelease.version
  ) {
    throw new Error(
      `${source} manifest latestVersion does not match the release APK versionName`,
    );
  }
}

if (!existsSync(apkSource)) {
  throw new Error(`Release APK not found: ${apkSource}`);
}

assertReleaseSourceIsClean();
const sourceCommit = gitOutput(["rev-parse", "HEAD"]);
const sourceDirty = gitSourceIsDirty();
const outputMetadataRelease = readApkReleaseVersion();
const apkRelease = readActualApkReleaseVersion();
assertReleaseVersionsMatch(
  apkRelease,
  outputMetadataRelease,
  "APK output metadata",
);
const signingCertificateSha256 = readActualApkSigningCertificate();
const configuredRelease = readConfiguredReleaseVersion();
assertReleaseVersionsMatch(
  apkRelease,
  configuredRelease,
  "ANDROID_VERSION_NAME/CODE",
);
assertEmbeddedAndroidBuildMatchesApk(apkRelease);
assertNoEmbeddedAndroidManifest();
const existingManifest = readPreviousManifest();
const previousVersionCode = Math.max(
  existingManifest.versionCode || 0,
  highestPublishedVersionCode(),
);
if (previousVersionCode && apkRelease.versionCode <= previousVersionCode) {
  throw new Error(
    `Android versionCode must exceed every previously published versionCode (highest ${previousVersionCode}, received ${apkRelease.versionCode})`,
  );
}

const apk = readFileSync(apkSource);
const sha256 = createHash("sha256").update(apk).digest("hex");
const canonicalApkUrl = buildCanonicalApkUrl(
  releaseCacheKey(apkRelease.version, apkRelease.versionCode, sha256),
);
const envNotes = parseNotes(
  process.env.ANDROID_RELEASE_NOTES ||
    process.env.NEXT_PUBLIC_ANDROID_RELEASE_NOTES,
);
const localizedNotes = {
  ...defaultLocalizedNotes,
  ...normalizeLocalizedNotes(
    existingManifest.notes_i18n || existingManifest.notesByLocale,
  ),
  ...parseLocalizedNotes(),
};
requireLocalizedNotes(localizedNotes);
const previousManifest = { ...existingManifest };
delete previousManifest.sourceState;

const manifest = {
  ...previousManifest,
  platform: "android",
  channel: "direct",
  // The public manifest is derived only from the verified release APK metadata.
  version: apkRelease.version,
  latestVersion: apkRelease.version,
  versionCode: apkRelease.versionCode,
  // This is the source commit used to build the APK. The release commit that
  // later records the APK/manifest is intentionally different and must not be
  // mistaken for the build input.
  sourceCommit,
  builtFromCommit: sourceCommit,
  sourceDirty,
  packageName: androidPackageName,
  signingCertificateSha256,
  apkUrl: canonicalApkUrl,
  size: formatBytes(apk.length),
  bytes: apk.length,
  sha256,
  minAndroidVersion: existingManifest.minAndroidVersion || "6.0",
  releaseDate: new Date().toISOString().slice(0, 10),
  // Keep the legacy one-language field aligned with the canonical Chinese
  // release notes. Older Direct clients still render `notes`, while current
  // clients select `notes_i18n`; neither may show a prior version's text.
  notes:
    envNotes.length > 0
      ? envNotes
      : localizedNotes.zh?.length
      ? localizedNotes.zh
      : existingManifest.notes && existingManifest.notes.length
      ? existingManifest.notes
      : [
          "平台账号登录",
          "余额、分组和模型自动同步",
          "JisudengChat 聊天与生图支持 Android",
          "生图结果保存在 APP 本机",
        ],
  ...(Object.keys(localizedNotes).length
    ? {
        notes_i18n: localizedNotes,
        notesByLocale: notesByLocaleForClient(localizedNotes),
      }
    : existingManifest.notes_i18n
    ? {
        notes_i18n: existingManifest.notes_i18n,
        notesByLocale: notesByLocaleForClient(existingManifest.notes_i18n),
      }
    : {}),
};

assertManifestMatchesApk(manifest, apkRelease, "Generated Android");

// Publish only after all source and version gates have passed.
mkdirSync(downloadsDir, { recursive: true });
copyFileSync(apkSource, apkTarget);
chmodSync(apkTarget, 0o644);
if (existsSync(legacyApkTarget)) {
  rmSync(legacyApkTarget);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
assertManifestMatchesApk(
  readJson(manifestPath),
  apkRelease,
  "Published Android",
);

// The public artifact is the only handoff. Gradle output is disposable.
rmSync(path.dirname(apkSource), { recursive: true, force: true });

console.log(`APK: ${path.relative(root, apkTarget)}`);
console.log(`Size: ${manifest.size}`);
console.log(`SHA256: ${sha256}`);
console.log(`Manifest: ${path.relative(root, manifestPath)}`);
