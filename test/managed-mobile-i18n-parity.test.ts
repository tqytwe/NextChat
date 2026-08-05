import { describe, expect, test } from "@jest/globals";

import { MANAGED_MOBILE_TEXT } from "../app/client/managed-mobile-i18n";

// 托管移动端文案 cn/en 结构一致性（parity）自动校验。
//
// 背景：MANAGED_MOBILE_TEXT.cn 与 .en 各上千键，长期靠人工对齐。新增文案
// （如 Task #8 农场 6 键）若只补一侧，编译不会报错、运行时才会漏翻/取到
// undefined。本测试把「结构对齐」变成 CI 门禁：任何一侧新增/删除/改动键的
// 类型（函数↔字符串↔对象），都会立刻转红。
//
// 校验对象是「键路径 + 叶子类型」而非文案内容——内容本就应不同（中/英），
// 但结构必须逐键同构：
//   - cn 有而 en 无（或反之）        → 漏翻/多余键
//   - 同一路径 cn 是函数、en 是字符串 → 形状不匹配（带参占位符只补一侧）
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

describe("managed mobile i18n cn/en parity", () => {
  const cnShape = new Map<string, LeafType>();
  const enShape = new Map<string, LeafType>();
  collectShape(MANAGED_MOBILE_TEXT.cn, "", cnShape);
  collectShape(MANAGED_MOBILE_TEXT.en, "", enShape);

  test("cn and en expose the exact same set of key paths", () => {
    const cnKeys = new Set(cnShape.keys());
    const enKeys = new Set(enShape.keys());

    const missingInEn = [...cnKeys].filter((k) => !enKeys.has(k)).sort();
    const missingInCn = [...enKeys].filter((k) => !cnKeys.has(k)).sort();

    expect({ missingInEn, missingInCn }).toEqual({
      missingInEn: [],
      missingInCn: [],
    });
  });

  test("every shared key path has the same leaf type in cn and en", () => {
    const typeMismatches: Array<{
      path: string;
      cn: LeafType;
      en: LeafType;
    }> = [];

    for (const [path, cnType] of cnShape) {
      const enType = enShape.get(path);
      if (enType !== undefined && enType !== cnType) {
        typeMismatches.push({ path, cn: cnType, en: enType });
      }
    }

    expect(typeMismatches).toEqual([]);
  });

  test("parity map is non-trivial (guards against an empty/short-circuited walk)", () => {
    // 防呆：若递归实现被改坏导致只收集到极少数键，parity 也会"假绿"。
    // 键量下限取一个远低于当前(约 1000+)、又足以证明真的走了全树的保守值。
    expect(cnShape.size).toBeGreaterThan(200);
    expect(enShape.size).toBe(cnShape.size);
  });
});
