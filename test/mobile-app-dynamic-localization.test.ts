import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  MANAGED_MOBILE_TEXT,
  type ManagedMobileText,
} from "../app/client/managed-mobile-i18n";

const mobileApp = readFileSync(
  resolve(process.cwd(), "app/components/mobile-app.tsx"),
  "utf8",
);

describe("mobile dynamic labels", () => {
  test("does not expose backend task operation identifiers as user-facing names", () => {
    expect(mobileApp).toContain("function mobileTaskOperationLabel");
    expect(mobileApp).toContain('"chat.completions"');
    expect(mobileApp).toContain('en: "AI conversation"');
    expect(mobileApp).toContain("{mobileTaskOperationLabel(task, text)}");
    expect(mobileApp).not.toContain('defaultFields: ["operation"]');
  });

  test("localizes known system group names and exposes task management from home", () => {
    expect(mobileApp).toContain('en: "Domestic models"');
    expect(mobileApp).toContain("startDashboardTaskLongPress");
    expect(mobileApp).toContain("openTaskManager(task.id)");
    expect(mobileApp).toContain("text.platform.taskManage");
  });

  test("localizes the chat skill selector in Japanese and Korean", () => {
    const jp = MANAGED_MOBILE_TEXT.jp as unknown as ManagedMobileText;
    const ko = MANAGED_MOBILE_TEXT.ko as unknown as ManagedMobileText;
    expect(jp.platform.skills).toBe("スキルセンター");
    expect(jp.platform.noSkill).toBe("スキルなし");
    expect(ko.platform.skills).toBe("스킬 센터");
    expect(ko.platform.noSkill).toBe("스킬 없음");
  });
});
