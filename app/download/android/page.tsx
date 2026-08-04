import type { Metadata } from "next";
import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import path from "node:path";

import { getBuildConfig } from "@/app/config/build";

import { AndroidDownloadActions } from "./android-download-actions";
import { AndroidManifestDetails } from "./android-manifest-details";
import { canonicalAndroidApkPath } from "./android-download-release";
import styles from "./android-download.module.scss";

export const metadata: Metadata = {
  title: "Android 下载 - JisudengChat",
  description: "下载 JisudengChat Android APK",
};

function absoluteUrl(url: string, baseUrl: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (!baseUrl) return url;

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function notesFromConfig(raw: string) {
  return raw
    .split(/[;\n；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function publishedApkPath() {
  try {
    const manifest = JSON.parse(
      readFileSync(
        path.join(process.cwd(), "public/downloads/android-version.json"),
        "utf8",
      ),
    ) as { apkUrl?: unknown };
    return canonicalAndroidApkPath(manifest.apkUrl);
  } catch {
    return "";
  }
}

export default async function AndroidDownloadPage() {
  const config = getBuildConfig();
  const fallbackApkPath = "/downloads/jisudengchat-android.apk";
  // A web deployment can use the signed manifest as its server-rendered
  // fallback. Android builds intentionally use their build-time URL so a
  // previous public manifest cannot leak into a newly embedded bundle.
  const publishedUrl = config.isAndroidApp ? "" : publishedApkPath();
  const rawApkUrl = publishedUrl || config.androidApkUrl || fallbackApkPath;
  const rawManifestUrl =
    config.androidManifestUrl || "/downloads/android-version.json";
  const apkUrl = absoluteUrl(rawApkUrl, config.nextchatWebUrl);
  const manifestUrl = absoluteUrl(rawManifestUrl, config.nextchatWebUrl);
  const notes = notesFromConfig(config.androidReleaseNotes);
  const qrValue = absoluteUrl(apkUrl, config.nextchatWebUrl) || rawApkUrl;
  const qrImage = await QRCode.toDataURL(qrValue, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  });

  return (
    <main className={styles["page"]}>
      <AndroidDownloadActions
        manifestFetchUrl={rawManifestUrl}
        fallbackApkUrl={apkUrl}
        fallbackQrImage={qrImage}
      />

      <AndroidManifestDetails
        manifestFetchUrl={rawManifestUrl}
        manifestHref={manifestUrl}
        fallbackVersion={config.androidReleaseVersion}
        fallbackSize={config.androidApkSize}
        fallbackSha256={config.androidApkSha256}
        fallbackNotes={notes}
      />
    </main>
  );
}
