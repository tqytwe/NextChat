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

const { Capacitor } = await import("@capacitor/core");
const { ManagedApiError, ManagedTransportError } = await import(
  "../app/client/managed-nextchat"
);
const {
  MobileAdminClientError,
  listMobileAdminAuditLogs,
  listMobileAdminOrders,
  listMobileAdminUsers,
  getMobileAdminUserWalletHistory,
  mobileAdminErrorCategory,
  mobileAdminRequestId,
  verifyMobileAdminStepUp,
} = await import("../app/client/mobile-admin");

const client = {
  baseUrl: "https://api.jisudeng.com",
  accessToken: "admin-access-token",
  mobileProtocol: {
    capabilities: {
      admin: {
        available: true,
        api_base_path: "/api/v1/admin",
        step_up_path: "/api/v1/user/totp/step-up",
      },
    },
  },
};

describe("mobile administrator client", () => {
  const originalFetch = window.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Capacitor.getPlatform).mockReturnValue("web");
    window.fetch = jest.fn<typeof window.fetch>();
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  test("fails closed when a role-like value exists without a server capability", async () => {
    const unavailableClient = {
      ...client,
      mobileProtocol: {
        session: { role: "admin" },
      } as unknown as { capabilities?: undefined },
    };

    let error: unknown;
    try {
      await listMobileAdminUsers(unavailableClient, undefined, {
        requestId: "admin-capability-1",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(MobileAdminClientError);
    expect(error).toMatchObject({
      code: "ADMIN_CAPABILITY_UNAVAILABLE",
      category: "capability",
      path: "/api/v1/admin/users",
      requestId: "admin-capability-1",
    });
    expect(mobileAdminErrorCategory(error)).toBe("capability");
    expect(mobileAdminRequestId(error)).toBe("admin-capability-1");
    expect(window.fetch).not.toHaveBeenCalled();
  });

  test("rejects a malformed server path before it can be requested", async () => {
    const malformedClient = {
      ...client,
      mobileProtocol: {
        capabilities: {
          admin: {
            available: true,
            api_base_path: "/api/v1/admin-preview",
            step_up_path: "/api/v1/user/totp/step-up",
          },
        },
      },
    };

    await expect(
      listMobileAdminAuditLogs(malformedClient, undefined, {
        requestId: "admin-capability-2",
      }),
    ).rejects.toMatchObject({
      code: "ADMIN_CAPABILITY_INVALID",
      category: "capability",
      path: "/api/v1/admin/audit-logs",
      requestId: "admin-capability-2",
    });
    expect(window.fetch).not.toHaveBeenCalled();
  });

  test("uses an allowlisted canonical order route with correlated request IDs", async () => {
    jest.mocked(window.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            code: 0,
            data: {
              items: [{ id: 12, status: "paid" }],
              total: 1,
              page: 2,
              page_size: 10,
              pages: 1,
            },
          }),
        ),
    } as Response);

    const result = await listMobileAdminOrders(
      client,
      { page: 2, page_size: 10, status: "paid" },
      { requestId: "admin-orders-1", locale: "en-US" },
    );

    expect(result).toEqual({
      data: {
        items: [{ id: 12, status: "paid" }],
        total: 1,
        page: 2,
        page_size: 10,
        pages: 1,
      },
      requestId: "admin-orders-1",
    });
    expect(window.fetch).toHaveBeenCalledWith(
      "https://api.jisudeng.com/api/v1/admin/payment/orders?page=2&page_size=10&status=paid",
      expect.objectContaining({ method: "GET" }),
    );
    const request = jest.mocked(window.fetch).mock.calls[0][1];
    const headers = new Headers(request?.headers);
    expect(headers.get("Authorization")).toBe("Bearer admin-access-token");
    expect(headers.get("X-Request-ID")).toBe("admin-orders-1");
    expect(headers.get("X-Client-Request-ID")).toBe("admin-orders-1");
    expect(headers.get("Accept-Language")).toBe("en-US");
  });

  test("preserves the request ID and HTTP category from an admin failure", async () => {
    jest.mocked(window.fetch).mockResolvedValue({
      ok: false,
      status: 502,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            code: 502,
            message: "upstream temporarily unavailable",
          }),
        ),
    } as Response);

    let error: unknown;
    try {
      await listMobileAdminOrders(client, undefined, {
        requestId: "admin-orders-502",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ManagedApiError);
    expect(error).toMatchObject({
      status: 502,
      path: "/api/v1/admin/payment/orders",
      requestId: "admin-orders-502",
      category: "http",
    });
    expect(mobileAdminErrorCategory(error)).toBe("http");
    expect(mobileAdminRequestId(error)).toBe("admin-orders-502");
  });

  test("preserves the request ID and network category from a transport failure", async () => {
    jest.mocked(window.fetch).mockRejectedValue(new Error("socket closed"));

    let error: unknown;
    try {
      await listMobileAdminOrders(client, undefined, {
        requestId: "admin-orders-network",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ManagedTransportError);
    expect(error).toMatchObject({
      path: "/api/v1/admin/payment/orders",
      requestId: "admin-orders-network",
      category: "network",
    });
    expect(mobileAdminErrorCategory(error)).toBe("network");
    expect(mobileAdminRequestId(error)).toBe("admin-orders-network");
  });

  test("uses the existing scoped wallet history route instead of inventing admin wallet", async () => {
    jest.mocked(window.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ code: 0, data: [] })),
    } as Response);

    await expect(
      getMobileAdminUserWalletHistory(
        client,
        42,
        { page: 1 },
        {
          requestId: "admin-wallet-42",
        },
      ),
    ).resolves.toEqual({ data: [], requestId: "admin-wallet-42" });

    expect(window.fetch).toHaveBeenCalledWith(
      "https://api.jisudeng.com/api/v1/admin/users/42/balance-history?page=1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("does not submit a TOTP code when the administrator JWT is missing", async () => {
    await expect(
      verifyMobileAdminStepUp({ ...client, accessToken: "" }, "123456", {
        requestId: "admin-step-up-no-token",
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "ADMIN_AUTH_TOKEN_REQUIRED",
      category: "capability",
      requestId: "admin-step-up-no-token",
    });
    expect(window.fetch).not.toHaveBeenCalled();
  });

  test("posts the current-session TOTP step-up code without a write replay", async () => {
    jest.mocked(window.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            code: 0,
            data: { verified: true, expires_in: 900 },
          }),
        ),
    } as Response);

    await expect(
      verifyMobileAdminStepUp(client, " 123456 ", {
        requestId: "admin-step-up-1",
      }),
    ).resolves.toEqual({
      data: { verified: true, expires_in: 900 },
      requestId: "admin-step-up-1",
    });

    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(window.fetch).toHaveBeenCalledWith(
      "https://api.jisudeng.com/api/v1/user/totp/step-up",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "123456" }),
      }),
    );
    const request = jest.mocked(window.fetch).mock.calls[0][1];
    const headers = new Headers(request?.headers);
    expect(headers.get("Authorization")).toBe("Bearer admin-access-token");
    expect(headers.get("X-Request-ID")).toBe("admin-step-up-1");
    expect(headers.get("X-Client-Request-ID")).toBe("admin-step-up-1");
    expect(headers.get("Idempotency-Key")).toBeNull();
  });
});
