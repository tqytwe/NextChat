import { describe, expect, test } from "@jest/globals";

import {
  inferLocalChatAttachmentMimeType,
  isLocalChatImage,
  isLocalChatText,
  localChatAttachmentKind,
  normalizeLocalChatAttachmentBlob,
} from "../app/client/mobile-chat-attachments";

describe("local chat attachments", () => {
  test("uses a safe filename fallback when Android omits an image MIME type", () => {
    const image = new File(["image-bytes"], "camera.jpg", {
      type: "",
    });
    expect(isLocalChatImage(image)).toBe(true);
    expect(localChatAttachmentKind(image)).toBe("image");
    expect(inferLocalChatAttachmentMimeType(image)).toBe("image/jpeg");
    expect(normalizeLocalChatAttachmentBlob(image).type).toBe("image/jpeg");
  });

  test("keeps plain and source text files local even with generic MIME types", () => {
    const source = new File(["export const answer = 42;"], "answer.ts", {
      type: "application/octet-stream",
    });
    expect(isLocalChatText(source)).toBe(true);
    expect(localChatAttachmentKind(source)).toBe("text");
  });

  test("does not pretend binary office, PDF, audio, or video files are readable chat input", () => {
    ["brief.pdf", "plan.docx", "meeting.m4a", "demo.mp4"].forEach((name) => {
      const file = new File(["binary"], name, {
        type: "application/octet-stream",
      });
      expect(localChatAttachmentKind(file)).toBe("unsupported");
    });
  });
});
