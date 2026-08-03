import { describe, expect, test } from "@jest/globals";

import {
  isMobileAdminAvailable,
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
      });
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
  });
});
