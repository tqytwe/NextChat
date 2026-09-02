import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "@jest/globals";

import { localizeManagedMobileError } from "../app/client/managed-mobile-i18n";

describe("mobile app backend alignment", () => {
  const source = readFileSync(
    resolve(process.cwd(), "app/components/mobile-app.tsx"),
    "utf8",
  );
  const constants = readFileSync(
    resolve(process.cwd(), "app/constant.ts"),
    "utf8",
  );
  const styles = readFileSync(
    resolve(process.cwd(), "app/components/mobile-app.module.scss"),
    "utf8",
  );
  const mobilePlatform = readFileSync(
    resolve(process.cwd(), "app/client/mobile-platform.ts"),
    "utf8",
  );

  test("selects localized Android release notes before legacy notes", () => {
    expect(source).toContain("notesByLocale?: Partial");
    expect(source).toContain('cn: "zh-CN"');
    expect(source).toContain("manifest?.notesByLocale?.[localeKey]");
    expect(source).toContain("manifestNotes(updateState.manifest, text)");
  });

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

  test("keeps coarse-pointer controls at an accessible touch size", () => {
    expect(styles).toContain("@media (pointer: coarse)");
    expect(styles).toMatch(
      /\.mobile-app button\s*\{\s*min-width: 44px;\s*min-height: 44px;/,
    );
    expect(styles).toContain(
      'input:not([type="checkbox"]):not([type="radio"])',
    );
  });

  test("keeps all five primary destinations in one stable bottom-nav row", () => {
    const bottomTabs = styles.slice(
      styles.lastIndexOf(".bottom-tabs {"),
      styles.indexOf(".attachment-row,"),
    );
    expect(bottomTabs).toContain(
      "grid-template-columns: repeat(5, minmax(0, 1fr));",
    );
    expect(bottomTabs).toContain(
      "grid-template-rows: 22px minmax(24px, auto);",
    );
    expect(bottomTabs).toContain("-webkit-line-clamp: 2;");
    expect(bottomTabs).not.toContain("grid-template-columns: repeat(4, 1fr);");
    expect(source).toContain("props.text.navigation.home");
    expect(source).toContain("props.text.navigation.chat");
    expect(source).toContain("props.text.navigation.create");
    expect(source).toContain("mobileAssetNavigationLabel()");
    expect(source).toContain("props.text.navigation.account");
  });

  test("supports native Google and GitHub OAuth callback login without web cookies", () => {
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

    expect(source).toContain('type MobileOAuthProvider = "google" | "github"');
    expect(source).toContain("/api/v1/auth/oauth/${provider}/start");
    expect(source).toContain("readOAuthAuthResponseFromUrl");
    expect(source).toContain("managed.applyAuth(auth)");
    expect(source).toContain("text.login.continueWithGoogle");
    expect(source).toContain("text.login.continueWithGitHub");
    expect(source).toContain("NATIVE_PENDING_OAUTH_KEY");
    expect(manifest).toContain("/auth/oauth/callback");
    expect(manifest).toContain("/auth/callback");
    expect(activity).toContain("jisudeng-native-pending-oauth");
    expect(activity).toContain("jisudeng-oauth-callback");
  });

  test("keeps password recovery as a focused secondary login flow", () => {
    const login = source.slice(
      source.indexOf("function AndroidLogin()"),
      source.indexOf("function AndroidDashboard()"),
    );
    expect(login).toContain("const primaryTabs");
    expect(login).toContain('value: "login"');
    expect(login).toContain('value: "register"');
    expect(login).not.toContain('value: "forgot"');
    expect(login).not.toContain('value: "reset"');
    expect(login).toContain("const showingPrimaryAuth");
    expect(login).toContain("showingPrimaryAuth && backendBaseUrl");
    expect(login).toContain('setMode("forgot")');
    expect(login).toContain('setMode("login")');
  });

  test("routes reference image generation through the managed gateway transport", () => {
    const imageStudio = source.slice(
      source.indexOf("function AndroidImageStudio("),
      source.indexOf("function AndroidGallery()"),
    );
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
    expect(source).toContain("isLocalChatImage(file)");
    expect(source).toContain("dataUrl = await blobToDataUrl(localFile)");
    expect(source).toContain("getNativeE2EFixtureFlags()");
    expect(source).toContain("!useLocalImageFixture &&");
    expect(imageStudio).toContain(
      "currentImageGroupID(activeManaged.workspace)",
    );
    expect(imageStudio).toContain("selectManagedImageSessionForGroup(");
    expect(imageStudio).not.toContain(
      "currentGroupID(activeManaged.workspace) !== taskGroupId",
    );
  });

  test("accepts native WebView input events for image and video prompts", () => {
    const imageStudio = source.slice(
      source.indexOf("function AndroidImageStudio("),
      source.indexOf("function AndroidGallery()"),
    );
    const videoStudio = source.slice(
      source.indexOf("function AndroidVideoStudio()"),
      source.indexOf("function AndroidImageStudio("),
    );
    expect(imageStudio).toContain('aria-label="image-prompt"');
    expect(imageStudio).toContain("const promptRef = useRef<HTMLTextAreaElement | null>(null)");
    expect(imageStudio).toContain("defaultValue={prompt}");
    expect(imageStudio).toContain("overrides?.prompt ??\n        persistedParams.prompt ??\n        promptRef.current?.value ??\n        prompt");
    expect(imageStudio).toContain("function setImagePrompt(next: string)");
    expect(imageStudio).toContain("promptRef.current.value = next");
    expect(videoStudio).toContain('aria-label="video-prompt"');
    expect(videoStudio).toContain(
      "onInput={(event) => setPrompt(event.currentTarget.value)}",
    );
  });

  test("renders the Canvas image-prompt directory in bounded pages", () => {
    const imageLibrary = source.slice(
      source.indexOf("function ImagePromptLibrarySheet"),
      source.indexOf("function ChatAgentLibrarySheet"),
    );
    expect(imageLibrary).toContain("const [visibleCount, setVisibleCount] = useState(24)");
    expect(imageLibrary).toContain("const visibleItems = items.slice(0, visibleCount)");
    expect(imageLibrary).toContain("missing.slice(0, 24).map");
    expect(imageLibrary).toContain("visibleItems.map((item)");
    expect(imageLibrary).not.toContain("catalog.items.map(async (item)");
    expect(styles).toContain(".prompt-library-pagination");
  });

  test("pins ContentKit image work to its saved image-purpose group", () => {
    const contentKit = source.slice(
      source.indexOf("function AndroidContentKit("),
      source.indexOf("function AndroidImageStudio("),
    );
    const generateAsset = contentKit.slice(
      contentKit.indexOf("async function generateAsset("),
      contentKit.indexOf("async function generateCopy("),
    );

    expect(contentKit).toContain("imageGroupId: projectImageGroupId");
    expect(generateAsset).toContain("project.imageGroupId");
    expect(generateAsset).toContain("imageModelsForExactGroup(");
    expect(generateAsset).toContain(
      "await managed.switchImageGroup(projectImageGroupId)",
    );
    expect(generateAsset).toContain("selectManagedImageSessionForGroup(");
    expect(generateAsset).toContain("group_id: projectImageGroupId");
    expect(generateAsset).toContain("imageSession.api_key");
    expect(generateAsset).toContain("imageModelUnavailable(project.model)");
    expect(generateAsset).not.toContain("group_id: imageGroup?.id");
    expect(generateAsset).not.toContain("managed.imageSession.api_key");
    expect(generateAsset).not.toContain("managed.session?.api_key");
  });

  test("keeps selected reference images local without hiding normal image models", () => {
    const imageStudio = source.slice(
      source.indexOf("function AndroidImageStudio("),
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
    expect(imageStudio).toContain("selectedReferenceLimit");
    expect(imageStudio).not.toContain("validateManagedImageRequest({");
    expect(imageStudio).toContain("const imageOutputLimit = 16;");
  });

  test("allows a ready shared file to start chat and passes its asset ID to the task", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio("),
    );
    expect(chat).toContain("readyMaterials");
    expect(chat).toContain("readyAssetIds.length === 0");
    expect(chat).toContain("title_zh: userContent.slice(0, 80)");
    expect(chat).toContain("asset_ids: readyAssetIds");
  });

  test("delegates web-search decisions to a capable model without keyword preflight", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio("),
    );
    expect(chat).toContain("modelSupportsWebSearch");
    expect(chat).toContain("runMobileWebSearchToolLoop");
    expect(chat).toContain("MOBILE_WEB_SEARCH_TOOL");
    expect(chat).toContain("searchMobileWeb(");
    expect(chat).not.toContain("webSearchEnabled");
    expect(chat).not.toContain("fetchWebSearchContext");
    expect(chat).not.toContain("aria-pressed={webSearchEnabled}");
    expect(chat).not.toContain("isExplicitMobileWebSearchRequest");
    expect(chat).not.toContain("webSearchUnsupportedModel");
  });

  test("keeps chat images and plain-text files on-device when cloud materials fail", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio("),
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

  test("correlates and keys feedback multipart retries without duplicating a submission", () => {
    const feedback = source.slice(
      source.indexOf("async function managedFormDataRequest"),
      source.indexOf("async function managedGatewayRequestText"),
    );
    expect(feedback).toContain('clientRequestID("multipart")');
    expect(feedback).toContain('"X-Client-Request-ID": requestId');
    expect(feedback).toContain('"Idempotency-Key": idempotencyKey');

    const feedbackForm = source.slice(
      source.indexOf("async function submitFeedbackForm("),
      source.indexOf("async function submitFeedback()"),
    );
    expect(feedbackForm).toContain("clientRequestID(requestPrefix)");
    expect(feedbackForm).toContain("feedbackRequestOptions");
    expect(feedbackForm).toContain('"/api/v1/mobile/support/tickets"');
    expect(feedbackForm).toContain('"/api/v1/play/mobile-feedback"');

    const account = source.slice(
      source.indexOf("async function submitFeedback()"),
      source.indexOf("async function redeemCode()"),
    );
    expect(account).toContain('submitFeedbackForm(form, "feedback")');
  });

  test("exposes an explicit AI content report path from chat and image results", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio("),
    );
    const imageStudio = source.slice(
      source.indexOf("function AndroidImageStudio("),
      source.indexOf("function AndroidGallery()"),
    );
    const account = source.slice(
      source.indexOf("function AndroidAccountSettings()"),
      source.indexOf("function AndroidGlobalUpdatePrompt()"),
    );

    expect(source).toContain('"ai_content_report"');
    expect(source).toContain("MOBILE_REPORT_DRAFT_STORAGE_KEY");
    expect(chat).toContain("reportChatMessage");
    expect(chat).toContain("buildChatReportDraft");
    expect(chat).toContain("onReport={() => reportChatMessage");
    expect(imageStudio).toContain("reportImageTask");
    expect(imageStudio).toContain("buildImageReportDraft");
    expect(imageStudio).toContain("onReport={() => reportImageTask");
    expect(account).toContain("readMobileReportDraft");
    expect(account).toContain('setFeedbackCategory("ai_content_report")');
    expect(account).toContain("setFeedbackTitle(draft.title)");
    expect(account).toContain("setFeedbackContent(draft.content)");
  });

  test("routes mobile push opens to the relevant Android surface", () => {
    const gate = source.slice(
      source.indexOf("function AndroidManagedGateContent"),
      source.indexOf("if (!managed._hasHydrated || !secureRestoreDone)"),
    );

    expect(gate).toContain('window.addEventListener("jisudeng:push-open"');
    expect(gate).toContain('sourceType === "mobile_feedback"');
    expect(gate).toContain("Path.AccountFeedbackDetail");
    expect(gate).toContain("encodeURIComponent(");
    expect(gate).toContain("sourceId,");
    expect(source).toContain("selectedSupportTicketID");
    expect(gate).toContain('sourceType === "mobile_task"');
    expect(gate).toContain('eventType.startsWith("task.")');
    expect(gate).toContain("navigate(Path.Sd)");
    expect(gate).toContain("navigate(Path.Chat)");
    expect(gate).toContain(
      'navigate(Path.Activity, { state: { view: "tasks" } })',
    );
    expect(gate).toContain('eventType.includes("payment")');
    expect(gate).toContain("navigate(Path.AccountOrders)");
    expect(gate).toContain(
      'navigate(Path.Activity, { state: { view: "notifications" } })',
    );
  });

  test("opens the cloud task dashboard filter from notification state", () => {
    const dashboard = source.slice(
      source.indexOf("function AndroidDashboard()"),
      source.indexOf("function ChatSessionDrawer("),
    );

    expect(dashboard).toContain("const location = useLocation()");
    expect(dashboard).toContain("dashboardFilter");
    expect(dashboard).toContain("setDashboardFilter(nextFilter)");
    expect(dashboard).toContain(
      "navigate(Path.Home, { replace: true, state: null })",
    );
  });

  test("keeps app sharing in invite growth with affiliate registration and download links", () => {
    const account = source.slice(
      source.indexOf("function AndroidAccountSettings()"),
      source.indexOf("function AndroidGlobalUpdatePrompt()"),
    );
    const inviteUrl = account.slice(
      account.indexOf("const inviteRegisterUrl = useMemo"),
      account.indexOf("const refreshInviteGrowth = useCallback"),
    );
    const share = account.slice(
      account.indexOf("async function shareInviteGrowth()"),
      account.indexOf("async function copyInviteGrowthLink()"),
    );
    const home = account.slice(
      account.indexOf("return ("),
      account.indexOf("showLogoutConfirm &&"),
    );

    expect(source).not.toContain("shareAppPoster");
    expect(inviteUrl).toContain('url.searchParams.set("aff_code"');
    expect(inviteUrl).toContain(
      'url.searchParams.set("source", "invite_poster_app_qr")',
    );
    expect(inviteUrl).toContain('url.searchParams.set("invite_token"');
    expect(share).toContain("surface: inviteSummary?.attribution_token");
    expect(share).toContain('aff_code: inviteSummary?.aff_code || ""');
    expect(share).toContain("registerUrl: inviteRegisterUrl");
    expect(share).toContain("appUrl: inviteAppUrl");
    expect(home).not.toContain("text.account.appShare");
  });

  test("uses a domestic in-app code shop and keeps the shop entry out of Play", () => {
    expect(constants).toContain(
      'AccountDirectCodeShop = "/account/direct-code-shop"',
    );
    expect(source).toContain("WEB_OPEN_MODE_STORAGE_KEY");
    expect(source).toContain("readWebOpenMode()");
    expect(source).toContain("writeWebOpenMode(mode)");
    expect(source).toContain('webOpenMode === "in_app"');
    expect(source).toContain("navigate(Path.AccountDirectCodeShop)");
    expect(source).toContain('className={styles["direct-code-shop-frame"]}');
    expect(source).toContain(
      'data-distribution-commerce="direct-external-code-shop"',
    );
    expect(source).toContain('data-distribution-commerce="play-billing"');
    expect(source).toContain('className={styles["primary-payment-action"]}');
  });

  test("exposes profile, password, and two-factor account security APIs", () => {
    expect(constants).toContain('AccountProfile = "/account/profile"');
    expect(source).toContain('"/api/v1/user/profile"');
    expect(source).toContain('"/api/v1/user"');
    expect(source).toContain('"/api/v1/user/password"');
    expect(source).toContain('"/api/v1/auth/mobile/forgot-password"');
    expect(source).toContain('"/api/v1/auth/mobile/reset-password"');
    expect(source).toContain('"/api/v1/user/totp/status"');
    expect(source).toContain('"/api/v1/user/totp/setup"');
    expect(source).toContain('"/api/v1/user/totp/enable"');
    expect(source).toContain('"/api/v1/user/totp/disable"');
    expect(source).toContain('"/api/v1/user/totp/send-code"');
  });

  test("submits account deletion requests through the mobile support channel", () => {
    expect(source).toContain('"account_deletion_request"');
    expect(source).toContain("accountDeletionReason");
    expect(source).toContain("sendAccountDeletionCode");
    expect(source).toContain("submitAccountDeletionRequest");
    expect(source).toContain('submitFeedbackForm(form, "account-deletion")');
    expect(source).toContain("accountDeletionTicketBody");
    expect(source).toContain(
      'accountDeletionConfirm.trim().toUpperCase() !== "DELETE"',
    );
  });

  test("routes Google Play purchases through native billing and backend verification", () => {
    expect(source).toContain("queryPlayBillingProducts");
    expect(source).toContain("launchPlayBillingPurchase");
    expect(source).toContain("submitPlayBillingPurchase");
    expect(source).toContain("client.playBilling.submitPurchase");
    expect(mobilePlatform).toContain('"/play-billing/purchases"');
    expect(source).toContain("consumePlayBillingPurchase");
    expect(source).toContain("acknowledgePlayBillingPurchase");
    expect(source).toContain("playBillingProductId(record)");
    expect(source).toContain("record.product_type");
    expect(source).toContain('productType: "inapp",');
    expect(source).not.toContain(
      'productType: fallbackOrderType === "subscription" ? "subs" : "inapp"',
    );
    expect(source).not.toContain(
      'orderType === "subscription" ? "subs" : fallback.productType',
    );
  });

  test("account hub no longer promotes misleading service or duplicate code-shop entries", () => {
    const accountHome = source.slice(
      source.indexOf('<AndroidAppShell active="account"'),
      source.indexOf("{accountData.error && !accountData.updatedAt"),
    );
    expect(accountHome).toContain("text.account.profile");
    expect(accountHome).toContain("Path.AccountProfile");
    expect(accountHome).toContain("text.account.systemSettings");
    expect(accountHome).toContain("Path.AccountSystemSettings");
    expect(accountHome).toContain("Path.AccountInvite");
    expect(accountHome).not.toContain("Path.AccountFeedback");
    expect(accountHome).not.toContain("Path.AccountPermissions");
    expect(accountHome).not.toContain("Path.AccountUpdate");
    expect(accountHome).not.toContain("Path.ContentKit");
    expect(accountHome).not.toContain("text.account.accountHubProjects");
    expect(accountHome).not.toContain("text.account.accountHubHelp");
    expect(accountHome).not.toContain("Path.AccountSupport");
    expect(accountHome).not.toContain("text.account.directCodeShopAction");
  });

  test("provides a system settings hub and managed task history actions", () => {
    expect(source).toContain("function AndroidSystemSettings");
    expect(source).toContain("Path.AccountAppearance");
    expect(source).toContain("Path.AccountLanguage");
    expect(source).toContain("Path.AccountWebOpenMode");
    expect(source).toContain("function AndroidAppearanceSettings");
    expect(source).toContain("function AndroidLanguageSettings");
    expect(source).toContain("function AndroidWebOpenModeSettings");
    expect(source).toContain("function deleteSelectedTasks");
    expect(source).toContain("client.tasks.bulkDelete");
    expect(source).toContain("client.tasks.bulkCancel");
    expect(source).toContain("function ConfirmSheet");
    expect(source).toContain('result.status === "not_terminal"');
    expect(source).toContain("error.status === 405");
    expect(source).toContain("taskDeleteConfirmOpen");
    expect(source).toContain('styles["app-toast"]');
    expect(source).not.toContain(
      "window.confirm(text.platform.taskDeleteConfirm",
    );
    expect(source).toContain("taskPageRef.current");
    expect(source).toContain("mergeMobileTaskPages");
    expect(source).toContain("taskManaging");
    expect(source).toContain("startTaskLongPress");
    expect(source).toContain("page_size: 50");
    expect(mobilePlatform).toContain("deleteMobileTask");
    expect(source).toContain("function AndroidProjects");
    expect(source).toContain("client.projects.delete");
    expect(mobilePlatform).toContain("createMobileProject");
    expect(constants).toContain(
      'AccountPermissions = "/account/system-settings/permissions"',
    );
    expect(constants).toContain(
      'AccountUpdate = "/account/system-settings/version"',
    );
    expect(constants).toContain(
      'AccountFeedback = "/account/system-settings/feedback"',
    );
    expect(constants).toContain(
      'AccountFeedbackNew = "/account/system-settings/feedback/new"',
    );
    expect(constants).toContain(
      'AccountFeedbackDetail = "/account/system-settings/feedback/detail"',
    );
    expect(source).toContain("route === Path.AccountFeedbackNew");
    expect(source).toContain("route === Path.AccountFeedbackDetail");
    expect(source).toContain('"/account/permissions": Path.AccountPermissions');
    expect(source).toContain("navigate(legacySystemRoute, { replace: true })");
  });

  test("keeps native detail pages compact without nested section cards", () => {
    const appearancePage = source.slice(
      source.indexOf("function AndroidAppearanceSettings"),
      source.indexOf("function AndroidLanguageSettings"),
    );
    const webModePage = source.slice(
      source.indexOf("function AndroidWebOpenModeSettings"),
      source.indexOf("function AndroidPaymentOrderCard"),
    );
    expect(source).toContain('styles["detail-header"]');
    expect(appearancePage).not.toContain('styles["section-head"]');
    expect(webModePage).not.toContain('styles["section-head"]');
    expect(styles).toMatch(
      /\.detail-header\s*\{[\s\S]*?min-height: 48px;[\s\S]*?margin-bottom: 8px;/,
    );
    expect(styles).toMatch(
      /\.detail-header\s*\{[\s\S]*?h1\s*\{[\s\S]*?font-size: 20px;/,
    );
    expect(styles).toMatch(
      /\.detail-header\s*\{[\s\S]*?\.icon-button\s*\{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/,
    );
    expect(styles).toMatch(
      /\.detail-scroll\s*\{[\s\S]*?> \.section\s*\{[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/,
    );
    expect(styles).toMatch(
      /\.language-settings\s*\{[\s\S]*?margin: 0;[\s\S]*?border-radius: 8px;/,
    );
  });

  test("localizes order titles and keeps monetary balances in dollars", () => {
    expect(source).toContain("function localizedOrderTitle");
    expect(source).toContain("orderRecharge");
    expect(source).toContain("localizedOrderTitle(order, text)");
    expect(source).toContain("localizedOrderTitle(detail, text)");
    expect(source).toContain("return `$${Number.isFinite(numberValue)");
    expect(source).not.toContain("return `¥${Number.isFinite(numberValue)");
  });

  test("keeps curated mobile templates complete for Japanese and Korean", () => {
    const curated = source.slice(
      source.indexOf("const IMAGE_PROMPT_TEMPLATES"),
      source.indexOf("const IMAGE_SIZE_OPTIONS"),
    );
    const partialVisibleBlocks: string[] = [];
    const visibleKeys = new Set([
      "title",
      "description",
      "personality",
      "starter",
      "prompt",
    ]);
    const lines = curated.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index].match(
        /^\s*(title|description|personality|starter|prompt):\s*\{/,
      );
      if (!match || !visibleKeys.has(match[1])) continue;

      const block = [lines[index]];
      let depth =
        (lines[index].match(/\{/g) || []).length -
        (lines[index].match(/\}/g) || []).length;
      while (depth > 0 && index + 1 < lines.length) {
        index += 1;
        block.push(lines[index]);
        depth +=
          (lines[index].match(/\{/g) || []).length -
          (lines[index].match(/\}/g) || []).length;
      }
      const text = block.join("\n");
      if (
        text.includes("cn:") &&
        text.includes("en:") &&
        (!text.includes("jp:") || !text.includes("ko:"))
      ) {
        partialVisibleBlocks.push(text.slice(0, 160));
      }
    }

    expect(partialVisibleBlocks).toEqual([]);
    expect(source).not.toContain("ImagePromptLanguageMode");
    expect(source).not.toContain('styles["prompt-language-row"]');
    expect(source).toContain("syncLocalPromptCatalog(");
    expect(source).toContain('appLocale === "jp"');
    expect(source).toContain('appLocale === "ko"');
    expect(source).toContain("mobilePromptSemanticCategory");
    expect(source).toContain("portrait-character");
    expect(source).toContain("text-infographic");
  });

  test("uses planned single-image outputs and a bounded local content-kit queue", () => {
    const kit = source.slice(
      source.indexOf("function AndroidContentKit("),
      source.indexOf("function AndroidImageStudio("),
    );
    expect(source).toContain("contentWorkbenchPresets()");
    expect(kit).toContain("contentKitAssetSpecs(");
    expect(kit).toContain("scene: selectedPreset.id");
    expect(kit).toContain("presetId: selectedPreset.id");
    expect(kit).toContain("activeRunId: runId");
    expect(kit).toContain("mobileCreationQueueCoordinator");
    expect(kit).toContain("function contentKitCreationQueueTasks(");
    expect(kit).toContain("function blockContentKitAccountQueue(");
    expect(kit).toContain("persistOnUnmount: Boolean(props.queueWorker)");
    expect(source).toContain("function AndroidCreationQueueWorker()");
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
      source.indexOf("function AndroidContentKit("),
      source.indexOf("function AndroidImageStudio("),
    );
    expect(kit).toContain('["submitting", "running"].includes(asset.status)');
    expect(kit).toContain('status: "reconciling",');
    expect(source).toContain("max_reference_images");
    expect(kit).toContain("max_queued_outputs");
    expect(kit).not.toContain('"/api/v1/nextchat/image-studio/estimate-batch"');
    expect(kit).toContain("CONTENT_KIT_MAX_OUTPUTS_PER_PROJECT");
    expect(kit).toContain("createNextRun(selectedProject)");
    expect(kit).toContain("content-kit-preview-modal");
    expect(kit).toContain("toggleAssetTag");
    expect(kit).toContain("deleteAppImages(localFileNames, activeAccountId)");
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
      source.indexOf("function AndroidContentKit("),
      source.indexOf("function AndroidImageStudio("),
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

  test("keeps capability validation for authored workflows but lets account workspaces submit", () => {
    expect(source).toContain("imageModelsForExactGroup");
    expect(source).not.toContain("validateManagedVideoRequest");
    expect(source).toContain('"/api/v1/payment/coupons/quote"');
    expect(source).toContain("coupon_id: selectedCouponID || undefined");
  });

  test("shows the app shell before a background workspace bootstrap completes", () => {
    const gate = source.slice(
      source.indexOf("function AndroidManagedGateContent"),
    );
    expect(gate).toContain("setSecureRestoreDone(true);");
    expect(gate).toContain("await managed.restoreSecureSession();");
    expect(gate).toContain("return <AndroidStartupShell />;");
    expect(gate).toContain("if (!secureRestoreDone) return;");
    expect(gate).toContain("setFirstPaintReady(true)");
    expect(gate).toContain("reportNativeStartupInteractive()");
    expect(gate).toContain("firstPaintReady &&\n      backendBaseUrl");
  });

  test("keeps native startup visible and interactive traces independent", () => {
    const nativeSource = readFileSync(
      resolve(
        process.cwd(),
        "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
      ),
      "utf8",
    );
    const nativeClient = readFileSync(
      resolve(process.cwd(), "app/client/android-native.ts"),
      "utf8",
    );
    const onCreate = nativeSource.slice(
      nativeSource.indexOf("public void onCreate"),
      nativeSource.indexOf("@Override\n    protected void onNewIntent"),
    );

    expect(nativeSource).toContain("native_start_to_webview_visible");
    expect(nativeSource).toContain("webview_first_interactive");
    expect(nativeSource).toContain("onPageCommitVisible");
    expect(nativeSource).toContain('case "reportStartupInteractive"');
    expect(nativeClient).toContain('"reportStartupInteractive"');
    expect(onCreate).toContain("SplashScreen.installSplashScreen(this)");
    expect(onCreate).not.toContain("new TextToSpeech(this");
    expect(nativeSource).toContain("initializeTextToSpeech()");
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

  test("clears only the active account on logout", () => {
    const signOut = source.slice(
      source.indexOf("async function signOut(clearAll: boolean)"),
      source.indexOf(
        "const downloadPollRef",
        source.indexOf("async function signOut(clearAll: boolean)"),
      ),
    );
    expect(signOut).toContain("listAppImages(activeAccountId)");
    expect(signOut).toContain("deleteAppImages(fileNames, activeAccountId)");
    expect(signOut).toContain("clearLocalMaterials(activeAccountId)");
    expect(signOut).toContain("clearLocalPromptCatalogs(activeAccountId)");
    expect(signOut).toContain("clearLocalVideos(activeAccountId)");
    expect(signOut).toContain(
      "clearAccountScopedLocalStorage(activeAccountId)",
    );
    expect(signOut).toContain("mobileStore.clearActiveAccount()");
    expect(signOut).toContain("sdStore.clearActiveAccount()");
    expect(signOut).not.toContain("localStorage.clear()");
    expect(signOut).not.toContain("indexedDBStorage.clear()");
    expect(signOut).not.toContain("clearAllAccounts()");
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
    expect(managedStore).toContain(
      "partialize: ((state: any) => managedPersistedState(state)) as any",
    );
    expect(managedStore).toContain("backendBaseUrl: normalizeManagedBaseUrl(");

    const managedGate = source.slice(
      source.indexOf("function AndroidManagedGateContent"),
    );
    expect(managedGate).toContain("await managed.restoreSecureSession();");
    expect(managedGate).toContain("firstPaintReady &&");
    expect(managedGate).not.toContain(
      "bootstrap({ silent: Boolean(current.workspace) })",
    );
    expect(managedGate).toContain("!latest.workspace");
    expect(managedGate).toContain(
      "bootstrap({ silent: Boolean(latest.workspace) })",
    );
    const accountAdminRoute = source.slice(
      source.indexOf("if (route === Path.AccountAdmin)"),
      source.indexOf("if (route === Path.AccountRedeem)"),
    );
    expect(accountAdminRoute).toContain("{isAdmin ? (");
    expect(accountAdminRoute).toContain("<MobileAdminWorkspace");
    expect(accountAdminRoute).toContain("text.account.adminUnavailable");
  });

  test("injects web search only when both the model and server contract allow it", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio("),
    );

    expect(chat).toContain("isMobileWebSearchAvailable(");
    expect(chat).toContain("managed.mobileProtocol");
    expect(chat).toContain(
      "modelSupportsWebSearch && webSearchServiceAvailable",
    );
    expect(chat).toContain("text.chat.webSearchUnavailable");
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
      '<AndroidAppShell active="home" text={text} documentScroll>',
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
      source.indexOf("function AndroidImageStudio("),
    );
    expect(chat).toContain("if (!effectiveChatGroupId) return;");
    expect(chat).toContain("const selectedModelIsAvailable =");
    expect(chat).toContain("if (!selectedModelIsAvailable) return;");
    expect(chat).toContain("const requestedModel = requestGroupId");
    expect(chat).toContain(
      "modelMatches(item, selectedModel || fallbackModel)",
    );
    expect(chat).toContain("const model = modelValue(requestedModel);");
    expect(chat).toContain("if (!model || !requestedModel)");
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
      source.indexOf("function AndroidImageStudio("),
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
      source.indexOf("function AndroidImageStudio("),
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
      source.indexOf("function AndroidImageStudio("),
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
      source.indexOf("function AndroidImageStudio("),
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

  test("uses a double native back press only on root screens", () => {
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
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidContentKit("),
    );
    expect(chat).toContain("lastNativeHomeBackAt = 0");
    expect(chat).toContain("navigateBack(navigate, Path.Home)");
    expect(chat).not.toContain("handleNativeHomeBack(text)");

    const contentKit = source.slice(
      source.indexOf("function AndroidContentKit("),
      source.indexOf("function AndroidImageStudio("),
    );
    expect(contentKit).toContain(
      "Content workbench is opened from the image tab",
    );
    expect(contentKit).toContain("navigateBack(navigate, Path.Sd)");
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

    const stylesheet = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.module.scss"),
      "utf8",
    );
    const messageStyles = stylesheet.slice(
      stylesheet.indexOf(".message {"),
      stylesheet.indexOf(".message-text {"),
    );
    expect(messageStyles).toContain("touch-action: auto;");
    expect(messageStyles).toContain("-webkit-touch-callout: default;");
    expect(messageStyles).not.toContain("touch-action: pan-y;");
  });

  test("reuses a failed chat request ID for manual and network recovery", () => {
    const chat = source.slice(
      source.indexOf("function AndroidChat()"),
      source.indexOf("function AndroidImageStudio("),
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
