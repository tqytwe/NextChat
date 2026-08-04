import { describe, expect, test } from "@jest/globals";

import {
  isMobileAdminAvailable,
  isMobileAdminComplianceAvailable,
  resolveMobileAdminCapability,
} from "../app/client/mobile-capabilities";

describe("mobile admin capabilities", () => {
  test("fails closed when the server does not declare the capability", () => {
    expect(
      resolveMobileAdminCapability({
        capabilities: undefined,
      }),
    ).toEqual({
      available: false,
      apiBasePath: "",
      stepUpPath: "",
      compliancePath: "",
      writeOperations: [],
    });
  });

  test("does not infer access from a role-like field outside capabilities", () => {
    const protocol = {
      session: { role: "admin" },
      capabilities: {},
    } as any;

    expect(isMobileAdminAvailable(protocol)).toBe(false);
  });

  test("accepts only an explicit available flag and canonical paths", () => {
    const protocol = {
      capabilities: {
        admin: {
          available: true,
          api_base_path: " /api/v1/admin ",
          step_up_path: "/api/v1/user/totp/step-up",
        },
      },
    } as any;

    expect(resolveMobileAdminCapability(protocol)).toEqual({
      available: true,
      apiBasePath: "/api/v1/admin",
      stepUpPath: "/api/v1/user/totp/step-up",
      compliancePath: "",
      writeOperations: [],
    });
    expect(isMobileAdminAvailable(protocol)).toBe(true);
    expect(isMobileAdminComplianceAvailable(protocol)).toBe(false);
  });

  test("enables the compliance gate only when the server explicitly declares it", () => {
    const protocol = {
      capabilities: {
        admin: {
          available: true,
          api_base_path: "/api/v1/admin",
          step_up_path: "/api/v1/user/totp/step-up",
          compliance_path: " /api/v1/admin/compliance ",
        },
      },
    } as any;

    expect(resolveMobileAdminCapability(protocol)).toMatchObject({
      compliancePath: "/api/v1/admin/compliance",
    });
    expect(isMobileAdminAvailable(protocol)).toBe(true);
    expect(isMobileAdminComplianceAvailable(protocol)).toBe(true);
  });

  test("does not enable access for a malformed or false capability", () => {
    expect(
      isMobileAdminAvailable({
        capabilities: { admin: { available: "true" } },
      } as any),
    ).toBe(false);
    expect(
      isMobileAdminAvailable({
        capabilities: { admin: { available: false } },
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
    expect(
      isMobileAdminAvailable({
        capabilities: {
          admin: {
            available: true,
            api_base_path: "/api/v1/admin",
          },
        },
      } as any),
    ).toBe(false);
  });

  test("keeps the legacy admin route usable when compliance is undeclared or malformed", () => {
    const legacyProtocol = {
      capabilities: {
        admin: {
          available: true,
          api_base_path: "/api/v1/admin",
          step_up_path: "/api/v1/user/totp/step-up",
        },
      },
    } as any;
    const malformedProtocol = {
      capabilities: {
        admin: {
          ...legacyProtocol.capabilities.admin,
          compliance_path: "/api/v1/admin/compliance-preview",
        },
      },
    } as any;

    expect(isMobileAdminAvailable(legacyProtocol)).toBe(true);
    expect(isMobileAdminComplianceAvailable(legacyProtocol)).toBe(false);
    expect(isMobileAdminAvailable(malformedProtocol)).toBe(true);
    expect(isMobileAdminComplianceAvailable(malformedProtocol)).toBe(false);
  });
});
