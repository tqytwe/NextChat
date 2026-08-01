import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "@jest/globals";

import { localizeManagedMobileError } from "../app/client/managed-mobile-i18n";

describe("mobile app backend alignment", () => {
  const source = readFileSync(
    resolve(process.cwd(), "app/components/mobile-app.tsx"),
    "utf8",
  );

  test("routes Android payment creation and sync through mobile payments", () => {
    expect(source).toContain("client.payments.create");
    expect(source).toContain("client.payments.sync");
    expect(source).toContain("client.payments.detail");
    expect(source).toContain("payment_type: method");
    expect(source).toContain('payment_source: "android_app"');
    expect(source).not.toContain(
      'managedAuthenticatedJsonRequest<PaymentOrderCreateResult>(\n          "/api/v1/payment/orders"',
    );
  });

  test("routes reference image generation through the managed gateway transport", () => {
    expect(source).toContain("const endpoint = taskReferences.length");
    expect(source).toContain("body: request.body");
    expect(source).toContain("managedGatewayRequestText(");
    expect(source).not.toContain("request.body instanceof FormData");
    expect(source).not.toContain(
      'transport: "web",\n                      status',
    );
    expect(source).toContain('"Idempotency-Key": `android-image-${id}-');
    expect(source).toContain('file.type.startsWith("image/")');
    expect(source).toContain("dataUrl = await blobToDataUrl(file)");
    expect(source).toContain("getNativeE2EFixtureFlags()");
    expect(source).toContain("!useLocalImageFixture &&");
  });

  test("keeps selected reference images local and requires an explicit edit-capable model choice", () => {
    const imageStudio = source.slice(
      source.indexOf("function AndroidImageStudio()"),
      source.indexOf("function AndroidGallery()"),
    );
    const attachReferences = imageStudio.slice(
      imageStudio.indexOf("async function attachReferences("),
      imageStudio.indexOf("function switchImageGroup("),
    );
    expect(attachReferences).not.toContain("uploadMaterial(");
    expect(imageStudio).not.toContain("referenceMaterials");
    expect(imageStudio).not.toContain("asset_ids:");
    expect(imageStudio).toContain("firstReferenceImageModel(");
    expect(imageStudio).toContain("referenceModelUnsupported(selectedModel)");
    expect(attachReferences).not.toContain("setSelectedModel(modelValue");
    expect(imageStudio).toContain("allowLegacyImageCapabilityFallback");
  });

  test("allows a ready shared file to start chat and passes its asset ID to the task", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    expect(chat).toContain("readyMaterials");
    expect(chat).toContain("readyAssetIds.length === 0");
    expect(chat).toContain("title_zh: userContent.slice(0, 80)");
    expect(chat).toContain("asset_ids: readyAssetIds");
  });

  test("keeps chat images and plain-text files on-device when cloud materials fail", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    const attachImages = chat.slice(
      chat.indexOf("async function attachImages("),
      chat.indexOf("async function capturePhoto()"),
    );
    expect(attachImages).toContain("localOnly: isImage || isPlainText");
    expect(attachImages).toContain("unsupported: !isImage && !isPlainText");
    expect(chat).toContain("if (input.localOnly || input.unsupported) return;");
    expect(chat).toContain("localTextMaterials");
    expect(chat).toContain("[${item.name}]");
    expect(chat).toContain('state: canSendLocally ? "local" : "failed"');
  });

  test("uses planned single-image outputs and a bounded local content-kit queue", () => {
    const kit = source.slice(
      source.indexOf("function AndroidContentKit()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    expect(kit).toContain('id: "quick"');
    expect(kit).toContain('id: "ecommerce"');
    expect(kit).toContain('id: "campaign"');
    expect(kit).toContain("presetId: selectedPreset.id");
    expect(kit).toContain("activeRunId: runId");
    expect(kit).toContain("CONTENT_KIT_GLOBAL_CONCURRENCY");
    expect(kit).toContain("recommendedParallelism");
    expect(kit).toContain("activeContentKitOutputs");
    expect(kit).toContain("content-kit-output-${asset.id}");
    expect(kit).toContain('requestId: clientRequestID("content-kit-output")');
    expect(kit).toContain("n: 1");
    expect(kit).toContain("content-kit-output-grid");
  });

  test("recovers content-kit outputs safely and uses server limits for batch planning", () => {
    const kit = source.slice(
      source.indexOf("function AndroidContentKit()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    expect(kit).toContain('asset.status === "running"');
    expect(kit).toContain('status: "queued", updatedAt: Date.now()');
    expect(source).toContain("max_reference_images");
    expect(kit).toContain("max_queued_outputs");
    expect(kit).toContain('"/api/v1/nextchat/image-studio/estimate-batch"');
    expect(kit).toContain("CONTENT_KIT_MAX_OUTPUTS_PER_PROJECT");
    expect(kit).toContain("createNextRun(selectedProject)");
    expect(kit).toContain("content-kit-preview-modal");
    expect(kit).toContain("toggleAssetTag");
    expect(kit).toContain("deleteAppImages(localFileNames)");
    expect(kit).toContain("shareImages(");
    expect(kit).toContain("client_request_id=${encodeURIComponent(");
    expect(kit).toContain("item.request_id === `client:${requestId}`");
    expect(kit).toContain('"X-Client-Request-ID": localTaskId');
    expect(kit).toContain(
      "hydrateAssetBilling(project.id, asset.id, localTaskId)",
    );
    expect(source).toContain("jisudeng-network-restored");
    expect(source).toContain("window.setInterval(refresh, 15_000)");
  });

  test("uses the server capability contract and coupon IDs", () => {
    expect(source).toContain('capabilities.operations?.includes("edit")');
    expect(source).toContain('"/api/v1/payment/coupons/quote"');
    expect(source).toContain("coupon_id: selectedCouponID || undefined");
  });

  test("retries status-zero gateway failures and preserves diagnostic errors", () => {
    const gateway = source.slice(
      source.indexOf("async function managedGatewayRequestText("),
      source.indexOf("async function managedGatewayRequestTextOnce("),
    );
    expect(gateway).toContain("!result.ok && result.status === 0");
    expect(gateway).toContain("throw new ManagedTransportError(");
    expect(gateway).toContain("formatManagedMobileError({");
    expect(source).toContain("err instanceof ManagedTransportError");
  });

  test("classifies upstream HTTP failures before network-like response text", () => {
    expect(
      localizeManagedMobileError({
        message: "upstream network request failed",
        status: 502,
      }),
    ).toMatch(/busy|繁忙/i);
    expect(
      localizeManagedMobileError({
        message: "upstream network unavailable",
        status: 503,
      }),
    ).toMatch(/unavailable|暂时不可用/i);
    expect(
      localizeManagedMobileError({
        message: "network request unauthorized",
        status: 401,
      }),
    ).toMatch(/expired|过期/i);
    expect(source).toContain(
      "function conciseImageGatewayReason(message: string)",
    );
    expect(source).toContain(
      "payload.instance ? `request ${payload.instance}`",
    );
  });

  test("keeps default group selection local until the first message", () => {
    const dashboard = source.slice(
      source.indexOf("function AndroidDashboard()"),
      source.indexOf("function ChatSessionDrawer("),
    );
    expect(dashboard).toContain("setGroupSheetOpen(true)");
    expect(dashboard).toContain("persistChatPreference(groupId, nextModel)");
    expect(dashboard).not.toContain("openGroupSheet: true");

    const switchGroup = source.slice(
      source.indexOf("async function switchGroup(groupID: number)"),
      source.indexOf("async function switchToChatGroup()"),
    );
    expect(switchGroup).toContain("if (currentSession?.id)");
    expect(switchGroup).toContain("await managed.switchGroup(groupID)");
  });

  test("uses the document scroller for long pages while keeping chat independent", () => {
    expect(source).not.toContain("scrollCapture");
    expect(source).toContain("documentScroll?: boolean;");
    expect(source).toContain(
      'const usesDocumentScroll = props.documentScroll ?? props.active !== "chat";',
    );
    const dashboard = source.slice(
      source.indexOf("function AndroidDashboard()"),
      source.indexOf("function ChatSessionDrawer("),
    );
    expect(dashboard).toContain(
      '<AndroidAppShell active="chat" text={text} documentScroll>',
    );
    const stylesheet = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.module.scss"),
      "utf8",
    );
    expect(stylesheet).not.toContain(".scroll-capture");
    expect(stylesheet).toContain(".app-scroll {");
    expect(stylesheet).toContain("overflow-y: auto;");
    const globalStyles = readFileSync(
      resolve(process.cwd(), "app/styles/globals.scss"),
      "utf8",
    );
    expect(globalStyles).toContain("html.mobile-document-scroll");
    expect(globalStyles).toContain("body.mobile-document-scroll");
  });

  test("supplements account-summary subscriptions when a server omits usage progress", () => {
    const refreshAccountData = source.slice(
      source.indexOf("async function refreshAccountData()"),
      source.indexOf("async function loadCheckoutInfo()"),
    );
    expect(refreshAccountData).toContain(
      "needsSubscriptionProgressRefresh(summarySubscriptions)",
    );
    expect(refreshAccountData).toContain('"/api/v1/subscriptions/progress"');
    expect(refreshAccountData).toContain("mergeSubscriptionProgress(");
  });

  test("does not erase the saved default group before workspace models load", () => {
    const dashboard = source.slice(
      source.indexOf("function AndroidDashboard()"),
      source.indexOf("function ChatSessionDrawer("),
    );
    expect(dashboard).toContain(
      ">(() => storedChatPreferenceGroupID() || undefined)",
    );
    expect(dashboard).not.toContain(">(() => storedChatGroupID(workspace))");

    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    expect(chat).toContain(
      "if (!effectiveChatGroupId) return;\n    persistChatPreference(",
    );
  });

  test("migrates a legacy default group to only the first signed-in account", () => {
    const storage = source.slice(
      source.indexOf("function readStoredJSON"),
      source.indexOf("function writeStoredJSON"),
    );
    expect(storage).toContain("localStorage.setItem(scopedKey, raw)");
    expect(storage).toContain("localStorage.removeItem(key)");
  });

  test("uses the saved draft group when opening chat without a session", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    expect(chat).toContain(
      "const currentSessionChatGroupId = currentSession\n    ? preferredChatGroupID(workspace, currentSession.groupId)\n    : undefined;",
    );
    expect(chat).not.toContain(
      "preferredChatGroupID(\n    workspace,\n    currentSession?.groupId,\n  )",
    );
  });

  test("does not intercept system text selection on chat messages", () => {
    const messages = source.slice(
      source.indexOf(
        "{currentSession?.messages.map((message, messageIndex) => (",
      ),
      source.indexOf("{(chatError ||"),
    );
    expect(messages).not.toContain("onContextMenu");
    expect(messages).not.toContain("onTouchStart");
    expect(messages).not.toContain("onTouchEnd");
    expect(messages).not.toContain("onDoubleClick");
    expect(messages).toContain('className={styles["message-actions-trigger"]}');
    expect(messages).toContain("aria-label={`chat-message-${message.role}-");
  });

  test("reuses a failed chat request ID for manual and network recovery", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    expect(chat).toContain("requestId: gatewayRequestId");
    expect(chat).toContain('"jisudeng-network-restored"');
    expect(chat).toContain('failedAssistant.requestId || ""');
    expect(chat).toContain("retryRequestId || clientRequestID");
    expect(chat).toContain("const retryAssistant = retryRequestId");
    expect(chat).toContain("retryAssistant?.id ||");
    expect(chat).toContain("mobileStore.clearChatError(sessionId)");
  });

  test("stores remembered passwords only through the Android native vault", () => {
    const nativeSource = readFileSync(
      resolve(process.cwd(), "app/client/android-native.ts"),
      "utf8",
    );
    const androidSource = readFileSync(
      resolve(
        process.cwd(),
        "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
      ),
      "utf8",
    );
    expect(source).toContain("saveLoginCredentials(email.trim(), password)");
    expect(source).toContain("clearLoginCredentials()");
    expect(nativeSource).toContain('"saveLoginCredentials"');
    expect(androidSource).toContain('KeyStore.getInstance("AndroidKeyStore")');
    expect(androidSource).toContain('Cipher.getInstance("AES/GCM/NoPadding")');
    expect(source).not.toContain("localStorage.setItem(password");
  });
});
