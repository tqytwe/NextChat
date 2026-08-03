import tauriConfig from "../../src-tauri/tauri.conf.json";
import { DEFAULT_INPUT_TEMPLATE } from "../constant";

export function androidReleaseMetadataFromEnv(
  environment: Record<string, string | undefined> = process.env,
) {
  // Gradle and the release packager use ANDROID_* as their source of truth.
  // Keep the embedded web bundle on exactly the same authority.
  const configuredAndroidVersion =
    environment.ANDROID_VERSION_NAME ??
    environment.NEXT_PUBLIC_ANDROID_VERSION ??
    "";
  const androidVersion = configuredAndroidVersion.replace(/^v/i, "");
  const configuredAndroidVersionCode =
    environment.ANDROID_VERSION_CODE ??
    environment.NEXT_PUBLIC_ANDROID_VERSION_CODE ??
    "";
  const androidVersionCode = /^\d+$/.test(configuredAndroidVersionCode)
    ? Number(configuredAndroidVersionCode)
    : undefined;

  return { androidVersion, androidVersionCode };
}

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
  const sub2apiManagedMode = ["1", "true", "yes", "on"].includes(
    (process.env.SUB2API_MANAGED_MODE ?? "").toLowerCase(),
  );
  const rawBasePath =
    process.env.NEXTCHAT_BASE_PATH ?? (sub2apiManagedMode ? "/ai" : "");
  const basePath =
    rawBasePath.trim() === "" || rawBasePath.trim() === "/"
      ? ""
      : "/" + rawBasePath.trim().replace(/^\/+|\/+$/g, "");
  const version = "v" + tauriConfig.package.version;
  const { androidVersion, androidVersionCode } =
    androidReleaseMetadataFromEnv();
  const androidReleaseCacheKey =
    androidVersionCode && androidVersion
      ? `${androidVersion}-${androidVersionCode}`
      : androidVersion;
  const defaultAndroidApkUrl = androidReleaseCacheKey
    ? `/downloads/jisudengchat-android.apk?v=${encodeURIComponent(
        androidReleaseCacheKey,
      )}`
    : "/downloads/jisudengchat-android.apk";

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
    androidApkUrl: isAndroidApp
      ? defaultAndroidApkUrl
      : process.env.NEXT_PUBLIC_ANDROID_APK_URL ?? defaultAndroidApkUrl,
    androidManifestUrl: isAndroidApp
      ? "/downloads/android-version.json"
      : process.env.NEXT_PUBLIC_ANDROID_MANIFEST_URL ??
        "/downloads/android-version.json",
    androidVersion,
    androidVersionCode,
    androidApkSha256: process.env.NEXT_PUBLIC_ANDROID_APK_SHA256 ?? "",
    androidApkSize: process.env.NEXT_PUBLIC_ANDROID_APK_SIZE ?? "",
    androidReleaseNotes: process.env.NEXT_PUBLIC_ANDROID_RELEASE_NOTES ?? "",
    basePath,
    sub2apiManagedMode,
    template: process.env.DEFAULT_INPUT_TEMPLATE ?? DEFAULT_INPUT_TEMPLATE,
  };
};

export type BuildConfig = ReturnType<typeof getBuildConfig>;
