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
    expect(source).toContain("const imageOperation = taskReferences.length");
    expect(source).toContain('"images.edits"');
    expect(source).toMatch(
      /const endpoint\s*=\s*\n?\s*imageOperation === "images\.edits"/,
    );
    expect(source).toContain(
      "const taskBackendBaseUrl = managed.backendBaseUrl;",
    );
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
    expect(source).toContain("contentWorkbenchPresets()");
    expect(kit).toContain("contentKitAssetSpecs(");
    expect(kit).toContain("scene: selectedPreset.id");
    expect(kit).toContain("presetId: selectedPreset.id");
    expect(kit).toContain("activeRunId: runId");
    expect(kit).toContain("CONTENT_KIT_GLOBAL_CONCURRENCY");
    expect(kit).toContain("recommendedParallelism");
    expect(kit).toContain("activeContentKitOutputs");
    expect(kit).toContain("content-kit-output-${asset.id}");
    expect(source).toContain(
      'requestId: clientRequestID("content-kit-output")',
    );
    expect(kit).toContain("n: 1");
    expect(kit).toContain("content-kit-output-grid");
    expect(kit).not.toContain("source?.prompt");
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

  test("keeps scenario plans editable and retries the exact failed project run", () => {
    const kit = source.slice(
      source.indexOf("function AndroidContentKit()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    expect(kit).toContain("presetShotEdits");
    expect(kit).toContain("function updateSelectedPlan(");
    expect(kit).toContain("contentWorkbenchCanIncreaseShotCount(");
    expect(kit).toContain("contentWorkbenchClonePlan(selectedPlanShots)");
    expect(kit).toContain("function retryRunAssets(");
    expect(kit).toContain("activeRunId: runId");
    expect(kit).toContain("content-kit-retry-${asset.id}");
    expect(kit).toContain("retryFailedAssets(selectedProject, displayedRunId)");
    expect(kit).toContain("retryRunAssets(selectedProject, asset.runId");
    expect(kit).toContain("collectionId: project.id");
    expect(kit).not.toContain("open={groupIndex === 0}");
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

  test("derives administrator access from the server session capability", () => {
    const managedStore = readFileSync(
      resolve(process.cwd(), "app/store/managed.ts"),
      "utf8",
    );

    expect(source).toContain("isMobileAdminAvailable(managed.mobileProtocol)");
    expect(source).not.toContain("function isManagedAdminWorkspace");
    expect(managedStore).toContain("getMobileSessionStatus");
    expect(managedStore).toContain("void get().refreshMobileSessionStatus()");
    expect(managedStore).toContain("set({ mobileProtocol: null })");
    expect(managedStore).toContain("mobileProtocol: _mobileProtocol");

    const accountAdminRoute = source.slice(
      source.indexOf("if (route === Path.AccountAdmin)"),
      source.indexOf("if (route === Path.AccountRedeem)"),
    );
    expect(accountAdminRoute).toContain("{isAdmin ? (");
    expect(accountAdminRoute).toContain("<MobileAdminWorkspace");
    expect(accountAdminRoute).toContain("text.account.adminUnavailable");
  });

  test("checks and acknowledges admin compliance before rendering protected data", () => {
    const adminWorkspace = readFileSync(
      resolve(process.cwd(), "app/components/mobile-admin-workspace.tsx"),
      "utf8",
    );
    const adminClient = readFileSync(
      resolve(process.cwd(), "app/client/mobile-admin.ts"),
      "utf8",
    );

    expect(adminWorkspace).toContain("getMobileAdminComplianceStatus");
    expect(adminWorkspace).toContain("acceptMobileAdminCompliance");
    expect(adminWorkspace).toContain("isMobileAdminComplianceAvailable");
    expect(adminWorkspace).toContain("if (!complianceSupported)");
    expect(adminWorkspace).toContain("ADMIN_COMPLIANCE_ACK_REQUIRED");
    expect(adminWorkspace).toContain("setAppliedSearch");
    expect(adminClient).toContain("MOBILE_ADMIN_COMPLIANCE_PATHS");
    expect(adminClient).toContain('"Idempotency-Key"');
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

  test("keeps logout available while the account bootstrap is still loading", () => {
    const account = source.slice(
      source.indexOf("function AndroidAccountSettings()"),
      source.indexOf("function useMobileCrashLog()"),
    );
    const logoutButton = account.slice(
      account.indexOf('aria-label="account-logout"'),
      account.indexOf("{showLogoutConfirm &&"),
    );
    expect(logoutButton).not.toContain("disabled={managed.loading}");
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
    expect(chat).toContain("if (!effectiveChatGroupId) return;");
    expect(chat).toContain("const selectedModelIsAvailable =");
    expect(chat).toContain("if (!selectedModelIsAvailable) return;");
    expect(chat).toContain("const requestModelAvailable = Boolean(");
    expect(chat).toContain("if (!model || !requestModelAvailable)");
    expect(chat).toContain("resolveChatPreference(");
    expect(source).toContain("workspaceLoaded: Boolean(workspace)");
  });

  test("migrates a legacy default group to only the first signed-in account", () => {
    const accountScope = source.slice(
      source.indexOf("function accountStorageKey"),
      source.indexOf("function readStoredJSON"),
    );
    const storage = source.slice(
      source.indexOf("function readStoredJSON"),
      source.indexOf("function writeStoredJSON"),
    );
    expect(accountScope).toContain(
      "state.user?.id || state.session?.user_id || state.workspace?.user?.id",
    );
    expect(accountScope).toContain("`${key}:user:${userId}`");
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

  test("inherits the user's selected model when a new chat is created", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    const newSession = chat.slice(
      chat.indexOf("function newSession()"),
      chat.indexOf("function renameSession("),
    );
    expect(newSession).toContain(
      "const storedPreference = readChatPreference()",
    );
    expect(newSession).toContain("storedPreference.groupId ||");
    expect(newSession).toContain(
      "rememberedMobileChatModel(storedPreference, requestedGroupId)",
    );
    expect(newSession).toContain(
      "preferredModel || draftModel || currentSession?.model || selectedModel",
    );
    expect(newSession).toContain(
      "const nextPreference = resolveChatPreference(workspace, requestedGroupId",
    );
    expect(newSession).not.toContain(
      "modelValue(chatModelsForGroup(workspace, nextGroupId)[0])",
    );
  });

  test("uses the same draft resolver for every home chat entry", () => {
    const dashboard = source.slice(
      source.indexOf("function AndroidDashboard()"),
      source.indexOf("function ChatSessionDrawer("),
    );
    const prepareDraftChat = dashboard.slice(
      dashboard.indexOf("function prepareDraftChat()"),
      dashboard.indexOf("function openSession("),
    );

    expect(prepareDraftChat).toContain(
      "resolveChatPreference(workspace, dashboardChatGroupId)",
    );
    expect(prepareDraftChat).toContain('mobileStore.setCurrentChatId("")');
    expect(prepareDraftChat).toContain("function openChat()");
    expect(prepareDraftChat).toContain("function openSkillCenter()");
    expect(prepareDraftChat).toContain("function openCollaborationChat()");
    expect(prepareDraftChat.match(/prepareDraftChat\(\)/g)?.length).toBe(4);
  });

  test("does not let browsing an older session replace the new-chat preference", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    const activeSessionPreference = chat.slice(
      chat.indexOf("if (!effectiveChatGroupId) return;"),
      chat.indexOf(
        "if (!currentSession) return;",
        chat.indexOf("if (!effectiveChatGroupId) return;"),
      ),
    );

    expect(activeSessionPreference).toContain("if (currentSession?.id)");
    expect(activeSessionPreference).toContain(
      "Browsing an older conversation must not replace the user's last choice.",
    );
  });

  test("prefers the remembered model for a selected group and server current group recovery", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio()"),
    );
    const switchGroup = chat.slice(
      chat.indexOf("async function switchGroup(groupID: number)"),
      chat.indexOf("async function switchToChatGroup()"),
    );

    expect(source).toContain(
      "group.is_current && (group.models || []).some(isChatModel)",
    );
    expect(switchGroup).toContain(
      "const rememberedModel = storedChatPreferenceModel(groupID)",
    );
    expect(switchGroup).toContain("rememberedModel,");
  });

  test("uses a double native back press only for root tabs", () => {
    expect(source).toContain(
      "function handleNativeHomeBack(text: ManagedMobileText)",
    );
    expect(source).toContain("now - lastNativeHomeBackAt <= 2000");
    expect(source).toContain("void finishNativeApp()");
    expect(source).toContain("void showNativeToast(text.common.exitAppHint)");
    const dashboard = source.slice(
      source.indexOf("function AndroidDashboard()"),
      source.indexOf("function ChatSessionDrawer("),
    );
    expect(dashboard).toContain("handleNativeHomeBack(text)");
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
