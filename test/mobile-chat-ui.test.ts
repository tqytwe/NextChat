import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "@jest/globals";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("mobile chat UI state and layout contract", () => {
  const app = source("app/components/mobile-app.tsx");
  const styles = source("app/components/mobile-app.module.scss");

  test("keeps message actions separate from the streaming indicator", () => {
    expect(app).toContain("<ThreeDotsIcon />");
    expect(app).toContain('className={styles["message-generating"]}');
    expect(app).toContain('message.status === "streaming"');
    expect(app).toContain("MessageActionSheet");
    expect(app).toContain(
      "onRetry={() => retryMessage(messageActionTarget.message)}",
    );
  });

  test("deduplicates session errors when the message already owns the same error", () => {
    expect(app).toContain("const messageError =");
    expect(app).toMatch(
      /const showChatErrorBar = Boolean\(\s*sessionError && sessionError !== messageError,?\s*\)/,
    );
    expect(app).toContain('role="alert"');
  });

  test("protects the chat frame from header overlap and gives actions a touch target", () => {
    expect(styles).toContain(".chat-screen {");
    expect(styles).toContain("min-height: 0;");
    expect(styles).toContain("flex: 0 0 auto;");
    expect(styles).toContain("scroll-padding-block: 12px;");
    expect(styles).toContain("flex: 0 0 44px;");
    expect(styles).toContain("--mobile-control-height: 48px;");
  });

  test("renders message links through the native external-link bridge", () => {
    expect(app).toContain("https?:\\/\\/[^\\s<]+");
    expect(app).toContain("void openExternalUrl(url)");
  });

  test("revalidates a selected model after the chat group session changes", () => {
    expect(app).toContain("let submissionModel = model;");
    expect(app).toContain("The selected model is no longer available in this group.");
    expect(app).toContain('errorCode: "MODEL_UNAVAILABLE"');
    expect(app).toContain("model: submissionModel");
  });

  test("keeps server skill selection scoped to the signed-in account", () => {
    expect(app).toContain("serverSkillSelectionStorageKey(accountId");
    expect(app).toContain("readStoredJSON(skillSelectionStorageKey, {})");
    expect(app).toContain("[MOBILE_SKILL id=${selectedSkill.id}");
    expect(app).not.toContain("当前启用技能：");
  });
});
