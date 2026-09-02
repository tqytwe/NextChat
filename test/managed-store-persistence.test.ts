import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { managedPersistedState } from "../app/store/managed";

describe("managed store persistence", () => {
  test("persists only the backend origin, never a stale error or prior workspace", () => {
    expect(
      managedPersistedState({
        backendBaseUrl: "https://api.jisudeng.com///",
        lastError: "HTTP unavailable, network, request old-request",
        user: { id: 99, email: "previous@example.com" },
        workspace: { models: { groups: [] } },
        loading: true,
      }),
    ).toEqual({
      backendBaseUrl: "https://api.jisudeng.com",
      _hasHydrated: false,
      _persistenceBlocked: false,
    });
  });

  test("keeps the hydration sentinels so a v3 to v4 migration can commit once", () => {
    expect(
      managedPersistedState({
        backendBaseUrl: null,
        _hasHydrated: true,
        _persistenceBlocked: false,
        accessToken: "must-not-persist",
      }),
    ).toEqual({
      backendBaseUrl: "",
      _hasHydrated: true,
      _persistenceBlocked: false,
    });
  });
});

describe("managed group-switch workspace integrity", () => {
  test("applies only a verified pinned replacement and re-bootstraps compatibility responses", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/store/managed.ts"),
      "utf8",
    );

    expect(source).toContain("function applyManagedGroupSwitch(");
    expect(source).toContain("isGroupPinnedManagedSessionSwitch(");
    expect(source).toContain("get().applyBootstrap(bootstrap);");
    expect(source).toContain("await get().bootstrap({ silent: true });");

    for (const [method, purpose] of [
      ["async switchGroup(groupID: number)", '"chat"'],
      ["async switchImageGroup(groupID: number)", '"image"'],
      ["async switchVideoGroup(groupID: number)", '"video"'],
    ]) {
      const start = source.indexOf(method);
      expect(start).toBeGreaterThanOrEqual(0);
      const end = source.indexOf("\n      async ", start + method.length);
      const body = source.slice(start, end === -1 ? undefined : end);
      expect(body).toContain(
        `applyManagedGroupSwitch(bootstrap, ${purpose}, groupID)`,
      );
      expect(body).not.toContain("get().applyBootstrap(legacyBootstrap)");
    }
  });

  test("keeps non-video workspaces and the complete video workspace during a purpose-scoped switch", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/store/managed.ts"),
      "utf8",
    );
    const start = source.indexOf("applyBootstrap(bootstrap: ManagedMobileBootstrap)");
    const end = source.indexOf("\n      async logout()", start);
    const body = source.slice(start, end);

    expect(body).toContain("const isPurposeScopedResponse");
    expect(body).toContain("...previousWorkspaces");
    expect(body).toContain("[purpose]: { models: workspace.models }");
    expect(body).toContain("purpose === \"video\"");
    expect(body).toContain("previous.videoSession");
    expect(body).toContain("managed_api_keys");
  });
});
