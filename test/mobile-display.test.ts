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

  test("uses Japanese and Korean API variants before English fallback", () => {
    const multiLocaleRecord = {
      title_zh: "中文标题",
      title_en: "English title",
      title_ja: "日本語タイトル",
      title_ko: "한국어 제목",
      title: "Fallback title",
    };

    expect(localizedMobileDisplay(multiLocaleRecord, { locale: "jp" })).toBe(
      "日本語タイトル",
    );
    expect(localizedMobileDisplay(multiLocaleRecord, { locale: "ko" })).toBe(
      "한국어 제목",
    );
    expect(
      localizedMobileDisplay(
        { localized: { en: "Server English", default: "Server default" } },
        { locale: "jp" },
      ),
    ).toBe("Server English");
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

  test("uses locale variants for API-specific display fields before defaults", () => {
    const paymentMethod = {
      display_name_zh: "微信支付",
      display_name_en: "WeChat Pay",
      display_name: "Weixin",
    };
    const coupon = {
      template_name_zh: "新用户券",
      template_name_en: "New user coupon",
      template_name: "Coupon",
    };

    expect(
      localizedMobileDisplay(paymentMethod, {
        locale: "cn",
        defaultFields: ["display_name"],
      }),
    ).toBe("微信支付");
    expect(
      localizedMobileDisplay(coupon, {
        locale: "en",
        defaultFields: ["template_name"],
      }),
    ).toBe("New user coupon");
  });

  test("resolves dynamic plan fields returned as direct locale objects", () => {
    const plan = {
      duration: { zh: "30 天", en: "30 days" },
      duration_zh: "30 天",
      duration_en: "30 days",
    };
    expect(
      localizedMobileDisplay(plan, {
        locale: "cn",
        defaultFields: ["duration"],
      }),
    ).toBe("30 天");
    expect(
      localizedMobileDisplay(plan, {
        locale: "en",
        defaultFields: ["duration"],
      }),
    ).toBe("30 days");
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

  test("maps administrator recovery codes without exposing a server-default message", () => {
    expect(
      localizeManagedMobileError({
        code: "ADMIN_COMPLIANCE_ACK_REQUIRED",
        message: "administrator compliance acknowledgement is required",
        status: 423,
      }),
    ).toMatch(/compliance|合规/i);
    expect(
      localizeManagedMobileError({
        code: "STEP_UP_REQUIRED",
        message: "step-up verification required",
        status: 403,
      }),
    ).toMatch(/step-up|二次验证/i);
  });
});
