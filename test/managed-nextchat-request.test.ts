import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

jest.unstable_mockModule("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: jest.fn(() => "web"),
  },
  CapacitorHttp: {
    request: jest.fn(),
  },
  registerPlugin: jest.fn(() => ({})),
}));

const { Capacitor, CapacitorHttp } = await import("@capacitor/core");
const {
  isManagedAuthError,
  loginManagedUser,
  managedJsonRequest,
  shouldRefreshManagedSession,
  shouldRefreshManagedToken,
  switchManagedImageGroupCompatible,
} = await import("../app/client/managed-nextchat");

describe("managed NextChat API requests", () => {
  const originalFetch = window.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Capacitor.getPlatform).mockReturnValue("web");
    window.fetch = jest.fn<typeof window.fetch>();
    Object.defineProperty(window.navigator, "languages", {
      value: ["zh-CN"],
      configurable: true,
    });
    delete window.JisudengNativeBridge;
  });

  afterEach(() => {
    window.fetch = originalFetch;
    delete window.JisudengNativeBridge;
  });

  test("uses browser fetch outside Android", async () => {
    jest.mocked(window.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(JSON.stringify({ code: 0, data: { ok: true } })),
    } as Response);

    await expect(
      managedJsonRequest<{ ok: boolean }>(
        "https://api.jisudeng.com",
        "/api/v1/nextchat/mobile/bootstrap",
      ),
    ).resolves.toEqual({ ok: true });

    expect(window.fetch).toHaveBeenCalledWith(
      "https://api.jisudeng.com/api/v1/nextchat/mobile/bootstrap",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    expect(CapacitorHttp.request).not.toHaveBeenCalled();
  });

  test("falls back to the legacy group route when image sessions are not deployed", async () => {
    jest
      .mocked(window.fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve("404 page not found"),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              code: 0,
              data: { session: { api_key: "legacy" } },
            }),
          ),
      } as Response);

    await expect(
      switchManagedImageGroupCompatible(
        "https://api.jisudeng.com",
        "access-token",
        7,
      ),
    ).resolves.toMatchObject({ session: { api_key: "legacy" } });

    expect(window.fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.jisudeng.com/api/v1/nextchat/mobile/sessions/image/group",
      expect.anything(),
    );
    expect(window.fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.jisudeng.com/api/v1/nextchat/mobile/group",
      expect.anything(),
    );
  });

  test("uses native HTTP on Android for managed login", async () => {
    jest.mocked(Capacitor.getPlatform).mockReturnValue("android");
    jest.mocked(CapacitorHttp.request).mockResolvedValue({
      status: 200,
      headers: {},
      url: "https://api.jisudeng.com/api/v1/auth/mobile/login",
      data: JSON.stringify({
        code: 0,
        data: {
          access_token: "access",
          refresh_token: "refresh",
        },
      }),
    });

    await expect(
      loginManagedUser(
        "https://api.jisudeng.com",
        "user@example.com",
        "secret",
      ),
    ).resolves.toMatchObject({
      access_token: "access",
      refresh_token: "refresh",
    });

    expect(window.fetch).not.toHaveBeenCalled();
    expect(CapacitorHttp.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://api.jisudeng.com/api/v1/auth/mobile/login",
        method: "POST",
        data: JSON.stringify({
          email: "user@example.com",
          password: "secret",
        }),
        responseType: "text",
      }),
    );
  });

  test("uses the APK direct bridge when the custom WebView reports web", async () => {
    window.JisudengNativeBridge = {
      request: jest.fn((raw) => {
        const request = JSON.parse(String(raw)) as { id: string };
        queueMicrotask(() => {
          window.__jisudengNativeResolve?.(request.id, { id: request.id });
          window.__jisudengNativeStream?.(request.id, "status", {
            status: 200,
          });
          window.__jisudengNativeStream?.(request.id, "data", {
            line: JSON.stringify({ code: 0, data: { ok: true } }),
          });
          window.__jisudengNativeStream?.(request.id, "done");
        });
      }),
    };

    await expect(
      managedJsonRequest<{ ok: boolean }>(
        "https://api.jisudeng.com",
        "/api/v1/nextchat/mobile/bootstrap",
        {},
        "access-token",
      ),
    ).resolves.toEqual({ ok: true });

    expect(window.JisudengNativeBridge.request).toHaveBeenCalledTimes(1);
    expect(window.fetch).not.toHaveBeenCalled();
    expect(CapacitorHttp.request).not.toHaveBeenCalled();
  });

  test("keeps localized business errors from native HTTP responses", async () => {
    jest.mocked(Capacitor.getPlatform).mockReturnValue("android");
    jest.mocked(CapacitorHttp.request).mockResolvedValue({
      status: 401,
      headers: {},
      url: "https://api.jisudeng.com/api/v1/auth/mobile/login",
      data: JSON.stringify({
        code: 401,
        message: "邮箱或密码错误",
      }),
    });

    const request = loginManagedUser(
      "https://api.jisudeng.com",
      "user@example.com",
      "bad",
    );
    await expect(request).rejects.toThrow("邮箱或密码不正确");
    await expect(request).rejects.toMatchObject({ status: 401 });
  });

  test("preserves auth status so callers can refresh instead of reporting a network error", async () => {
    jest.mocked(window.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: () =>
        Promise.resolve(
          JSON.stringify({ code: "TOKEN_EXPIRED", message: "token expired" }),
        ),
    } as Response);

    let caught: unknown;
    try {
      await managedJsonRequest(
        "https://api.jisudeng.com",
        "/api/v1/nextchat/mobile/bootstrap",
        {},
        "expired-access-token",
      );
    } catch (error) {
      caught = error;
    }
    expect(isManagedAuthError(caught)).toBe(true);
  });

  test("refreshes shortly before the persisted access token expires", () => {
    const now = Date.parse("2026-07-26T05:00:00.000Z");
    expect(shouldRefreshManagedToken("2026-07-26T05:00:30.000Z", now)).toBe(
      true,
    );
    expect(shouldRefreshManagedToken("2026-07-26T05:05:00.000Z", now)).toBe(
      false,
    );
  });

  test("refreshes missing and expiring managed API-key sessions", () => {
    const now = Date.parse("2026-07-26T05:00:00.000Z");
    expect(shouldRefreshManagedSession(null, now)).toBe(true);
    expect(
      shouldRefreshManagedSession(
        {
          user_id: 1,
          api_key: "managed-key",
          api_key_id: 2,
          expires_at: "2026-07-26T05:04:00.000Z",
        },
        now,
      ),
    ).toBe(true);
    expect(
      shouldRefreshManagedSession(
        {
          user_id: 1,
          api_key: "managed-key",
          api_key_id: 2,
          expires_at: "2026-07-26T06:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  test("retries idempotent Android GET after a transient native failure", async () => {
    jest.mocked(Capacitor.getPlatform).mockReturnValue("android");
    jest
      .mocked(CapacitorHttp.request)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        status: 200,
        headers: {},
        url: "https://api.jisudeng.com/api/v1/nextchat/mobile/bootstrap",
        data: JSON.stringify({ code: 0, data: { ok: true } }),
      });

    await expect(
      managedJsonRequest<{ ok: boolean }>(
        "https://api.jisudeng.com",
        "/api/v1/nextchat/mobile/bootstrap",
      ),
    ).resolves.toEqual({ ok: true });

    expect(CapacitorHttp.request).toHaveBeenCalledTimes(2);
    expect(window.fetch).not.toHaveBeenCalled();
  });

  test("falls back to fetch after Android GET retry exhaustion", async () => {
    jest.mocked(Capacitor.getPlatform).mockReturnValue("android");
    jest
      .mocked(CapacitorHttp.request)
      .mockRejectedValueOnce(new Error("socket closed"))
      .mockRejectedValueOnce(new Error("socket closed"));
    jest.mocked(window.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(JSON.stringify({ code: 0, data: { ok: true } })),
    } as Response);

    await expect(
      managedJsonRequest<{ ok: boolean }>(
        "https://api.jisudeng.com",
        "/api/v1/nextchat/mobile/bootstrap",
      ),
    ).resolves.toEqual({ ok: true });

    expect(CapacitorHttp.request).toHaveBeenCalledTimes(2);
    expect(window.fetch).toHaveBeenCalledTimes(1);
  });

  test("does not retry non-idempotent Android POST requests", async () => {
    jest.mocked(Capacitor.getPlatform).mockReturnValue("android");
    jest
      .mocked(CapacitorHttp.request)
      .mockRejectedValueOnce(new Error("network down"));

    await expect(
      loginManagedUser("https://api.jisudeng.com", "user@example.com", "bad"),
    ).rejects.toThrow("网络请求失败");

    expect(CapacitorHttp.request).toHaveBeenCalledTimes(1);
    expect(window.fetch).not.toHaveBeenCalled();
  });

  test("releases Android native request promises when aborted", async () => {
    jest.mocked(Capacitor.getPlatform).mockReturnValue("android");
    jest.mocked(CapacitorHttp.request).mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();

    const request = managedJsonRequest<{ ok: boolean }>(
      "https://api.jisudeng.com",
      "/api/v1/nextchat/mobile/bootstrap",
      { signal: controller.signal },
    );
    controller.abort();

    await expect(request).rejects.toThrow(/abort/i);
    expect(CapacitorHttp.request).toHaveBeenCalledTimes(1);
    expect(window.fetch).not.toHaveBeenCalled();
  });
});
