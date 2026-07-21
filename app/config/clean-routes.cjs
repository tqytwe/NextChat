const cleanHashRoutes = ["/sd", "/chat", "/prompts", "/settings"];

function normalizeNextChatBasePath(rawBasePath) {
  const trimmed = (rawBasePath ?? "").trim();
  if (trimmed === "" || trimmed === "/") return "";
  return "/" + trimmed.replace(/^\/+|\/+$/g, "");
}

function getNextChatBasePath(env = process.env) {
  const managedMode = ["1", "true", "yes", "on"].includes(
    (env.SUB2API_MANAGED_MODE ?? "").toLowerCase(),
  );
  return normalizeNextChatBasePath(
    env.NEXTCHAT_BASE_PATH ?? (managedMode ? "/ai" : ""),
  );
}

function buildCleanHashRouteRedirects() {
  return cleanHashRoutes.map((route) => ({
    source: route,
    destination: `/#${route}`,
    permanent: false,
  }));
}

module.exports = {
  buildCleanHashRouteRedirects,
  cleanHashRoutes,
  getNextChatBasePath,
  normalizeNextChatBasePath,
};
