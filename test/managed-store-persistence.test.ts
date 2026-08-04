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
