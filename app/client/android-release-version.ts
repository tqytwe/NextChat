export type AndroidReleaseVersion = {
  name: string;
  code?: number;
};

export type AndroidReleaseManifest = {
  version?: string;
  latestVersion?: string;
  androidVersion?: string;
  versionCode?: number | string;
  minSupportedVersionCode?: number | string;
};

export type AndroidUpdateDecision = {
  hasUpdate: boolean;
  required: boolean;
  latest: AndroidReleaseVersion;
};

type AndroidReleaseVersionInput = {
  appVersionName?: unknown;
  appVersionCode?: unknown;
};

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function normalizedName(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "");
}

/**
 * The installed Android package is authoritative. Build-resource versions are
 * intentionally not accepted here because they belong to the embedded web UI.
 */
export function normalizeAndroidReleaseVersion(
  value?: AndroidReleaseVersionInput | null,
): AndroidReleaseVersion {
  return {
    name: normalizedName(value?.appVersionName),
    code: positiveInteger(value?.appVersionCode),
  };
}

export function androidManifestReleaseVersion(
  manifest?: AndroidReleaseManifest | null,
): AndroidReleaseVersion {
  return {
    name: normalizedName(
      manifest?.version || manifest?.latestVersion || manifest?.androidVersion,
    ),
    code: positiveInteger(manifest?.versionCode),
  };
}

export function formatAndroidReleaseVersion(
  version?: AndroidReleaseVersion | null,
  fallback = "",
) {
  if (!version?.name) return fallback;
  return version.code ? `${version.name} (${version.code})` : version.name;
}

/**
 * APK delivery is monotonic on Android versionCode. Do not fall back to a
 * semantic string comparison: an embedded web version can never decide APK
 * update eligibility.
 */
export function evaluateAndroidUpdate(
  installed?: AndroidReleaseVersion | null,
  manifest?: AndroidReleaseManifest | null,
): AndroidUpdateDecision {
  const latest = androidManifestReleaseVersion(manifest);
  const installedCode = positiveInteger(installed?.code);
  const minSupportedCode = positiveInteger(manifest?.minSupportedVersionCode);

  return {
    latest,
    hasUpdate: Boolean(
      installedCode && latest.code && latest.code > installedCode,
    ),
    required: Boolean(
      installedCode && minSupportedCode && installedCode < minSupportedCode,
    ),
  };
}
