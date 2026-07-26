"use client";

import { useEffect, useMemo, useState } from "react";

import styles from "./android-download.module.scss";

type AndroidManifest = {
  version?: string;
  size?: string;
  bytes?: number;
  sha256?: string;
  notes?: string[];
};

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export function AndroidManifestDetails(props: {
  manifestFetchUrl: string;
  manifestHref: string;
  fallbackVersion: string;
  fallbackSize?: string;
  fallbackSha256?: string;
  fallbackNotes: string[];
}) {
  const [manifest, setManifest] = useState<AndroidManifest | null>(null);

  useEffect(() => {
    if (!props.manifestFetchUrl) return;
    const controller = new AbortController();
    fetch(props.manifestFetchUrl, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setManifest(payload))
      .catch(() => {});
    return () => controller.abort();
  }, [props.manifestFetchUrl]);

  const details = useMemo(() => {
    const size = manifest?.size || formatBytes(manifest?.bytes);
    const manifestNotes = manifest?.notes;
    const notes =
      Array.isArray(manifestNotes) && manifestNotes.length
        ? manifestNotes
        : props.fallbackNotes;
    return {
      version: manifest?.version || props.fallbackVersion || "待发布",
      size: size || props.fallbackSize || "读取中",
      sha256: manifest?.sha256 || props.fallbackSha256 || "读取中",
      notes: notes.length
        ? notes
        : [
            "平台账号登录",
            "余额、分组和模型自动同步",
            "聊天与生图支持 Android",
            "生图结果保存在 APP 本机",
          ],
    };
  }, [
    manifest,
    props.fallbackNotes,
    props.fallbackSha256,
    props.fallbackSize,
    props.fallbackVersion,
  ]);

  return (
    <>
      <section className={styles["details"]}>
        <div className={styles["detail-item"]}>
          <span>当前版本</span>
          <strong>{details.version}</strong>
        </div>
        <div className={styles["detail-item"]}>
          <span>安装包大小</span>
          <strong>{details.size}</strong>
        </div>
        <div className={styles["detail-item"]}>
          <span>更新清单</span>
          <a href={props.manifestHref}>android-version.json</a>
        </div>
        <div className={styles["detail-item"]}>
          <span>SHA-256</span>
          <code>{details.sha256}</code>
        </div>
      </section>

      <section className={styles["release"]}>
        <h2>版本内容</h2>
        <ul>
          {details.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
