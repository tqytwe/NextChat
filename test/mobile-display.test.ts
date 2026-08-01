import { describe, expect, test } from "@jest/globals";

import { localizedMobileDisplay } from "../app/client/mobile-display";

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
});
