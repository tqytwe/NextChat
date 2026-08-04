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
    ).toEqual({ backendBaseUrl: "https://api.jisudeng.com" });
  });

  test("uses the compiled default for malformed persisted state", () => {
    expect(managedPersistedState({ backendBaseUrl: null })).toEqual({
      backendBaseUrl: "",
    });
  });
});
