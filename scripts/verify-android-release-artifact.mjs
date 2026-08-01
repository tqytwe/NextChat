import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";

const root = process.cwd();
const apkRelativePath = "public/downloads/jisudengchat-android.apk";
const manifestRelativePath = "public/downloads/android-version.json";
const apk = readFileSync(path.join(root, apkRelativePath));
const manifest = JSON.parse(
  readFileSync(path.join(root, manifestRelativePath), "utf8"),
);
const sha256 = createHash("sha256").update(apk).digest("hex");
const expectedUrl = `/downloads/jisudengchat-android.apk?v=${encodeURIComponent(
  `${manifest.version}-${manifest.versionCode}`,
)}`;

if (!/^\d+(?:\.\d+)+$/.test(String(manifest.version || ""))) {
  throw new Error("Android manifest has no valid version");
}
if (!Number.isSafeInteger(manifest.versionCode) || manifest.versionCode < 1) {
  throw new Error("Android manifest has no valid versionCode");
}
if (manifest.packageName !== "com.jisudeng.chat") {
  throw new Error("Android manifest packageName is invalid");
}
if (manifest.apkUrl !== expectedUrl) {
  throw new Error("Android manifest does not use the canonical APK URL");
}
if (manifest.sha256 !== sha256 || manifest.bytes !== apk.length) {
  throw new Error("Android manifest does not match the canonical APK file");
}

console.log(`Verified canonical Android artifact: ${apkRelativePath}`);
