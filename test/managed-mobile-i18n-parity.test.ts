import { describe, expect, test } from "@jest/globals";

import {
  getManagedMobileLocale,
  MANAGED_MOBILE_TEXT,
  MANAGED_MOBILE_LOCALE_STORAGE_KEY,
  setManagedMobileLocale,
} from "../app/client/managed-mobile-i18n";
import type { ManagedMobileLocale } from "../app/client/managed-mobile-i18n";

// 托管移动端文案 cn/en/jp/ko 结构一致性（parity）自动校验。
//
// 背景：MANAGED_MOBILE_TEXT 各语言长期靠人工对齐。新增文案若只补一侧，
// 编译不会报错、运行时才会漏翻/取到 undefined。本测试把「结构对齐」
// 变成 CI 门禁：任何一侧新增/删除/改动键的类型（函数↔字符串↔对象），
// 都会立刻转红。
//
// 校验对象是「键路径 + 叶子类型」而非文案内容——内容本就应不同（中/英），
// 但结构必须逐键同构：
//   - cn 有而 jp/ko/en 无（或反之）        → 漏翻/多余键
//   - 同一路径 cn 是函数、jp 是字符串       → 形状不匹配（带参占位符只补一侧）
//   - 同一路径一侧是对象、另一侧是叶子 → 分组结构分叉

type LeafType = "function" | "string" | "number" | "boolean" | "other";

function classify(value: unknown): LeafType {
  const t = typeof value;
  if (t === "function") return "function";
  if (t === "string") return "string";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  return "other";
}

// 递归收集 path -> 叶子类型。对象继续下钻；数组与其它值按叶子处理。
function collectShape(
  node: unknown,
  prefix: string,
  out: Map<string, LeafType>,
): void {
  if (
    node !== null &&
    typeof node === "object" &&
    !Array.isArray(node) &&
    typeof node !== "function"
  ) {
    for (const key of Object.keys(node as Record<string, unknown>)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      collectShape((node as Record<string, unknown>)[key], nextPrefix, out);
    }
    return;
  }
  out.set(prefix, classify(node));
}

function collectStrings(
  node: unknown,
  prefix: string,
  out: Map<string, string>,
): void {
  if (
    node !== null &&
    typeof node === "object" &&
    !Array.isArray(node) &&
    typeof node !== "function"
  ) {
    for (const key of Object.keys(node as Record<string, unknown>)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      collectStrings((node as Record<string, unknown>)[key], nextPrefix, out);
    }
    return;
  }
  if (typeof node === "string") out.set(prefix, node);
}

function isAllowedEnglishSharedValue(path: string, value: string): boolean {
  const context = `${path} ${value}`;
  if (/^account\.language(?:Chinese|English|Japanese|Korean)$/.test(path)) {
    return true;
  }
  if (
    /(^dateLocale$|GitHub|Google|USDT|API|URL|ID|QR|ChatGPT|Jisudeng|NextChat|Play|OAuth|FCM|WebView|Apple|Android|USD|\$)/i.test(
      context,
    )
  ) {
    return true;
  }
  return /^[0-9\s$%.,:/+\-()A-Za-z_]+$/.test(value) && value.length <= 12;
}

const locales = Object.keys(MANAGED_MOBILE_TEXT) as ManagedMobileLocale[];

function mockNavigatorLanguages(languages: string[]) {
  const navigatorValue =
    typeof navigator === "undefined"
      ? {}
      : (navigator as unknown as Record<string, unknown>);
  if (typeof navigator === "undefined") {
    Object.defineProperty(globalThis, "navigator", {
      value: navigatorValue,
      configurable: true,
    });
  }
  Object.defineProperty(navigatorValue, "languages", {
    value: languages,
    configurable: true,
  });
  Object.defineProperty(navigatorValue, "language", {
    value: languages[0] || "",
    configurable: true,
  });
}

describe("managed mobile i18n locale parity", () => {
  const shapes = new Map<ManagedMobileLocale, Map<string, LeafType>>();
  for (const locale of locales) {
    const shape = new Map<string, LeafType>();
    collectShape(MANAGED_MOBILE_TEXT[locale], "", shape);
    shapes.set(locale, shape);
  }
  const baseShape = shapes.get("cn")!;

  test("every locale exposes the exact same set of key paths", () => {
    const cnKeys = new Set(baseShape.keys());
    const missingByLocale: Record<string, string[]> = {};
    const extraByLocale: Record<string, string[]> = {};

    for (const locale of locales) {
      const shape = shapes.get(locale)!;
      const keys = new Set(shape.keys());
      missingByLocale[locale] = [...cnKeys].filter((k) => !keys.has(k)).sort();
      extraByLocale[locale] = [...keys].filter((k) => !cnKeys.has(k)).sort();
    }

    expect({ missingByLocale, extraByLocale }).toEqual({
      missingByLocale: Object.fromEntries(locales.map((locale) => [locale, []])),
      extraByLocale: Object.fromEntries(locales.map((locale) => [locale, []])),
    });
  });

  test("every shared key path has the same leaf type in every locale", () => {
    const typeMismatches: Array<{
      path: string;
      locale: ManagedMobileLocale;
      cn: LeafType;
      actual: LeafType;
    }> = [];

    for (const locale of locales) {
      const shape = shapes.get(locale)!;
      for (const [path, cnType] of baseShape) {
        const actual = shape.get(path);
        if (actual !== undefined && actual !== cnType) {
          typeMismatches.push({ path, locale, cn: cnType, actual });
        }
      }
    }

    expect(typeMismatches).toEqual([]);
  });

  test("parity map is non-trivial (guards against an empty/short-circuited walk)", () => {
    // 防呆：若递归实现被改坏导致只收集到极少数键，parity 也会"假绿"。
    // 键量下限取一个远低于当前(约 1000+)、又足以证明真的走了全树的保守值。
    expect(baseShape.size).toBeGreaterThan(200);
    for (const locale of locales) {
      expect(shapes.get(locale)?.size).toBe(baseShape.size);
    }
  });

  test("jp and ko ship native date locales", () => {
    expect(MANAGED_MOBILE_TEXT.jp.dateLocale).toBe("ja-JP");
    expect(MANAGED_MOBILE_TEXT.ko.dateLocale).toBe("ko-KR");
  });

  test("jp and ko do not silently fall back to English for user-facing strings", () => {
    const english = new Map<string, string>();
    collectStrings(MANAGED_MOBILE_TEXT.en, "", english);

    for (const locale of ["jp", "ko"] as const) {
      const localized = new Map<string, string>();
      collectStrings(MANAGED_MOBILE_TEXT[locale], "", localized);
      const suspiciousFallbacks = [...english.entries()]
        .filter(([path, value]) => localized.get(path) === value)
        .filter(([path, value]) => !isAllowedEnglishSharedValue(path, value))
        .map(([path, value]) => `${locale}:${path}=${value}`);

      expect(suspiciousFallbacks).toEqual([]);
    }
  });

  test("system locale detection recognizes Japanese and Korean", () => {
    localStorage.removeItem(MANAGED_MOBILE_LOCALE_STORAGE_KEY);
    mockNavigatorLanguages(["ja-JP", "en-US"]);
    expect(getManagedMobileLocale()).toBe("jp");

    mockNavigatorLanguages(["ko-KR", "en-US"]);
    expect(getManagedMobileLocale()).toBe("ko");

    mockNavigatorLanguages(["en-US"]);
    expect(getManagedMobileLocale()).toBe("en");

    mockNavigatorLanguages(["zh-CN"]);
    expect(getManagedMobileLocale()).toBe("cn");
  });

  test("an explicit app locale overrides the system locale and can be cleared", () => {
    mockNavigatorLanguages(["en-US"]);
    setManagedMobileLocale("ko");
    expect(getManagedMobileLocale()).toBe("ko");

    setManagedMobileLocale(null);
    expect(getManagedMobileLocale()).toBe("en");
  });
});
