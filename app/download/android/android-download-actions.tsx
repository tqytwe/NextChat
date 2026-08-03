"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import BotIcon from "@/app/icons/bot.svg";
import DownloadIcon from "@/app/icons/download.svg";

import { canonicalAndroidApkPath } from "./android-download-release";
import styles from "./android-download.module.scss";

type AndroidManifest = {
  apkUrl?: unknown;
};

function absoluteBrowserUrl(path: string) {
  return new URL(path, window.location.origin).toString();
}

export function AndroidDownloadActions(props: {
  manifestFetchUrl: string;
  fallbackApkUrl: string;
  fallbackQrImage: string;
}) {
  const [apkUrl, setApkUrl] = useState(props.fallbackApkUrl);
  const [qrImage, setQrImage] = useState(props.fallbackQrImage);

  useEffect(() => {
    if (!props.manifestFetchUrl) return;
    const controller = new AbortController();
    let active = true;

    fetch(props.manifestFetchUrl, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then(async (manifest: AndroidManifest | null) => {
        const path = canonicalAndroidApkPath(manifest?.apkUrl);
        if (!path || !active) return;
        const nextApkUrl = absoluteBrowserUrl(path);
        const nextQrImage = await QRCode.toDataURL(nextApkUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 280,
          color: { dark: "#111827", light: "#ffffff" },
        });
        if (!active) return;
        setApkUrl(nextApkUrl);
        setQrImage(nextQrImage);
      })
      .catch(() => {});

    return () => {
      active = false;
      controller.abort();
    };
  }, [props.manifestFetchUrl]);

  return (
    <>
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
    </>
  );
}
