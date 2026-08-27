import { createHash } from "crypto";
import { execFileSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";

const root = process.cwd();
const releaseSigningCertificateSha256 =
  "cd7abbd79daf6648a429ff34d7450b18cfb6b416e660b2f5169178e0a488627e";

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

function verifyAabSigningCertificate(aabPath) {
  const jarsigner = String(process.env.JARSIGNER_PATH || "jarsigner").trim();
  const keytool = String(process.env.KEYTOOL_PATH || "keytool").trim();

  try {
    execFileSync(jarsigner, ["-verify", aabPath], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to verify Play AAB signature: ${reason}`);
  }

  let certificateOutput;
  try {
    certificateOutput = execFileSync(
      keytool,
      ["-printcert", "-jarfile", aabPath],
      { cwd: root, encoding: "utf-8" },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to inspect Play AAB certificate: ${reason}`);
  }

  const fingerprints = [
    ...certificateOutput.matchAll(/^\s*SHA256:\s*([0-9A-F:]+)\s*$/gim),
  ].map((match) => match[1].replace(/:/g, "").toLowerCase());
  const uniqueFingerprints = [...new Set(fingerprints)];
  if (uniqueFingerprints.length !== 1) {
    throw new Error(
      "Play AAB must expose exactly one signing certificate SHA-256 fingerprint",
    );
  }
  if (uniqueFingerprints[0] !== releaseSigningCertificateSha256) {
    throw new Error(
      `Play AAB signing certificate expected ${releaseSigningCertificateSha256}, received ${uniqueFingerprints[0]}`,
    );
  }
  return uniqueFingerprints[0];
}

function parseNotes(raw) {
  return String(raw || "")
    .split(/[;\n；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLocalizedNotes() {
  return Object.fromEntries(
    [
      ["zh", process.env.ANDROID_RELEASE_NOTES_ZH],
      ["en", process.env.ANDROID_RELEASE_NOTES_EN],
      ["ja", process.env.ANDROID_RELEASE_NOTES_JA],
      ["ko", process.env.ANDROID_RELEASE_NOTES_KO],
    ]
      .map(([locale, raw]) => [locale, parseNotes(raw)])
      .filter(([, notes]) => notes.length),
  );
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

function requireLocalizedNotes(notes) {
  const missing = ["zh", "en", "ja", "ko"].filter(
    (locale) => !notes[locale]?.length,
  );
  if (missing.length) {
    throw new Error(
      `Play release requires localized notes for: ${missing.join(", ")}`,
    );
  }
}

function resolveBuildOutput(configured, candidates) {
  const selected = String(configured || "").trim();
  if (selected) {
    return path.isAbsolute(selected) ? selected : path.join(root, selected);
  }
  for (const candidate of candidates) {
    const resolved = path.join(root, candidate);
    if (existsSync(resolved)) return resolved;
  }
  return path.join(root, candidates[0]);
}

function normalizeVersionName(value, source) {
  const version = String(value ?? "")
    .trim()
    .replace(/^v/, "");
  if (!version) throw new Error(`${source} is missing versionName`);
  return version;
}

function normalizeVersionCode(value, source) {
  const raw = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${source} must contain a positive integer versionCode`);
  }
  return Number(raw);
}

const versionName = normalizeVersionName(
  process.env.ANDROID_VERSION_NAME || process.env.NEXT_PUBLIC_ANDROID_VERSION,
  "ANDROID_VERSION_NAME",
);
const versionCode = normalizeVersionCode(
  process.env.ANDROID_VERSION_CODE,
  "ANDROID_VERSION_CODE",
);

const aabSource = resolveBuildOutput(process.env.ANDROID_PLAY_AAB_SOURCE, [
  "android/app/build/outputs/bundle/playRelease/app-play-release.aab",
]);

if (!existsSync(aabSource)) {
  throw new Error(`Play AAB not found: ${aabSource}`);
}

const sourceCommit = gitOutput(["rev-parse", "HEAD"]);
const sourceDirty = gitSourceIsDirty();
const signingCertificateSha256 = verifyAabSigningCertificate(aabSource);
const localizedNotes = { ...defaultLocalizedNotes, ...parseLocalizedNotes() };
requireLocalizedNotes(localizedNotes);

const outputDir = path.join(root, "dist/android/play");
mkdirSync(outputDir, { recursive: true });

const targetName = `app-play-release-${versionName}-${versionCode}.aab`;
const aabTarget = path.join(outputDir, targetName);
copyFileSync(aabSource, aabTarget);

const bytes = statSync(aabTarget).size;
const sha256 = createHash("sha256")
  .update(readFileSync(aabTarget))
  .digest("hex");
const manifest = {
  channel: "play",
  artifactType: "aab",
  packageName: "com.jisudeng.chat",
  version: versionName,
  versionCode,
  artifact: path.relative(root, aabTarget),
  bytes,
  sha256,
  signingCertificateSha256,
  sourceCommit,
  builtFromCommit: sourceCommit,
  sourceDirty,
  notes: parseNotes(
    process.env.ANDROID_RELEASE_NOTES ||
      process.env.NEXT_PUBLIC_ANDROID_RELEASE_NOTES,
  ),
  notes_i18n: localizedNotes,
  notesByLocale: notesByLocaleForClient(localizedNotes),
  builtAt: new Date().toISOString(),
};

const manifestTarget = path.join(
  outputDir,
  `app-play-release-${versionName}-${versionCode}.json`,
);
writeFileSync(manifestTarget, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Play AAB: ${path.relative(root, aabTarget)}`);
console.log(`Play manifest: ${path.relative(root, manifestTarget)}`);
console.log(`SHA256: ${sha256}`);
