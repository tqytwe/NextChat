import { createHash } from "crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import path from "path";

const root = process.cwd();
const apkSource = path.join(
  root,
  "android/app/build/outputs/apk/release/app-release.apk",
);
const metadataPath = path.join(
  root,
  "android/app/build/outputs/apk/release/output-metadata.json",
);
const downloadsDir = path.join(root, "public/downloads");
const outDownloadsDir = path.join(root, "out/downloads");
const apkTarget = path.join(downloadsDir, "jisudengchat-android.apk");
const manifestPath = path.join(downloadsDir, "android-version.json");
const outApkTarget = path.join(outDownloadsDir, "jisudengchat-android.apk");
const outManifestPath = path.join(outDownloadsDir, "android-version.json");
const legacyApkTarget = path.join(downloadsDir, "nextchat-android.apk");
const legacyOutApkTarget = path.join(outDownloadsDir, "nextchat-android.apk");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf-8"));
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

if (!existsSync(apkSource)) {
  throw new Error(`Release APK not found: ${apkSource}`);
}

mkdirSync(downloadsDir, { recursive: true });
copyFileSync(apkSource, apkTarget);
chmodSync(apkTarget, 0o644);
if (existsSync(legacyApkTarget)) {
  rmSync(legacyApkTarget);
}

const apk = readFileSync(apkTarget);
const sha256 = createHash("sha256").update(apk).digest("hex");
const metadata = existsSync(metadataPath) ? readJson(metadataPath) : {};
const firstOutput = metadata?.elements?.[0] ?? {};
const existingManifest = existsSync(manifestPath) ? readJson(manifestPath) : {};

const version =
  process.env.ANDROID_VERSION_NAME ||
  firstOutput.versionName ||
  existingManifest.version ||
  "1.0.0";
const versionCode =
  Number(process.env.ANDROID_VERSION_CODE || firstOutput.versionCode || 1) || 1;
const envNotes = parseNotes(
  process.env.ANDROID_RELEASE_NOTES ||
    process.env.NEXT_PUBLIC_ANDROID_RELEASE_NOTES,
);

const manifest = {
  ...existingManifest,
  platform: "android",
  version,
  versionCode,
  packageName: "com.jisudeng.chat",
  signingCertificateSha256:
    "cd7abbd79daf6648a429ff34d7450b18cfb6b416e660b2f5169178e0a488627e",
  apkUrl:
    existingManifest.apkUrl === "/downloads/nextchat-android.apk"
      ? "/downloads/jisudengchat-android.apk"
      : existingManifest.apkUrl || "/downloads/jisudengchat-android.apk",
  size: formatBytes(apk.length),
  bytes: apk.length,
  sha256,
  minAndroidVersion: existingManifest.minAndroidVersion || "8.0",
  releaseDate: new Date().toISOString().slice(0, 10),
  notes: envNotes.length
    ? envNotes
    : existingManifest.notes && existingManifest.notes.length
    ? existingManifest.notes
    : [
        "平台账号登录",
        "余额、分组和模型自动同步",
        "JisudengChat 聊天与生图支持 Android",
        "生图结果保存在 APP 本机",
      ],
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

if (existsSync(path.join(root, "out"))) {
  mkdirSync(outDownloadsDir, { recursive: true });
  copyFileSync(apkTarget, outApkTarget);
  chmodSync(outApkTarget, 0o644);
  if (existsSync(legacyOutApkTarget)) {
    rmSync(legacyOutApkTarget);
  }
  writeFileSync(outManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(`APK: ${path.relative(root, apkTarget)}`);
console.log(`Size: ${manifest.size}`);
console.log(`SHA256: ${sha256}`);
console.log(`Manifest: ${path.relative(root, manifestPath)}`);
