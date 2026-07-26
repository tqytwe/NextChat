import tauriConfig from "../../src-tauri/tauri.conf.json";
import { DEFAULT_INPUT_TEMPLATE } from "../constant";

export const getBuildConfig = () => {
  if (typeof process === "undefined") {
    throw Error(
      "[Server Config] you are importing a nodejs-only module outside of nodejs",
    );
  }

  const buildMode = process.env.BUILD_MODE ?? "standalone";
  const isApp = !!process.env.BUILD_APP;
  const isAndroidApp =
    process.env.BUILD_ANDROID === "1" || process.env.BUILD_ANDROID === "true";
  const version = "v" + tauriConfig.package.version;

  const commitInfo = (() => {
    try {
      const childProcess = require("child_process");
      const commitDate: string = childProcess
        .execSync('git log -1 --format="%at000" --date=unix')
        .toString()
        .trim();
      const commitHash: string = childProcess
        .execSync('git log --pretty=format:"%H" -n 1')
        .toString()
        .trim();

      return { commitDate, commitHash };
    } catch (e) {
      console.error("[Build Config] No git or not from git repo.");
      return {
        commitDate: "unknown",
        commitHash: "unknown",
      };
    }
  })();

  return {
    version,
    ...commitInfo,
    buildMode,
    isApp,
    isAndroidApp,
    managedBackendBaseUrl:
      process.env.NEXT_PUBLIC_SUB2API_BASE_URL ?? "https://api.jisudeng.com",
    nextchatWebUrl:
      process.env.NEXT_PUBLIC_NEXTCHAT_WEB_URL ?? "https://www.jisudeng.com",
    androidApkUrl:
      process.env.NEXT_PUBLIC_ANDROID_APK_URL ??
      "/downloads/jisudengchat-android.apk",
    androidManifestUrl:
      process.env.NEXT_PUBLIC_ANDROID_MANIFEST_URL ??
      "/downloads/android-version.json",
    androidVersion: process.env.NEXT_PUBLIC_ANDROID_VERSION ?? version,
    androidApkSha256: process.env.NEXT_PUBLIC_ANDROID_APK_SHA256 ?? "",
    androidApkSize: process.env.NEXT_PUBLIC_ANDROID_APK_SIZE ?? "",
    androidReleaseNotes: process.env.NEXT_PUBLIC_ANDROID_RELEASE_NOTES ?? "",
    template: process.env.DEFAULT_INPUT_TEMPLATE ?? DEFAULT_INPUT_TEMPLATE,
  };
};

export type BuildConfig = ReturnType<typeof getBuildConfig>;
