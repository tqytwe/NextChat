import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

jest.unstable_mockModule("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: jest.fn(() => "web"),
  },
  registerPlugin: jest.fn(() => ({})),
}));

const {
  finishNativeApp,
  loadLoginCredentials,
  showNativeToast,
  startForegroundPttSession,
  startDirectNativeStreamRequest,
} = await import(
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

  test("delegates the home back hint and confirmed exit to the native bridge", async () => {
    window.history.replaceState(
      {},
      "",
      "/?nativeBridgeToken=launch-secret-123",
    );
    const methods: string[] = [];
    window.JisudengNativeBridge = {
      request(raw) {
        const payload = JSON.parse(raw) as { id: string; method: string };
        methods.push(payload.method);
        window.__jisudengNativeResolve?.(payload.id, {});
      },
    };

    await showNativeToast("再按一次退出应用");
    await finishNativeApp();

    expect(methods).toEqual(["showToast", "finishApp"]);
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

test("native bridge implements a system toast and finish action for double back", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  expect(source).toContain('case "showToast"');
  expect(source).toContain("Toast.makeText(");
  expect(source).toContain('case "finishApp"');
  expect(source).toContain("finishAndRemoveTask()");
});

test("foreground PTT streams transcript events by session and cancels on route change", async () => {
  window.history.replaceState(
    {},
    "",
    "/?nativeBridgeToken=launch-secret-123",
  );
  const requests: Array<{
    id: string;
    method: string;
    options?: Record<string, unknown>;
  }> = [];
  window.JisudengNativeBridge = {
    request(raw) {
      const request = JSON.parse(raw) as {
        id: string;
        method: string;
        options?: Record<string, unknown>;
      };
      requests.push(request);
      if (request.method === "requestMicrophonePermission") {
        window.__jisudengNativeResolve?.(request.id, { granted: true });
        return;
      }
      if (request.method === "startForegroundPtt") {
        window.__jisudengNativeResolve?.(request.id, {
          sessionId: request.options?.sessionId,
          state: "listening",
        });
        return;
      }
      if (request.method === "cancelForegroundPtt") {
        const sessionId = String(request.options?.sessionId || "");
        window.__jisudengNativeForegroundPttEvent?.(sessionId, "cancelled", {
          reason: String(request.options?.reason || "cancelled"),
        });
        window.__jisudengNativeResolve?.(request.id, { active: false });
      }
    },
  };

  const events: Array<{ type: string; text?: string; reason?: string }> = [];
  await startForegroundPttSession({
    sessionId: "ptt-session-1",
    onEvent: (event) => events.push(event),
  });

  window.__jisudengNativeForegroundPttEvent?.("ptt-session-1", "partial", {
    text: "draft transcript",
    matches: ["draft transcript"],
  });
  window.dispatchEvent(new PopStateEvent("popstate"));
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(events).toHaveLength(2);
  expect(events[0]).toMatchObject({
    sessionId: "ptt-session-1",
    type: "partial",
    text: "draft transcript",
    matches: ["draft transcript"],
  });
  expect(events[1]).toMatchObject({
    sessionId: "ptt-session-1",
    type: "cancelled",
    reason: "route_changed",
  });
  expect(requests.map((request) => request.method)).toEqual([
    "requestMicrophonePermission",
    "startForegroundPtt",
    "cancelForegroundPtt",
  ]);
  expect(requests[2].options).toEqual({
    sessionId: "ptt-session-1",
    reason: "route_changed",
  });
});

test("foreground PTT forwards final and error callbacks without a message action", async () => {
  window.history.replaceState(
    {},
    "",
    "/?nativeBridgeToken=launch-secret-123",
  );
  const methods: string[] = [];
  window.JisudengNativeBridge = {
    request(raw) {
      const request = JSON.parse(raw) as {
        id: string;
        method: string;
        options?: Record<string, unknown>;
      };
      methods.push(request.method);
      if (request.method === "requestMicrophonePermission") {
        window.__jisudengNativeResolve?.(request.id, { granted: true });
        return;
      }
      if (request.method === "startForegroundPtt") {
        window.__jisudengNativeResolve?.(request.id, {
          sessionId: request.options?.sessionId,
          state: "listening",
        });
      }
    },
  };

  const finalEvents: Array<{ type: string; text?: string }> = [];
  await startForegroundPttSession({
    sessionId: "ptt-session-final",
    onEvent: (event) => finalEvents.push(event),
  });
  window.__jisudengNativeForegroundPttEvent?.(
    "ptt-session-final",
    "final",
    { text: "final transcript", matches: ["final transcript"] },
  );

  const errorEvents: Array<{
    type: string;
    errorCode?: string;
    recoverable?: boolean;
  }> = [];
  await startForegroundPttSession({
    sessionId: "ptt-session-error",
    onEvent: (event) => errorEvents.push(event),
  });
  window.__jisudengNativeForegroundPttEvent?.(
    "ptt-session-error",
    "error",
    {
      errorCode: "network_timeout",
      errorMessage: "speech recognition network_timeout",
      recoverable: true,
    },
  );

  expect(finalEvents[0]).toMatchObject({
    sessionId: "ptt-session-final",
    type: "final",
    text: "final transcript",
  });
  expect(errorEvents[0]).toMatchObject({
    sessionId: "ptt-session-error",
    type: "error",
    errorCode: "network_timeout",
    recoverable: true,
  });
  expect(methods).toEqual([
    "requestMicrophonePermission",
    "startForegroundPtt",
    "requestMicrophonePermission",
    "startForegroundPtt",
  ]);
});

test("foreground PTT native bridge exposes partial, final, error, and lifecycle cleanup", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  expect(source).toContain('case "startForegroundPtt"');
  expect(source).toContain('case "stopForegroundPtt"');
  expect(source).toContain('case "cancelForegroundPtt"');
  expect(source).toContain('"partial",');
  expect(source).toContain('"final",');
  expect(source).toContain('"error",');
  expect(source).toContain('cancelActiveSpeechSessions("app_backgrounded")');
  expect(source).toContain('cancelActiveSpeechSessions("route_changed")');
});

test("native app storage retains local project grouping metadata", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  ["projectId", "runId", "shotId", "kind", "label", "collectionId"].forEach(
    (field) => {
      expect(source).toContain(`options.optString(\"${field}\", \"\")`);
      expect(source).toContain(`metadata.put(\"${field}\"`);
    },
  );
  expect(source).toContain('payload.put("localUrl", LOCAL_ORIGIN + APP_IMAGE_ROUTE');
});
