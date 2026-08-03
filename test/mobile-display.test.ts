import { describe, expect, test } from "@jest/globals";

import { localizedMobileDisplay } from "../app/client/mobile-display";
import { localizeManagedMobileError } from "../app/client/managed-mobile-i18n";

describe("mobile dynamic display localization", () => {
  const record = {
    title_zh: "中文标题",
    title_en: "English title",
    title: "Fallback title",
  };

  test("uses the system locale before the API default field", () => {
    expect(localizedMobileDisplay(record, { locale: "cn" })).toBe("中文标题");
    expect(localizedMobileDisplay(record, { locale: "en" })).toBe(
      "English title",
    );
  });

  test("falls back through localized and generic fields without translating identifiers", () => {
    expect(
      localizedMobileDisplay(
        { localized: { en: "Server English", default: "Server default" } },
        { locale: "en" },
      ),
    ).toBe("Server English");
    expect(
      localizedMobileDisplay(
        { title: "gpt-image-private-alias" },
        { locale: "cn" },
      ),
    ).toBe("gpt-image-private-alias");
  });

  test("maps coupon and plan error codes before showing an upstream message", () => {
    expect(
      localizeManagedMobileError({
        code: "coupon_not_applicable",
        message: "coupon cannot be used with this subscription",
      }),
    ).toMatch(/coupon|卡券/i);
    expect(
      localizeManagedMobileError({
        code: "subscription_unavailable",
        message: "subscription plan unavailable",
      }),
    ).toMatch(/plan|套餐/i);
  });
});
