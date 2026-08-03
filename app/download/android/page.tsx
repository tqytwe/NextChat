import type { Metadata } from "next";
import QRCode from "qrcode";

import { getBuildConfig } from "@/app/config/build";
import BotIcon from "@/app/icons/bot.svg";
import DownloadIcon from "@/app/icons/download.svg";

import { AndroidManifestDetails } from "./android-manifest-details";
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

export default async function AndroidDownloadPage() {
  const config = getBuildConfig();
  const fallbackApkPath = "/downloads/jisudengchat-android.apk";
  const rawApkUrl = config.androidApkUrl || fallbackApkPath;
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
      <section className={styles["hero"]}>
        <div className={styles["hero-copy"]}>
          <div className={styles["brand-row"]}>
            <span className={styles["app-icon"]}>
              <BotIcon />
            </span>
            <span>JisudengChat Android</span>
          </div>
          <h1>Android 版下载</h1>
          <p>使用平台账号登录，自动同步余额、分组、API Key 和可用模型。</p>
          <div className={styles["actions"]}>
            <a className={styles["primary-action"]} href={apkUrl}>
              <DownloadIcon />
              <span>下载 APK</span>
            </a>
            <a className={styles["secondary-action"]} href="/">
              打开网页版
            </a>
          </div>
        </div>

        <div className={styles["qr-card"]}>
          <img src={qrImage} alt="JisudengChat Android APK 下载二维码" />
          <strong>手机扫码下载</strong>
          <span>版本信息以更新清单为准</span>
        </div>
      </section>

      <AndroidManifestDetails
        manifestFetchUrl={rawManifestUrl}
        manifestHref={manifestUrl}
        fallbackVersion={config.androidVersion}
        fallbackSize={config.androidApkSize}
        fallbackSha256={config.androidApkSha256}
        fallbackNotes={notes}
      />
    </main>
  );
}
