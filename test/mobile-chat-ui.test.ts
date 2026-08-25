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
    expect(app).toContain(
      "const showChatErrorBar = Boolean(sessionError && sessionError !== messageError)",
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
});
