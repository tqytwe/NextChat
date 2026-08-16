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
  claimUnassignedAppImages,
  listUnassignedAppImages,
  loadLoginCredentials,
  showNativeToast,
  speakNativeText,
  startForegroundPttSession,
  startForegroundWakeWordSession,
  startDirectNativeStreamRequest,
  stopNativeSpeech,
  getNativeFcmToken,
  configureNativeCrashlyticsUser,
  recordNativeCrashlyticsException,
  startNativePerformanceTrace,
  stopNativePerformanceTrace,
  getNativePushInbox,
  markNativePushInboxRead,
  clearNativePushInbox,
} = await import("../app/client/android-native");

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

test("native shell grants WebRTC microphone capture only to the local app origin", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  expect(source).toContain("void onPermissionRequest(PermissionRequest request)");
  expect(source).toContain("isTrustedLocalMediaRequest(request)");
  expect(source).toContain("PermissionRequest.RESOURCE_AUDIO_CAPTURE");
  expect(source).toContain('"localhost".equalsIgnoreCase(origin.getHost())');
  expect(source).toContain("request.getResources()");
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

test("native bridge exposes Firebase Cloud Messaging token acquisition", async () => {
  window.history.replaceState({}, "", "/?nativeBridgeToken=launch-secret-123");
  let method = "";
  window.JisudengNativeBridge = {
    request(raw) {
      const payload = JSON.parse(raw) as { id: string; method: string };
      method = payload.method;
      window.__jisudengNativeResolve?.(payload.id, { token: "fcm-token-1" });
    },
  };

  await expect(getNativeFcmToken()).resolves.toEqual({ token: "fcm-token-1" });
  expect(method).toBe("getFcmToken");

  const source = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  expect(source).toContain('case "getFcmToken"');
  expect(source).toContain("FirebaseMessaging.getInstance().getToken()");
  expect(source).toContain("FCM_TOKEN_TIMEOUT_MS");
  expect(source).toContain("FCM token request timed out");
});

test("native shell owns FCM receipt notifications and push-open routing", () => {
  const manifest = readFileSync(
    resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml"),
    "utf8",
  );
  const activity = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  const service = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/JisudengFirebaseMessagingService.java",
    ),
    "utf8",
  );
  const pushClient = readFileSync(
    resolve(process.cwd(), "app/client/mobile-push.ts"),
    "utf8",
  );

  expect(manifest).toContain(".JisudengFirebaseMessagingService");
  expect(manifest).toContain("com.google.firebase.MESSAGING_EVENT");
  expect(manifest).toContain("com.jisudeng.chat.PUSH_OPEN");
  expect(manifest).toContain(
    "com.google.firebase.messaging.default_notification_channel_id",
  );
  expect(manifest).toContain(
    'android:name="com.capacitorjs.plugins.pushnotifications.MessagingService"',
  );
  expect(manifest).toContain('tools:node="remove"');

  expect(service).toContain("extends FirebaseMessagingService");
  expect(service).toContain("void onMessageReceived(RemoteMessage message)");
  expect(service).toContain("MainActivity.createPushOpenIntent");
  expect(service).toContain("PendingIntent.getActivity");
  expect(service).toContain("MainActivity.PUSH_CHANNEL_ID");
  expect(service).toContain("POST_NOTIFICATIONS");
  expect(service).toContain("FCM token refreshed length=");
  expect(service).toContain("FCM_TOKEN_REFRESH_ACTION");
  expect(service).toContain("sendBroadcast(refreshIntent)");
  expect(service).toContain("R.string.push_open_details");
  expect(service).not.toContain("Log.i(LOG_TAG, token)");

  expect(pushClient).toContain('"jisudeng-native-resume"');
  expect(pushClient).toContain('"online"');
  expect(pushClient).toContain('"jisudeng:mobile-locale-change"');
  expect(pushClient).toContain('"jisudeng:fcm-token-refresh"');
  expect(pushClient).toContain("getManagedMobileLocale()");
  expect(pushClient).toContain("PUSH_REFRESH_THROTTLE_MS");

  expect(activity).toContain("PUSH_EXTRA_EVENT_TYPE");
  expect(activity).toContain("PUSH_EXTRA_TICKET_ID");
  expect(activity).toContain("PUSH_EXTRA_KIND");
  expect(activity).toContain("PUSH_EXTRA_STATUS");
  expect(activity).toContain("pushDetailFromIntent");
  expect(activity).toContain("dispatchPushOpen(intent)");
  expect(activity).toContain("dispatchPushOpen(getIntent())");
  expect(activity).toContain("clearPushIntent()");
  expect(activity).toContain("Intent.ACTION_MAIN");
  expect(activity).toContain("lastPushIntentSignature");
  expect(activity).toContain("'jisudeng:push-open'");
});

test("native bridge forwards JS failures and opaque user ids to Crashlytics", async () => {
  window.history.replaceState({}, "", "/?nativeBridgeToken=launch-secret-123");
  const calls: Array<{ method: string; options: Record<string, unknown> }> = [];
  window.JisudengNativeBridge = {
    request(raw) {
      const payload = JSON.parse(raw) as {
        id: string;
        method: string;
        options: Record<string, unknown>;
      };
      calls.push({ method: payload.method, options: payload.options });
      window.__jisudengNativeResolve?.(payload.id, {});
    },
  };

  await configureNativeCrashlyticsUser(42);
  await recordNativeCrashlyticsException({
    category: "unhandledrejection",
    message: "render failed",
    stack: "stack line",
  });

  expect(calls).toEqual([
    { method: "configureCrashlyticsUser", options: { userId: "42" } },
    {
      method: "recordCrashlyticsException",
      options: {
        category: "unhandledrejection",
        message: "render failed",
        stack: "stack line",
      },
    },
  ]);

  const activity = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  expect(activity).toContain("FirebaseCrashlytics.getInstance()");
  expect(activity).toContain('case "configureCrashlyticsUser"');
  expect(activity).toContain('case "recordCrashlyticsException"');
  expect(activity).toContain('"distribution_channel"');
});

test("native bridge records bounded Firebase performance traces", async () => {
  window.history.replaceState({}, "", "/?nativeBridgeToken=launch-secret-123");
  const calls: Array<{ method: string; options: Record<string, unknown> }> = [];
  window.JisudengNativeBridge = {
    request(raw) {
      const payload = JSON.parse(raw) as {
        id: string;
        method: string;
        options: Record<string, unknown>;
      };
      calls.push({ method: payload.method, options: payload.options });
      window.__jisudengNativeResolve?.(
        payload.id,
        payload.method === "startPerformanceTrace"
          ? { traceId: "trace-1" }
          : {},
      );
    },
  };

  await expect(
    startNativePerformanceTrace("chat_completion", {
      transport: "native",
      retry: false,
      attachments: true,
      ignored: "fourth-attribute",
    }),
  ).resolves.toBe("trace-1");
  await stopNativePerformanceTrace("trace-1", "success");

  expect(calls).toEqual([
    {
      method: "startPerformanceTrace",
      options: {
        name: "chat_completion",
        attributes: {
          transport: "native",
          retry: "false",
          attachments: "true",
        },
      },
    },
    {
      method: "stopPerformanceTrace",
      options: { traceId: "trace-1", outcome: "success" },
    },
  ]);

  const activity = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  expect(activity).toContain("FirebasePerformance.getInstance()");
  expect(activity).toContain('newTrace("app_cold_start")');
  expect(activity).toContain('newTrace("webview_first_load")');
  expect(activity).toContain('case "startPerformanceTrace"');
  expect(activity).toContain('case "stopPerformanceTrace"');
});

test("native bridge exposes the durable FCM notification inbox", async () => {
  window.history.replaceState({}, "", "/?nativeBridgeToken=launch-secret-123");
  const methods: string[] = [];
  window.JisudengNativeBridge = {
    request(raw) {
      const payload = JSON.parse(raw) as { id: string; method: string };
      methods.push(payload.method);
      window.__jisudengNativeResolve?.(payload.id, {
        items:
          payload.method === "clearPushInbox"
            ? []
            : [
                {
                  id: "message-1",
                  title: "Ready",
                  receivedAt: 1,
                  read: payload.method === "markPushInboxRead",
                },
              ],
      });
    },
  };

  await expect(getNativePushInbox()).resolves.toHaveLength(1);
  await expect(markNativePushInboxRead(["message-1"])).resolves.toEqual([
    expect.objectContaining({ id: "message-1", read: true }),
  ]);
  await expect(clearNativePushInbox()).resolves.toEqual([]);
  expect(methods).toEqual([
    "getPushInbox",
    "markPushInboxRead",
    "clearPushInbox",
  ]);

  const service = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/JisudengFirebaseMessagingService.java",
    ),
    "utf8",
  );
  expect(service).toContain("persistPushNotification(message, data)");
  expect(service).toContain("markPushInboxRead");
  expect(service).toContain("next.length() < 100");
});

test("native image storage requires an owner and exposes only explicit legacy claims", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  const plugin = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/NextChatNativePlugin.java",
    ),
    "utf8",
  );
  for (const implementation of [source, plugin]) {
    expect(implementation).toContain("image owner is required");
    expect(implementation).toContain(
      'String requestedOwner = ownerUserId == null ? "" : ownerUserId.trim();',
    );
    expect(implementation).toContain(
      'metadata.put("ownerUserId", requestedOwner)',
    );
    expect(implementation).toContain("requestedOwner.equals(owner)");
    expect(implementation).toContain(
      'requestedOwner.equals(imageMetadata.optString("ownerUserId", ""))',
    );
    expect(implementation).not.toContain(
      'metadata.put("ownerUserId", ownerUserId)',
    );
    expect(implementation).not.toContain(
      "if (owner.isEmpty() && ownerUserId != null && !ownerUserId.isEmpty())",
    );
  }
  expect(source).toContain('case "listUnassignedAppImages"');
  expect(source).toContain('case "claimUnassignedAppImages"');
  expect(source).toContain("claimUnassignedAppImages(");
  expect(source).toContain("new AtomicFile(metadataFile(imageFile))");
  expect(source).toContain("metadataFile.finishWrite(out)");
  expect(source).toContain(
    'if (!metadata.optString("ownerUserId", "").trim().isEmpty())',
  );
  expect(plugin).not.toContain('case "claimUnassignedAppImages"');
});

test("legacy image migration sends selected files to the direct bridge only", async () => {
  window.history.replaceState({}, "", "/?nativeBridgeToken=launch-secret-123");
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
      if (request.method === "listUnassignedAppImages") {
        window.__jisudengNativeResolve?.(request.id, {
          items: [
            {
              fileName: "legacy-image.png",
              localUrl:
                "https://localhost/__jisudeng_app_images/legacy-image.png",
            },
          ],
        });
        return;
      }
      if (request.method === "claimUnassignedAppImages") {
        window.__jisudengNativeResolve?.(request.id, {
          claimed: 1,
          skipped: 0,
          items: [],
        });
      }
    },
  };

  await expect(listUnassignedAppImages("101")).resolves.toHaveLength(1);
  await expect(
    claimUnassignedAppImages(["legacy-image.png"], "101"),
  ).resolves.toMatchObject({ claimed: 1, skipped: 0 });

  expect(requests).toEqual([
    expect.objectContaining({
      method: "listUnassignedAppImages",
      bridgeToken: "launch-secret-123",
      options: { ownerUserId: "101" },
    }),
    expect.objectContaining({
      method: "claimUnassignedAppImages",
      bridgeToken: "launch-secret-123",
      options: {
        ownerUserId: "101",
        fileNames: ["legacy-image.png"],
      },
    }),
  ]);
});

test("foreground PTT streams transcript events by session and cancels on route change", async () => {
  window.history.replaceState({}, "", "/?nativeBridgeToken=launch-secret-123");
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
  window.history.replaceState({}, "", "/?nativeBridgeToken=launch-secret-123");
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
  window.__jisudengNativeForegroundPttEvent?.("ptt-session-final", "final", {
    text: "final transcript",
    matches: ["final transcript"],
  });

  const errorEvents: Array<{
    type: string;
    errorCode?: string;
    recoverable?: boolean;
  }> = [];
  await startForegroundPttSession({
    sessionId: "ptt-session-error",
    onEvent: (event) => errorEvents.push(event),
  });
  window.__jisudengNativeForegroundPttEvent?.("ptt-session-error", "error", {
    errorCode: "network_timeout",
    errorMessage: "speech recognition network_timeout",
    recoverable: true,
  });

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

test("foreground wake word stays in the native bridge and releases after a match", async () => {
  window.history.replaceState({}, "", "/?nativeBridgeToken=launch-secret-123");
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
      if (request.method === "startWakeWord") {
        window.__jisudengNativeResolve?.(request.id, {
          sessionId: request.options?.sessionId,
          state: "listening",
        });
        return;
      }
      if (request.method === "speakText") {
        const utteranceId = String(request.options?.utteranceId || "");
        // This intentionally precedes the request response. The bridge must
        // already know the caller's utterance ID before native TTS can finish.
        window.__jisudengNativeSpeechEvent?.(utteranceId, "done");
        window.__jisudengNativeResolve?.(request.id, {
          utteranceId,
        });
        return;
      }
      if (request.method === "stopSpeaking") {
        window.__jisudengNativeResolve?.(request.id, {});
      }
    },
  };

  const events: Array<{ type: string; transcript?: string }> = [];
  await startForegroundWakeWordSession({
    sessionId: "wake-session-1",
    phrase: "极速蹬",
    language: "zh-CN",
    onEvent: (event) => events.push(event),
  });
  window.__jisudengNativeWakeWordEvent?.("wake-session-1", "partial", {
    transcript: "极速蹬",
  });
  window.__jisudengNativeWakeWordEvent?.("wake-session-1", "matched", {
    transcript: "极速蹬 帮我总结这段话",
  });

  const speechEvents: Array<{ type: string; utteranceId: string }> = [];
  await speakNativeText({
    text: "好的，我来帮你总结。",
    language: "zh-CN",
    onEvent: (event) => speechEvents.push(event),
  });
  await stopNativeSpeech();
  window.dispatchEvent(new PopStateEvent("popstate"));
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(events).toEqual([
    { sessionId: "wake-session-1", type: "partial", transcript: "极速蹬" },
    {
      sessionId: "wake-session-1",
      type: "matched",
      transcript: "极速蹬 帮我总结这段话",
    },
  ]);
  expect(requests.map((request) => request.method)).toEqual([
    "requestMicrophonePermission",
    "startWakeWord",
    "speakText",
    "stopSpeaking",
  ]);
  expect(requests[1].options).toMatchObject({
    sessionId: "wake-session-1",
    phrase: "极速蹬",
    language: "zh-CN",
  });
  expect(speechEvents).toEqual([
    {
      utteranceId: expect.stringMatching(/^tts-/),
      type: "done",
      message: undefined,
    },
  ]);
  expect(requests[2].options?.utteranceId).toMatch(/^tts-/);
});

test("native wake word and speech APIs are foreground lifecycle bounded", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    ),
    "utf8",
  );
  expect(source).toContain('case "startWakeWord"');
  expect(source).toContain('case "stopWakeWord"');
  expect(source).toContain('case "speakText"');
  expect(source).toContain('case "stopSpeaking"');
  expect(source).toContain("TextToSpeech");
  expect(source).toContain("UtteranceProgressListener");
  expect(source).toContain("__jisudengNativeSpeechEvent");
  expect(source).toContain('cancelActiveSpeechSessions("app_backgrounded")');
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
  expect(source).toContain(
    'payload.put("localUrl", LOCAL_ORIGIN + APP_IMAGE_ROUTE',
  );
});
