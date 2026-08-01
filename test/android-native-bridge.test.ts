import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

jest.unstable_mockModule("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: jest.fn(() => "web"),
  },
  registerPlugin: jest.fn(() => ({})),
}));

const { loadLoginCredentials, startDirectNativeStreamRequest } = await import(
  "../app/client/android-native"
);

describe("direct Android bridge authentication", () => {
  afterEach(() => {
    delete window.JisudengNativeBridge;
    delete window.__jisudengNativeBridgeToken;
    window.history.replaceState({}, "", "/");
  });

  test("includes the per-launch bridge token in every native request", async () => {
    window.history.replaceState(
      {},
      "",
      "/?nativeBridgeToken=launch-secret-123",
    );
    let payload: Record<string, unknown> = {};
    window.JisudengNativeBridge = {
      request(raw) {
        payload = JSON.parse(raw) as Record<string, unknown>;
        window.__jisudengNativeResolve?.(String(payload.id), { saved: false });
      },
    };

    await expect(loadLoginCredentials()).resolves.toEqual({ saved: false });
    expect(payload).toMatchObject({
      method: "loadLoginCredentials",
      bridgeToken: "launch-secret-123",
    });
  });

  test("reassembles chunked native response lines without inserting data", async () => {
    window.history.replaceState(
      {},
      "",
      "/?nativeBridgeToken=launch-secret-123",
    );
    window.JisudengNativeBridge = {
      request(raw) {
        const payload = JSON.parse(raw) as { id: string };
        window.__jisudengNativeResolve?.(payload.id, { id: payload.id });
        window.__jisudengNativeStream?.(payload.id, "status", { status: 200 });
        window.__jisudengNativeStream?.(payload.id, "data", {
          line: '{"data":"abc',
          continued: true,
        });
        window.__jisudengNativeStream?.(payload.id, "data", {
          line: 'def"}',
          continued: false,
        });
        window.__jisudengNativeStream?.(payload.id, "done", {});
      },
    };
    const lines: string[] = [];
    const request = await startDirectNativeStreamRequest(
      { url: "https://example.test/v1/images/edits" },
      { onLine: (line) => lines.push(line) },
    );

    await request.done;

    expect(lines).toEqual(['{"data":"abcdef"}']);
  });
});

test("native bridge supports sharing multiple selected images in one chooser", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  expect(source).toContain('case "shareImages"');
  expect(source).toContain("Intent.ACTION_SEND_MULTIPLE");
  expect(source).toContain(
    "putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)",
  );
});
