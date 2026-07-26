const backendBaseUrl = (process.env.NEXT_PUBLIC_SUB2API_BASE_URL || "").trim();
const webBaseUrl = (process.env.NEXT_PUBLIC_NEXTCHAT_WEB_URL || "").trim();
const allowDevBackend = process.env.ALLOW_ANDROID_DEV_BACKEND === "1";

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
