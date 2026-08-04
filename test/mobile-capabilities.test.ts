import { describe, expect, test } from "@jest/globals";

import {
  isMobileAdminAvailable,
  isMobileAdminComplianceAvailable,
  isMobileWebSearchAvailable,
  resolveMobileAdminCapability,
} from "../app/client/mobile-capabilities";

describe("mobile web search capability contract", () => {
  test("enables model tools only for a canonical server-owned search service", () => {
    expect(
      isMobileWebSearchAvailable({
        capabilities: {
          search: {
            configured: true,
            execution_state: "canonical",
            default_enabled: true,
            model_tool_call_required: true,
          },
        },
      } as never),
    ).toBe(true);
  });

  test("fails closed for disabled, legacy, or toggle-gated servers", () => {
    const search = (overrides: Record<string, unknown>) =>
      isMobileWebSearchAvailable({
        capabilities: {
          search: {
            configured: true,
            execution_state: "canonical",
            default_enabled: true,
            model_tool_call_required: true,
            ...overrides,
          },
        },
      } as never);

    expect(search({ configured: false })).toBe(false);
    expect(search({ execution_state: "legacy" })).toBe(false);
    expect(search({ default_enabled: false })).toBe(false);
    expect(search({ model_tool_call_required: false })).toBe(false);
    expect(isMobileWebSearchAvailable(null)).toBe(false);
  });
});

describe("mobile admin capabilities", () => {
  test("fails closed when the server does not declare the capability", () => {
    expect(resolveMobileAdminCapability({ capabilities: undefined })).toEqual({
      available: false,
      apiBasePath: "",
      stepUpPath: "",
      compliancePath: "",
      writeOperations: [],
    });
  });

  test("does not infer access from a role-like field outside capabilities", () => {
    expect(
      isMobileAdminAvailable({
        session: { role: "admin" },
        capabilities: {},
      } as any),
    ).toBe(false);
  });

  test("accepts only explicit canonical paths and compliance declarations", () => {
    const protocol = {
      capabilities: {
        admin: {
          available: true,
          api_base_path: " /api/v1/admin ",
          step_up_path: "/api/v1/user/totp/step-up",
          compliance_path: " /api/v1/admin/compliance ",
        },
      },
    } as any;

    expect(resolveMobileAdminCapability(protocol)).toEqual({
      available: true,
      apiBasePath: "/api/v1/admin",
      stepUpPath: "/api/v1/user/totp/step-up",
      compliancePath: "/api/v1/admin/compliance",
      writeOperations: [],
    });
    expect(isMobileAdminAvailable(protocol)).toBe(true);
    expect(isMobileAdminComplianceAvailable(protocol)).toBe(true);
  });

  test("does not enable a malformed, false, or undeclared compliance capability", () => {
    expect(
      isMobileAdminAvailable({
        capabilities: { admin: { available: "true" } },
      } as any),
    ).toBe(false);
    expect(
      isMobileAdminAvailable({
        capabilities: {
          admin: {
            available: true,
            api_base_path: "/api/v1/admin-preview",
            step_up_path: "/api/v1/user/totp/step-up",
          },
        },
      } as any),
    ).toBe(false);

    const legacyProtocol = {
      capabilities: {
        admin: {
          available: true,
          api_base_path: "/api/v1/admin",
          step_up_path: "/api/v1/user/totp/step-up",
        },
      },
    } as any;
    expect(isMobileAdminAvailable(legacyProtocol)).toBe(true);
    expect(isMobileAdminComplianceAvailable(legacyProtocol)).toBe(false);
  });
});
