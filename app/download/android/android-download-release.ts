const CANONICAL_ANDROID_APK_PATH = "/downloads/jisudengchat-android.apk";
// The version/code form is retained for older releases. New manifests add the
// verified APK SHA-256 so publishing a replacement APK cannot reuse a cached
// URL. Keeping the parser strict prevents a manifest from redirecting to an
// arbitrary host or path.
const VERSION_CACHE_KEY = /^\d+(?:\.\d+)+-\d+(?:-[0-9a-f]{64})?$/i;

/** Only use the signed APK path advertised by the same-site release manifest. */
export function canonicalAndroidApkPath(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "";
  }

  try {
    const url = new URL(value, "https://android-release.invalid");
    const cacheKey = url.searchParams.get("v") || "";
    if (
      url.pathname !== CANONICAL_ANDROID_APK_PATH ||
      [...url.searchParams.keys()].length !== 1 ||
      !VERSION_CACHE_KEY.test(cacheKey) ||
      url.hash
    ) {
      return "";
    }
    return `${CANONICAL_ANDROID_APK_PATH}?v=${encodeURIComponent(cacheKey)}`;
  } catch {
    return "";
  }
}
