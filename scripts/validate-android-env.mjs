const backendBaseUrl = (process.env.NEXT_PUBLIC_SUB2API_BASE_URL || "").trim();
const webBaseUrl = (process.env.NEXT_PUBLIC_NEXTCHAT_WEB_URL || "").trim();
const allowDevBackend = process.env.ALLOW_ANDROID_DEV_BACKEND === "1";
const androidVersionName = (process.env.ANDROID_VERSION_NAME || "").trim();
const androidVersionCode = (process.env.ANDROID_VERSION_CODE || "").trim();
const publicAndroidVersion = (
  process.env.NEXT_PUBLIC_ANDROID_VERSION || ""
).trim();
const publicAndroidVersionCode = (
  process.env.NEXT_PUBLIC_ANDROID_VERSION_CODE || ""
).trim();

function fail(message) {
  console.error(`[Android Env] ${message}`);
  process.exit(1);
}

function isPlaceholderHost(hostname) {
  return (
    hostname === "api.example.com" ||
    hostname.endsWith(".example.com") ||
    hostname === "your-domain.com" ||
    hostname.endsWith(".your-domain.com")
  );
}

function normalizedVersionName(version) {
  return version.replace(/^v/i, "");
}

if (
  androidVersionName &&
  publicAndroidVersion &&
  normalizedVersionName(androidVersionName) !==
    normalizedVersionName(publicAndroidVersion)
) {
  fail(
    "ANDROID_VERSION_NAME and NEXT_PUBLIC_ANDROID_VERSION disagree. Android release metadata must have one source of truth.",
  );
}

if (
  androidVersionCode &&
  publicAndroidVersionCode &&
  androidVersionCode !== publicAndroidVersionCode
) {
  fail(
    "ANDROID_VERSION_CODE and NEXT_PUBLIC_ANDROID_VERSION_CODE disagree. Android release metadata must have one source of truth.",
  );
}

if (!backendBaseUrl) {
  fail(
    "NEXT_PUBLIC_SUB2API_BASE_URL is required. Android users must not enter a backend address manually.",
  );
}

if (!webBaseUrl) {
  fail(
    "NEXT_PUBLIC_NEXTCHAT_WEB_URL is required. Android downloads must come from www.jisudeng.com.",
  );
}

let parsed;
try {
  parsed = new URL(backendBaseUrl);
} catch {
  fail("NEXT_PUBLIC_SUB2API_BASE_URL must be an absolute URL.");
}

let parsedWeb;
try {
  parsedWeb = new URL(webBaseUrl);
} catch {
  fail("NEXT_PUBLIC_NEXTCHAT_WEB_URL must be an absolute URL.");
}

if (!allowDevBackend && parsed.protocol !== "https:") {
  fail(
    "NEXT_PUBLIC_SUB2API_BASE_URL must use https for Android release builds.",
  );
}

if (!allowDevBackend && parsedWeb.protocol !== "https:") {
  fail(
    "NEXT_PUBLIC_NEXTCHAT_WEB_URL must use https for Android release builds.",
  );
}

if (!allowDevBackend && isPlaceholderHost(parsed.hostname.toLowerCase())) {
  fail("NEXT_PUBLIC_SUB2API_BASE_URL still points to a placeholder domain.");
}

if (!allowDevBackend && isPlaceholderHost(parsedWeb.hostname.toLowerCase())) {
  fail("NEXT_PUBLIC_NEXTCHAT_WEB_URL still points to a placeholder domain.");
}

if (
  !allowDevBackend &&
  parsedWeb.hostname.toLowerCase() !== "www.jisudeng.com"
) {
  fail("NEXT_PUBLIC_NEXTCHAT_WEB_URL must be https://www.jisudeng.com.");
}

console.log(`[Android Env] fixed backend: ${parsed.origin}`);
console.log(`[Android Env] official web: ${parsedWeb.origin}`);
