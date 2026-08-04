import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.unstable_mockModule("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: jest.fn(() => "web"),
  },
  CapacitorHttp: {
    request: jest.fn(),
  },
  registerPlugin: jest.fn(() => ({})),
}));

const { MobileAdminWorkspace } = await import(
  "../app/components/mobile-admin-workspace"
);
const { getManagedMobileText } = await import(
  "../app/client/managed-mobile-i18n"
);

const client = {
  baseUrl: "https://api.jisudeng.com",
  accessToken: "admin-access-token",
  mobileProtocol: {
    capabilities: {
      admin: {
        available: true,
        api_base_path: "/api/v1/admin",
        step_up_path: "/api/v1/user/totp/step-up",
        compliance_path: "/api/v1/admin/compliance",
      },
    },
  },
};

function success(data: unknown) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ code: 0, data })),
  } as Response;
}

describe("mobile administrator workspace", () => {
  const originalFetch = window.fetch;

  beforeEach(() => {
    window.fetch = jest.fn<typeof window.fetch>((input) => {
      const url = new URL(String(input));
      const path = url.pathname;

      if (path === "/api/v1/admin/compliance") {
        return Promise.resolve(success({ required: false, version: "" }));
      }
      if (path === "/api/v1/admin/dashboard/snapshot-v2") {
        return Promise.resolve(success({ overview: { total_users: 1 } }));
      }
      if (path === "/api/v1/admin/payment/dashboard") {
        return Promise.resolve(success({ total_revenue: 0 }));
      }
      if (path === "/api/v1/admin/users") {
        return Promise.resolve(
          success({
            items: [{ id: 42, email: "member@example.com", status: "active" }],
            total: 1,
            page: 1,
            page_size: 20,
            pages: 1,
          }),
        );
      }
      if (path === "/api/v1/admin/users/42") {
        return Promise.resolve(
          success({ id: 42, email: "member@example.com", balance: 12.5 }),
        );
      }
      if (path === "/api/v1/admin/users/42/usage") {
        return Promise.resolve(success({ total_requests: 7 }));
      }
      if (path === "/api/v1/admin/users/42/balance-history") {
        return Promise.resolve(success([{ id: 9, amount: 12.5 }]));
      }
      if (path === "/api/v1/admin/users/42/balance-reconciliation") {
        return Promise.resolve(success({ balanced: true }));
      }
      if (path === "/api/v1/admin/users/42/subscriptions") {
        return Promise.resolve(
          success({
            items: [{ id: 6, status: "active" }],
            total: 1,
            page: 1,
            page_size: 20,
            pages: 1,
          }),
        );
      }
      return Promise.resolve(
        success({ items: [], total: 0, page: 1, pages: 1 }),
      );
    });
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  test("opens a redacted, server-backed user detail sheet from the paged list", async () => {
    render(
      <MobileAdminWorkspace
        client={client}
        text={getManagedMobileText("en")}
      />,
    );

    await screen.findByRole("tab", { name: "Overview" });
    fireEvent.click(screen.getByRole("tab", { name: "Users" }));
    await screen.findByText("member@example.com");
    fireEvent.click(
      screen.getByRole("button", { name: /member@example.com/i }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "member@example.com",
    });

    await waitFor(() => {
      expect(dialog.textContent).toContain("User profile");
      expect(dialog.textContent).toContain("Balance history");
      expect(dialog.textContent).toContain("Subscriptions");
      expect(window.fetch).toHaveBeenCalledWith(
        "https://api.jisudeng.com/api/v1/admin/users/42/balance-reconciliation",
        expect.objectContaining({ method: "GET" }),
      );
      expect(window.fetch).toHaveBeenCalledWith(
        "https://api.jisudeng.com/api/v1/admin/users/42/subscriptions?page=1&page_size=20",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });
});
