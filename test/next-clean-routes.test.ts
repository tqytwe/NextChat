const expectedCleanRouteRedirects = [
  { source: "/sd", destination: "/#/sd", permanent: false },
  { source: "/chat", destination: "/#/chat", permanent: false },
  { source: "/prompts", destination: "/#/prompts", permanent: false },
  { source: "/settings", destination: "/#/settings", permanent: false },
];

describe("Next clean hash route redirects", () => {
  let cleanRoutes: {
    buildCleanHashRouteRedirects: () => typeof expectedCleanRouteRedirects;
    getNextChatBasePath: (env?: NodeJS.ProcessEnv) => string;
    normalizeNextChatBasePath: (rawBasePath?: string) => string;
  };

  beforeAll(async () => {
    cleanRoutes = (
      await import("../app/config/clean-routes.cjs")
    ).default as typeof cleanRoutes;
  });

  test("redirects clean app routes to their hash router targets", () => {
    expect(cleanRoutes.buildCleanHashRouteRedirects()).toEqual(
      expectedCleanRouteRedirects,
    );
  });

  test("normalizes base paths for root and /ai deployments", () => {
    expect(cleanRoutes.normalizeNextChatBasePath("")).toBe("");
    expect(cleanRoutes.normalizeNextChatBasePath("/")).toBe("");
    expect(cleanRoutes.normalizeNextChatBasePath("ai")).toBe("/ai");
    expect(cleanRoutes.normalizeNextChatBasePath("/ai/")).toBe("/ai");
  });

  test("defaults managed deployments to the /ai base path", () => {
    expect(
      cleanRoutes.getNextChatBasePath({
        SUB2API_MANAGED_MODE: "true",
      } as NodeJS.ProcessEnv),
    ).toBe("/ai");
    expect(
      cleanRoutes.getNextChatBasePath({
        SUB2API_MANAGED_MODE: "true",
        NEXTCHAT_BASE_PATH: "/",
      } as NodeJS.ProcessEnv),
    ).toBe("");
  });
});
