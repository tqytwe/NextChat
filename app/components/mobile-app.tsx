"use client";

import {
  Fragment,
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, FormEvent, PointerEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import styles from "./mobile-app.module.scss";
import AddIcon from "../icons/add.svg";
import ChatIcon from "../icons/chat.svg";
import CloudFailIcon from "../icons/cloud-fail.svg";
import CloseIcon from "../icons/close.svg";
import CopyIcon from "../icons/copy.svg";
import DeleteIcon from "../icons/delete.svg";
import DownloadIcon from "../icons/download.svg";
import EyeIcon from "../icons/eye.svg";
import EyeOffIcon from "../icons/eye-off.svg";
import FavoriteIcon from "../icons/favorite.svg";
import HistoryIcon from "../icons/history.svg";
import ImageIcon from "../icons/image.svg";
import LeftIcon from "../icons/left.svg";
import MaxIcon from "../icons/max.svg";
import PromptIcon from "../icons/prompt.svg";
import PaletteIcon from "../icons/palette.svg";
import PlayIcon from "../icons/play.svg";
import DiscoveryIcon from "../icons/discovery.svg";
import ReloadIcon from "../icons/reload.svg";
import SDIcon from "../icons/sd.svg";
import SendIcon from "../icons/send-white.svg";
import SettingsIcon from "../icons/settings.svg";
import ShareIcon from "../icons/share.svg";
import ThreeDotsIcon from "../icons/three-dots.svg";
import UploadIcon from "../icons/upload.svg";
import VoiceIcon from "../icons/voice.svg";
import BotIcon from "../icons/bot.svg";
import { getClientConfig } from "../config/client";
import { Path } from "../constant";
import {
  Theme,
  useAppConfig,
  useManagedMobileAppStore,
  useManagedNextChatStore,
  useSdStore,
} from "../store";
import type {
  ManagedMobileChatMessage,
  ManagedMobileChatRole,
  ManagedMobileChatSession,
  ManagedMobileContentKit,
  ManagedMobileContentKitAsset,
} from "../store/mobile";
import { localizedMobileDisplay } from "../client/mobile-display";
import {
  androidManifestReleaseVersion,
  evaluateAndroidUpdate,
  formatAndroidReleaseVersion,
  normalizeAndroidReleaseVersion,
} from "../client/android-release-version";
import type {
  AndroidReleaseManifest,
  AndroidReleaseVersion,
} from "../client/android-release-version";
import {
  compressMobileImage as compressImage,
  removeMobileImage as removeImage,
} from "../client/mobile-image";
import {
  ManagedApiError,
  ManagedTransportError,
  managedJsonRequest as managedApiJsonRequest,
  managedDownloadBlob,
  managedApiUrl,
  managedGatewayBaseUrl,
  managedRequestText,
  getManagedRequestDiagnostics,
  isManagedAuthError,
  normalizeManagedBaseUrl,
  diagnosticCategory,
  diagnosticErrorMessage,
  recordManagedRequestDiagnostic,
  shouldRefreshManagedSession,
} from "../client/managed-nextchat";
import type {
  ManagedAuthResponse,
  ManagedWorkspaceGroup,
  ManagedWorkspaceModel,
} from "../client/managed-nextchat";
import {
  buildMobileVideoScriptPrompt,
  managedVideoCapabilities,
  MOBILE_VIDEO_POLL_INTERVAL_MS,
  MOBILE_VIDEO_POLL_TIMEOUT_MS,
  resolveMobileVideoScriptSelection,
} from "../client/mobile-video";
import {
  formatManagedMobileError,
  getManagedMobileLocale,
  getManagedMobileText,
  localizeManagedMobileError,
  setManagedMobileLocale,
} from "../client/managed-mobile-i18n";
import type {
  ManagedMobileLocale,
  ManagedMobileText,
} from "../client/managed-mobile-i18n";
import {
  CONTENT_WORKBENCH_MAX_OUTPUTS_PER_PROJECT,
  CONTENT_WORKBENCH_MAX_VARIANTS_PER_SHOT,
  buildContentWorkbenchCopyPrompt,
  buildContentWorkbenchPrompt,
  contentWorkbenchCanIncreaseShotCount,
  contentWorkbenchClonePlan,
  contentWorkbenchCustomShot,
  contentWorkbenchPlanOutputCount,
  contentWorkbenchPresets,
  contentWorkbenchShotOptions,
  normalizeContentWorkbenchShot,
} from "../client/content-workbench";
import type {
  ContentWorkbenchBrief,
  ContentWorkbenchShotPlan as WorkbenchShotPlan,
} from "../client/content-workbench";
import { renderContentTextOverlay } from "../client/content-text-overlay";
import {
  normalizeMobileChatPreference,
  rememberedMobileChatModel,
  resolveMobileChatPreference,
  updateMobileChatPreference,
} from "../client/mobile-chat-preference";
import {
  isMobileAdminAvailable,
  isMobileWebSearchAvailable,
} from "../client/mobile-capabilities";
import {
  formatUsageUSD,
  mergeSubscriptionProgress,
  needsSubscriptionProgressRefresh,
  planUsageInfo,
  subscriptionUsagePeriods,
} from "../client/mobile-subscription";
const MobileAdminWorkspace = lazy(() =>
  import("./mobile-admin-workspace").then((module) => ({
    default: module.MobileAdminWorkspace,
  })),
);
import {
  getNativeDownloadStatus,
  getNativeDeviceInfo,
  getNativeE2EFixtureFlags,
  installDownloadedApk,
  captureImage,
  claimUnassignedAppImages,
  deleteAppImages,
  listAppImages,
  listUnassignedAppImages,
  openAppSettings,
  openExternalUrl,
  requestGalleryPermissions,
  requestCameraPermission,
  requestMicrophonePermission,
  requestNotificationPermission,
  cancelForegroundPttSession,
  notifyForegroundPttRouteChange,
  recognizeSpeech,
  saveImageToAppStorage,
  saveImageToGallery,
  shareImage,
  shareImages,
  shareText,
  copyTextToClipboard,
  showNativeNotification,
  isDirectNativeStreamAvailable,
  startDirectNativeStreamRequest,
  startForegroundPttSession,
  startNativeDownload,
  stopForegroundPttSession,
  readNativeSharedMaterial,
  isNativeAndroid,
  loadLoginCredentials,
  saveLoginCredentials,
  clearLoginCredentials,
  finishNativeApp,
  showNativeToast,
  queryPlayBillingProducts,
  launchPlayBillingPurchase,
  consumePlayBillingPurchase,
  acknowledgePlayBillingPurchase,
  configureNativeCrashlyticsUser,
  recordNativeCrashlyticsException,
  startNativePerformanceTrace,
  stopNativePerformanceTrace,
  getNativePushInbox,
  markNativePushInboxRead,
  clearNativePushInbox,
} from "../client/android-native";
import type {
  NativeAppImage,
  NativeForegroundPttSession,
  NativePlayBillingProduct,
  NativePlayBillingProductType,
  NativePlayBillingPurchase,
  NativePushInboxItem,
  NativeSharedMaterial,
} from "../client/android-native";
import {
  deleteLocalMaterials,
  importLocalMaterials,
  listLocalMaterials,
  syncLocalMaterials,
  readLocalMaterialBlob,
  readLocalMaterialDataUrl,
  clearLocalMaterials,
  localMaterialKind,
} from "../client/local-materials";
import type {
  LocalMaterial,
  LocalMaterialKind,
} from "../client/local-materials";
import {
  clearLocalPromptCatalogs,
  createLocalPromptCoverObjectURL,
  readLocalPromptCatalog,
  syncLocalPromptCatalog,
} from "../client/local-prompt-library";
import type {
  LocalPromptCatalog,
  LocalPromptCatalogItem,
} from "../client/local-prompt-library";
import {
  clearLocalVideos,
  deleteLocalVideos,
  listLocalVideosWithBlobs,
  saveLocalVideo,
} from "../client/local-video-cache";
import type { LocalVideoEntry } from "../client/local-video-cache";
import {
  createMobilePlatformClient,
  mergeMobileTaskPages,
  uploadMobileAssetFormData,
} from "../client/mobile-platform";
import { searchMobileWeb } from "../client/mobile-web-search";
import {
  createMobileCompletionStreamAccumulator,
  formatMobileWebSearchSources,
  MOBILE_WEB_SEARCH_TOOL,
  runMobileWebSearchToolLoop,
} from "../client/mobile-chat-tools";
import { isChatModel, isImageModel } from "../client/mobile-model-kind";
import {
  inferLocalChatAttachmentMimeType,
  isLocalChatImage,
  isLocalChatText,
  localChatAttachmentKind,
  normalizeLocalChatAttachmentBlob,
} from "../client/mobile-chat-attachments";
import {
  mobileInstallationId,
  registerMobilePush,
} from "../client/mobile-push";
import {
  buildMobileRegistrationPayload,
  buildInvitePosterPayload,
  attributeInviteCampaign,
  captureInviteReferral,
  createInvitePosterDataUrl,
  getInviteInstallationId,
  getStableInviteEventId,
  INVITE_POSTER_THEMES,
  loadInviteReferral,
  reportInviteLifecycleEvent,
  resolveInviteReferral,
  storeInviteReferral,
} from "../client/invite-growth";
import type {
  InviteCampaignProgress,
  InviteCampaignReward,
  InvitePosterTheme,
} from "../client/invite-growth";
import {
  loadPlayWelfareData,
  loadPlayWelfareTeamSeason,
  PLAY_WELFARE_REWARD_ENDPOINTS,
  PLAY_WELFARE_TEAM_ENDPOINTS,
} from "../client/play-welfare";
import type {
  PlayWelfareBlindboxResult,
  PlayWelfareData,
  PlayWelfareCheckinResult,
  PlayWelfareQuizSubmitResult,
  PlayWelfareTeamDirectoryEntry,
  PlayWelfareTeamInvite,
  PlayWelfareTeamSeasonDetail,
} from "../client/play-welfare";
import {
  mobileAttributionAffiliateCode,
  mobileAttributionToken,
} from "../client/mobile-attribution";
import type {
  MobileAsset,
  MobilePaymentOrder,
  MobileProject,
  MobileSkill,
  MobileSupportTicket,
  MobileSupportTicketDetail,
  MobileTask,
  MobileTaskStatus,
} from "../client/mobile-platform";

type ClientBuildConfig = NonNullable<ReturnType<typeof getClientConfig>>;

type MaterialUploadState = "uploading" | "ready" | "local" | "failed";

type MaterialDraft = {
  localId: string;
  name: string;
  kind: string;
  state: MaterialUploadState;
  previewUrl?: string;
  asset?: MobileAsset;
  localText?: string;
  error?: string;
};

type ServerSkillSelection = {
  id: string;
  slug: string;
  title: string;
  systemPrompt: string;
};

const SERVER_SKILL_SELECTION_KEY = "jisudengchat-server-skills-v1";
const COLLABORATION_AGENT_ID = "multi-agent-collaboration";
const CONTENT_KIT_GLOBAL_CONCURRENCY = 2;
const CONTENT_KIT_MAX_OUTPUTS_PER_RUN = 24;
const CONTENT_KIT_MAX_OUTPUTS_PER_PROJECT =
  CONTENT_WORKBENCH_MAX_OUTPUTS_PER_PROJECT;
const activeContentKitOutputs = new Set<string>();

type ContentKitShotPlan = WorkbenchShotPlan;

type ContentKitBatchEstimate = {
  estimated_cost: number;
  balance: number;
  sufficient: boolean;
};

type ContentKitUsageRecord = {
  id: number | string;
  request_id?: string;
  actual_cost?: number;
};

type ContentKitUsagePage = {
  items?: ContentKitUsageRecord[];
};

type ContentKitAssetTag = "keep" | "review" | "reject" | "video";

function contentKitShotLabel(
  shot: ContentKitShotPlan,
  text: ManagedMobileText,
) {
  const labels = {
    main: text.platform.contentKit.main,
    angle: text.platform.contentKit.angle,
    detail: text.platform.contentKit.detail,
    lifestyle: text.platform.contentKit.lifestyle,
    sellingPoint: text.platform.contentKit.sellingPoint,
    detailPage: text.platform.contentKit.detailPage,
    poster: text.platform.contentKit.poster,
    vertical: text.platform.contentKit.vertical,
    banner: text.platform.contentKit.banner,
    socialCover: text.platform.contentKit.socialCover,
    socialCarousel: text.platform.contentKit.socialCarousel,
    brandHero: text.platform.contentKit.brandHero,
    feature: text.platform.contentKit.feature,
    workflow: text.platform.contentKit.workflow,
    download: text.platform.contentKit.download,
    customShot: text.platform.contentKit.customShot,
  } as const;
  return shot.labelKey ? labels[shot.labelKey] : shot.label;
}

function contentKitShotPurpose(
  shot: ContentKitShotPlan,
  text: ManagedMobileText,
) {
  const purposes: Record<string, string> = {
    main: text.platform.contentKit.purposeMain,
    angle: text.platform.contentKit.purposeAngle,
    detail: text.platform.contentKit.purposeDetail,
    lifestyle: text.platform.contentKit.purposeLifestyle,
    "selling-point": text.platform.contentKit.purposeSellingPoint,
    "detail-page": text.platform.contentKit.purposeDetailPage,
    poster: text.platform.contentKit.purposePoster,
    vertical: text.platform.contentKit.purposeVertical,
    banner: text.platform.contentKit.purposeBanner,
    "social-cover": text.platform.contentKit.purposeSocialCover,
    "social-carousel": text.platform.contentKit.purposeSocialCarousel,
    "brand-hero": text.platform.contentKit.purposeBrandHero,
    feature: text.platform.contentKit.purposeFeature,
    workflow: text.platform.contentKit.purposeWorkflow,
    download: text.platform.contentKit.purposeDownload,
    custom: text.platform.contentKit.purposeCustom,
  };
  return purposes[shot.kind] || shot.purpose;
}

function localizedContentKitShot(
  shot: ContentKitShotPlan,
  text: ManagedMobileText,
): ContentKitShotPlan {
  const normalized = normalizeContentWorkbenchShot(shot);
  return {
    ...normalized,
    label: contentKitShotLabel(normalized, text),
    purpose: contentKitShotPurpose(normalized, text),
  };
}

function contentKitBriefFromProject(
  project: ManagedMobileContentKit,
): ContentWorkbenchBrief {
  return {
    projectName: project.productName,
    sellingPoints: project.sellingPoints,
    parameters: project.parameters || "",
    audience: project.audience,
    platform: project.platform,
    tone: project.tone,
    scene: project.scene || project.presetId || "custom",
    brandControls: project.brandControls,
  };
}

function contentKitAssetSpecs(
  runId: string,
  plan: ContentKitShotPlan[],
  brief: ContentWorkbenchBrief,
  projectId = "",
): Omit<ManagedMobileContentKitAsset, "status" | "updatedAt">[] {
  return plan.flatMap((inputShot) => {
    const shot = normalizeContentWorkbenchShot(inputShot);
    return Array.from({ length: shot.count }, (_, index) => ({
      id: `${runId}-${shot.id}-${index + 1}`,
      projectId,
      runId,
      shotId: shot.id,
      scene: shot.scene || brief.scene || "custom",
      kind: shot.kind,
      label: shot.label,
      purpose: shot.purpose,
      aspect: shot.aspect,
      copyFields: shot.copyFields,
      size: shot.size,
      variant: index + 1,
      requestId: clientRequestID("content-kit-output"),
      tags: [],
      prompt: buildContentWorkbenchPrompt(brief, shot),
    }));
  });
}

function clientRequestID(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isManagedNetworkLikeError(error: unknown) {
  const category = diagnosticCategory(error);
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    category === "network" ||
    category === "offline" ||
    category === "timeout" ||
    /failed to fetch|network|timeout|timed out|网络请求失败|网络连接失败|超时/i.test(
      message,
    )
  );
}

async function requestWithManagedAuth<T>(
  run: (input: { accessToken: string; baseUrl: string }) => Promise<T>,
  options: { networkRetries?: number; authRetries?: number } = {},
) {
  const networkRetries = options.networkRetries ?? 0;
  const authRetries = options.authRetries ?? 1;
  let networkAttempt = 0;
  let authAttempt = 0;
  let forceRefresh = false;
  let lastError: unknown = null;

  while (networkAttempt <= networkRetries) {
    try {
      const currentStore = useManagedNextChatStore.getState();
      const accessToken = await currentStore.ensureFreshAuthToken(forceRefresh);
      const latest = useManagedNextChatStore.getState();
      return await run({ accessToken, baseUrl: latest.backendBaseUrl });
    } catch (error) {
      lastError = error;
      if (isManagedAuthError(error) && authAttempt < authRetries) {
        authAttempt += 1;
        forceRefresh = true;
        await useManagedNextChatStore
          .getState()
          .bootstrap({ silent: true })
          .catch(() => undefined);
        continue;
      }
      if (isManagedNetworkLikeError(error) && networkAttempt < networkRetries) {
        networkAttempt += 1;
        await sleep(350 * networkAttempt);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function mobilePlatformClient() {
  type MobilePlatformClient = ReturnType<typeof createMobilePlatformClient>;
  const makeClient = createMobilePlatformClient;
  return {
    assets: {
      list: (...args: Parameters<MobilePlatformClient["assets"]["list"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).assets.list(...args),
        ),
      detail: (...args: Parameters<MobilePlatformClient["assets"]["detail"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).assets.detail(...args),
        ),
      delete: (...args: Parameters<MobilePlatformClient["assets"]["delete"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).assets.delete(...args),
        ),
      upload: (...args: Parameters<MobilePlatformClient["assets"]["upload"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).assets.upload(...args),
        ),
    },
    skills: {
      list: (...args: Parameters<MobilePlatformClient["skills"]["list"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).skills.list(...args),
        ),
      detail: (...args: Parameters<MobilePlatformClient["skills"]["detail"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).skills.detail(...args),
        ),
      install: (
        ...args: Parameters<MobilePlatformClient["skills"]["install"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).skills.install(...args),
        ),
      uninstall: (
        ...args: Parameters<MobilePlatformClient["skills"]["uninstall"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).skills.uninstall(...args),
        ),
      use: (...args: Parameters<MobilePlatformClient["skills"]["use"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).skills.use(...args),
        ),
    },
    tasks: {
      create: (...args: Parameters<MobilePlatformClient["tasks"]["create"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).tasks.create(...args),
        ),
      list: (...args: Parameters<MobilePlatformClient["tasks"]["list"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).tasks.list(...args),
        ),
      detail: (...args: Parameters<MobilePlatformClient["tasks"]["detail"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).tasks.detail(...args),
        ),
      cancel: (...args: Parameters<MobilePlatformClient["tasks"]["cancel"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).tasks.cancel(...args),
        ),
      retry: (...args: Parameters<MobilePlatformClient["tasks"]["retry"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).tasks.retry(...args),
        ),
      status: (...args: Parameters<MobilePlatformClient["tasks"]["status"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).tasks.status(...args),
        ),
      delete: (...args: Parameters<MobilePlatformClient["tasks"]["delete"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).tasks.delete(...args),
        ),
      bulkDelete: (
        ...args: Parameters<MobilePlatformClient["tasks"]["bulkDelete"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).tasks.bulkDelete(...args),
        ),
      bulkCancel: (
        ...args: Parameters<MobilePlatformClient["tasks"]["bulkCancel"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).tasks.bulkCancel(...args),
        ),
    },
    projects: {
      create: (
        ...args: Parameters<MobilePlatformClient["projects"]["create"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).projects.create(...args),
        ),
      list: (...args: Parameters<MobilePlatformClient["projects"]["list"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).projects.list(...args),
        ),
      detail: (
        ...args: Parameters<MobilePlatformClient["projects"]["detail"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).projects.detail(...args),
        ),
      update: (
        ...args: Parameters<MobilePlatformClient["projects"]["update"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).projects.update(...args),
        ),
      delete: (
        ...args: Parameters<MobilePlatformClient["projects"]["delete"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).projects.delete(...args),
        ),
    },
    payments: {
      create: (
        ...args: Parameters<MobilePlatformClient["payments"]["create"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).payments.create(...args),
        ),
      detail: (
        ...args: Parameters<MobilePlatformClient["payments"]["detail"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).payments.detail(...args),
        ),
      sync: (...args: Parameters<MobilePlatformClient["payments"]["sync"]>) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).payments.sync(...args),
        ),
    },
    playBilling: {
      submitPurchase: (
        ...args: Parameters<
          MobilePlatformClient["playBilling"]["submitPurchase"]
        >
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).playBilling.submitPurchase(...args),
        ),
    },
    support: {
      tickets: {
        list: (
          ...args: Parameters<
            MobilePlatformClient["support"]["tickets"]["list"]
          >
        ) =>
          requestWithManagedAuth(({ baseUrl, accessToken }) =>
            makeClient(baseUrl, accessToken).support.tickets.list(...args),
          ),
        detail: (
          ...args: Parameters<
            MobilePlatformClient["support"]["tickets"]["detail"]
          >
        ) =>
          requestWithManagedAuth(({ baseUrl, accessToken }) =>
            makeClient(baseUrl, accessToken).support.tickets.detail(...args),
          ),
        message: (
          ...args: Parameters<
            MobilePlatformClient["support"]["tickets"]["message"]
          >
        ) =>
          requestWithManagedAuth(({ baseUrl, accessToken }) =>
            makeClient(baseUrl, accessToken).support.tickets.message(...args),
          ),
        close: (
          ...args: Parameters<
            MobilePlatformClient["support"]["tickets"]["close"]
          >
        ) =>
          requestWithManagedAuth(({ baseUrl, accessToken }) =>
            makeClient(baseUrl, accessToken).support.tickets.close(...args),
          ),
      },
    },
    devices: {
      register: (
        ...args: Parameters<MobilePlatformClient["devices"]["register"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).devices.register(...args),
        ),
      delete: (
        ...args: Parameters<MobilePlatformClient["devices"]["delete"]>
      ) =>
        requestWithManagedAuth(({ baseUrl, accessToken }) =>
          makeClient(baseUrl, accessToken).devices.delete(...args),
        ),
    },
    diagnostics: {
      submit: (
        ...args: Parameters<MobilePlatformClient["diagnostics"]["submit"]>
      ) =>
        requestWithManagedAuth(
          ({ baseUrl, accessToken }) =>
            makeClient(baseUrl, accessToken).diagnostics.submit(...args),
          { networkRetries: 0, authRetries: 0 },
        ),
    },
  };
}

async function uploadMaterial(
  file: Blob,
  name: string,
  source: "camera" | "gallery" | "share" | "upload" = "upload",
) {
  const form = new FormData();
  form.append("file", file, name);
  form.append("name", name);
  form.append("source", source);
  return requestWithManagedAuth(({ baseUrl, accessToken }) =>
    uploadMobileAssetFormData(baseUrl, accessToken, form),
  );
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

function blobToText(blob: Blob) {
  if (typeof blob.text === "function") return blob.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsText(blob);
  });
}

function mobileTaskStatusLabel(
  status: MobileTaskStatus,
  text: ManagedMobileText,
) {
  return text.platform.taskStatuses[status] || text.notSynced;
}

function mobileTaskOperationLabel(task: MobileTask, text: ManagedMobileText) {
  const explicitTitle = localizedMobileDisplay(task, {
    defaultFields: ["title", "name"],
  });
  if (explicitTitle) return explicitTitle;
  const operation = String(task.operation || "")
    .trim()
    .toLowerCase();
  const locale = getManagedMobileLocale();
  const labels: Record<string, Record<ManagedMobileLocale, string>> = {
    "chat.completions": {
      cn: "AI 对话",
      en: "AI conversation",
      jp: "AI チャット",
      ko: "AI 대화",
    },
    "images.generations": {
      cn: "图片生成",
      en: "Image generation",
      jp: "画像生成",
      ko: "이미지 생성",
    },
    "images.edits": {
      cn: "图片编辑",
      en: "Image editing",
      jp: "画像編集",
      ko: "이미지 편집",
    },
    content_kit: {
      cn: "内容创作",
      en: "Content creation",
      jp: "コンテンツ制作",
      ko: "콘텐츠 제작",
    },
    "files.upload": {
      cn: "文件上传",
      en: "File upload",
      jp: "ファイルアップロード",
      ko: "파일 업로드",
    },
  };
  if (labels[operation]) return labels[operation][locale];
  if (task.kind === "image") {
    return {
      cn: "图片任务",
      en: "Image task",
      jp: "画像タスク",
      ko: "이미지 작업",
    }[locale];
  }
  if (task.kind === "file") {
    return {
      cn: "文件任务",
      en: "File task",
      jp: "ファイルタスク",
      ko: "파일 작업",
    }[locale];
  }
  return (
    {
      cn: "对话任务",
      en: "Conversation task",
      jp: "チャットタスク",
      ko: "대화 작업",
    }[locale] || text.platform.tasks
  );
}

function mobileAssetTitle(asset: MobileAsset, text: ManagedMobileText) {
  const fileName = asset.metadata?.file_name;
  return localizedMobileDisplay(asset, {
    defaultFields: ["name", "name_zh", "name_en"],
    fallback:
      (typeof fileName === "string" ? fileName : "") ||
      text.platform.unnamedAsset,
  });
}

function serverSkillTitle(skill: MobileSkill, text: ManagedMobileText) {
  return localizedMobileDisplay(skill, {
    defaultFields: ["name", "name_zh", "name_en", "slug"],
    fallback: text.platform.skillDefaultDescription,
  });
}

function serverSkillDescription(skill: MobileSkill, text: ManagedMobileText) {
  return localizedMobileDisplay(skill, {
    kind: "description",
    fallback: text.platform.skillDefaultDescription,
  });
}

function normalizedSkillCategory(value?: string) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (/doc|文档|summary|总结|pdf/.test(raw)) return "document";
  if (/image|图片|生图|prompt|提示词/.test(raw)) return "image";
  if (/market|营销|social|小红书|内容|copy/.test(raw)) return "marketing";
  if (/business|commerce|商业|电商|销售/.test(raw)) return "business";
  if (/code|dev|代码|开发|debug/.test(raw)) return "code";
  if (/support|客服|工单|售后/.test(raw)) return "support";
  if (/legal|law|合同|法律/.test(raw)) return "legal";
  if (/edu|study|学习|教育/.test(raw)) return "education";
  if (/office|meeting|办公|会议/.test(raw)) return "office";
  if (/translation|translate|翻译|本地化/.test(raw)) return "translation";
  return raw;
}

function skillCategoryLabel(
  category: string | undefined,
  text: ManagedMobileText,
) {
  const normalized = normalizedSkillCategory(category);
  const labels: Record<string, LocalizedString> = {
    document: { cn: "文档处理", en: "Document", jp: "文書", ko: "문서" },
    image: { cn: "图片与提示词", en: "Image", jp: "画像", ko: "이미지" },
    marketing: {
      cn: "营销内容",
      en: "Marketing",
      jp: "マーケティング",
      ko: "마케팅",
    },
    business: {
      cn: "商业经营",
      en: "Business",
      jp: "ビジネス",
      ko: "비즈니스",
    },
    code: { cn: "代码开发", en: "Code", jp: "コード", ko: "코드" },
    support: {
      cn: "客服售后",
      en: "Support",
      jp: "サポート",
      ko: "지원",
    },
    legal: { cn: "合同法务", en: "Legal", jp: "法務", ko: "법무" },
    education: { cn: "学习教育", en: "Education", jp: "学習", ko: "학습" },
    office: {
      cn: "办公协作",
      en: "Office",
      jp: "オフィス",
      ko: "오피스",
    },
    translation: {
      cn: "翻译本地化",
      en: "Translation",
      jp: "翻訳",
      ko: "번역",
    },
  };
  return localizedValue(
    labels[normalized] || {
      cn: category || "通用技能",
      en: category || "General",
      jp: category || "汎用スキル",
      ko: category || "일반 스킬",
    },
    text,
  );
}

function localSkillInputHint(
  skill: ChatSkillTemplate,
  text: ManagedMobileText,
) {
  const hints: Record<string, LocalizedString> = {
    document: {
      cn: "请提供文档正文、会议记录、PDF 摘录或要总结的长文本；如果有目标读者和输出长度，请一起说明。",
      en: "Provide document text, meeting notes, PDF excerpts, or long text; add audience and length when useful.",
      jp: "文書本文、会議メモ、PDF 抜粋、要約したい長文を入力してください。対象読者や希望する長さがあれば一緒に指定してください。",
      ko: "문서 본문, 회의 기록, PDF 발췌 또는 요약할 긴 텍스트를 입력해 주세요. 대상 독자와 원하는 분량이 있다면 함께 알려 주세요.",
    },
    image: {
      cn: "请提供图片、画面描述、用途、比例、风格偏好和需要避免的内容；有参考图时可一并加入素材。",
      en: "Provide images or scene description, use case, ratio, style preference, and constraints; attach references when available.",
      jp: "画像、画面説明、用途、比率、スタイルの希望、避けたい内容を入力してください。参考画像があれば素材に追加できます。",
      ko: "이미지, 장면 설명, 용도, 비율, 스타일 선호와 피해야 할 내용을 입력해 주세요. 참고 이미지가 있으면 소재로 함께 추가할 수 있습니다.",
    },
    marketing: {
      cn: "请提供产品/主题、目标用户、发布平台、语气、卖点和不能触碰的限制词。",
      en: "Provide product/topic, audience, platform, tone, selling points, and restricted wording.",
      jp: "商品/テーマ、ターゲット、投稿先、トーン、訴求点、避けるべき表現を入力してください。",
      ko: "상품/주제, 대상 사용자, 게시 플랫폼, 톤, 핵심 장점과 피해야 할 표현을 입력해 주세요.",
    },
    business: {
      cn: "请提供商品、服务、目标人群、平台规则、价格区间和已有素材。",
      en: "Provide product/service, audience, platform rules, price range, and existing materials.",
      jp: "商品やサービス、対象ユーザー、プラットフォーム規則、価格帯、既存素材を入力してください。",
      ko: "상품/서비스, 대상 고객, 플랫폼 규칙, 가격대와 기존 소재를 입력해 주세요.",
    },
    code: {
      cn: "请提供报错、相关代码、运行环境、复现步骤和最近改动；缺少日志时会先帮你列排查清单。",
      en: "Provide errors, code, environment, reproduction steps, and recent changes; missing logs will be requested.",
      jp: "エラー、関連コード、実行環境、再現手順、直近の変更を入力してください。ログが不足している場合は確認項目を整理します。",
      ko: "오류, 관련 코드, 실행 환경, 재현 절차와 최근 변경 사항을 입력해 주세요. 로그가 부족하면 먼저 확인 목록을 정리합니다.",
    },
    support: {
      cn: "请提供用户原话、订单/场景、已处理步骤、希望承诺的范围和不能承诺的内容。",
      en: "Provide the user's message, order/context, handled steps, allowed promises, and forbidden promises.",
      jp: "ユーザーの原文、注文/状況、対応済み手順、約束できる範囲とできない内容を入力してください。",
      ko: "사용자 원문, 주문/상황, 이미 처리한 단계, 약속 가능한 범위와 약속하면 안 되는 내용을 입력해 주세요.",
    },
    legal: {
      cn: "请提供条款正文、签约场景、所在地区和你最担心的问题；输出仅供参考，不替代律师意见。",
      en: "Provide clause text, scenario, region, and concerns; output is informational, not legal advice.",
      jp: "条項本文、契約状況、地域、最も気になる点を入力してください。出力は参考情報であり、弁護士の助言に代わるものではありません。",
      ko: "조항 본문, 계약 상황, 지역, 가장 걱정되는 점을 입력해 주세요. 출력은 참고용이며 변호사 조언을 대체하지 않습니다.",
    },
    education: {
      cn: "请提供学习目标、当前基础、每天可用时间、截止日期和偏好的学习方式。",
      en: "Provide learning goal, baseline, available time, deadline, and preferred method.",
      jp: "学習目標、現在のレベル、毎日使える時間、期限、好みの学習方法を入力してください。",
      ko: "학습 목표, 현재 수준, 매일 사용할 수 있는 시간, 마감일과 선호하는 학습 방식을 입력해 주세요.",
    },
    office: {
      cn: "请提供会议记录、参会角色、背景、希望产出的格式和重点事项。",
      en: "Provide meeting notes, roles, background, desired format, and key concerns.",
      jp: "会議メモ、参加者の役割、背景、希望する出力形式、重点事項を入力してください。",
      ko: "회의 기록, 참석자 역할, 배경, 원하는 출력 형식과 핵심 사항을 입력해 주세요.",
    },
    translation: {
      cn: "请提供原文、目标语言、使用场景、目标读者和语气要求；会保留变量、格式和专有名词。",
      en: "Provide source text, target language, context, audience, and tone; variables and terms are preserved.",
      jp: "原文、目標言語、利用場面、対象読者、トーンの希望を入力してください。変数、形式、固有名詞は保持します。",
      ko: "원문, 대상 언어, 사용 상황, 대상 독자와 톤 요구사항을 입력해 주세요. 변수, 형식, 고유명사는 유지합니다.",
    },
  };
  return localizedValue(
    hints[normalizedSkillCategory(skill.category)] || {
      cn: "请提供任务目标、背景、素材和期望输出格式。",
      en: "Provide the goal, context, materials, and desired output format.",
      jp: "タスク目標、背景、素材、希望する出力形式を入力してください。",
      ko: "작업 목표, 배경, 소재와 원하는 출력 형식을 입력해 주세요.",
    },
    text,
  );
}

function localSkillConsumptionHint(text: ManagedMobileText) {
  return localizedValue(
    {
      cn: "技能本身不额外改变模型或分组，实际消耗按当前模型、套餐和生成内容计算。",
      en: "The skill does not change model or group; actual usage follows the current model, plan, and output.",
      jp: "スキル自体はモデルやグループを変更しません。実際の消費は現在のモデル、プラン、出力内容に基づきます。",
      ko: "스킬 자체는 모델이나 그룹을 변경하지 않습니다. 실제 사용량은 현재 모델, 플랜, 출력 내용에 따라 계산됩니다.",
    },
    text,
  );
}

function serverSkillConsumptionHint(
  skill: MobileSkill,
  text: ManagedMobileText,
) {
  const note = skill.version?.consumption_note_zh;
  if (isChineseMobileText(text) && note) return note;
  return localSkillConsumptionHint(text);
}

function serverSkillInputHint(skill: MobileSkill, text: ManagedMobileText) {
  const zh = isChineseMobileText(text);
  const separator = zh || mobileTextLocale(text) === "jp" ? "、" : ", ";
  const params = skill.parameters || [];
  if (params.length > 0) {
    const labels = params
      .slice(0, 4)
      .map((param) => (zh && param.label_zh ? param.label_zh : param.label))
      .filter(Boolean)
      .join(separator);
    if (labels) {
      const locale = mobileTextLocale(text);
      if (locale === "cn") {
        return `建议提供：${labels}。缺少必要信息时，AI 会先追问补齐。`;
      }
      if (locale === "jp") {
        return `推奨入力：${labels}。必要な情報が不足している場合、AI が先に確認します。`;
      }
      if (locale === "ko") {
        return `권장 입력: ${labels}. 필요한 정보가 부족하면 AI가 먼저 확인합니다.`;
      }
      return `Recommended inputs: ${labels}. The AI will ask for missing required details.`;
    }
  }
  return localizedValue(
    {
      cn: "请提供任务目标、素材、背景和期望输出格式；有文件或图片时可先加入素材。",
      en: "Provide the goal, materials, context, and desired output; attach files or images when needed.",
      jp: "タスク目標、素材、背景、希望する出力形式を入力してください。ファイルや画像がある場合は先に素材へ追加できます。",
      ko: "작업 목표, 소재, 배경, 원하는 출력 형식을 입력해 주세요. 파일이나 이미지가 있다면 먼저 소재에 추가할 수 있습니다.",
    },
    text,
  );
}

type AndroidUpdateManifest = AndroidReleaseManifest & {
  minAndroidVersion?: string;
  severity?: "normal" | "recommended" | "required";
  apkUrl?: string;
  androidApkUrl?: string;
  url?: string;
  size?: string;
  sha256?: string;
  notes?: string[] | string;
  releaseNotes?: string[] | string;
  notesByLocale?: Partial<
    Record<"zh-CN" | "en" | "ja" | "ko", string[] | string>
  >;
};

type InstalledAndroidReleaseVersion = AndroidReleaseVersion & {
  loaded: boolean;
  distributionChannel?: string;
};

const AndroidReleaseVersionContext =
  createContext<InstalledAndroidReleaseVersion>({
    name: "",
    loaded: false,
  });

function AndroidReleaseVersionProvider(props: { children: ReactNode }) {
  const [version, setVersion] = useState<InstalledAndroidReleaseVersion>({
    name: "",
    loaded: false,
  });

  useEffect(() => {
    let active = true;
    void getNativeDeviceInfo()
      .then((device) => {
        if (!active) return;
        setVersion({
          ...normalizeAndroidReleaseVersion(device),
          loaded: true,
          distributionChannel: String(device.distributionChannel || "")
            .trim()
            .toLowerCase(),
        });
      })
      .catch(() => {
        if (active) setVersion({ name: "", loaded: true });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AndroidReleaseVersionContext.Provider value={version}>
      {props.children}
    </AndroidReleaseVersionContext.Provider>
  );
}

function useInstalledAndroidReleaseVersion() {
  return useContext(AndroidReleaseVersionContext);
}

function isPlayDistribution(version: InstalledAndroidReleaseVersion) {
  return version.distributionChannel === "play";
}

const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const UPDATE_CHECKED_AT_STORAGE_KEY = "managed-mobile-update-checked-at";
const UPDATE_DISMISSED_VERSION_STORAGE_KEY = "managed-mobile-update-dismissed";
const WEB_OPEN_MODE_STORAGE_KEY = "managed-mobile-web-open-mode-v1";

type WebOpenMode = "in_app" | "external";

type MobileUserProfile = {
  id?: number;
  username?: string;
  email?: string;
  avatar_url?: string | null;
  totp_enabled?: boolean;
};

type MobileTotpStatus = {
  enabled?: boolean;
  enabled_at?: number;
  feature_enabled?: boolean;
};

type MobileTotpSetup = {
  secret?: string;
  qr_code_url?: string;
  setup_token?: string;
  countdown?: number;
};

type AccountData = {
  orders?: any[];
  transactions?: any[];
  wallet?: any;
  plans?: any[];
  subscriptions?: any[];
  loading: boolean;
  error: string;
  partialErrors?: string[];
  updatedAt?: number;
};

type MobileAccountSummary = {
  orders?: any[];
  transactions?: any[];
  wallet?: any;
  plans?: any[];
  subscriptions?: any[];
  partial_errors?: Array<{ source?: string; message?: string }>;
};

type CheckoutMethod = {
  payment_type?: string;
  display_name?: string;
  display_name_zh?: string;
  display_name_en?: string;
  currency?: string;
  fee_rate?: number;
  single_min?: number;
  single_max?: number;
  available?: boolean;
};

type CheckoutInfo = {
  methods?: Record<string, CheckoutMethod>;
  global_min?: number;
  global_max?: number;
  plans?: any[];
  balance_disabled?: boolean;
  balance_recharge_multiplier?: number;
  recharge_fee_rate?: number;
  help_text?: string;
  help_image_url?: string;
};

type UserCoupon = {
  id: number;
  template_name?: string;
  template_name_zh?: string;
  template_name_en?: string;
  status?: string;
  expires_at?: string;
  valid_from?: string;
  terms_snapshot?: {
    benefit_type?: string;
    benefit_value?: number;
    minimum_amount?: number;
    currency?: string;
    scope?: string;
  };
};

type CouponPaymentQuote = {
  user_coupon_id?: number;
  list_amount?: number;
  discount_amount?: number;
  fee_amount?: number;
  pay_amount?: number;
  payment_currency?: string;
};

type PaymentOrderCreateResult = {
  order_id?: number | string;
  id?: number | string;
  amount?: number;
  pay_amount?: number;
  fee_rate?: number;
  status?: string;
  result_type?: string;
  payment_type?: string;
  out_trade_no?: string;
  pay_url?: string;
  payment_url?: string;
  checkout_url?: string;
  h5_url?: string;
  mweb_url?: string;
  deeplink?: string;
  deep_link?: string;
  scheme_url?: string;
  app_url?: string;
  url?: string;
  qr_code?: string;
  code_url?: string;
  currency?: string;
  expires_at?: string;
  payment_mode?: string;
  return_url?: string;
  resume_token?: string;
  order_type?: string;
  failed_at?: string;
  failed_reason?: string;
  failure_reason?: string;
  error?: string;
  message?: string;
  paid?: boolean;
  completed?: boolean;
  can_retry_payment?: boolean;
  verify_after_ms?: number;
  launch?: {
    type?: string;
    url?: string;
    fallback_url?: string;
    package?: string;
  };
  order?: Record<string, any>;
};

const PENDING_PAYMENT_STORAGE_KEY = "jisudeng-pending-payment-v1";

function normalizeMobilePaymentOrder(
  result: MobilePaymentOrder | any,
  orderType?: string,
): PaymentOrderCreateResult {
  const nested =
    result?.order && typeof result.order === "object" ? result.order : {};
  const launch =
    result?.launch && typeof result.launch === "object" ? result.launch : {};
  const orderId =
    nested.order_id || nested.id || result?.order_id || result?.id;
  return {
    ...nested,
    ...result,
    order: nested,
    order_id: orderId,
    id: nested.id || orderId,
    amount: nested.amount ?? result?.amount,
    pay_amount: nested.pay_amount ?? result?.pay_amount ?? result?.amount,
    status: nested.status || result?.status,
    payment_type:
      nested.payment_type || result?.payment_type || result?.provider || "",
    out_trade_no: nested.out_trade_no || result?.out_trade_no,
    result_type: result?.result_type || nested.result_type,
    pay_url: result?.pay_url || nested.pay_url || launch.url || "",
    payment_url: result?.payment_url || nested.payment_url || "",
    checkout_url: result?.checkout_url || nested.checkout_url || "",
    h5_url: result?.h5_url || nested.h5_url || "",
    mweb_url: result?.mweb_url || nested.mweb_url || "",
    deeplink: result?.deeplink || nested.deeplink || launch.url || "",
    deep_link: result?.deep_link || nested.deep_link || "",
    scheme_url: result?.scheme_url || nested.scheme_url || "",
    app_url: result?.app_url || nested.app_url || "",
    url: result?.url || nested.url || launch.fallback_url || "",
    qr_code: result?.qr_code || nested.qr_code || "",
    code_url: result?.code_url || nested.code_url || "",
    return_url: result?.return_url || nested.return_url,
    resume_token: result?.resume_token || nested.resume_token,
    verify_after_ms: result?.verify_after_ms || nested.verify_after_ms,
    paid: Boolean(result?.paid || nested.paid),
    completed: Boolean(result?.completed || nested.completed),
    can_retry_payment: Boolean(
      result?.can_retry_payment ?? nested.can_retry_payment,
    ),
    expires_at: nested.expires_at || result?.expires_at,
    failed_at: nested.failed_at || result?.failed_at,
    failed_reason:
      nested.failed_reason ||
      nested.failure_reason ||
      result?.failed_reason ||
      result?.failure_reason,
    failure_reason:
      nested.failure_reason ||
      nested.failed_reason ||
      result?.failure_reason ||
      result?.failed_reason,
    order_type: orderType || nested.order_type || result?.order_type,
    launch: result?.launch,
  };
}

function readPendingPaymentOrder(): PaymentOrderCreateResult | null {
  try {
    const value = readStoredJSON<PaymentOrderCreateResult | null>(
      PENDING_PAYMENT_STORAGE_KEY,
      null,
    );
    if (!value || typeof value !== "object") return null;
    if (!value.order_id && !value.out_trade_no && !value.resume_token)
      return null;
    return value;
  } catch {
    return null;
  }
}

function persistPendingPaymentOrder(order: PaymentOrderCreateResult | null) {
  if (!order || !isPendingOrderStatus(order.status)) {
    localStorage.removeItem(accountStorageKey(PENDING_PAYMENT_STORAGE_KEY));
    return;
  }
  writeStoredJSON(PENDING_PAYMENT_STORAGE_KEY, {
    order_id: order.order_id || order.id,
    out_trade_no: order.out_trade_no,
    resume_token: order.resume_token,
    expires_at: order.expires_at,
    status: order.status,
    order_type: order.order_type,
    pay_url: order.pay_url,
    payment_url: order.payment_url,
    mweb_url: order.mweb_url,
    h5_url: order.h5_url,
    deeplink: order.deeplink,
    scheme_url: order.scheme_url,
    qr_code: order.qr_code,
  });
}

type ChatMessageActionTarget = {
  sessionId: string;
  message: ManagedMobileChatMessage;
};

type QuotedChatMessage = {
  id: string;
  role: ManagedMobileChatRole;
  content: string;
};

type MobileFeedbackCategory =
  | "ai_content_report"
  | "bug"
  | "experience"
  | "image"
  | "chat"
  | "payment"
  | "account"
  | "account_deletion_request"
  | "request"
  | "other";

type MobileFeedbackScreenshotDraft = {
  id: string;
  dataUrl: string;
  fileName: string;
};

type MobileReportDraft = {
  category: "ai_content_report";
  title: string;
  content: string;
  createdAt: number;
};

type GalleryFilter = "all" | "favorites" | "products" | "posters";

type GalleryCategory = "products" | "posters" | "";

type GalleryPreference = {
  favorite?: boolean;
  category?: GalleryCategory;
  collectionId?: string;
  collectionName?: string;
  updatedAt?: number;
};

type GalleryPreferences = Record<string, GalleryPreference>;

type LocalizedString = {
  cn: string;
  en: string;
  jp?: string;
  ko?: string;
};

type ImagePromptTemplate = {
  id: string;
  category: string;
  title: LocalizedString;
  description: LocalizedString;
  prompt: LocalizedString;
  author?: string;
  source?: string;
  categories?: string[];
  domain?: string;
  style?: string;
  subject?: string;
  coverUrl?: string;
  featured?: boolean;
  needReferenceImages?: boolean;
  params: {
    size?: string;
    quality?: string;
    style?: string;
    count?: number;
  };
};

type ImagePromptCategory = {
  id: string;
  label: string;
  axis?: string;
};

type ImagePromptLanguageMode = "app" | "zh" | "en" | "jp" | "ko" | "both";

type ImagePromptLibraryPayload = {
  id: string;
  author?: string;
  source?: string;
  title?: string;
  description?: string;
  promptZh?: string;
  promptEn?: string;
  categories?: string[];
  domain?: string;
  style?: string;
  subject?: string;
  featured?: boolean;
  needReferenceImages?: boolean;
  recommendedParams?: {
    size?: string;
    quality?: string;
    style?: string;
    count?: number;
  };
};

type ChatAgentTemplate = {
  id: string;
  category: string;
  title: LocalizedString;
  description: LocalizedString;
  personality: LocalizedString;
  systemPrompt: LocalizedString;
  starter?: LocalizedString;
};

type ChatSkillTemplate = {
  id: string;
  category: string;
  title: LocalizedString;
  description: LocalizedString;
  instruction: LocalizedString;
  examples: LocalizedString[];
  starter?: LocalizedString;
};

type MobileOAuthProvider = "google" | "github";

const PLACEHOLDER_BACKEND_RE =
  /^https?:\/\/api\.example\.com(?:[:/]|$)|^api\.example\.com(?:[:/]|$)/i;

const PAYMENT_RESULT_FALLBACK_URL = "https://www.jisudeng.com/payment/result";
const OAUTH_CALLBACK_PATH = "/auth/oauth/callback";
const NATIVE_PENDING_OAUTH_KEY = "jisudeng-native-pending-oauth";
const NATIVE_PENDING_OAUTH_PROVIDER_KEY =
  "jisudeng-native-pending-oauth-provider";
const GALLERY_PREF_STORAGE_KEY = "jisudengchat-gallery-preferences-v1";
const IMAGE_PREF_STORAGE_KEY = "jisudengchat-image-preferences-v1";
const CHAT_PREF_STORAGE_KEY = "jisudengchat-chat-preferences-v1";
const NATIVE_SHARE_DRAFT_KEY = "jisudengchat-native-share-draft-v1";
const MOBILE_REPORT_DRAFT_STORAGE_KEY = "jisudengchat-mobile-report-draft-v1";
const CRASH_LOG_STORAGE_KEY = "nextchat-mobile-crash-log";
const FEEDBACK_DRAFT_STORAGE_KEY = "nextchat-mobile-feedback-draft";
const DIAGNOSTICS_CURSOR_STORAGE_KEY = "jisudengchat-diagnostics-last-sent-v1";

const IMAGE_PROMPT_TEMPLATES: ImagePromptTemplate[] = [
  {
    id: "portrait-clean",
    category: "portrait",
    title: {
      cn: "干净商业头像",
      en: "Clean business portrait",
      jp: "クリーンなビジネスプロフィール",
      ko: "깔끔한 비즈니스 프로필",
    },
    description: {
      cn: "适合个人头像、简历、社媒形象。",
      en: "Good for profile, resume, and social avatar images.",
      jp: "プロフィール、履歴書、SNS アイコン向け。",
      ko: "프로필, 이력서, 소셜 아바타에 적합합니다.",
    },
    prompt: {
      cn: "一张高级商业头像，人物自然看向镜头，柔和自然光，干净浅色背景，真实摄影质感，皮肤细节自然，构图简洁，高级感，避免夸张滤镜和过度磨皮",
      en: "A refined business portrait, subject looking naturally at the camera, soft natural light, clean light background, realistic photographic texture, natural skin details, simple composition, premium feel, no heavy filters or over-smoothing",
      jp: "洗練されたビジネスプロフィール写真。人物は自然にカメラを見る。柔らかな自然光、明るく清潔な背景、リアルな写真質感、自然な肌のディテール、簡潔な構図、高級感。過度なフィルターや肌補正は避ける。",
      ko: "고급스러운 비즈니스 프로필 사진. 인물이 자연스럽게 카메라를 바라보고, 부드러운 자연광과 깨끗한 밝은 배경, 사실적인 사진 질감, 자연스러운 피부 디테일, 간결한 구도와 프리미엄 분위기. 과한 필터와 과도한 보정은 피합니다.",
    },
    params: {
      size: "1024x1024",
      quality: "high",
      style: "photographic",
      count: 1,
    },
  },
  {
    id: "product-ecommerce",
    category: "product",
    title: {
      cn: "电商产品主图",
      en: "E-commerce product hero",
      jp: "EC 商品メイン画像",
      ko: "커머스 상품 대표 이미지",
    },
    description: {
      cn: "突出产品主体，适合商品首图。",
      en: "Highlights the product for marketplace hero images.",
      jp: "商品を際立たせる、商品一覧・詳細のメイン画像向け。",
      ko: "상품을 돋보이게 하는 대표 이미지에 적합합니다.",
    },
    prompt: {
      cn: "电商产品主图，产品居中展示，白色或浅灰背景，专业棚拍灯光，边缘清晰，材质真实，干净阴影，突出卖点，画面高级，适合网店首图",
      en: "E-commerce product hero image, product centered, white or light gray background, professional studio lighting, crisp edges, realistic material, clean shadow, clear selling point, premium look for an online store",
      jp: "EC 商品のメイン画像。商品を中央に配置し、白または淡いグレーの背景、プロのスタジオ照明、シャープな輪郭、リアルな素材感、清潔な影、売りを強調した高級感のある画面。オンラインストアの主画像向け。",
      ko: "커머스 상품 대표 이미지. 상품을 중앙에 배치하고 흰색 또는 연한 회색 배경, 전문 스튜디오 조명, 선명한 가장자리, 사실적인 소재감, 깔끔한 그림자와 명확한 장점을 보여 주는 고급스러운 화면. 온라인 스토어 대표 이미지에 적합합니다.",
    },
    params: {
      size: "1536x1024",
      quality: "high",
      style: "photographic",
      count: 1,
    },
  },
  {
    id: "poster-launch",
    category: "poster",
    title: {
      cn: "新品发布海报",
      en: "Launch poster",
      jp: "新商品ローンチポスター",
      ko: "신제품 출시 포스터",
    },
    description: {
      cn: "适合新品、活动、促销海报底图。",
      en: "A base visual for launches, campaigns, and promos.",
      jp: "新商品、イベント、キャンペーンのポスター背景向け。",
      ko: "신제품, 이벤트, 프로모션 포스터 배경에 적합합니다.",
    },
    prompt: {
      cn: "新品发布海报视觉，中心留出标题区域，背景有层次但不杂乱，现代商业设计，高级光影，产品展示空间明确，适合添加中文标题和卖点文字",
      en: "New product launch poster visual, leave a clear central title area, layered but uncluttered background, modern commercial design, premium lighting, clear product display space, suitable for adding headline and selling points",
      jp: "新商品ローンチポスターのビジュアル。中央にタイトル領域を確保し、背景は奥行きがありながら散らからない。現代的な商業デザイン、高級感のある光と影、明確な商品表示スペース。見出しや訴求文を後から追加しやすい構図。",
      ko: "신제품 출시 포스터 비주얼. 중앙에 제목 영역을 확보하고, 배경은 레이어감이 있으면서도 복잡하지 않게 구성합니다. 현대적인 상업 디자인, 고급스러운 빛과 그림자, 명확한 상품 노출 공간을 두어 제목과 핵심 문구를 추가하기 쉽습니다.",
    },
    params: { size: "1024x1536", quality: "high", style: "vivid", count: 1 },
  },
  {
    id: "cover-short-video",
    category: "cover",
    title: {
      cn: "短视频封面",
      en: "Short video cover",
      jp: "ショート動画カバー",
      ko: "숏폼 영상 커버",
    },
    description: {
      cn: "适合小红书、抖音、视频号封面。",
      en: "For social short-video covers.",
      jp: "SNS やショート動画のカバー画像向け。",
      ko: "소셜/숏폼 영상 커버 이미지에 적합합니다.",
    },
    prompt: {
      cn: "短视频封面视觉，竖版构图，主体清晰，强视觉焦点，背景简洁有冲击力，预留大标题空间，适合添加醒目的中文标题，高清商业设计",
      en: "Vertical short-video cover visual, clear subject, strong focal point, simple impactful background, large title space reserved, suitable for bold headline text, high-resolution commercial design",
      jp: "ショート動画カバーの縦型ビジュアル。主体を明確にし、強い視覚的焦点を作る。背景は簡潔で印象的、大きなタイトル領域を確保。目立つ見出しを後から追加しやすい、高解像度の商業デザイン。",
      ko: "숏폼 영상 커버용 세로 비주얼. 주제가 선명하고 강한 시각적 초점이 있으며, 배경은 간결하지만 임팩트 있게 구성합니다. 큰 제목 영역을 남겨 눈에 띄는 문구를 추가하기 쉬운 고해상도 상업 디자인.",
    },
    params: { size: "1024x1792", quality: "high", style: "vivid", count: 1 },
  },
  {
    id: "interior-warm",
    category: "space",
    title: {
      cn: "温暖室内空间",
      en: "Warm interior space",
      jp: "温かみのある室内空間",
      ko: "따뜻한 실내 공간",
    },
    description: {
      cn: "适合装修、家居、民宿视觉。",
      en: "For interior, home, and hospitality visuals.",
      jp: "インテリア、住まい、宿泊施設のビジュアル向け。",
      ko: "인테리어, 홈, 숙박 공간 비주얼에 적합합니다.",
    },
    prompt: {
      cn: "温暖现代室内空间，真实摄影风格，自然采光，木质与织物材质细腻，空间整洁舒适，生活气息，高级家居杂志质感",
      en: "Warm modern interior space, realistic photography, natural daylight, refined wood and fabric textures, tidy and comfortable, lived-in atmosphere, premium home magazine look",
      jp: "温かみのあるモダンな室内空間。リアルな写真スタイル、自然光、繊細な木材と布の質感、整って快適な空間、暮らしの気配、高級インテリア雑誌のような質感。",
      ko: "따뜻하고 현대적인 실내 공간. 사실적인 사진 스타일, 자연 채광, 섬세한 목재와 패브릭 질감, 정돈되고 편안한 공간, 생활감과 고급 홈 매거진 같은 분위기.",
    },
    params: {
      size: "1536x1024",
      quality: "high",
      style: "photographic",
      count: 1,
    },
  },
  {
    id: "guofeng-illustration",
    category: "illustration",
    title: {
      cn: "国风插画",
      en: "Chinese-style illustration",
      jp: "中国風イラスト",
      ko: "중국풍 일러스트",
    },
    description: {
      cn: "适合头像、海报、节日视觉。",
      en: "For avatars, posters, and festival visuals.",
      jp: "アイコン、ポスター、季節イベントのビジュアル向け。",
      ko: "프로필, 포스터, 시즌/행사 비주얼에 적합합니다.",
    },
    prompt: {
      cn: "精致国风插画，东方美学，细腻线条，柔和色彩，云纹与山水元素，画面有留白，高级插画质感，适合中文主题设计",
      en: "Refined Chinese-style illustration, eastern aesthetics, delicate linework, soft colors, cloud and landscape elements, elegant negative space, premium illustration quality for Chinese-themed design",
      jp: "精緻な中国風イラスト。東洋美学、繊細な線、柔らかな色彩、雲文様と山水要素、余白のある構図、高級感のあるイラスト質感。中国風テーマのデザイン向け。",
      ko: "정교한 중국풍 일러스트. 동양적 미감, 섬세한 선, 부드러운 색감, 구름 무늬와 산수 요소, 여백이 있는 화면, 고급스러운 일러스트 질감. 중국풍 테마 디자인에 적합합니다.",
    },
    params: {
      size: "1024x1024",
      quality: "high",
      style: "digital-art",
      count: 1,
    },
  },
];

const CHAT_AGENT_TEMPLATES: ChatAgentTemplate[] = [
  {
    id: COLLABORATION_AGENT_ID,
    category: "collaboration",
    title: {
      cn: "多专家协作",
      en: "Multi-expert collaboration",
      jp: "複数専門家の協働",
      ko: "다중 전문가 협업",
    },
    description: {
      cn: "用产品、技术、运营、风控等多个视角共同拆解问题。",
      en: "Break down a task through product, engineering, operations, and risk perspectives.",
      jp: "プロダクト、技術、運用、リスク管理など複数の視点で課題を分解します。",
      ko: "제품, 기술, 운영, 리스크 관점으로 문제를 함께 분해합니다.",
    },
    personality: {
      cn: "多视角、先分工、再汇总",
      en: "Multi-perspective, structured, decisive",
      jp: "多角的、役割分担、最後に統合",
      ko: "다각도, 역할 분담, 최종 정리",
    },
    systemPrompt: {
      cn: "你是一个多专家协作组，但不要假装有后台多智能体编排。请在单次回答中模拟多个专业视角协同：产品专家负责用户场景和优先级，技术专家负责实现路径和风险，运营专家负责增长、留存和话术，风控/客服专家负责异常、投诉、合规和兜底。先用简短小节列出各专家判断，再汇总成可执行方案、优先级、验收标准和下一步。用户要求简单回答时保持简洁，不要为了展示协作而冗长。",
      en: "You are a multi-expert collaboration group, but do not pretend there is backend multi-agent orchestration. In one response, simulate coordinated expert perspectives: product for user scenarios and priority, engineering for implementation and risk, operations for growth and retention, and risk/support for edge cases, complaints, compliance, and fallback. Give brief expert judgments, then summarize an actionable plan, priority, acceptance criteria, and next steps. Stay concise when the user asks for a simple answer.",
    },
    starter: {
      cn: "请用多专家协作方式帮我分析：",
      en: "Analyze this with multi-expert collaboration:",
      jp: "複数専門家の協働方式で分析してください：",
      ko: "다중 전문가 협업 방식으로 분석해 주세요:",
    },
  },
  {
    id: "writing-editor",
    category: "writing",
    title: {
      cn: "写作润色专家",
      en: "Writing editor",
      jp: "文章校正エディター",
      ko: "글쓰기 다듬기 전문가",
    },
    description: {
      cn: "改写、润色、总结、标题优化。",
      en: "Rewrite, polish, summarize, and improve titles.",
      jp: "書き換え、校正、要約、タイトル改善。",
      ko: "문장 수정, 다듬기, 요약, 제목 개선.",
    },
    personality: {
      cn: "清晰、克制、有表达力",
      en: "Clear, restrained, expressive",
      jp: "明快、控えめ、表現力がある",
      ko: "명확하고 절제되며 표현력 있음",
    },
    systemPrompt: {
      cn: "你是写作润色专家。先判断用户要的是润色、改写、总结、扩写还是标题方案；保留原意和事实，去掉空话，增强结构、节奏和可读性。必要时给出 2-3 个不同风格版本，并说明差异。",
      en: "You are a writing editor. First infer whether the user needs polishing, rewriting, summarizing, expanding, or title ideas. Preserve intent and facts, remove filler, improve structure and readability, and offer 2-3 style variants when useful.",
    },
    starter: {
      cn: "把下面这段内容润色得更自然：",
      en: "Polish this text:",
      jp: "次の文章を自然に整えてください：",
      ko: "아래 문장을 더 자연스럽게 다듬어 주세요:",
    },
  },
  {
    id: "code-engineer",
    category: "code",
    title: {
      cn: "代码工程师",
      en: "Software engineer",
      jp: "ソフトウェアエンジニア",
      ko: "소프트웨어 엔지니어",
    },
    description: {
      cn: "排查报错、解释代码、生成实现方案。",
      en: "Debug errors, explain code, and plan implementations.",
      jp: "エラー調査、コード説明、実装計画の作成。",
      ko: "오류 분석, 코드 설명, 구현 계획 작성.",
    },
    personality: {
      cn: "严谨、直接、可执行",
      en: "Rigorous, direct, actionable",
      jp: "厳密、率直、実行可能",
      ko: "엄밀하고 직접적이며 실행 가능",
    },
    systemPrompt: {
      cn: "你是资深软件工程师。先定位问题本质和风险，再给最小可行修复、排查命令、代码示例和验证方法。遇到信息不足时明确假设；不要编造不存在的接口、日志或环境。",
      en: "You are a senior software engineer. Identify the core issue and risk first, then provide the smallest viable fix, diagnostic commands, code examples, and verification steps. State assumptions when context is missing; do not invent APIs, logs, or environments.",
    },
    starter: {
      cn: "帮我排查这个问题：",
      en: "Help me debug this issue:",
      jp: "この問題を調査してください：",
      ko: "이 문제를 디버그해 주세요:",
    },
  },
  {
    id: "code-reviewer",
    category: "code",
    title: {
      cn: "代码审查专家",
      en: "Code reviewer",
      jp: "コードレビュー専門家",
      ko: "코드 리뷰 전문가",
    },
    description: {
      cn: "找缺陷、回归风险和测试缺口。",
      en: "Find defects, regressions, and test gaps.",
      jp: "欠陥、回帰リスク、テスト不足を見つけます。",
      ko: "결함, 회귀 위험, 테스트 공백을 찾습니다.",
    },
    personality: {
      cn: "挑剔、证据优先",
      en: "Exacting, evidence-first",
      jp: "厳格、証拠優先",
      ko: "꼼꼼하고 증거 우선",
    },
    systemPrompt: {
      cn: "你是代码审查专家。优先指出会导致线上故障、数据错误、安全风险、性能退化或兼容性问题的缺陷。结论要按严重程度排序，并给出具体修复建议和需要补充的测试。没有发现问题时明确说明残余风险。",
      en: "You are a code reviewer. Prioritize issues that can cause production failures, data bugs, security risk, performance regressions, or compatibility problems. Order findings by severity, give concrete fixes and missing tests, and state residual risk when no issue is found.",
    },
    starter: {
      cn: "帮我审查这段改动：",
      en: "Review this change:",
      jp: "この変更をレビューしてください：",
      ko: "이 변경 사항을 리뷰해 주세요:",
    },
  },
  {
    id: "ops-growth",
    category: "operation",
    title: {
      cn: "运营策划专家",
      en: "Growth operator",
      jp: "グロース運用プランナー",
      ko: "성장 운영 기획자",
    },
    description: {
      cn: "活动、公告、用户反馈和增长方案。",
      en: "Campaigns, announcements, feedback, and growth plans.",
      jp: "キャンペーン、告知、ユーザーフィードバック、成長施策。",
      ko: "캠페인, 공지, 사용자 피드백, 성장 전략.",
    },
    personality: {
      cn: "目标导向、重执行",
      en: "Goal-oriented, execution-minded",
      jp: "目標志向、実行重視",
      ko: "목표 지향, 실행 중심",
    },
    systemPrompt: {
      cn: "你是运营策划专家。围绕目标用户、触达场景、转化路径、内容话术、活动规则、数据指标和执行排期输出方案。方案要能直接交给团队执行，避免泛泛而谈。",
      en: "You are a growth operator. Build plans around audience, touchpoints, conversion path, copy, campaign rules, metrics, and rollout schedule. Make the result directly executable, not generic.",
    },
    starter: {
      cn: "帮我设计一个运营方案：",
      en: "Design a growth plan for:",
      jp: "運用施策を設計してください：",
      ko: "운영/성장 방안을 설계해 주세요:",
    },
  },
  {
    id: "support-agent",
    category: "support",
    title: {
      cn: "客服回复专家",
      en: "Support agent",
      jp: "サポート返信専門家",
      ko: "고객지원 답변 전문가",
    },
    description: {
      cn: "生成耐心、清楚、能安抚用户的回复。",
      en: "Creates clear, calm support replies.",
      jp: "丁寧で分かりやすく、ユーザーを安心させる返信を作成します。",
      ko: "차분하고 명확하며 사용자를 안심시키는 답변을 만듭니다.",
    },
    personality: {
      cn: "耐心、负责、不推诿",
      en: "Patient, accountable, calm",
      jp: "丁寧、責任感、言い訳しない",
      ko: "인내심, 책임감, 회피하지 않음",
    },
    systemPrompt: {
      cn: "你是客服回复专家。先复述并确认用户问题，再给清楚步骤、预计处理时间、补偿或后续跟进方式。语气要真诚负责，不甩锅，不承诺无法保证的结果。",
      en: "You are a support agent. Acknowledge and restate the issue, then provide clear steps, expected handling time, compensation or follow-up when appropriate. Be sincere and accountable without overpromising.",
    },
    starter: {
      cn: "帮我回复这个用户反馈：",
      en: "Help me reply to this user:",
      jp: "このユーザーフィードバックへの返信を作ってください：",
      ko: "이 사용자 피드백에 대한 답변을 작성해 주세요:",
    },
  },
  {
    id: "product-manager",
    category: "product",
    title: {
      cn: "产品经理",
      en: "Product manager",
      jp: "プロダクトマネージャー",
      ko: "프로덕트 매니저",
    },
    description: {
      cn: "需求拆解、优先级、原型流程。",
      en: "Requirement breakdown, priority, and flows.",
      jp: "要件分解、優先順位、プロトタイプ導線。",
      ko: "요구사항 분해, 우선순위, 프로토타입 흐름.",
    },
    personality: {
      cn: "结构化、关注用户体验",
      en: "Structured, UX-aware",
      jp: "構造的、UX 重視",
      ko: "구조적, 사용자 경험 중심",
    },
    systemPrompt: {
      cn: "你是产品经理。把用户想法拆成目标、目标用户、核心场景、功能范围、交互流程、异常状态、验收标准、数据指标和迭代路线。遇到体验冲突时优先保护核心用户体验。",
      en: "You are a product manager. Break ideas into goals, target users, core scenarios, scope, interaction flow, failure states, acceptance criteria, metrics, and iteration path. When tradeoffs conflict, protect the core user experience.",
    },
    starter: {
      cn: "帮我拆解这个需求：",
      en: "Break down this requirement:",
      jp: "この要件を分解してください：",
      ko: "이 요구사항을 분해해 주세요:",
    },
  },
  {
    id: "prompt-architect",
    category: "ai",
    title: {
      cn: "提示词架构师",
      en: "Prompt architect",
      jp: "プロンプト設計者",
      ko: "프롬프트 설계자",
    },
    description: {
      cn: "智能体、人设、工作流提示词。",
      en: "Agent, persona, and workflow prompts.",
      jp: "エージェント、ペルソナ、ワークフロー用プロンプト。",
      ko: "에이전트, 페르소나, 워크플로 프롬프트.",
    },
    personality: {
      cn: "精准、可复用、重边界",
      en: "Precise, reusable, boundary-aware",
      jp: "正確、再利用可能、境界重視",
      ko: "정확하고 재사용 가능하며 경계가 명확함",
    },
    systemPrompt: {
      cn: "你是提示词架构师。根据任务目标设计可复用提示词，包含角色、目标、输入要求、工作步骤、输出格式、边界约束和失败处理。提示词要简洁但完整，并给出测试样例。",
      en: "You are a prompt architect. Design reusable prompts with role, objective, input requirements, workflow, output format, boundaries, and failure handling. Keep prompts concise but complete, and include test examples.",
    },
    starter: {
      cn: "帮我设计一个智能体提示词：",
      en: "Design an agent prompt for:",
      jp: "エージェント用プロンプトを設計してください：",
      ko: "에이전트 프롬프트를 설계해 주세요:",
    },
  },
  {
    id: "image-director",
    category: "ai",
    title: {
      cn: "生图导演",
      en: "Image director",
      jp: "画像生成ディレクター",
      ko: "이미지 생성 디렉터",
    },
    description: {
      cn: "把想法变成高质量生图提示词。",
      en: "Turn ideas into high-quality image prompts.",
      jp: "アイデアを高品質な画像生成プロンプトに変換します。",
      ko: "아이디어를 고품질 이미지 생성 프롬프트로 바꿉니다.",
    },
    personality: {
      cn: "审美明确、细节丰富",
      en: "Visual, specific, taste-led",
      jp: "美意識が明確、具体的、細部重視",
      ko: "미감이 분명하고 구체적이며 디테일 풍부",
    },
    systemPrompt: {
      cn: "你是生图导演。把用户想法转成可直接用于图像模型的提示词，明确主体、场景、构图、镜头、光线、材质、风格、色彩、比例和负面约束。默认输出中文提示词，可附英文版。",
      en: "You are an image director. Convert ideas into image-generation prompts with subject, scene, composition, camera, light, material, style, color, aspect ratio, and negative constraints. Default to the user's language and add English when helpful.",
    },
    starter: {
      cn: "帮我优化这个生图提示词：",
      en: "Improve this image prompt:",
      jp: "この画像生成プロンプトを改善してください：",
      ko: "이 이미지 생성 프롬프트를 개선해 주세요:",
    },
  },
  {
    id: "data-analyst",
    category: "analysis",
    title: {
      cn: "数据分析师",
      en: "Data analyst",
      jp: "データアナリスト",
      ko: "데이터 분석가",
    },
    description: {
      cn: "指标拆解、表格分析、结论提炼。",
      en: "Metrics, tables, and insight extraction.",
      jp: "指標分解、表分析、洞察抽出。",
      ko: "지표 분해, 표 분석, 인사이트 도출.",
    },
    personality: {
      cn: "客观、重证据",
      en: "Objective, evidence-led",
      jp: "客観的、証拠重視",
      ko: "객관적, 증거 중심",
    },
    systemPrompt: {
      cn: "你是数据分析师。先明确指标口径和样本范围，再做趋势、结构、异常和原因假设分析。输出结论、证据、可能原因、验证办法和下一步动作。不要把相关性说成因果。",
      en: "You are a data analyst. Clarify metric definitions and sample scope, then analyze trends, composition, anomalies, and hypotheses. Output conclusions, evidence, possible causes, validation steps, and next actions. Do not present correlation as causation.",
    },
    starter: {
      cn: "帮我分析这些数据：",
      en: "Analyze this data:",
      jp: "このデータを分析してください：",
      ko: "이 데이터를 분석해 주세요:",
    },
  },
  {
    id: "sre-operator",
    category: "operation",
    title: {
      cn: "运维排障专家",
      en: "SRE troubleshooter",
      jp: "SRE 障害対応専門家",
      ko: "SRE 장애 대응 전문가",
    },
    description: {
      cn: "服务异常、日志、监控和容量方案。",
      en: "Incidents, logs, monitoring, and capacity.",
      jp: "サービス障害、ログ、監視、キャパシティ設計。",
      ko: "서비스 장애, 로그, 모니터링, 용량 계획.",
    },
    personality: {
      cn: "冷静、分层排查",
      en: "Calm, layered diagnosis",
      jp: "冷静、段階的な切り分け",
      ko: "차분하고 단계적으로 진단",
    },
    systemPrompt: {
      cn: "你是运维排障专家。按现象、影响范围、最近变更、依赖链路、日志证据、临时止血、根因定位和长期改进来分析。优先保障可用性和数据安全。",
      en: "You are an SRE troubleshooter. Analyze symptoms, blast radius, recent changes, dependencies, logs, mitigation, root cause, and long-term improvements. Prioritize availability and data safety.",
    },
    starter: {
      cn: "帮我排查这个服务异常：",
      en: "Troubleshoot this incident:",
      jp: "このサービス障害を調査してください：",
      ko: "이 서비스 장애를 진단해 주세요:",
    },
  },
  {
    id: "finance-advisor",
    category: "business",
    title: {
      cn: "商业财务助手",
      en: "Business finance",
      jp: "ビジネス財務アシスタント",
      ko: "비즈니스 재무 도우미",
    },
    description: {
      cn: "定价、成本、毛利和套餐设计。",
      en: "Pricing, cost, margin, and plans.",
      jp: "価格、コスト、粗利、プラン設計。",
      ko: "가격, 비용, 마진, 요금제 설계.",
    },
    personality: {
      cn: "现实、算账清楚",
      en: "Practical, numbers-first",
      jp: "現実的、数字優先",
      ko: "현실적이고 숫자 중심",
    },
    systemPrompt: {
      cn: "你是商业财务助手。围绕成本结构、毛利、现金流、定价梯度、用户分层和风险假设做分析。输出可计算公式、示例表格和决策建议，提醒不确定参数。",
      en: "You are a business finance assistant. Analyze cost structure, margin, cash flow, pricing tiers, user segments, and risk assumptions. Provide formulas, example tables, decisions, and uncertain parameters.",
    },
    starter: {
      cn: "帮我算一下这个定价方案：",
      en: "Analyze this pricing plan:",
      jp: "この価格設計を分析してください：",
      ko: "이 가격 정책을 분석해 주세요:",
    },
  },
  {
    id: "translator",
    category: "translation",
    title: {
      cn: "中英翻译专家",
      en: "CN/EN translator",
      jp: "中英翻訳専門家",
      ko: "중영 번역 전문가",
    },
    description: {
      cn: "自然翻译、双语润色、跨境表达。",
      en: "Natural translation and bilingual polishing.",
      jp: "自然な翻訳、二言語校正、越境表現。",
      ko: "자연스러운 번역, 이중언어 다듬기, 글로벌 표현.",
    },
    personality: {
      cn: "自然、准确、懂语境",
      en: "Natural, accurate, contextual",
      jp: "自然、正確、文脈を理解",
      ko: "자연스럽고 정확하며 맥락을 이해",
    },
    systemPrompt: {
      cn: "你是中英翻译专家。根据语境自然翻译，不逐字硬翻，保留专业术语、品牌名、变量名和格式。用户未指定时，中文翻英文、英文翻中文；必要时给正式版和口语版。",
      en: "You are a Chinese-English translator. Translate naturally based on context, avoid literal phrasing, and preserve domain terms, brand names, variable names, and formatting. If direction is unspecified, translate Chinese to English and English to Chinese; include formal and conversational variants when useful.",
    },
    starter: {
      cn: "帮我翻译：",
      en: "Translate this:",
      jp: "これを翻訳してください：",
      ko: "이 내용을 번역해 주세요:",
    },
  },
  {
    id: "legal-reference",
    category: "legal",
    title: {
      cn: "法律参考助手",
      en: "Legal reference",
      jp: "法務参考アシスタント",
      ko: "법률 참고 도우미",
    },
    description: {
      cn: "合同、条款、风险点初步梳理。",
      en: "Initial review of contracts, terms, and risks.",
      jp: "契約、条項、リスク点の初期整理。",
      ko: "계약, 조항, 위험 요소를 1차로 정리합니다.",
    },
    personality: {
      cn: "谨慎、边界清楚",
      en: "Careful, boundary-clear",
      jp: "慎重、境界が明確",
      ko: "신중하고 경계가 명확함",
    },
    systemPrompt: {
      cn: "你是法律参考助手。帮助用户梳理条款含义、风险点、缺失条款、谈判建议和需要咨询律师的问题。必须说明内容仅供参考，不替代律师意见；不要给确定性法律结论。",
      en: "You are a legal reference assistant. Help identify clause meaning, risks, missing terms, negotiation points, and questions for a lawyer. Always state this is informational and not legal advice; avoid definitive legal conclusions.",
    },
    starter: {
      cn: "帮我看一下这段条款：",
      en: "Review this clause:",
      jp: "この条項を確認してください：",
      ko: "이 조항을 검토해 주세요:",
    },
  },
];

const CHAT_SKILL_TEMPLATES: ChatSkillTemplate[] = [
  {
    id: "document-summary",
    category: "document",
    title: {
      cn: "文档总结",
      en: "Document summary",
      jp: "文書要約",
      ko: "문서 요약",
    },
    description: {
      cn: "提炼长文、会议纪要、资料重点和待办。",
      en: "Extract key points, decisions, and todos from long text.",
      jp: "長文、会議メモ、資料から要点とタスクを抽出します。",
      ko: "긴 글, 회의록, 자료에서 핵심과 할 일을 추출합니다.",
    },
    instruction: {
      cn: "你正在使用“文档总结”技能。先识别文档主题、对象和上下文，再输出核心结论、关键证据、风险/疑问、待办事项和适合转发给团队的简短摘要。不要编造文档中不存在的信息。",
      en: "You are using the Document Summary skill. Identify topic, audience, and context, then output key conclusions, evidence, risks/questions, todos, and a concise team-ready summary. Do not invent facts absent from the document.",
    },
    examples: [
      {
        cn: "总结这份会议记录并列出待办",
        en: "Summarize this meeting note and list todos",
        jp: "この会議メモを要約してタスクを列挙してください",
        ko: "이 회의록을 요약하고 할 일을 정리해 주세요",
      },
    ],
    starter: {
      cn: "请总结下面这份文档：",
      en: "Summarize this document:",
      jp: "次の文書を要約してください：",
      ko: "아래 문서를 요약해 주세요:",
    },
  },
  {
    id: "webpage-summary",
    category: "document",
    title: {
      cn: "网页总结",
      en: "Webpage summary",
      jp: "Web ページ要約",
      ko: "웹페이지 요약",
    },
    description: {
      cn: "把链接、网页摘录整理成重点和行动建议。",
      en: "Turn links or webpage excerpts into key points and next actions.",
      jp: "リンクやページ抜粋を要点と次のアクションに整理します。",
      ko: "링크나 웹페이지 발췌를 핵심과 다음 행동으로 정리합니다.",
    },
    instruction: {
      cn: "你正在使用“网页总结”技能。根据用户提供的链接说明或网页摘录进行整理；无法访问外部网页时要明确说明需要用户粘贴正文。输出页面主题、关键信息、适合谁看、可执行建议和需要核实的点。",
      en: "You are using the Webpage Summary skill. Work from the user's link description or pasted excerpt. If you cannot access the page, ask for pasted content. Output topic, key information, target audience, actionable suggestions, and facts to verify.",
    },
    examples: [
      {
        cn: "总结这个网页适合我关注什么",
        en: "Summarize what matters from this webpage",
        jp: "このページで注目すべき点を要約してください",
        ko: "이 웹페이지에서 중요한 점을 요약해 주세요",
      },
    ],
    starter: {
      cn: "请总结这个网页/链接内容：",
      en: "Summarize this webpage/link:",
      jp: "この Web ページ/リンク内容を要約してください：",
      ko: "이 웹페이지/링크 내용을 요약해 주세요:",
    },
  },
  {
    id: "image-to-prompt",
    category: "image",
    title: {
      cn: "图片转提示词",
      en: "Image to prompt",
      jp: "画像からプロンプト",
      ko: "이미지를 프롬프트로",
    },
    description: {
      cn: "分析图片风格、主体、镜头和可复用生图 prompt。",
      en: "Analyze an image and produce reusable generation prompts.",
      jp: "画像のスタイル、主体、構図を分析し、再利用できる生成プロンプトにします。",
      ko: "이미지의 스타일, 주제, 구도를 분석해 재사용 가능한 생성 프롬프트로 만듭니다.",
    },
    instruction: {
      cn: "你正在使用“图片转提示词”技能。根据用户上传或描述的图片，拆解主体、场景、构图、镜头、光线、色彩、材质、风格、负面约束，并给出中文完整 prompt 和英文完整 prompt。不要声称看到了未提供的图片细节。",
      en: "You are using the Image to Prompt skill. From the uploaded or described image, break down subject, scene, composition, camera, lighting, color, material, style, negative constraints, then provide full Chinese and English prompts. Do not claim unseen details.",
    },
    examples: [
      {
        cn: "把这张图转成可复用生图提示词",
        en: "Turn this image into a reusable prompt",
        jp: "この画像を再利用できる画像生成プロンプトにしてください",
        ko: "이 이미지를 재사용 가능한 이미지 생성 프롬프트로 바꿔 주세요",
      },
    ],
    starter: {
      cn: "请把这张图/这个画面转成提示词：",
      en: "Turn this image/scene into a prompt:",
      jp: "この画像/シーンをプロンプトにしてください：",
      ko: "이 이미지/장면을 프롬프트로 바꿔 주세요:",
    },
  },
  {
    id: "prompt-polish",
    category: "image",
    title: {
      cn: "生图提示词优化",
      en: "Image prompt polish",
      jp: "画像プロンプト改善",
      ko: "이미지 프롬프트 개선",
    },
    description: {
      cn: "把简单想法扩写成完整、高质量、通用的生图提示词。",
      en: "Expand rough ideas into complete model-agnostic image prompts.",
      jp: "ラフなアイデアを、汎用的で高品質な画像生成プロンプトに広げます。",
      ko: "간단한 아이디어를 모델에 덜 종속적인 고품질 이미지 프롬프트로 확장합니다.",
    },
    instruction: {
      cn: "你正在使用“生图提示词优化”技能。保留用户原意，不绑定特定模型；补全主体、场景、构图、镜头、光线、色彩、材质、风格、比例、负面约束和参考图建议。输出中文 prompt、英文 prompt、推荐参数和可选变体。",
      en: "You are using the Image Prompt Polish skill. Preserve user intent and avoid binding to one model. Add subject, scene, composition, camera, lighting, color, material, style, ratio, negative constraints, and reference-image advice. Output Chinese prompt, English prompt, suggested parameters, and optional variants.",
    },
    examples: [
      {
        cn: "优化这个生图提示词，让它更完整",
        en: "Polish this image prompt",
        jp: "この画像プロンプトをより完成度高くしてください",
        ko: "이 이미지 프롬프트를 더 완성도 있게 다듬어 주세요",
      },
    ],
    starter: {
      cn: "请优化这个生图提示词：",
      en: "Polish this image prompt:",
      jp: "この画像プロンプトを改善してください：",
      ko: "이 이미지 프롬프트를 개선해 주세요:",
    },
  },
  {
    id: "ecommerce-copy",
    category: "business",
    title: {
      cn: "电商文案",
      en: "E-commerce copy",
      jp: "EC コピー",
      ko: "커머스 문구",
    },
    description: {
      cn: "生成商品标题、卖点、详情页结构和投放文案。",
      en: "Generate titles, selling points, product pages, and ad copy.",
      jp: "商品タイトル、訴求点、詳細ページ構成、広告コピーを作成します。",
      ko: "상품 제목, 판매 포인트, 상세 페이지 구조와 광고 문구를 생성합니다.",
    },
    instruction: {
      cn: "你正在使用“电商文案”技能。先确认商品、目标人群、平台和核心卖点；输出搜索友好标题、3-5 个主卖点、详情页结构、短视频/信息流文案和风险词提醒。不要夸大功效，不要写无法证明的绝对化承诺。",
      en: "You are using the E-commerce Copy skill. Clarify product, audience, platform, and key value. Output search-friendly titles, 3-5 selling points, detail-page structure, short-video/feed copy, and risky wording warnings. Avoid exaggerated claims and unverifiable absolutes.",
    },
    examples: [
      {
        cn: "帮我写这个商品的主图和详情页文案",
        en: "Write listing copy for this product",
        jp: "この商品のメイン画像と詳細ページコピーを書いてください",
        ko: "이 상품의 대표 이미지와 상세 페이지 문구를 작성해 주세요",
      },
    ],
    starter: {
      cn: "请为这个商品生成电商文案：",
      en: "Create e-commerce copy for this product:",
      jp: "この商品の EC コピーを作成してください：",
      ko: "이 상품의 커머스 문구를 작성해 주세요:",
    },
  },
  {
    id: "xiaohongshu-note",
    category: "marketing",
    title: {
      cn: "小红书笔记",
      en: "Social note",
      jp: "SNS 投稿ノート",
      ko: "소셜 노트",
    },
    description: {
      cn: "生成种草笔记、标题、封面文字和评论引导。",
      en: "Create social note posts, titles, cover text, and engagement hooks.",
      jp: "SNS 投稿、タイトル、カバー文言、コメント誘導を作成します。",
      ko: "소셜 게시글, 제목, 커버 문구와 댓글 유도 문장을 만듭니다.",
    },
    instruction: {
      cn: "你正在使用“小红书笔记”技能。根据用户目标输出 5 个标题、正文结构、口语化正文、封面文字建议、话题标签和评论区引导。语气自然可信，避免假体验、虚假背书和过度营销。",
      en: "You are using the Social Note skill. Output 5 titles, content structure, conversational body copy, cover-text ideas, hashtags, and comment prompts. Keep it natural and credible; avoid fake experience, false endorsement, and over-selling.",
    },
    examples: [
      {
        cn: "写一篇适合小红书的种草笔记",
        en: "Write a social recommendation note",
        jp: "SNS 向けのおすすめ投稿を書いてください",
        ko: "소셜 플랫폼에 맞는 추천 글을 써 주세요",
      },
    ],
    starter: {
      cn: "请写一篇小红书笔记：",
      en: "Write a social note:",
      jp: "SNS 投稿を書いてください：",
      ko: "소셜 노트를 작성해 주세요:",
    },
  },
  {
    id: "contract-review",
    category: "legal",
    title: {
      cn: "合同风险初筛",
      en: "Contract risk scan",
      jp: "契約リスク一次確認",
      ko: "계약 리스크 1차 점검",
    },
    description: {
      cn: "梳理合同重点、风险条款、缺失条款和谈判建议。",
      en: "Scan contract clauses, risks, missing terms, and negotiation points.",
      jp: "契約の要点、リスク条項、不足条項、交渉提案を整理します。",
      ko: "계약 핵심, 위험 조항, 누락 조항과 협상 제안을 정리합니다.",
    },
    instruction: {
      cn: "你正在使用“合同风险初筛”技能。内容仅供参考，不替代律师意见。按条款含义、风险等级、可能后果、建议修改、需补充信息输出；对无法判断的法律事实明确标注需专业确认。",
      en: "You are using the Contract Risk Scan skill. This is informational and not legal advice. Output clause meaning, risk level, possible consequence, suggested revision, and missing information. Mark legal uncertainties that require professional review.",
    },
    examples: [
      {
        cn: "帮我检查这份合同有哪些风险",
        en: "Scan this contract for risks",
        jp: "この契約のリスクを確認してください",
        ko: "이 계약의 위험 요소를 점검해 주세요",
      },
    ],
    starter: {
      cn: "请初步检查这份合同：",
      en: "Scan this contract:",
      jp: "この契約を一次確認してください：",
      ko: "이 계약을 1차로 검토해 주세요:",
    },
  },
  {
    id: "customer-reply",
    category: "support",
    title: {
      cn: "客服回复",
      en: "Support reply",
      jp: "サポート返信",
      ko: "고객지원 답변",
    },
    description: {
      cn: "把用户投诉、问题和售后情况转成清楚负责的回复。",
      en: "Turn complaints or issues into clear support replies.",
      jp: "苦情、問い合わせ、アフター対応を分かりやすく責任ある返信にします。",
      ko: "불만, 문의, 사후 처리 상황을 명확하고 책임감 있는 답변으로 바꿉니다.",
    },
    instruction: {
      cn: "你正在使用“客服回复”技能。先共情并复述问题，再给处理步骤、预计时间、补充信息要求和后续跟进方式。语气负责，不甩锅，不承诺无法保证的结果。",
      en: "You are using the Support Reply skill. Acknowledge and restate the issue, then provide steps, expected timing, requested details, and follow-up. Be accountable without overpromising.",
    },
    examples: [
      {
        cn: "帮我回复这个用户投诉",
        en: "Help me reply to this complaint",
        jp: "このユーザー苦情への返信を作ってください",
        ko: "이 사용자 불만에 대한 답변을 작성해 주세요",
      },
    ],
    starter: {
      cn: "请帮我回复这个用户：",
      en: "Help me reply to this user:",
      jp: "このユーザーへの返信を作ってください：",
      ko: "이 사용자에게 답변해 주세요:",
    },
  },
  {
    id: "code-debug",
    category: "code",
    title: {
      cn: "代码排错",
      en: "Code debugging",
      jp: "コードデバッグ",
      ko: "코드 디버깅",
    },
    description: {
      cn: "分析报错、定位原因、给修复步骤和验证命令。",
      en: "Analyze errors, locate causes, and provide fixes and verification.",
      jp: "エラーを分析し、原因、修正手順、検証コマンドを提示します。",
      ko: "오류를 분석하고 원인, 수정 단계, 검증 명령을 제공합니다.",
    },
    instruction: {
      cn: "你正在使用“代码排错”技能。先复述现象和环境，按最可能原因排序，给排查命令、最小修复、回归风险和验证步骤。缺少日志时明确需要哪些信息，不编造结果。",
      en: "You are using the Code Debugging skill. Restate symptoms and environment, rank likely causes, give diagnostic commands, minimal fix, regression risks, and verification. Ask for missing logs instead of inventing results.",
    },
    examples: [
      {
        cn: "帮我排查这段报错",
        en: "Debug this error",
        jp: "このエラーを調査してください",
        ko: "이 오류를 디버그해 주세요",
      },
    ],
    starter: {
      cn: "请帮我排查这个报错：",
      en: "Debug this error:",
      jp: "このエラーを調査してください：",
      ko: "이 오류를 디버그해 주세요:",
    },
  },
  {
    id: "study-plan",
    category: "education",
    title: {
      cn: "学习计划",
      en: "Study plan",
      jp: "学習計画",
      ko: "학습 계획",
    },
    description: {
      cn: "根据目标、基础和时间制定学习路径。",
      en: "Create a learning path from goals, baseline, and schedule.",
      jp: "目標、現在のレベル、時間に合わせて学習ルートを作ります。",
      ko: "목표, 현재 수준, 시간에 맞춘 학습 경로를 만듭니다.",
    },
    instruction: {
      cn: "你正在使用“学习计划”技能。先判断用户目标、基础、可投入时间和截止日期；输出阶段目标、每日/每周安排、练习任务、检查点和调整建议。计划要可执行，不堆砌资源。",
      en: "You are using the Study Plan skill. Identify goal, baseline, available time, and deadline. Output stages, daily/weekly schedule, practice tasks, checkpoints, and adjustment advice. Keep it executable, not resource-heavy.",
    },
    examples: [
      {
        cn: "给我制定一个 30 天学习计划",
        en: "Create a 30-day study plan",
        jp: "30 日間の学習計画を作ってください",
        ko: "30일 학습 계획을 만들어 주세요",
      },
    ],
    starter: {
      cn: "请给我制定学习计划：",
      en: "Create a study plan:",
      jp: "学習計画を作成してください：",
      ko: "학습 계획을 만들어 주세요:",
    },
  },
  {
    id: "meeting-minutes",
    category: "office",
    title: {
      cn: "会议纪要",
      en: "Meeting minutes",
      jp: "議事録",
      ko: "회의록",
    },
    description: {
      cn: "把会议内容整理成决策、待办、负责人和时间点。",
      en: "Convert meeting text into decisions, todos, owners, and dates.",
      jp: "会議内容を決定事項、タスク、担当者、期限に整理します。",
      ko: "회의 내용을 결정 사항, 할 일, 담당자, 일정으로 정리합니다.",
    },
    instruction: {
      cn: "你正在使用“会议纪要”技能。输出会议主题、参会角色、关键讨论、已确认决策、待办事项、负责人、截止时间和未决问题。未知负责人或时间要标注待确认。",
      en: "You are using the Meeting Minutes skill. Output topic, attendees/roles, key discussion, decisions, action items, owners, deadlines, and open questions. Mark unknown owners or dates as to-be-confirmed.",
    },
    examples: [
      {
        cn: "整理这段会议录音转写",
        en: "Organize this meeting transcript",
        jp: "この会議文字起こしを整理してください",
        ko: "이 회의 녹취록을 정리해 주세요",
      },
    ],
    starter: {
      cn: "请整理这段会议内容：",
      en: "Organize these meeting notes:",
      jp: "この会議内容を整理してください：",
      ko: "이 회의 내용을 정리해 주세요:",
    },
  },
  {
    id: "translation-localize",
    category: "translation",
    title: {
      cn: "翻译本地化",
      en: "Translation localization",
      jp: "翻訳とローカライズ",
      ko: "번역 및 현지화",
    },
    description: {
      cn: "中英互译、润色、适配平台语气和目标用户。",
      en: "Translate and localize tone for platform and audience.",
      jp: "翻訳、校正、媒体トーンと対象読者への調整。",
      ko: "번역, 다듬기, 플랫폼 톤과 대상 독자에 맞춘 현지화.",
    },
    instruction: {
      cn: "你正在使用“翻译本地化”技能。保留专有名词、变量、格式和事实；根据目标地区和平台调整语气。默认给自然版，如有必要再给正式版和口语版，并说明关键取舍。",
      en: "You are using the Translation Localization skill. Preserve names, variables, formatting, and facts; adapt tone to region and platform. Provide a natural version by default, plus formal and casual variants when useful, with key tradeoffs.",
    },
    examples: [
      {
        cn: "把这段中文翻译成自然英文",
        en: "Translate this into natural English",
        jp: "この文章を自然な英語に翻訳してください",
        ko: "이 문장을 자연스러운 영어로 번역해 주세요",
      },
    ],
    starter: {
      cn: "请翻译并本地化：",
      en: "Translate and localize:",
      jp: "翻訳してローカライズしてください：",
      ko: "번역하고 현지화해 주세요:",
    },
  },
];

const IMAGE_SIZE_OPTIONS = [
  { id: "1024x1024", tier: "1K", aspect: "1:1" },
  { id: "1536x1024", tier: "1.5K", aspect: "3:2" },
  { id: "1024x1536", tier: "1.5K", aspect: "2:3" },
  { id: "1792x1024", tier: "HD", aspect: "16:9" },
  { id: "1024x1792", tier: "HD", aspect: "9:16" },
  { id: "2048x2048", tier: "2K", aspect: "1:1" },
  { id: "3072x3072", tier: "3K", aspect: "1:1" },
  { id: "3840x2160", tier: "4K", aspect: "16:9" },
  { id: "2160x3840", tier: "4K", aspect: "9:16" },
  { id: "4096x4096", tier: "4K", aspect: "1:1" },
];
const MOBILE_FEEDBACK_CATEGORIES: MobileFeedbackCategory[] = [
  "ai_content_report",
  "bug",
  "experience",
  "image",
  "chat",
  "payment",
  "account",
  "account_deletion_request",
  "request",
  "other",
];

function fixedManagedBackendBaseUrl(config?: ClientBuildConfig) {
  const baseUrl = normalizeManagedBaseUrl(config?.managedBackendBaseUrl || "");
  if (!baseUrl || PLACEHOLDER_BACKEND_RE.test(baseUrl)) return "";
  return baseUrl;
}

function formatMoney(value?: number | string) {
  const numberValue =
    typeof value === "string" ? Number.parseFloat(value) : Number(value || 0);
  return `$${Number.isFinite(numberValue) ? numberValue.toFixed(2) : "0.00"}`;
}

function useMobileText() {
  const [locale, setLocale] = useState<ManagedMobileLocale>(() =>
    getManagedMobileLocale(),
  );
  useEffect(() => {
    const refresh = () => setLocale(getManagedMobileLocale());
    window.addEventListener("jisudeng:mobile-locale-change", refresh);
    return () =>
      window.removeEventListener("jisudeng:mobile-locale-change", refresh);
  }, []);
  useEffect(() => {
    document.documentElement.lang =
      locale === "cn"
        ? "zh-CN"
        : locale === "jp"
        ? "ja-JP"
        : locale === "ko"
        ? "ko-KR"
        : "en-US";
  }, [locale]);
  return useMemo(() => getManagedMobileText(locale), [locale]);
}

function mobileTextLocale(text: ManagedMobileText): ManagedMobileLocale {
  const locale = text.dateLocale.toLowerCase();
  if (locale.startsWith("zh")) return "cn";
  if (locale.startsWith("ja")) return "jp";
  if (locale.startsWith("ko")) return "ko";
  return "en";
}

function isChineseMobileText(text: ManagedMobileText) {
  return mobileTextLocale(text) === "cn";
}

function localizedValue(value: LocalizedString, text: ManagedMobileText) {
  const locale = mobileTextLocale(text);
  return value[locale] || value.en || value.cn;
}

function imagePromptText(
  template: ImagePromptTemplate,
  text: ManagedMobileText,
  mode: ImagePromptLanguageMode = "app",
) {
  const zh = template.prompt.cn;
  const en = template.prompt.en;
  if (mode === "zh") return zh;
  if (mode === "en") return en || zh;
  if (mode === "jp") return template.prompt.jp || en || zh;
  if (mode === "ko") return template.prompt.ko || en || zh;
  if (mode === "both") {
    const localized = localizedValue(template.prompt, text);
    const secondary = mobileTextLocale(text) === "en" ? zh : en;
    return [...new Set([localized, secondary].filter(Boolean))].join(
      "\n\n---\n\n",
    );
  }
  return localizedValue(template.prompt, text);
}

function normalizeImagePromptPayload(
  item: ImagePromptLibraryPayload,
): ImagePromptTemplate {
  const promptZh = String(item.promptZh || item.promptEn || "").trim();
  const promptEn = String(item.promptEn || item.promptZh || "").trim();
  return {
    id: item.id,
    category: item.domain || item.categories?.[0] || "featured",
    title: {
      cn: String(item.title || item.id),
      en: String(item.title || item.id),
    },
    description: {
      cn: String(item.description || ""),
      en: String(item.description || ""),
    },
    prompt: {
      cn: promptZh,
      en: promptEn,
    },
    author: item.author || "Jisudeng",
    source: item.source || "Jisudeng",
    categories: item.categories || [],
    domain: item.domain,
    style: item.style,
    subject: item.subject,
    featured: Boolean(item.featured),
    needReferenceImages: Boolean(item.needReferenceImages),
    params: {
      size: item.recommendedParams?.size,
      quality: item.recommendedParams?.quality,
      style: item.recommendedParams?.style,
      count: item.recommendedParams?.count,
    },
  };
}

function localPromptCatalogItemToImageTemplate(
  item: LocalPromptCatalogItem,
  coverUrl = "",
): ImagePromptTemplate {
  const prompt = String(item.prompt_text || "").trim();
  return {
    id: item.id,
    category: item.category || item.purpose || "featured",
    title: { cn: item.title, en: item.title },
    description: { cn: item.description, en: item.description },
    prompt: { cn: prompt, en: prompt },
    author: "Jisudeng",
    source: "Jisudeng creation space",
    categories: item.categories,
    domain: item.purpose,
    style: item.style,
    subject: item.subject,
    featured: item.featured,
    coverUrl: coverUrl || undefined,
    params: {},
  };
}

function localPromptCatalogCategoryToImageCategory(
  category: LocalPromptCatalog["categories"][number],
): ImagePromptCategory {
  return { id: category.id, label: category.label, axis: category.axis };
}

function fallbackImagePromptCategories(text: ManagedMobileText) {
  return [
    { id: "all", label: text.common.all },
    {
      id: "featured",
      label: localizedValue(
        { cn: "精选", en: "Featured", jp: "おすすめ", ko: "추천" },
        text,
      ),
    },
    {
      id: "favorites",
      label: localizedValue(
        { cn: "收藏", en: "Favorites", jp: "お気に入り", ko: "즐겨찾기" },
        text,
      ),
    },
    {
      id: "recent",
      label: localizedValue(
        { cn: "最近", en: "Recent", jp: "最近", ko: "최근" },
        text,
      ),
    },
    {
      id: "profile-avatar",
      label: localizedValue(
        { cn: "头像", en: "Profile", jp: "プロフィール", ko: "프로필" },
        text,
      ),
    },
    {
      id: "portrait",
      label: localizedValue(
        { cn: "人像", en: "Portrait", jp: "人物", ko: "인물" },
        text,
      ),
    },
    {
      id: "product",
      label: localizedValue(
        { cn: "产品", en: "Product", jp: "商品", ko: "상품" },
        text,
      ),
    },
    {
      id: "ecommerce",
      label: localizedValue(
        { cn: "电商", en: "E-commerce", jp: "EC", ko: "이커머스" },
        text,
      ),
    },
    {
      id: "poster",
      label: localizedValue(
        { cn: "海报", en: "Poster", jp: "ポスター", ko: "포스터" },
        text,
      ),
    },
    {
      id: "social-media",
      label: localizedValue(
        { cn: "社媒", en: "Social", jp: "SNS", ko: "소셜" },
        text,
      ),
    },
    {
      id: "education-infographic",
      label: localizedValue(
        { cn: "教育图解", en: "Infographic", jp: "図解", ko: "인포그래픽" },
        text,
      ),
    },
    { id: "ui-web", label: "UI/Web" },
    {
      id: "game-asset",
      label: localizedValue(
        { cn: "游戏资产", en: "Game asset", jp: "ゲーム素材", ko: "게임 에셋" },
        text,
      ),
    },
    {
      id: "comic-storyboard",
      label: localizedValue(
        { cn: "漫画分镜", en: "Storyboard", jp: "絵コンテ", ko: "스토리보드" },
        text,
      ),
    },
    {
      id: "photography",
      label: localizedValue(
        { cn: "摄影", en: "Photography", jp: "写真", ko: "사진" },
        text,
      ),
    },
    {
      id: "cinematic",
      label: localizedValue(
        { cn: "电影感", en: "Cinematic", jp: "シネマ風", ko: "시네마틱" },
        text,
      ),
    },
    {
      id: "illustration",
      label: localizedValue(
        { cn: "插画", en: "Illustration", jp: "イラスト", ko: "일러스트" },
        text,
      ),
    },
    {
      id: "chinese-style",
      label: localizedValue(
        { cn: "国风", en: "Chinese style", jp: "中国風", ko: "중국풍" },
        text,
      ),
    },
    {
      id: "watercolor",
      label: localizedValue(
        { cn: "水彩", en: "Watercolor", jp: "水彩", ko: "수채화" },
        text,
      ),
    },
    {
      id: "pixel-art",
      label: localizedValue(
        { cn: "像素", en: "Pixel art", jp: "ピクセル", ko: "픽셀 아트" },
        text,
      ),
    },
    { id: "3d-render", label: "3D" },
    {
      id: "architecture-interior",
      label: localizedValue(
        { cn: "建筑空间", en: "Architecture", jp: "建築空間", ko: "건축 공간" },
        text,
      ),
    },
    {
      id: "food-drink",
      label: localizedValue(
        { cn: "食物", en: "Food", jp: "フード", ko: "음식" },
        text,
      ),
    },
    {
      id: "fashion",
      label: localizedValue(
        { cn: "服装", en: "Fashion", jp: "ファッション", ko: "패션" },
        text,
      ),
    },
    {
      id: "typography",
      label: localizedValue(
        {
          cn: "字体排版",
          en: "Typography",
          jp: "タイポグラフィ",
          ko: "타이포그래피",
        },
        text,
      ),
    },
  ];
}

function formatSyncTime(ts: number, text: ManagedMobileText) {
  if (!ts) return text.notSynced;
  return new Date(ts).toLocaleTimeString(text.dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(
  value: number | string | undefined,
  text: ManagedMobileText,
) {
  if (!value) return text.notSynced;
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(text.dateLocale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sanitizeDiagnosticText(value: string) {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
    .replace(
      /([?&](?:access_token|api_key|authorization|key|token)=)[^&\s]*/gi,
      "$1[redacted]",
    )
    .slice(0, 1600);
}

function mobileNetworkDiagnosticLine() {
  if (typeof navigator === "undefined") return "network=unknown";
  const connection = (navigator as any).connection || {};
  return [
    `online=${navigator.onLine}`,
    connection.effectiveType ? `type=${connection.effectiveType}` : "",
    Number.isFinite(connection.downlink)
      ? `downlink=${connection.downlink}`
      : "",
    Number.isFinite(connection.rtt) ? `rtt=${connection.rtt}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function isBrokenTitle(value?: string) {
  const title = (value || "").trim();
  if (!title) return false;
  const questionMarks = (title.match(/\?/g) || []).length;
  return questionMarks >= 3 && questionMarks / title.length > 0.5;
}

function chatSessionDisplayTitle(
  session: ManagedMobileChatSession,
  text: ManagedMobileText,
) {
  if (session.title && !isBrokenTitle(session.title)) return session.title;
  const firstUser = session.messages.find(
    (message) => message.role === "user" && message.content.trim(),
  );
  const fallback = firstUser?.content.trim() || text.chat.unnamedSession;
  return fallback.slice(0, 28);
}

function resolveAndroidUrl(url: string, config?: ClientBuildConfig) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (!config?.nextchatWebUrl) return url;

  try {
    return new URL(url, config.nextchatWebUrl).toString();
  } catch {
    return url;
  }
}

function resolveWebUrl(path: string, config?: ClientBuildConfig) {
  const base = config?.nextchatWebUrl || window.location.origin;
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

function resolvePaymentReturnUrl(config?: ClientBuildConfig) {
  try {
    const url = new URL(resolveWebUrl("/payment/result", config));
    if (/^(www\.)?jisudeng\.com$/i.test(url.hostname)) {
      url.pathname = "/payment/result";
      url.hash = "";
      return url.toString();
    }
  } catch {
    // Fall through to the production website. Native Android has no browser origin.
  }
  return PAYMENT_RESULT_FALLBACK_URL;
}

function resolveMobileOAuthStartUrl(
  backendBaseUrl: string,
  provider: MobileOAuthProvider,
  options?: {
    redirect?: string;
    affCode?: string;
    promoCode?: string;
  },
) {
  const url = new URL(
    `/api/v1/auth/oauth/${provider}/start`,
    backendBaseUrl.endsWith("/") ? backendBaseUrl : `${backendBaseUrl}/`,
  );
  url.searchParams.set("redirect", options?.redirect || Path.Home);
  const affCode = options?.affCode?.trim();
  if (affCode) url.searchParams.set("aff_code", affCode);
  const promoCode = options?.promoCode?.trim();
  if (promoCode) url.searchParams.set("promo_code", promoCode);
  return url.toString();
}

function oauthProviderLabel(
  provider: MobileOAuthProvider,
  text: ManagedMobileText,
) {
  return provider === "google"
    ? text.login.providerGoogle
    : text.login.providerGitHub;
}

function readOAuthAuthResponseFromUrl(rawUrl: string): {
  auth?: ManagedAuthResponse;
  error?: string;
  pending?: boolean;
} {
  if (!rawUrl) return {};
  const url = new URL(rawUrl);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const params = new URLSearchParams(hash || url.search);
  const accessToken = params.get("access_token")?.trim() || "";
  if (!accessToken) {
    return {
      pending: true,
      error:
        params.get("error_message")?.trim() ||
        params.get("error_description")?.trim() ||
        params.get("error")?.trim() ||
        "",
    };
  }
  const refreshToken = params.get("refresh_token")?.trim() || "";
  const expiresIn = Number.parseInt(params.get("expires_in") || "", 10);
  const tokenType = params.get("token_type")?.trim() || "";
  return {
    auth: {
      access_token: accessToken,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      ...(Number.isFinite(expiresIn) && expiresIn > 0
        ? { expires_in: expiresIn }
        : {}),
      ...(tokenType ? { token_type: tokenType } : {}),
    },
  };
}

function shouldHandleNativeOAuthUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return url.pathname === OAUTH_CALLBACK_PATH;
  } catch {
    return false;
  }
}

function getAndroidManifestUrl(config?: ClientBuildConfig) {
  return resolveAndroidUrl(
    config?.androidManifestUrl || "/downloads/android-version.json",
    config,
  );
}

function manifestNotes(
  manifest: AndroidUpdateManifest | undefined,
  text: ManagedMobileText,
) {
  const localeKey = {
    cn: "zh-CN",
    en: "en",
    jp: "ja",
    ko: "ko",
  }[mobileTextLocale(text)] as "zh-CN" | "en" | "ja" | "ko";
  const raw =
    manifest?.notesByLocale?.[localeKey] ||
    manifest?.notes ||
    manifest?.releaseNotes ||
    [];
  if (Array.isArray(raw)) return raw;
  return raw
    .split(/[;\n；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function currentGroupName(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
  text: ManagedMobileText,
) {
  return (
    workspace?.managed_api_key?.group_name ||
    workspace?.models?.groups?.find((group) => group.is_current)?.name ||
    text.defaultGroup
  );
}

function currentGroupID(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
) {
  return (
    workspace?.managed_api_keys?.chat?.group_id ||
    workspace?.managed_api_key?.group_id ||
    workspace?.models?.groups?.find((group) => group.is_current)?.id ||
    workspace?.models?.groups?.[0]?.id
  );
}

function currentModels(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
) {
  const groupID = currentGroupID(workspace);
  return modelsForGroup(workspace, groupID);
}

function groupByID(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
  groupID?: number,
) {
  return (
    workspace?.models?.groups?.find((item) => item.id === groupID) ||
    workspace?.models?.groups?.find((item) => item.is_current) ||
    workspace?.models?.groups?.[0]
  );
}

function groupNameByID(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
  groupID: number | undefined,
  text: ManagedMobileText,
) {
  const group = groupByID(workspace, groupID);
  const name = localizedMobileDisplay(group, {
    defaultFields: ["name"],
    fallback: currentGroupName(workspace, text),
  });
  const normalized = name.replace(/\s+/g, "").toLowerCase();
  const systemLabels: Record<string, Record<ManagedMobileLocale, string>> = {
    国产分组: {
      cn: "国产分组",
      en: "Domestic models",
      jp: "国内モデル",
      ko: "국산 모델",
    },
    默认分组: {
      cn: "默认分组",
      en: "Default group",
      jp: "標準グループ",
      ko: "기본 그룹",
    },
  };
  return systemLabels[normalized]?.[getManagedMobileLocale()] || name;
}

function modelsForGroup(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
  groupID?: number,
) {
  const group =
    workspace?.models?.groups?.find((item) => item.id === groupID) ||
    workspace?.models?.groups?.find((item) => item.is_current) ||
    workspace?.models?.groups?.[0];
  return group?.models ?? [];
}

function modelValue(model?: ManagedWorkspaceModel) {
  return model?.name || model?.id || "";
}

function modelLabel(model?: ManagedWorkspaceModel) {
  return model?.display_name || model?.name || model?.id || "";
}

function currentChatModels(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
) {
  return currentModels(workspace).filter(isChatModel);
}

function chatModelsForGroup(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
  groupID?: number,
) {
  return modelsForGroup(workspace, groupID).filter(isChatModel);
}

function currentImageModels(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
) {
  return currentModels(workspace).filter(isImageModel);
}

function imageModelsForGroup(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
  groupID?: number,
) {
  return modelsForGroup(workspace, groupID).filter(isImageModel);
}

function imageModelSupportsStyle(model: string) {
  return /dall-e-3/i.test(model);
}

function imageModelSupportsReferences(
  model: ManagedWorkspaceModel | string,
  knownModels: ManagedWorkspaceModel[] = [],
  _allowLegacyFallback = false,
) {
  const workspaceModel =
    typeof model === "string"
      ? knownModels.find((item) => modelValue(item) === model)
      : model;
  const capabilities = workspaceModel?.image_capabilities;
  if (capabilities) {
    return (
      capabilities.operations?.includes("edit") === true &&
      Number(capabilities.max_reference_images || 0) > 0
    );
  }

  // Capability data is authoritative. An unknown model fails closed rather
  // than being guessed from a private alias or a provider name.
  return false;
}

function contentKitReferenceLimit(model?: ManagedWorkspaceModel) {
  return Math.max(
    0,
    Math.min(12, Number(model?.image_capabilities?.max_reference_images || 0)),
  );
}

function contentKitModelSupportsSize(
  model: ManagedWorkspaceModel | undefined,
  size: string,
) {
  const supported = model?.image_capabilities?.supported_sizes;
  return !supported?.length || supported.includes(size);
}

function firstReferenceImageModel(
  models: ManagedWorkspaceModel[],
  allowLegacyFallback = false,
) {
  return models.find((model) =>
    imageModelSupportsReferences(model, [], allowLegacyFallback),
  );
}

function imageSizeOptionsForModel(model: string) {
  const normalized = model.toLowerCase();
  if (/dall-e-3/.test(normalized)) {
    return IMAGE_SIZE_OPTIONS.filter((item) =>
      ["1024x1024", "1024x1792", "1792x1024"].includes(item.id),
    );
  }
  if (/gpt-image-(?!2)/.test(normalized)) {
    return IMAGE_SIZE_OPTIONS.filter((item) =>
      ["1024x1024", "1536x1024", "1024x1536"].includes(item.id),
    );
  }
  if (/grok-imagine|gemini|imagen/.test(normalized)) {
    return IMAGE_SIZE_OPTIONS.filter((item) =>
      [
        "1024x1024",
        "1536x1024",
        "1024x1536",
        "1792x1024",
        "1024x1792",
        "2048x2048",
      ].includes(item.id),
    );
  }
  if (/gpt-image-2/.test(normalized)) {
    return IMAGE_SIZE_OPTIONS.filter((item) => item.id !== "4096x4096");
  }
  return IMAGE_SIZE_OPTIONS;
}

function imageSizeLabel(
  option: (typeof IMAGE_SIZE_OPTIONS)[number],
  text: ManagedMobileText,
) {
  return text.image.sizeOption(
    option.tier,
    option.aspect,
    option.id.replace("x", "×"),
  );
}

function imageQualityOptionsForModel(model: string, text: ManagedMobileText) {
  const normalized = model.toLowerCase();
  if (/gpt-image-/.test(normalized)) {
    return [
      { id: "auto", title: text.image.qualityAuto },
      { id: "low", title: text.image.qualityLow },
      { id: "medium", title: text.image.qualityMedium },
      { id: "high", title: text.image.qualityHigh },
    ];
  }
  if (/dall-e-3/.test(normalized)) {
    return [
      { id: "auto", title: text.image.qualityAuto },
      { id: "standard", title: text.image.qualityStandard },
      { id: "hd", title: text.image.qualityHD },
    ];
  }
  if (/grok-imagine|agnes-image/.test(normalized)) {
    return [{ id: "auto", title: text.image.qualityAuto }];
  }
  return [
    { id: "auto", title: text.image.qualityAuto },
    { id: "standard", title: text.image.qualityStandard },
    { id: "hd", title: text.image.qualityHD },
    { id: "high", title: text.image.qualityHigh },
  ];
}

function isInformativeImageError(message: string) {
  const normalized = message.toLowerCase().trim();
  if (!normalized) return false;
  return !/^(bad gateway|service unavailable|upstream|temporarily unavailable|服务器暂时不可用|图片服务暂时繁忙)$/.test(
    normalized,
  );
}

function conciseImageGatewayReason(message: string) {
  const raw = message.trim();
  if (!raw) return "";
  try {
    const payload = JSON.parse(raw);
    if (payload && typeof payload === "object") {
      const parts = [
        payload.title,
        payload.detail,
        payload.instance ? `request ${payload.instance}` : "",
      ]
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => String(item).trim());
      if (parts.length)
        return Array.from(new Set(parts)).join(". ").slice(0, 360);
    }
  } catch {
    // Plain upstream messages are handled below.
  }
  return raw.replace(/\s+/g, " ").slice(0, 240);
}

function imageResults(item: any) {
  const results = Array.isArray(item?.results) ? item.results : [];
  return [...results, item?.img_data]
    .filter(Boolean)
    .filter((url, index, arr) => {
      return arr.indexOf(url) === index;
    });
}

function imageTaskStatusText(item: any, text: ManagedMobileText) {
  switch (item?.status) {
    case "queued":
      return text.image.statusQueued;
    case "running":
      return text.image.statusRunning;
    case "success":
      return text.image.statusSuccess;
    case "partial":
      return text.image.statusPartial;
    case "cancelled":
      return text.image.statusCancelled;
    case "error":
      return text.image.statusError;
    default:
      return text.common.empty;
  }
}

function imageTaskResultText(item: any, text: ManagedMobileText) {
  const done = imageResults(item).length;
  const total = Math.max(1, Number(item?.params?.n || done || 1));
  if (!done && item?.status !== "partial") return "";
  return text.image.resultCount(done, total);
}

function imageTaskSlots(item: any, text: ManagedMobileText) {
  const urls = imageResults(item);
  const storedItems = Array.isArray(item?.result_items)
    ? item.result_items
    : [];
  const total = Math.max(
    1,
    Number(item?.params?.n || storedItems.length || urls.length || 1),
  );
  return Array.from({ length: total }, (_, index) => {
    const stored = storedItems[index] || {};
    const url = stored.url || urls[index] || "";
    const status =
      stored.status ||
      (url
        ? "success"
        : item?.status === "error" || item?.status === "partial"
        ? "failed"
        : item?.status || "queued");
    const label =
      status === "success"
        ? text.image.statusSuccess
        : status === "failed"
        ? text.image.statusError
        : status === "running"
        ? text.image.statusRunning
        : status === "cancelled"
        ? text.image.statusCancelled
        : text.image.statusQueued;
    return {
      index,
      status,
      label,
      url,
      error: stored.error || (!url && status === "failed" ? item?.error : ""),
    };
  });
}

function bestImageGroup(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
) {
  return workspace?.models?.groups?.find((group) =>
    (group.models || []).some(isImageModel),
  );
}

function bestChatGroup(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
) {
  const groups = workspace?.models?.groups || [];
  return (
    groups.find(
      (group) => group.is_current && (group.models || []).some(isChatModel),
    ) || groups.find((group) => (group.models || []).some(isChatModel))
  );
}

function preferredChatGroupID(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
  storedGroupID?: number,
) {
  return resolveChatPreference(workspace, storedGroupID).groupId;
}

function storedChatGroupID(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
) {
  return resolveChatPreference(workspace).groupId;
}

function storedChatPreferenceGroupID() {
  return readChatPreference().groupId || 0;
}

function storedChatPreferenceModel(groupId?: number) {
  const preference = readChatPreference();
  if (groupId) {
    return rememberedMobileChatModel(preference, groupId);
  }
  return preference.model || "";
}

function persistChatPreference(groupId?: number, model = "") {
  writeStoredJSON(
    CHAT_PREF_STORAGE_KEY,
    updateMobileChatPreference(readChatPreference(), groupId, model),
  );
}

function readChatPreference() {
  return normalizeMobileChatPreference(
    readStoredJSON(CHAT_PREF_STORAGE_KEY, { groupId: 0, model: "" }),
  );
}

function resolveChatPreference(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
  preferredGroupId?: number,
  candidateModels: string[] = [],
) {
  return resolveMobileChatPreference({
    groups: workspace?.models?.groups,
    workspaceLoaded: Boolean(workspace),
    preference: readChatPreference(),
    preferredGroupId,
    candidateModels,
    isChatModel,
    modelValue,
  });
}

function stableChatGroupName(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
  text: ManagedMobileText,
) {
  return groupNameByID(workspace, storedChatGroupID(workspace), text);
}

function describeImageError(
  message: string,
  context: {
    text: ManagedMobileText;
    selectedModel?: string;
    imageModelCount: number;
    hasImageGroup: boolean;
    status?: number;
  },
) {
  if (!context.imageModelCount) {
    return context.hasImageGroup
      ? context.text.errors.noImageModelsInCurrentGroup
      : context.text.errors.noImageModels;
  }
  const normalized = (message || "").toLowerCase();
  if (/404|not found|model.*not.*found|model_not_found/.test(normalized)) {
    return context.text.errors.imageModelUnavailable(
      context.selectedModel || "",
    );
  }
  if (
    context.status === 401 ||
    context.status === 403 ||
    /forbidden|unauthorized|permission|quota|balance|insufficient|not allowed|无权限|余额不足/.test(
      normalized,
    )
  ) {
    return context.text.errors.imagePermissionOrBalance;
  }
  if (
    /n must be|n .*integer|n .*range|only.*one|only.*1|at most.*1|maximum.*1|multiple images|multiple outputs|too many images|一次.*多张|数量.*不支持/.test(
      normalized,
    )
  ) {
    return context.text.errors.imageCountUnsupported;
  }
  if (
    /unsupported.*size|invalid.*size|size.*not.*supported|resolution.*not.*supported|尺寸.*不支持|分辨率.*不支持/.test(
      normalized,
    )
  ) {
    return context.text.errors.imageSizeUnsupported(message);
  }
  if (
    context.status === 502 ||
    context.status === 503 ||
    /service unavailable|bad gateway|upstream|overloaded|retry_after|temporarily unavailable|服务器暂时不可用/.test(
      normalized,
    )
  ) {
    const reason = conciseImageGatewayReason(message);
    if (isInformativeImageError(reason)) {
      return context.text.errors.imageGatewayUnavailableWithReason(reason);
    }
    return context.text.errors.imageGatewayUnavailable;
  }
  if (/failed to fetch|network|timeout|timed out|网络/.test(normalized)) {
    return context.text.errors.networkFailed;
  }
  return message || context.text.image.generateFailed;
}

function makeImageFileName(prefix: string, id?: string, index = 0) {
  return `${prefix}-${id || Date.now()}-${index + 1}.png`;
}

function dataUrlToBlob(dataUrl: string) {
  const [header, payload = ""] = dataUrl.split(",", 2);
  const mime = header.match(/^data:([^;]+)/)?.[1] || "image/png";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function openAIImageData(json: any) {
  const candidates = [
    json?.data,
    json?.images,
    json?.result?.data,
    json?.result?.images,
    json?.output,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  if (json?.b64_json || json?.url || json?.image) return [json];
  return [];
}

async function persistContentKitImageResult(
  result: any,
  context: {
    taskId: string;
    prompt: string;
    model: string;
    ownerUserId: string;
    projectId: string;
    runId: string;
    shotId: string;
    kind: string;
    label: string;
    collectionId: string;
    overlay?: {
      brief: ContentWorkbenchBrief;
      shot: WorkbenchShotPlan;
    };
  },
) {
  let imageData = "";
  const source =
    typeof result === "string"
      ? result
      : result?.b64_json
      ? `data:image/png;base64,${result.b64_json}`
      : result?.image || result?.url || "";
  if (/^https?:\/\//i.test(source)) {
    imageData = await compressImage(
      await (await fetch(source)).blob(),
      1024 * 1024,
    );
  } else if (source) {
    imageData = source.startsWith("data:")
      ? source
      : `data:image/png;base64,${source}`;
  }
  if (!imageData) throw new Error("Image response did not contain an image.");
  if (context.overlay) {
    imageData = (
      await renderContentTextOverlay({
        imageDataUrl: imageData,
        brief: context.overlay.brief,
        shot: context.overlay.shot,
      })
    ).dataUrl;
  }
  const saved = await saveImageToAppStorage(
    imageData,
    makeImageFileName("content-kit", context.taskId),
    context,
  );
  return { url: saved.localUrl || imageData, fileName: saved.fileName || "" };
}

function imageLocalFileNames(item: any) {
  const names = [
    ...(Array.isArray(item?.local_files) ? item.local_files : []),
    ...(Array.isArray(item?.localFiles) ? item.localFiles : []),
    item?.local_file,
    item?.fileName,
  ]
    .map((value: any) =>
      typeof value === "string" ? value : value?.fileName || "",
    )
    .filter(Boolean);
  return Array.from(new Set(names));
}

function galleryItemPreferenceKey(item: any) {
  return imageLocalFileNames(item)[0] || String(item?.id || "");
}

function readGalleryPreferences(): GalleryPreferences {
  return readStoredJSON(GALLERY_PREF_STORAGE_KEY, {} as GalleryPreferences);
}

function writeGalleryPreferences(preferences: GalleryPreferences) {
  writeStoredJSON(GALLERY_PREF_STORAGE_KEY, preferences);
}

function accountStorageKey(key: string) {
  const state = useManagedNextChatStore.getState();
  const userId =
    state.user?.id || state.session?.user_id || state.workspace?.user?.id;
  return userId ? `${key}:user:${userId}` : key;
}

function clearAccountScopedLocalStorage(userId: string) {
  if (typeof localStorage === "undefined") return;
  const owner = String(userId || "").trim();
  if (!owner) return;
  const suffix = `:user:${owner}`;
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.endsWith(suffix)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

function readStoredJSON<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const scopedKey = accountStorageKey(key);
    let raw = localStorage.getItem(scopedKey);
    if (raw === null && scopedKey !== key) {
      raw = localStorage.getItem(key);
      if (raw !== null) {
        localStorage.setItem(scopedKey, raw);
        localStorage.removeItem(key);
      }
    }
    const parsed = JSON.parse(raw || "null");
    if (fallback === null) return (parsed ?? fallback) as T;
    if (Array.isArray(fallback)) {
      return (Array.isArray(parsed) ? parsed : fallback) as T;
    }
    return {
      ...(fallback as Record<string, unknown>),
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    } as T;
  } catch {
    return fallback;
  }
}

function writeStoredJSON(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(accountStorageKey(key), JSON.stringify(value));
}

function readWebOpenMode(): WebOpenMode {
  if (typeof localStorage === "undefined") return "in_app";
  const value = localStorage.getItem(WEB_OPEN_MODE_STORAGE_KEY);
  return value === "external" ? "external" : "in_app";
}

function writeWebOpenMode(value: WebOpenMode) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(WEB_OPEN_MODE_STORAGE_KEY, value);
}

function galleryItemPreference(item: any, preferences: GalleryPreferences) {
  return preferences[galleryItemPreferenceKey(item)] || {};
}

function galleryItemPreferenceKeys(item: any) {
  if (Array.isArray(item?.preferenceKeys) && item.preferenceKeys.length) {
    return item.preferenceKeys.filter(Boolean);
  }
  const key = galleryItemPreferenceKey(item);
  return key ? [key] : [];
}

function galleryItemMatchesFilter(
  item: any,
  filter: GalleryFilter,
  preferences: GalleryPreferences,
) {
  if (filter === "all") return true;
  const preference = galleryItemPreference(item, preferences);
  if (filter === "favorites") return Boolean(preference.favorite);
  return preference.category === filter;
}

function nativeImageAsDrawItem(image: NativeAppImage) {
  return {
    id: `native-${image.fileName}`,
    status: "success",
    progress: 100,
    model: image.model || "",
    model_name: image.model || "JisudengChat",
    img_data: image.localUrl,
    results: [image.localUrl],
    local_files: [image.fileName],
    params: {
      prompt: image.prompt || image.fileName,
    },
    created_at: image.createdAt || image.updatedAt || Date.now(),
    updated_at: image.updatedAt || image.createdAt || Date.now(),
    nativeOnly: true,
    nativeMetadata: image,
    projectId: image.projectId || "",
    runId: image.runId || "",
    shotId: image.shotId || "",
    kind: image.kind || "",
    label: image.label || "",
    collectionId: image.collectionId || "",
  };
}

function nativeImageCollectionKey(image: NativeAppImage) {
  const collectionId = String(image.collectionId || "").trim();
  if (collectionId) return `collection:${collectionId}`;
  const projectId = String(image.projectId || "").trim();
  if (projectId) return `project:${projectId}`;
  const taskId = String(image.id || "").trim();
  if (taskId) return `task:${taskId}`;
  return `file:${image.fileName}`;
}

function nativeImageCollectionItem(
  collectionKey: string,
  images: NativeAppImage[],
) {
  const ordered = images
    .slice()
    .sort(
      (left, right) =>
        Number(right.updatedAt || right.createdAt || 0) -
        Number(left.updatedAt || left.createdAt || 0),
    );
  const primary = ordered[0];
  const isProject = Boolean(primary?.projectId || primary?.collectionId);
  return {
    ...nativeImageAsDrawItem(primary),
    id: `native-${collectionKey}`,
    img_data: primary.localUrl,
    results: ordered.map((image) => image.localUrl),
    local_files: ordered.map((image) => image.fileName),
    params: {
      prompt: primary.label || primary.prompt || primary.fileName,
    },
    created_at: Math.min(
      ...ordered.map((image) =>
        Number(image.createdAt || image.updatedAt || Date.now()),
      ),
    ),
    updated_at: Math.max(
      ...ordered.map((image) =>
        Number(image.updatedAt || image.createdAt || Date.now()),
      ),
    ),
    nativeImages: ordered,
    nativeOnly: true,
    contentProject: isProject,
  };
}

function localizedOrderStatus(status: string, text: ManagedMobileText) {
  const key = String(status || "")
    .toLowerCase()
    .trim();
  const labelsByLocale: Record<ManagedMobileLocale, Record<string, string>> = {
    cn: {
      pending: "待支付",
      created: "待支付",
      unpaid: "待支付",
      waiting: "等待支付",
      processing: "处理中",
      paid: "已支付",
      success: "已支付",
      payment_success: "已支付",
      paid_success: "已支付",
      completed: "已完成",
      failed: "已失败",
      cancelled: "已取消",
      canceled: "已取消",
      closed: "已关闭",
      expired: "已过期",
      refunded: "已退款",
      refund_success: "已退款",
      refunded_success: "已退款",
      refunding: "退款中",
      refund_failed: "退款失败",
    },
    en: {
      pending: "Pending",
      created: "Pending",
      unpaid: "Pending",
      waiting: "Waiting",
      processing: "Processing",
      paid: "Paid",
      success: "Paid",
      payment_success: "Paid",
      paid_success: "Paid",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
      canceled: "Cancelled",
      closed: "Closed",
      expired: "Expired",
      refunded: "Refunded",
      refund_success: "Refunded",
      refunded_success: "Refunded",
      refunding: "Refunding",
      refund_failed: "Refund failed",
    },
    jp: {
      pending: "支払い待ち",
      created: "支払い待ち",
      unpaid: "支払い待ち",
      waiting: "支払い待ち",
      processing: "処理中",
      paid: "支払い済み",
      success: "支払い済み",
      payment_success: "支払い済み",
      paid_success: "支払い済み",
      completed: "完了",
      failed: "失敗",
      cancelled: "キャンセル済み",
      canceled: "キャンセル済み",
      closed: "クローズ済み",
      expired: "期限切れ",
      refunded: "返金済み",
      refund_success: "返金済み",
      refunded_success: "返金済み",
      refunding: "返金中",
      refund_failed: "返金失敗",
    },
    ko: {
      pending: "결제 대기",
      created: "결제 대기",
      unpaid: "결제 대기",
      waiting: "결제 대기",
      processing: "처리 중",
      paid: "결제 완료",
      success: "결제 완료",
      payment_success: "결제 완료",
      paid_success: "결제 완료",
      completed: "완료",
      failed: "실패",
      cancelled: "취소됨",
      canceled: "취소됨",
      closed: "닫힘",
      expired: "만료됨",
      refunded: "환불됨",
      refund_success: "환불됨",
      refunded_success: "환불됨",
      refunding: "환불 중",
      refund_failed: "환불 실패",
    },
  };
  const labels = labelsByLocale[mobileTextLocale(text)] || labelsByLocale.en;
  if (labels[key]) return labels[key];
  if (!key) return "-";
  return localizedValue(
    {
      cn: "订单状态待同步",
      en: "Order status unavailable",
      jp: "注文状態は未同期です",
      ko: "주문 상태가 아직 동기화되지 않았습니다",
    },
    text,
  );
}

function localizedPaymentType(type: string, text: ManagedMobileText) {
  return paymentMethodLabel({ payment_type: type }, text);
}

function localizedOrderTitle(order: any, text: ManagedMobileText) {
  const raw = String(
    order?.order_type ||
      order?.type ||
      order?.product_type ||
      order?.payment_type ||
      "",
  )
    .trim()
    .toLowerCase();
  const productName = String(order?.product_name || "").trim();
  if (
    productName &&
    !/^(balance|recharge|subscription|plan|package|redeem|coupon)$/i.test(
      productName,
    )
  ) {
    return productName;
  }
  const labels: Record<string, string> = {
    balance: text.account.orderRecharge,
    recharge: text.account.orderRecharge,
    topup: text.account.orderRecharge,
    subscription: text.account.orderPackage,
    plan: text.account.orderPackage,
    package: text.account.orderPackage,
    redeem: text.account.orderRedeem,
    coupon: text.account.orderCoupon,
  };
  return labels[raw] || localizedPaymentType(raw, text) || text.account.orders;
}

function localizedTransactionReason(item: any, text: ManagedMobileText) {
  const description = String(
    item?.reason || item?.description || item?.remark || "",
  ).trim();
  if (description && !/^[a-z0-9_.:-]+$/i.test(description)) {
    return description;
  }
  const raw = String(
    item?.source_type || item?.sourceType || item?.source || item?.type || "",
  )
    .toLowerCase()
    .trim();
  const combined = `${raw} ${description}`.toLowerCase();
  if (/reason|thinking|deep/.test(combined)) {
    return localizedValue(
      {
        cn: "深度思考扣除",
        en: "Reasoning usage",
        jp: "推論使用量",
        ko: "추론 사용량",
      },
      text,
    );
  }
  if (/image|draw|poster|batch_image/.test(combined)) {
    return localizedValue(
      {
        cn: "生图扣除",
        en: "Image generation",
        jp: "画像生成",
        ko: "이미지 생성",
      },
      text,
    );
  }
  const labelsByLocale: Record<ManagedMobileLocale, Record<string, string>> = {
    cn: {
      recharge: "充值到账",
      payment_recharge: "充值到账",
      payment_balance: "充值到账",
      redeem: "兑换到账",
      redeem_code: "兑换码到账",
      usage: "API 扣除",
      usage_charge: "API 扣除",
      usage_log: "API 扣除",
      api_usage: "API 扣除",
      refund: "退款/退回",
      payment_refund: "退款到账",
      admin_adjustment: "管理员调整",
      admin_balance: "管理员调整",
      promotion: "活动赠送",
      promo_bonus: "活动赠送",
      promo_code: "优惠码赠送",
      subscription: "套餐购买",
      subscription_refund: "套餐退款",
      user_subscription: "套餐权益",
      gift: "赠送余额",
      withdrawal: "提现",
      team_reward: "团队奖励",
      arena_reward: "玩法奖励",
      checkin: "签到奖励",
      quiz: "答题奖励",
      blind_box: "盲盒奖励",
      affiliate: "推广奖励",
      image_task: "生图扣除",
    },
    en: {
      recharge: "Recharge credited",
      payment_recharge: "Recharge credited",
      payment_balance: "Recharge credited",
      redeem: "Redeem credited",
      redeem_code: "Redeem code credited",
      usage: "API usage",
      usage_charge: "API usage",
      usage_log: "API usage",
      api_usage: "API usage",
      refund: "Refund",
      payment_refund: "Payment refund",
      admin_adjustment: "Admin adjustment",
      admin_balance: "Admin adjustment",
      promotion: "Promotion",
      promo_bonus: "Promotion",
      promo_code: "Promo code",
      subscription: "Plan purchase",
      subscription_refund: "Plan refund",
      user_subscription: "Plan entitlement",
      gift: "Gift balance",
      withdrawal: "Withdrawal",
      team_reward: "Team reward",
      arena_reward: "Play reward",
      checkin: "Check-in reward",
      quiz: "Quiz reward",
      blind_box: "Blind box reward",
      affiliate: "Affiliate reward",
      image_task: "Image generation",
    },
    jp: {
      recharge: "チャージ反映",
      payment_recharge: "チャージ反映",
      payment_balance: "チャージ反映",
      redeem: "引換反映",
      redeem_code: "引換コード反映",
      usage: "API 使用量",
      usage_charge: "API 使用量",
      usage_log: "API 使用量",
      api_usage: "API 使用量",
      refund: "返金/戻入",
      payment_refund: "支払い返金",
      admin_adjustment: "管理者調整",
      admin_balance: "管理者調整",
      promotion: "キャンペーン付与",
      promo_bonus: "キャンペーン付与",
      promo_code: "プロモコード付与",
      subscription: "プラン購入",
      subscription_refund: "プラン返金",
      user_subscription: "プラン権益",
      gift: "ギフト残高",
      withdrawal: "出金",
      team_reward: "チーム報酬",
      arena_reward: "プレイ報酬",
      checkin: "チェックイン報酬",
      quiz: "クイズ報酬",
      blind_box: "ブラインドボックス報酬",
      affiliate: "紹介報酬",
      image_task: "画像生成",
    },
    ko: {
      recharge: "충전 반영",
      payment_recharge: "충전 반영",
      payment_balance: "충전 반영",
      redeem: "교환 반영",
      redeem_code: "교환 코드 반영",
      usage: "API 사용량",
      usage_charge: "API 사용량",
      usage_log: "API 사용량",
      api_usage: "API 사용량",
      refund: "환불/반환",
      payment_refund: "결제 환불",
      admin_adjustment: "관리자 조정",
      admin_balance: "관리자 조정",
      promotion: "캠페인 지급",
      promo_bonus: "캠페인 지급",
      promo_code: "프로모션 코드 지급",
      subscription: "플랜 구매",
      subscription_refund: "플랜 환불",
      user_subscription: "플랜 권한",
      gift: "선물 잔액",
      withdrawal: "출금",
      team_reward: "팀 보상",
      arena_reward: "플레이 보상",
      checkin: "출석 보상",
      quiz: "퀴즈 보상",
      blind_box: "블라인드박스 보상",
      affiliate: "추천 보상",
      image_task: "이미지 생성",
    },
  };
  const labels = labelsByLocale[mobileTextLocale(text)] || labelsByLocale.en;
  return (
    labels[raw] ||
    labels[String(item?.source || "").toLowerCase()] ||
    raw ||
    "-"
  );
}

function formatTransactionAmount(value: any) {
  const num = Number.parseFloat(String(value ?? "0"));
  if (!Number.isFinite(num)) return String(value ?? "-");
  const prefix = num > 0 ? "+" : "";
  return `${prefix}${formatMoney(num)}`;
}

function mergeGalleryItems(drawItems: any[], nativeImages: NativeAppImage[]) {
  const seen = new Set<string>();
  const merged: any[] = [];
  drawItems.forEach((item) => {
    imageResults(item).forEach((url) => seen.add(url));
    imageLocalFileNames(item).forEach((name) => seen.add(name));
    merged.push(item);
  });
  const nativeCollections = new Map<string, NativeAppImage[]>();
  nativeImages.forEach((image) => {
    if (seen.has(image.localUrl) || seen.has(image.fileName)) return;
    const key = nativeImageCollectionKey(image);
    nativeCollections.set(key, [...(nativeCollections.get(key) || []), image]);
  });
  nativeCollections.forEach((images, key) => {
    merged.push(nativeImageCollectionItem(key, images));
  });
  return merged.sort((left, right) => {
    const leftTime = Number(left.updated_at || left.created_at || 0);
    const rightTime = Number(right.updated_at || right.created_at || 0);
    return rightTime - leftTime;
  });
}

function mergeManualGalleryCollections(
  items: any[],
  preferences: GalleryPreferences,
) {
  const collections = new Map<string, any[]>();
  items.forEach((item) => {
    const collectionId = galleryItemPreference(item, preferences).collectionId;
    if (!collectionId) return;
    collections.set(collectionId, [
      ...(collections.get(collectionId) || []),
      item,
    ]);
  });
  const emitted = new Set<string>();
  return items.flatMap((item) => {
    const preference = galleryItemPreference(item, preferences);
    const collectionId = preference.collectionId;
    if (!collectionId) return [item];
    if (emitted.has(collectionId)) return [];
    emitted.add(collectionId);
    const members = collections.get(collectionId) || [item];
    const primary = members[0];
    const collectionName = preference.collectionName || primary.params?.prompt;
    return [
      {
        ...primary,
        id: `manual-collection-${collectionId}`,
        results: members.flatMap(imageResults),
        local_files: members.flatMap(imageLocalFileNames),
        params: { ...primary.params, prompt: collectionName },
        memberIds: members.flatMap((member) => member.memberIds || [member.id]),
        preferenceKeys: members.flatMap(galleryItemPreferenceKeys),
        manualCollectionId: collectionId,
        manualCollectionName: collectionName,
        created_at: Math.min(
          ...members.map((member) =>
            Number(member.created_at || member.updated_at || Date.now()),
          ),
        ),
        updated_at: Math.max(
          ...members.map((member) =>
            Number(member.updated_at || member.created_at || Date.now()),
          ),
        ),
      },
    ];
  });
}

function exportChatSessionText(
  session: ManagedMobileChatSession,
  text: ManagedMobileText,
) {
  const lines = [
    `JisudengChat ${text.chat.sessions}`,
    `title=${session.title || text.chat.unnamedSession}`,
    `model=${session.model || ""}`,
    `createdAt=${new Date(session.createdAt).toISOString()}`,
    `updatedAt=${new Date(session.updatedAt).toISOString()}`,
    "",
  ];
  session.messages.forEach((message) => {
    lines.push(
      `[${new Date(message.createdAt).toISOString()}] ${message.role}`,
    );
    if (message.content) lines.push(message.content);
    if (message.imageUrls?.length) {
      lines.push(text.chat.imageAttached(message.imageUrls.length));
    }
    if (message.error) lines.push(`error=${message.error}`);
    lines.push("");
  });
  return lines.join("\n");
}

function extractSupportLines(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, any>;
  const lines: string[] = [];
  const keys = [
    "email",
    "wechat",
    "work_wechat",
    "telegram",
    "qq",
    "phone",
    "url",
    "support_url",
    "online_service_url",
    "work_time",
    "hours",
    "custom_text",
    "description",
  ];
  keys.forEach((key) => {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) {
      lines.push(`${key}: ${raw.trim()}`);
    }
  });
  if (Array.isArray(record.entries)) {
    record.entries.forEach((entry) => {
      if (entry?.label && entry?.value) {
        lines.push(`${entry.label}: ${entry.value}`);
      }
    });
  }
  return lines.slice(0, 8);
}

async function managedJsonRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  accessToken?: string,
) {
  return managedApiJsonRequest<T>(baseUrl, path, init, accessToken);
}

async function managedAuthenticatedJsonRequest<T>(
  path: string,
  init: RequestInit = {},
) {
  return requestWithManagedAuth(({ baseUrl, accessToken }) =>
    managedApiJsonRequest<T>(baseUrl, path, init, accessToken),
  );
}

function localizedMobileErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ManagedApiError) {
    return error.message || fallback;
  }
  if (error instanceof ManagedTransportError) {
    return formatManagedMobileError({
      message: error.message,
      path: error.path,
      category: error.category,
      requestId: error.requestId,
    });
  }
  if (error instanceof Error && error.message) {
    return localizeManagedMobileError({ message: error.message });
  }
  return fallback;
}

async function managedFormDataRequest<T>(
  path: string,
  body: FormData,
  text: ManagedMobileText,
  options?: { requestId?: string; idempotencyKey?: string },
) {
  return requestWithManagedAuth(async ({ baseUrl, accessToken }) => {
    const requestId = options?.requestId || clientRequestID("multipart");
    const idempotencyKey = options?.idempotencyKey || requestId;
    const response = await managedRequestText(
      baseUrl,
      path,
      {
        method: "POST",
        body,
      },
      new Headers({
        Accept: "application/json",
        "Accept-Language": text.dateLocale,
        Authorization: `Bearer ${accessToken}`,
        "X-Request-ID": requestId,
        "X-Client-Request-ID": requestId,
        "Idempotency-Key": idempotencyKey,
      }),
    );
    const bodyText = response.text;
    const payload = bodyText
      ? (() => {
          try {
            return JSON.parse(bodyText) as {
              code?: number;
              message?: string;
              data?: T;
            };
          } catch {
            return null;
          }
        })()
      : null;
    if (!response.ok || !payload || payload.code !== 0) {
      const category = !response.ok ? "http" : "api";
      throw new ManagedApiError(
        formatManagedMobileError({
          message: payload?.message || bodyText,
          status: response.status,
          path,
          code: payload?.code,
          category,
          requestId: response.requestId,
        }),
        response.status,
        path,
        payload?.code,
        response.requestId,
        category,
      );
    }
    return payload.data as T;
  });
}

async function managedGatewayRequestText(
  baseUrl: string,
  path: string,
  init: RequestInit,
  accessToken: string,
  text: ManagedMobileText,
) {
  let lastError: unknown = null;
  const method = (init.method || "GET").toUpperCase();
  const requestHeaders = new Headers(init.headers);
  const requestId =
    requestHeaders.get("X-Request-ID") || clientRequestID("gateway");
  requestHeaders.set("X-Request-ID", requestId);
  const requestInit = { ...init, headers: requestHeaders };
  const retryable =
    method === "GET" ||
    method === "HEAD" ||
    requestHeaders.has("Idempotency-Key");
  const maxAttempts = retryable ? 3 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await managedGatewayRequestTextOnce(
        baseUrl,
        path,
        requestInit,
        accessToken,
        text,
      );
      if (!result.ok && result.status === 0) {
        throw new Error(result.text || "transport returned no HTTP status");
      }
      if (
        attempt + 1 < maxAttempts &&
        [408, 425, 502, 503, 504].includes(result.status)
      ) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      return { ...result, requestId };
    } catch (error) {
      lastError = error;
      if (
        requestInit.signal?.aborted ||
        !isManagedNetworkLikeError(error) ||
        attempt + 1 >= maxAttempts
      ) {
        if (error instanceof ManagedTransportError) throw error;
        const category = diagnosticCategory(error);
        const label =
          category === "timeout"
            ? text.errors.requestTimeout
            : category === "offline"
            ? text.errors.offline
            : text.errors.networkFailed;
        throw new ManagedTransportError(
          formatManagedMobileError({
            message: label,
            category,
            requestId,
          }),
          category,
          path,
          requestId,
          { cause: error },
        );
      }
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastError;
}

async function managedGatewayRequestTextOnce(
  baseUrl: string,
  path: string,
  init: RequestInit,
  accessToken: string,
  text: ManagedMobileText,
) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", text.dateLocale);
  }
  if (
    isDirectNativeStreamAvailable() &&
    (typeof init.body === "string" || !init.body)
  ) {
    let status = 0;
    const lines: string[] = [];
    const signal = init.signal;
    const nativeRequest = await startDirectNativeStreamRequest(
      {
        url: managedApiUrl(baseUrl, path),
        method: init.method || "GET",
        headers: Object.fromEntries(headers.entries()),
        body: typeof init.body === "string" ? init.body : undefined,
        connectTimeout: 15000,
        readTimeout: 180000,
      },
      {
        onStatus: (nextStatus) => {
          status = nextStatus;
        },
        onLine: (line) => lines.push(line),
      },
    );
    const cancel = () => nativeRequest.cancel().catch(() => {});
    if (signal?.aborted) {
      cancel();
      await nativeRequest.done.catch(() => {});
      throw new DOMException("Aborted", "AbortError");
    }
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      await nativeRequest.done;
      const result = {
        ok: status >= 200 && status < 300,
        status,
        text: lines.join("\n"),
      };
      if (!result.ok) {
        recordGatewayDiagnostic(path, {
          method: init.method,
          transport: "native",
          status,
        });
      }
      return result;
    } catch (error) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      recordGatewayDiagnostic(path, {
        method: init.method,
        transport: "native",
        status: status || undefined,
        error,
      });
      if (!status) {
        try {
          const fallback = await gatewayFetchText(
            baseUrl,
            path,
            init,
            accessToken,
            text,
          );
          recordGatewayDiagnostic(path, {
            method: init.method,
            transport: "web",
            status: fallback.status,
            recovered: fallback.ok,
          });
          return fallback;
        } catch (fallbackError) {
          recordGatewayDiagnostic(path, {
            method: init.method,
            transport: "web",
            error: fallbackError,
          });
        }
      }
      return {
        ok: false,
        status,
        text: error instanceof Error ? error.message : String(error || ""),
      };
    } finally {
      signal?.removeEventListener("abort", cancel);
    }
  }
  return managedRequestText(baseUrl, path, init, headers);
}

function recordGatewayDiagnostic(
  path: string,
  detail: {
    method?: string;
    transport: "native" | "web";
    status?: number;
    error?: unknown;
    recovered?: boolean;
  },
) {
  recordManagedRequestDiagnostic({
    at: Date.now(),
    method: (detail.method || "POST").toUpperCase(),
    path,
    transport: detail.transport,
    attempt: detail.transport === "native" ? 1 : 2,
    status: detail.status,
    category: detail.recovered
      ? "recovered"
      : detail.status
      ? "http"
      : diagnosticCategory(detail.error),
    message: detail.recovered
      ? "gateway request recovered with fallback transport"
      : detail.status
      ? `HTTP ${detail.status}`
      : diagnosticErrorMessage(detail.error),
  });
}

async function gatewayFetchText(
  baseUrl: string,
  path: string,
  init: RequestInit,
  accessToken: string,
  text: ManagedMobileText,
) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", text.dateLocale);
  }
  const response = await fetch(managedApiUrl(baseUrl, path), {
    ...init,
    headers,
    cache: "no-store",
  });
  const bodyText = await response.text().catch(() => "");
  return { ok: response.ok, status: response.status, text: bodyText };
}

function containsVisibleToolCallMarkup(value: string) {
  return /<\s*tool_(?:call|name)\b|<\s*param\b|<\/\s*tool_(?:call|name)\s*>|```json\s*\{\s*"tool_/i.test(
    value,
  );
}

function stripVisibleToolCallMarkup(value: string) {
  return value
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<tool_name>[\s\S]*?<\/tool_name>/gi, "")
    .replace(/<param\b[\s\S]*?<\/param>/gi, "")
    .replace(/```json\s*\{[\s\S]*?"tool_[\s\S]*?```\s*/gi, "")
    .trim();
}

async function readImageFiles(files: FileList | File[], limit = 6) {
  const selected = Array.from(files).slice(0, limit);
  const urls: string[] = [];
  for (const file of selected) {
    const localFile = normalizeLocalChatAttachmentBlob(file);
    let dataUrl: string;
    try {
      dataUrl = await compressImage(localFile, 1024 * 1024);
    } catch (error) {
      if (!isLocalChatImage(file) || file.size > 768 * 1024) {
        throw error;
      }
      dataUrl = await blobToDataUrl(localFile);
    }
    urls.push(dataUrl);
  }
  return urls;
}

function chatMessageContentForGateway(message: ManagedMobileChatMessage) {
  if (message.role !== "user" || !message.imageUrls?.length) {
    return message.content || "";
  }
  return [
    ...(message.content.trim()
      ? [{ type: "text", text: message.content.trim() }]
      : []),
    ...message.imageUrls.map((url) => ({
      type: "image_url",
      image_url: { url },
    })),
  ];
}

function extractChatContent(payload: any) {
  const choice = payload?.choices?.[0];
  return (
    choice?.delta?.content ||
    choice?.message?.content ||
    choice?.text ||
    payload?.message?.content ||
    ""
  );
}

function parseOpenAIError(
  responseText: string,
  status: number,
  path: string,
  requestId = "unknown",
) {
  let message = responseText;
  try {
    const json = JSON.parse(responseText);
    message =
      json?.error?.message || json?.message || json?.error || responseText;
    requestId =
      json?.request_id || json?.requestId || json?.instance || requestId;
  } catch {
    // Plain upstream responses still include the local request identifier.
  }
  return formatManagedMobileError({
    message,
    status,
    path,
    category: "http",
    requestId,
  });
}

function MobileLoading() {
  const text = useMobileText();
  return (
    <main className={styles["mobile-app"]}>
      <div className={styles["loading"]}>
        <BotIcon />
        <span>{text.loading}</span>
      </div>
    </main>
  );
}

function ThemeSwitch(props: { text: ManagedMobileText }) {
  const config = useAppConfig();
  const options = [
    { value: Theme.Auto, label: props.text.theme.auto },
    { value: Theme.Light, label: props.text.theme.light },
    { value: Theme.Dark, label: props.text.theme.dark },
  ];

  return (
    <div className={styles["theme-switch"]}>
      {options.map((option) => (
        <button
          key={option.value}
          className={clsx({
            [styles["active"]]: config.theme === option.value,
          })}
          onClick={() =>
            config.update((draft) => {
              draft.theme = option.value;
            })
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MobileLanguageSettings(props: { text: ManagedMobileText }) {
  const selectedLocale = mobileTextLocale(props.text);
  return (
    <div className={styles["language-settings"]}>
      <label htmlFor="managed-mobile-language">
        <strong>{props.text.account.appLanguage}</strong>
        <span>{props.text.account.appLanguageHint}</span>
      </label>
      <select
        id="managed-mobile-language"
        value={selectedLocale}
        onChange={(event) =>
          setManagedMobileLocale(event.target.value as ManagedMobileLocale)
        }
      >
        <option value="cn">{props.text.account.languageChinese}</option>
        <option value="en">{props.text.account.languageEnglish}</option>
        <option value="jp">{props.text.account.languageJapanese}</option>
        <option value="ko">{props.text.account.languageKorean}</option>
      </select>
      <button type="button" onClick={() => setManagedMobileLocale(null)}>
        {props.text.account.languageSystem}
      </button>
    </div>
  );
}

function IconButton(props: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={props.type || "button"}
      aria-label={props.label}
      title={props.label}
      className={clsx(styles["icon-button"], {
        [styles["active"]]: props.active,
        [styles["danger"]]: props.danger,
      })}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}

function useNativeBackHandler(enabled: boolean, onBack: () => void) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const handler = (event: Event) => {
      event.preventDefault();
      onBack();
    };
    window.addEventListener("jisudeng-native-back", handler);
    return () => window.removeEventListener("jisudeng-native-back", handler);
  }, [enabled, onBack]);
}

let lastNativeHomeBackAt = 0;

function handleNativeHomeBack(text: ManagedMobileText) {
  const now = Date.now();
  if (now - lastNativeHomeBackAt <= 2000) {
    lastNativeHomeBackAt = 0;
    void finishNativeApp();
    return;
  }
  lastNativeHomeBackAt = now;
  void showNativeToast(text.common.exitAppHint);
}

function useNativeDocumentScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    document.body.classList.add("mobile-document-scroll");
    document.documentElement.classList.add("mobile-document-scroll");
    return () => {
      document.body.classList.remove("mobile-document-scroll");
      document.documentElement.classList.remove("mobile-document-scroll");
    };
  }, [enabled]);
}

type AndroidTab = "home" | "chat" | "create" | "projects" | "account";

function AndroidBottomTabs(props: {
  active: AndroidTab;
  text: ManagedMobileText;
}) {
  const navigate = useNavigate();
  const tabs: Array<{
    id: AndroidTab;
    label: string;
    path: Path;
    icon: ReactNode;
  }> = [
    {
      id: "home",
      label: props.text.navigation.home,
      path: Path.Home,
      icon: <BotIcon />,
    },
    {
      id: "chat",
      label: props.text.navigation.chat,
      path: Path.Chat,
      icon: <ChatIcon />,
    },
    {
      id: "create",
      label: props.text.navigation.create,
      path: Path.Sd,
      icon: <SDIcon />,
    },
    {
      id: "projects",
      label: props.text.navigation.projects,
      path: Path.Projects,
      icon: <HistoryIcon />,
    },
    {
      id: "account",
      label: props.text.navigation.account,
      path: Path.Settings,
      icon: <SettingsIcon />,
    },
  ];

  return (
    <nav
      className={styles["bottom-tabs"]}
      aria-label="JisudengChat"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-label={tab.label}
          aria-current={props.active === tab.id ? "page" : undefined}
          aria-selected={props.active === tab.id}
          role="tab"
          className={clsx(styles["bottom-tab"], {
            [styles["active"]]: props.active === tab.id,
          })}
          onClick={() => navigate(tab.path)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function MobileConnectivityBanner(props: { text: ManagedMobileText }) {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    window.addEventListener("jisudeng-network-restored", markOnline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("jisudeng-network-restored", markOnline);
    };
  }, []);
  if (online) return null;
  return (
    <div
      className={styles["connectivity-banner"]}
      role="status"
      aria-live="assertive"
    >
      {props.text.errors.offline}
    </div>
  );
}

function AndroidAppShell(props: {
  active: AndroidTab;
  text: ManagedMobileText;
  children: ReactNode;
  documentScroll?: boolean;
}) {
  const usesDocumentScroll = props.documentScroll ?? props.active !== "chat";
  useNativeDocumentScroll(usesDocumentScroll);

  return (
    <main
      className={clsx(styles["mobile-app"], {
        [styles["native-page"]]: usesDocumentScroll,
      })}
    >
      <section className={styles["app-shell"]}>
        <MobileConnectivityBanner text={props.text} />
        <div className={styles["app-scroll"]}>{props.children}</div>
        <AndroidBottomTabs active={props.active} text={props.text} />
      </section>
    </main>
  );
}

function AndroidLogin() {
  const managed = useManagedNextChatStore();
  const text = useMobileText();
  const clientConfig = useMemo(() => getClientConfig(), []);
  const installedRelease = useInstalledAndroidReleaseVersion();
  const backendBaseUrl = useMemo(
    () => fixedManagedBackendBaseUrl(clientConfig),
    [clientConfig],
  );
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
    () => (resolveInviteReferral() ? "register" : "login"),
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [credentialSource, setCredentialSource] = useState<"manual" | "saved">(
    "manual",
  );
  const [rememberAccount, setRememberAccount] = useState(true);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [affiliateCode, setAffiliateCode] = useState(
    () => resolveInviteReferral()?.aff_code || "",
  );
  const [affiliateCampaign, setAffiliateCampaign] = useState(
    () => resolveInviteReferral()?.campaign_id || "",
  );
  const [affiliateToken, setAffiliateToken] = useState(
    () => resolveInviteReferral()?.token || "",
  );
  const [totpCode, setTotpCode] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<MobileOAuthProvider | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const configError = backendBaseUrl ? "" : text.errors.missingBackend;
  const busy = managed.loading || localLoading || Boolean(oauthBusy);

  useEffect(() => {
    if (backendBaseUrl && managed.backendBaseUrl !== backendBaseUrl) {
      managed.setBackendBaseUrl(backendBaseUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendBaseUrl, managed.backendBaseUrl]);

  useEffect(() => {
    const syncInviteReferral = () => {
      const referral = resolveInviteReferral();
      setAffiliateCode(referral?.aff_code || "");
      setAffiliateCampaign(referral?.campaign_id || "");
      setAffiliateToken(referral?.token || "");
      if (referral?.aff_code || referral?.token) setMode("register");
    };
    window.addEventListener(
      "jisudeng-invite-referral-updated",
      syncInviteReferral,
    );
    return () =>
      window.removeEventListener(
        "jisudeng-invite-referral-updated",
        syncInviteReferral,
      );
  }, []);

  useEffect(() => {
    void loadLoginCredentials()
      .then((credentials) => {
        if (!credentials.saved) return;
        setEmail(credentials.email || "");
        setPassword(credentials.password || "");
        setCredentialSource("saved");
        setRememberAccount(true);
      })
      .catch(() => undefined);
  }, []);

  async function finishOAuthLogin(auth: ManagedAuthResponse) {
    if (!backendBaseUrl) return;
    setError("");
    setMessage(text.login.oauthLoginSuccess);
    managed.setBackendBaseUrl(backendBaseUrl);
    managed.applyAuth(auth);
    await managed.bootstrap();
    const accessToken = useManagedNextChatStore.getState().accessToken;
    if (affiliateToken) {
      await attributeInviteCampaign(backendBaseUrl, accessToken, affiliateToken)
        .then(() => storeInviteReferral(null))
        .catch(() => undefined);
    }
    await reportInviteLifecycleEvent(
      backendBaseUrl,
      accessToken,
      "login",
      installedRelease.name,
      getInviteInstallationId(),
      {
        eventId: getStableInviteEventId(
          `oauth-login:${new Date().toISOString().slice(0, 10)}`,
        ),
        attributionToken: affiliateToken,
        metadata: { surface: "android_oauth" },
      },
    ).catch(() => undefined);
    navigate(Path.Home);
  }

  async function consumeOAuthCallbackUrl(rawUrl: string) {
    if (!backendBaseUrl || !shouldHandleNativeOAuthUrl(rawUrl)) return;
    const rawProvider = localStorage.getItem(NATIVE_PENDING_OAUTH_PROVIDER_KEY);
    const provider: MobileOAuthProvider =
      rawProvider === "github" ? "github" : "google";
    setOauthBusy(provider);
    try {
      const result = readOAuthAuthResponseFromUrl(rawUrl);
      if (result.auth) {
        await finishOAuthLogin(result.auth);
        return;
      }
      setMode("register");
      setMessage(text.login.oauthPendingRegistration);
      setError(result.error || text.login.oauthNoToken);
    } catch (err) {
      setError(localizedMobileErrorMessage(err, text.errors.loginFailed));
    } finally {
      localStorage.removeItem(NATIVE_PENDING_OAUTH_KEY);
      localStorage.removeItem(NATIVE_PENDING_OAUTH_PROVIDER_KEY);
      setOauthBusy("");
    }
  }

  useEffect(() => {
    const onOAuthDeepLink = (event: Event) => {
      const rawUrl = String((event as CustomEvent).detail?.url || "");
      if (!rawUrl) return;
      void consumeOAuthCallbackUrl(rawUrl);
    };
    try {
      const pending = localStorage.getItem(NATIVE_PENDING_OAUTH_KEY);
      if (pending) {
        const detail = JSON.parse(pending);
        const rawUrl = String(detail?.url || "");
        if (rawUrl) void consumeOAuthCallbackUrl(rawUrl);
      }
    } catch {
      localStorage.removeItem(NATIVE_PENDING_OAUTH_KEY);
    }
    window.addEventListener("jisudeng-oauth-callback", onOAuthDeepLink);
    return () =>
      window.removeEventListener("jisudeng-oauth-callback", onOAuthDeepLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendBaseUrl, affiliateToken, installedRelease.name, text]);

  async function startOAuthLogin(provider: MobileOAuthProvider) {
    if (!backendBaseUrl || busy) return;
    setOauthBusy(provider);
    setError("");
    setMessage(text.login.oauthOpening);
    let opened = false;
    try {
      const url = resolveMobileOAuthStartUrl(backendBaseUrl, provider, {
        redirect: Path.Home,
        affCode: affiliateCode || mobileAttributionAffiliateCode(),
        promoCode,
      });
      localStorage.setItem(NATIVE_PENDING_OAUTH_PROVIDER_KEY, provider);
      await openExternalUrl(url);
      opened = true;
      setMessage(text.login.oauthReturnHint);
    } catch (err) {
      localStorage.removeItem(NATIVE_PENDING_OAUTH_PROVIDER_KEY);
      setError(
        text.login.oauthFailed(
          oauthProviderLabel(provider, text),
          localizedMobileErrorMessage(err, text.errors.loginFailed),
        ),
      );
    } finally {
      setOauthBusy("");
      if (!opened) {
        localStorage.removeItem(NATIVE_PENDING_OAUTH_PROVIDER_KEY);
      }
    }
  }

  async function persistLoginChoice() {
    if (rememberAccount) {
      await saveLoginCredentials(email.trim(), password);
      return;
    }
    await clearLoginCredentials();
  }
  async function sendCode() {
    if (!backendBaseUrl || !email.trim()) return;
    setLocalLoading(true);
    setError("");
    setMessage("");
    try {
      await managedJsonRequest(
        backendBaseUrl,
        "/api/v1/auth/mobile/send-verify-code",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim() }),
          headers: { "Accept-Language": text.dateLocale },
        },
      );
      setMessage(text.login.codeSent);
    } catch (err) {
      setError(localizedMobileErrorMessage(err, text.errors.networkFailed));
    } finally {
      setLocalLoading(false);
    }
  }

  async function sendResetCode() {
    if (!backendBaseUrl || !email.trim()) return;
    setLocalLoading(true);
    setError("");
    setMessage("");
    try {
      await managedJsonRequest(
        backendBaseUrl,
        "/api/v1/auth/mobile/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim() }),
          headers: { "Accept-Language": text.dateLocale },
        },
      );
      setMessage(text.login.forgotSent);
      setMode("reset");
    } catch (err) {
      setError(localizedMobileErrorMessage(err, text.errors.networkFailed));
    } finally {
      setLocalLoading(false);
    }
  }

  async function submitTotpCode() {
    if (!backendBaseUrl || busy || totpCode.trim().length < 6) return;
    setError("");
    setMessage("");
    try {
      managed.setBackendBaseUrl(backendBaseUrl);
      await managed.login2FA(totpCode.trim());
      await persistLoginChoice().catch(() => undefined);
      setTotpCode("");
      navigate(Path.Home);
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeManagedMobileError({ message: err.message })
          : text.errors.verifyFailed,
      );
    }
  }

  useEffect(() => {
    if (!managed.pendingTotpToken) return;
    if (!/^\d{6}$/.test(totpCode.trim())) return;
    void submitTotpCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managed.pendingTotpToken, totpCode]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!backendBaseUrl) return;
    setError("");
    setMessage("");
    try {
      managed.setBackendBaseUrl(backendBaseUrl);
      if (managed.pendingTotpToken) {
        await submitTotpCode();
        return;
      }
      if (mode === "login") {
        const result = await managed.login(email, password, backendBaseUrl);
        if (!result.requires2FA) {
          const accessToken = useManagedNextChatStore.getState().accessToken;
          if (affiliateToken) {
            await attributeInviteCampaign(
              backendBaseUrl,
              accessToken,
              affiliateToken,
            ).catch(() => undefined);
          }
          await reportInviteLifecycleEvent(
            backendBaseUrl,
            accessToken,
            "login",
            installedRelease.name,
            getInviteInstallationId(),
            {
              eventId: getStableInviteEventId(
                `login:${new Date().toISOString().slice(0, 10)}`,
              ),
              attributionToken: affiliateToken,
            },
          ).catch(() => undefined);
          await persistLoginChoice().catch(() => undefined);
          navigate(Path.Home);
        }
        return;
      }
      if (mode === "register") {
        if (password !== confirmPassword) {
          setError(text.login.passwordMismatch);
          return;
        }
        setLocalLoading(true);
        const auth = await managedJsonRequest<any>(
          backendBaseUrl,
          "/api/v1/auth/mobile/register",
          {
            method: "POST",
            body: JSON.stringify({
              ...buildMobileRegistrationPayload({
                email,
                password,
                verifyCode,
                promoCode,
                invitationCode,
                referral:
                  affiliateCode || affiliateToken
                    ? {
                        ...(affiliateCode ? { aff_code: affiliateCode } : {}),
                        ...(affiliateCampaign
                          ? { campaign_id: affiliateCampaign }
                          : {}),
                        ...(affiliateToken ? { token: affiliateToken } : {}),
                        expires_at: Date.now() + 60_000,
                      }
                    : null,
              }),
              aff_code:
                affiliateCode ||
                mobileAttributionAffiliateCode() ||
                invitationCode.trim(),
              invite_token: affiliateToken || mobileAttributionToken(),
            }),
            headers: { "Accept-Language": text.dateLocale },
          },
        );
        managed.applyAuth(auth);
        let referralAttributed = !affiliateToken;
        if (affiliateToken) {
          referralAttributed = await attributeInviteCampaign(
            backendBaseUrl,
            auth.access_token,
            affiliateToken,
          )
            .then(() => true)
            .catch(() => false);
        }
        await reportInviteLifecycleEvent(
          backendBaseUrl,
          auth.access_token,
          "registered",
          installedRelease.name,
          getInviteInstallationId(),
          {
            eventId: getStableInviteEventId("registered"),
            attributionToken: affiliateToken,
          },
        ).catch(() => undefined);
        if (referralAttributed) storeInviteReferral(null);
        await managed.bootstrap();
        navigate(Path.Home);
        return;
      }
      if (mode === "forgot") {
        setLocalLoading(true);
        await managedJsonRequest(
          backendBaseUrl,
          "/api/v1/auth/mobile/forgot-password",
          {
            method: "POST",
            body: JSON.stringify({ email: email.trim() }),
            headers: { "Accept-Language": text.dateLocale },
          },
        );
        setMessage(text.login.forgotSent);
        setMode("reset");
        return;
      }
      if (mode === "reset") {
        if (password !== confirmPassword) {
          setError(text.login.passwordMismatch);
          return;
        }
        setLocalLoading(true);
        await managedJsonRequest(
          backendBaseUrl,
          "/api/v1/auth/mobile/reset-password",
          {
            method: "POST",
            body: JSON.stringify({
              email: email.trim(),
              verify_code: resetToken.trim(),
              new_password: password,
            }),
            headers: { "Accept-Language": text.dateLocale },
          },
        );
        setMessage(text.login.resetDone);
        setMode("login");
      }
    } catch (err) {
      const rawMessage =
        err instanceof ManagedApiError || err instanceof ManagedTransportError
          ? localizedMobileErrorMessage(
              err,
              mode === "login"
                ? text.errors.loginFailed
                : text.errors.networkFailed,
            )
          : err instanceof Error
          ? localizeManagedMobileError({ message: err.message })
          : mode === "login"
          ? text.errors.loginFailed
          : text.errors.networkFailed;
      const message =
        mode === "login" && err instanceof ManagedApiError && err.status === 401
          ? `${rawMessage} ${text.login.loginDiagnostic(
              password.length,
              credentialSource === "saved"
                ? text.login.savedCredentialSource
                : text.login.manualCredentialSource,
            )}`
          : rawMessage;
      setError(message);
    } finally {
      setLocalLoading(false);
    }
  }

  const submitDisabled =
    busy ||
    !backendBaseUrl ||
    (!managed.pendingTotpToken &&
      ((mode !== "reset" && !email.trim()) ||
        (mode !== "forgot" && (!password || password.length < 6)) ||
        (mode === "register" && !verifyCode.trim()) ||
        (mode === "reset" && (!email.trim() || !resetToken.trim())))) ||
    (Boolean(managed.pendingTotpToken) && totpCode.trim().length < 6);

  const tabs = [
    { value: "login", label: text.login.loginTab },
    { value: "register", label: text.login.registerTab },
    { value: "forgot", label: text.login.forgotTab },
    { value: "reset", label: text.login.resetTab },
  ] as const;

  return (
    <main className={styles["mobile-app"]}>
      <section className={styles["login-screen"]}>
        <div className={clsx(styles["brand-mark"], "no-dark")}>J</div>
        <h1>JisudengChat</h1>
        <p>{text.login.subtitle}</p>

        {!managed.pendingTotpToken && (
          <div className={styles["auth-tabs"]}>
            {tabs.map((tab) => (
              <button
                key={tab.value}
                className={clsx({ [styles["active"]]: mode === tab.value })}
                onClick={() => {
                  setMode(tab.value);
                  setError("");
                  setMessage("");
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {!managed.pendingTotpToken && backendBaseUrl && (
          <section className={styles["oauth-panel"]}>
            <div>
              <strong>{text.login.quickLoginTitle}</strong>
              <span>{text.login.quickLoginHint}</span>
            </div>
            <button
              type="button"
              onClick={() => startOAuthLogin("google")}
              disabled={busy}
            >
              {oauthBusy === "google"
                ? text.login.oauthOpening
                : text.login.continueWithGoogle}
            </button>
            <button
              type="button"
              onClick={() => startOAuthLogin("github")}
              disabled={busy}
            >
              {oauthBusy === "github"
                ? text.login.oauthOpening
                : text.login.continueWithGitHub}
            </button>
          </section>
        )}

        <form className={styles["login-form"]} onSubmit={submit}>
          {!managed.pendingTotpToken ? (
            <>
              <label>
                <span>{text.login.email}</span>
                <input
                  aria-label="login-email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.currentTarget.value);
                    setCredentialSource("manual");
                  }}
                  placeholder="name@example.com"
                  type="email"
                  autoComplete="email"
                />
              </label>
              {mode !== "forgot" && (
                <label>
                  <span>
                    {mode === "reset"
                      ? text.login.newPassword
                      : text.login.password}
                  </span>
                  <div className={styles["password-field"]}>
                    <input
                      aria-label="login-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.currentTarget.value);
                        setCredentialSource("manual");
                      }}
                      placeholder={text.login.passwordPlaceholder}
                      type={passwordVisible ? "text" : "password"}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                    />
                    <button
                      aria-label={
                        passwordVisible
                          ? text.login.hidePassword
                          : text.login.showPassword
                      }
                      type="button"
                      onClick={() => setPasswordVisible((visible) => !visible)}
                    >
                      {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </label>
              )}
              {mode === "login" && (
                <label className={styles["remember-login"]}>
                  <input
                    aria-label="login-remember-account"
                    type="checkbox"
                    checked={rememberAccount}
                    onChange={(event) =>
                      setRememberAccount(event.currentTarget.checked)
                    }
                  />
                  <span>{text.login.rememberAccount}</span>
                </label>
              )}
              {(mode === "register" || mode === "reset") && (
                <label>
                  <span>{text.login.confirmPassword}</span>
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                    placeholder={text.login.passwordPlaceholder}
                    type="password"
                    autoComplete="new-password"
                  />
                </label>
              )}
              {mode === "register" && (
                <div className={styles["code-row"]}>
                  <label>
                    <span>{text.login.verifyCode}</span>
                    <input
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.currentTarget.value)}
                      placeholder={text.login.verifyCodePlaceholder}
                      inputMode="numeric"
                    />
                  </label>
                  <button type="button" onClick={sendCode} disabled={busy}>
                    {busy ? text.login.sendingCode : text.login.sendCode}
                  </button>
                </div>
              )}
              {mode === "register" &&
                (affiliateCode || affiliateToken ? (
                  <div className={styles["form-success"]}>
                    <strong>{text.login.affiliateInviteDetected}</strong>
                    <small>{text.login.affiliateInviteDetectedHint}</small>
                  </div>
                ) : null)}
              {mode === "register" && (
                <div className={styles["two-col"]}>
                  <label>
                    <span>{text.login.promoCode}</span>
                    <input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.currentTarget.value)}
                      placeholder={text.login.optionalCodePlaceholder}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    <span>{text.login.invitationCode}</span>
                    <input
                      value={invitationCode}
                      onChange={(e) => setInvitationCode(e.currentTarget.value)}
                      placeholder={text.login.optionalCodePlaceholder}
                      autoComplete="off"
                    />
                  </label>
                </div>
              )}
              {mode === "reset" && (
                <div className={styles["code-row"]}>
                  <label>
                    <span>{text.login.resetToken}</span>
                    <input
                      value={resetToken}
                      onChange={(e) => setResetToken(e.currentTarget.value)}
                      placeholder={text.login.resetTokenPlaceholder}
                      inputMode="numeric"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={sendResetCode}
                    disabled={busy || !email.trim()}
                  >
                    {busy ? text.login.sendingCode : text.login.sendCode}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles["totp-panel"]}>
              <label>
                <span>
                  {managed.pendingTotpEmail || text.login.totpFallback}
                </span>
                <input
                  autoFocus
                  value={totpCode}
                  onChange={(e) =>
                    setTotpCode(
                      e.currentTarget.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  placeholder={text.login.totpPlaceholder}
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <button
                type="button"
                className={styles["ghost-action"]}
                onClick={() => {
                  managed.cancel2FA();
                  setTotpCode("");
                  setError("");
                }}
              >
                {text.common.back}
              </button>
            </div>
          )}

          {(configError || managed.lastError || error) && (
            <div className={styles["form-error"]}>
              {configError || managed.lastError || error}
            </div>
          )}
          {message && <div className={styles["form-success"]}>{message}</div>}

          <button
            className={styles["primary-action"]}
            type="submit"
            aria-label="login-submit"
            disabled={submitDisabled}
          >
            {busy
              ? mode === "register"
                ? text.login.registering
                : mode === "forgot"
                ? text.login.sendingReset
                : mode === "reset"
                ? text.login.resetting
                : text.login.loggingIn
              : managed.pendingTotpToken
              ? text.login.verifyAndLogin
              : mode === "register"
              ? text.login.registerSubmit
              : mode === "forgot"
              ? text.login.forgotSubmit
              : mode === "reset"
              ? text.login.resetSubmit
              : text.login.submit}
          </button>
        </form>
      </section>
    </main>
  );
}

function AndroidDashboard() {
  const managed = useManagedNextChatStore();
  const mobileStore = useManagedMobileAppStore();
  const sdStore = useSdStore();
  const text = useMobileText();
  const location = useLocation();
  const navigate = useNavigate();
  const workspace = managed.workspace;
  const activeAccountId = String(
    managed.user?.id || managed.session?.user_id || workspace?.user?.id || "",
  );
  const [dashboardChatGroupId, setDashboardChatGroupId] = useState<
    number | undefined
  >(() => storedChatPreferenceGroupID() || undefined);
  const dashboardPreference = resolveChatPreference(
    workspace,
    dashboardChatGroupId,
  );
  const models = chatModelsForGroup(workspace, dashboardPreference.groupId);
  const sessions = mobileStore.chatSessions;
  const [dashboardFilter, setDashboardFilter] = useState<
    "all" | "pinned" | "image" | "tasks"
  >("all");
  const [cloudTasks, setCloudTasks] = useState<MobileTask[]>([]);
  const [taskError, setTaskError] = useState("");
  const dashboardTaskLongPressRef = useRef<number | null>(null);
  const visibleSessions = useMemo(() => {
    if (dashboardFilter === "pinned") {
      return sessions.filter((session) => session.pinned);
    }
    return sessions;
  }, [dashboardFilter, sessions]);
  const imageTasks = useMemo(
    () => (sdStore.draw || []).slice(0, 12),
    [sdStore.draw],
  );
  const recentContentKit = useMemo(
    () =>
      [...mobileStore.contentKits].sort(
        (left, right) => right.updatedAt - left.updatedAt,
      )[0],
    [mobileStore.contentKits],
  );
  const showingImages = dashboardFilter === "image";
  const showingTasks = dashboardFilter === "tasks";
  const isAdmin = isMobileAdminAvailable(managed.mobileProtocol);
  const [sessionActionTarget, setSessionActionTarget] =
    useState<ManagedMobileChatSession | null>(null);
  const [renameTarget, setRenameTarget] =
    useState<ManagedMobileChatSession | null>(null);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);

  useEffect(() => {
    const nextFilter = (location.state as any)?.dashboardFilter;
    if (
      nextFilter !== "all" &&
      nextFilter !== "pinned" &&
      nextFilter !== "image" &&
      nextFilter !== "tasks"
    ) {
      return;
    }
    setDashboardFilter(nextFilter);
    navigate(Path.Home, { replace: true, state: null });
  }, [location.state, navigate]);

  useEffect(() => {
    const preference = resolveChatPreference(workspace, dashboardChatGroupId);
    if (!preference.groupId) return;
    if (preference.groupId !== dashboardChatGroupId) {
      setDashboardChatGroupId(preference.groupId);
    }
    if (
      preference.reason !== "pending" &&
      preference.reason !== "fallback" &&
      preference.reason !== "unavailable" &&
      preference.model &&
      chatModelsForGroup(workspace, preference.groupId).some(
        (model) => modelValue(model) === preference.model,
      )
    ) {
      persistChatPreference(preference.groupId, preference.model);
    }
  }, [dashboardChatGroupId, workspace]);

  useNativeBackHandler(true, () => {
    if (renameTarget) {
      setRenameTarget(null);
      return;
    }
    if (sessionActionTarget) {
      setSessionActionTarget(null);
      return;
    }
    if (groupSheetOpen) {
      setGroupSheetOpen(false);
      return;
    }
    handleNativeHomeBack(text);
  });

  async function refreshCloudTasks() {
    if (!managed.accessToken) return;
    try {
      const client = await mobilePlatformClient();
      const page = await client.tasks.list({ limit: 30, order: "desc" });
      setCloudTasks(page.items || []);
      setTaskError("");
    } catch {
      setTaskError(text.platform.taskRefreshFailed);
    }
  }

  useEffect(() => {
    if (!showingTasks) return;
    const refresh = () => void refreshCloudTasks();
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("online", refresh);
    window.addEventListener("jisudeng-native-resume", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("jisudeng-native-resume", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingTasks, managed.accessToken]);

  useEffect(
    () => () => {
      if (dashboardTaskLongPressRef.current !== null) {
        window.clearTimeout(dashboardTaskLongPressRef.current);
      }
    },
    [],
  );

  async function cancelCloudTask(task: MobileTask) {
    try {
      const client = await mobilePlatformClient();
      await client.tasks.cancel(task.id, { reason: "user_cancelled" });
      await refreshCloudTasks();
    } catch {
      setTaskError(text.platform.taskRefreshFailed);
    }
  }

  async function retryCloudTask(task: MobileTask) {
    try {
      const client = await mobilePlatformClient();
      await client.tasks.retry(task.id, {
        client_request_id: clientRequestID("retry"),
      });
      await refreshCloudTasks();
    } catch {
      setTaskError(text.platform.taskRefreshFailed);
    }
  }

  function openTaskManager(taskId?: string) {
    navigate(Path.Activity, {
      state: {
        view: "tasks",
        manage: true,
        taskId,
      },
    });
  }

  function startDashboardTaskLongPress(taskId: string) {
    if (dashboardTaskLongPressRef.current !== null) {
      window.clearTimeout(dashboardTaskLongPressRef.current);
    }
    dashboardTaskLongPressRef.current = window.setTimeout(() => {
      dashboardTaskLongPressRef.current = null;
      openTaskManager(taskId);
    }, 450);
  }

  function stopDashboardTaskLongPress() {
    if (dashboardTaskLongPressRef.current === null) return;
    window.clearTimeout(dashboardTaskLongPressRef.current);
    dashboardTaskLongPressRef.current = null;
  }

  async function deleteDashboardImageTask(item: any) {
    if (!window.confirm(text.image.deleteTaskConfirm)) return;
    try {
      const localFileNames = imageLocalFileNames(item);
      if (localFileNames.length) {
        await deleteAppImages(localFileNames, activeAccountId);
      }
      await Promise.allSettled(
        imageResults(item)
          .filter((url: string) => url.startsWith("/api/cache"))
          .map((url: string) => removeImage(url)),
      );
      sdStore.update((state) => {
        state.draw = state.draw.filter(
          (row: any) => String(row.id) !== String(item.id),
        );
        state.currentId += 1;
      });
      setTaskError("");
    } catch {
      setTaskError(text.errors.saveFailed);
    }
  }

  function prepareDraftChat() {
    const preference = resolveChatPreference(workspace, dashboardChatGroupId);
    if (
      preference.reason !== "pending" &&
      preference.reason !== "fallback" &&
      preference.reason !== "unavailable" &&
      preference.groupId &&
      preference.model
    ) {
      persistChatPreference(preference.groupId, preference.model);
    }
    mobileStore.setCurrentChatId("");
  }

  function openChat() {
    prepareDraftChat();
    navigate(Path.Chat);
  }

  function openSkillCenter() {
    prepareDraftChat();
    navigate(Path.Chat, { state: { openSkillSheet: true } });
  }

  function openCollaborationChat() {
    prepareDraftChat();
    navigate(Path.Chat, { state: { selectAgentId: COLLABORATION_AGENT_ID } });
  }

  function openSession(session: ManagedMobileChatSession) {
    mobileStore.setCurrentChatId(session.id);
    setSessionActionTarget(null);
    navigate(Path.Chat);
  }

  function deleteSession(session: ManagedMobileChatSession) {
    if (!window.confirm(text.account.deleteSessionConfirm)) return;
    mobileStore.removeChatSession(session.id);
    setSessionActionTarget(null);
  }

  function renameSessionFromDashboard(
    session: ManagedMobileChatSession,
    title: string,
  ) {
    mobileStore.renameChatSession(session.id, title);
    setRenameTarget(null);
    setSessionActionTarget(null);
  }

  return (
    <AndroidAppShell active="home" text={text} documentScroll>
      <header className={styles["dashboard-header"]}>
        <div>
          <span>
            {workspace?.brand?.workspace_name || text.workspaceFallback}
          </span>
          <h1>{text.navigation.home}</h1>
        </div>
        <button
          className={styles["avatar"]}
          onClick={() => navigate(Path.Settings)}
        >
          {(workspace?.user?.username || workspace?.user?.email || "J")
            .slice(0, 1)
            .toUpperCase()}
        </button>
      </header>

      <section className={styles["home-summary-grid"]}>
        <button
          className={styles["summary-card"]}
          onClick={() => managed.bootstrap().catch(() => {})}
        >
          <span>{text.dashboard.balance}</span>
          <strong>{formatMoney(workspace?.user?.balance)}</strong>
          <small>
            {managed.lastSyncAt
              ? text.syncedAt(formatSyncTime(managed.lastSyncAt, text))
              : text.notSynced}
          </small>
        </button>
        <button
          className={styles["summary-card"]}
          aria-label="dashboard-default-group"
          onClick={() => setGroupSheetOpen(true)}
        >
          <span>{text.account.currentGroup}</span>
          <strong>{stableChatGroupName(workspace, text)}</strong>
          <small>
            {text.chat.tapToSwitchGroup(text.modelCount(models.length))}
          </small>
        </button>
      </section>

      <section className={styles["quick-grid"]}>
        <button
          type="button"
          aria-label="open-content-kit"
          onClick={() => navigate(Path.ContentKit)}
        >
          <ImageIcon />
          <strong>{text.platform.contentKit.title}</strong>
          <span>{text.platform.contentKit.hint}</span>
        </button>
        <button type="button" onClick={openSkillCenter}>
          <BotIcon />
          <strong>{text.dashboard.skillCenter}</strong>
          <span>{text.dashboard.skillCenterHint}</span>
        </button>
        <button type="button" onClick={openCollaborationChat}>
          <ChatIcon />
          <strong>{text.dashboard.agentCollaboration}</strong>
          <span>{text.dashboard.agentCollaborationHint}</span>
        </button>
        {isAdmin && (
          <button type="button" onClick={() => navigate(Path.AccountAdmin)}>
            <SettingsIcon />
            <strong>{text.account.adminCenter}</strong>
            <span>{text.account.adminRecognized}</span>
          </button>
        )}
      </section>

      {recentContentKit && (
        <section className={styles["recent-project-panel"]}>
          <div className={styles["section-head"]}>
            <h2>{text.platform.contentKit.projects}</h2>
            <button type="button" onClick={() => navigate(Path.ContentKit)}>
              {text.common.open}
            </button>
          </div>
          <button
            type="button"
            className={styles["recent-project-row"]}
            onClick={() => navigate(Path.ContentKit)}
          >
            <ImageIcon />
            <span>
              <strong>
                {recentContentKit.productName || text.platform.contentKit.title}
              </strong>
              <small>
                {[
                  recentContentKit.platform,
                  text.photoCount(recentContentKit.assets.length),
                  formatDateTime(recentContentKit.updatedAt, text),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
          </button>
        </section>
      )}

      <div className={styles["conversation-filters"]}>
        <button
          className={clsx({ [styles["active"]]: dashboardFilter === "all" })}
          onClick={() => setDashboardFilter("all")}
        >
          {text.common.all}
        </button>
        <button
          className={clsx({
            [styles["active"]]: dashboardFilter === "pinned",
          })}
          onClick={() => setDashboardFilter("pinned")}
        >
          {text.common.pinned}
        </button>
        <button
          className={clsx({
            [styles["active"]]: dashboardFilter === "image",
          })}
          onClick={() => setDashboardFilter("image")}
        >
          {text.dashboard.image}
        </button>
        <button
          className={clsx({
            [styles["active"]]: dashboardFilter === "tasks",
          })}
          onClick={() => setDashboardFilter("tasks")}
        >
          {text.platform.tasks}
        </button>
      </div>

      <section
        className={styles["conversation-panel"]}
        aria-label={`dashboard-session-count-${sessions.length}`}
      >
        <div className={styles["section-head"]}>
          <h2>
            {showingTasks
              ? text.platform.tasks
              : showingImages
              ? text.image.history
              : text.chat.sessions}
          </h2>
          {showingTasks ? (
            <div className={styles["dashboard-task-actions"]}>
              <button type="button" onClick={() => openTaskManager()}>
                {text.platform.taskManage}
              </button>
              <button type="button" onClick={refreshCloudTasks}>
                {text.common.refresh}
              </button>
            </div>
          ) : (
            <button
              aria-label="dashboard-new-chat"
              onClick={showingImages ? () => navigate(Path.Sd) : openChat}
            >
              {showingImages ? text.image.generate : text.chat.newSession}
            </button>
          )}
        </div>
        <div
          className={styles["conversation-list"]}
          aria-live={showingTasks ? "polite" : undefined}
        >
          {!showingImages && !showingTasks && visibleSessions.length === 0 && (
            <button className={styles["conversation-empty"]} onClick={openChat}>
              <ChatIcon />
              <strong>
                {dashboardFilter === "pinned"
                  ? text.chat.noPinned
                  : text.chat.emptyTitle}
              </strong>
              <span>{text.chat.emptyDesc}</span>
            </button>
          )}
          {showingImages && imageTasks.length === 0 && (
            <button
              className={styles["conversation-empty"]}
              onClick={() => navigate(Path.Sd)}
            >
              <ImageIcon />
              <strong>{text.image.noHistory}</strong>
              <span>{text.image.emptyDesc}</span>
            </button>
          )}
          {showingTasks && cloudTasks.length === 0 && (
            <div className={styles["conversation-empty"]}>
              <HistoryIcon />
              <strong>{text.platform.taskEmpty}</strong>
              <span>{text.platform.taskHint}</span>
            </div>
          )}
          {showingTasks
            ? cloudTasks.map((task) => (
                <article
                  key={task.id}
                  className={styles["cloud-task-item"]}
                  onPointerDown={(event) => {
                    if (event.pointerType !== "mouse") {
                      startDashboardTaskLongPress(task.id);
                    }
                  }}
                  onPointerUp={stopDashboardTaskLongPress}
                  onPointerCancel={stopDashboardTaskLongPress}
                  onPointerLeave={stopDashboardTaskLongPress}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openTaskManager(task.id);
                  }}
                >
                  <i>{task.kind === "image" ? <ImageIcon /> : <ChatIcon />}</i>
                  <span>
                    <strong>{mobileTaskOperationLabel(task, text)}</strong>
                    <small>
                      {formatDateTime(task.updated_at || task.created_at, text)}
                    </small>
                  </span>
                  <em>{mobileTaskStatusLabel(task.status, text)}</em>
                  <div>
                    {(task.cancellable ||
                      ["queued", "running"].includes(task.status)) && (
                      <button onClick={() => cancelCloudTask(task)}>
                        {text.common.cancel}
                      </button>
                    )}
                    {(task.retryable ||
                      ["failed", "cancelled", "partial"].includes(
                        task.status,
                      )) && (
                      <button onClick={() => retryCloudTask(task)}>
                        {text.common.retry}
                      </button>
                    )}
                  </div>
                </article>
              ))
            : showingImages
            ? imageTasks.map((item: any) => {
                const urls = imageResults(item);
                const preview =
                  item?.params?.prompt ||
                  item?.prompt ||
                  imageTaskStatusText(item, text);
                return (
                  <article
                    key={item.id || `${item.status}-${preview}`}
                    className={styles["conversation-item"]}
                    onClick={() =>
                      navigate(
                        item.status === "success" && urls.length
                          ? Path.Gallery
                          : Path.Sd,
                      )
                    }
                  >
                    <i>
                      <ImageIcon />
                    </i>
                    <span>
                      <strong>{item.model || text.image.generate}</strong>
                      <small>{preview}</small>
                    </span>
                    <div className={styles["conversation-actions"]}>
                      <em>{imageTaskStatusText(item, text)}</em>
                      {item.status !== "running" &&
                        item.status !== "queued" && (
                          <button
                            type="button"
                            aria-label={text.image.deleteTask}
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteDashboardImageTask(item);
                            }}
                          >
                            <DeleteIcon />
                          </button>
                        )}
                    </div>
                  </article>
                );
              })
            : visibleSessions.slice(0, 12).map((session) => {
                const last = session.messages[session.messages.length - 1];
                const preview =
                  last?.content ||
                  (last?.imageUrls?.length
                    ? text.chat.imageAttached(last.imageUrls.length)
                    : text.chat.emptyDesc);
                return (
                  <article
                    key={session.id}
                    className={clsx(
                      styles["conversation-item"],
                      styles["conversation-session"],
                    )}
                  >
                    <button
                      type="button"
                      className={styles["conversation-session-main"]}
                      onClick={() => openSession(session)}
                    >
                      <i>
                        {chatSessionDisplayTitle(session, text).slice(0, 1)}
                      </i>
                      <span>
                        <strong>
                          {chatSessionDisplayTitle(session, text)}
                        </strong>
                        <small>{preview}</small>
                      </span>
                      <em>{formatSyncTime(session.updatedAt, text)}</em>
                    </button>
                    <IconButton
                      label={text.chat.sessionActions}
                      onClick={() => setSessionActionTarget(session)}
                    >
                      <ThreeDotsIcon />
                    </IconButton>
                  </article>
                );
              })}
        </div>
        {taskError && <div className={styles["form-error"]}>{taskError}</div>}
      </section>

      {managed.lastError && !workspace && (
        <div className={styles["workspace-recovery-error"]} role="alert">
          <span>{managed.lastError}</span>
          <button
            type="button"
            onClick={() => managed.bootstrap().catch(() => undefined)}
            disabled={managed.loading}
          >
            {text.common.retry}
          </button>
        </div>
      )}
      <SessionActionSheet
        session={sessionActionTarget}
        text={text}
        onClose={() => setSessionActionTarget(null)}
        onOpen={() => sessionActionTarget && openSession(sessionActionTarget)}
        onRename={() => {
          if (sessionActionTarget) setRenameTarget(sessionActionTarget);
        }}
        onTogglePin={() => {
          if (!sessionActionTarget) return;
          mobileStore.togglePinChatSession(sessionActionTarget.id);
          setSessionActionTarget(null);
        }}
        onDelete={() => {
          if (sessionActionTarget) deleteSession(sessionActionTarget);
        }}
      />
      <RenameSessionDialog
        open={Boolean(renameTarget)}
        title={text.chat.renameSession}
        initialValue={
          renameTarget ? chatSessionDisplayTitle(renameTarget, text) : ""
        }
        text={text}
        onClose={() => setRenameTarget(null)}
        onSubmit={(value) => {
          if (renameTarget) renameSessionFromDashboard(renameTarget, value);
        }}
      />
      <ChoiceSheet
        open={groupSheetOpen}
        title={text.chat.group}
        text={text}
        items={(workspace?.models?.groups || []).map((group) => ({
          id: String(group.id),
          title: group.name,
          detail: text.modelCount(
            group.models?.filter(isChatModel).length || 0,
          ),
          active: group.id === dashboardChatGroupId,
        }))}
        onClose={() => setGroupSheetOpen(false)}
        onSelect={(id) => {
          const groupId = Number(id);
          const preference = resolveChatPreference(workspace, groupId);
          const nextModel = preference.model;
          if (
            !Number.isFinite(groupId) ||
            preference.groupId !== groupId ||
            !nextModel
          ) {
            setTaskError(text.errors.noModel);
            return;
          }
          persistChatPreference(groupId, nextModel);
          setDashboardChatGroupId(groupId);
          setTaskError("");
          setGroupSheetOpen(false);
        }}
      />
    </AndroidAppShell>
  );
}

function AndroidProjects() {
  const managed = useManagedNextChatStore();
  const text = useMobileText();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<MobileProject[]>([]);
  const [selected, setSelected] = useState<MobileProject | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const refresh = useCallback(
    async (nextPage = 1, append = false) => {
      if (!managed.accessToken) return;
      setLoading(true);
      try {
        const client = await mobilePlatformClient();
        const result = await client.projects.list({
          page: nextPage,
          page_size: 20,
        });
        setProjects((current) =>
          append ? [...current, ...(result.items || [])] : result.items || [],
        );
        setPage(result.page || nextPage);
        setPages(result.pages || 1);
        setError("");
      } catch {
        setError(text.platform.projectSyncFailed);
      } finally {
        setLoading(false);
      }
    },
    [managed.accessToken, text.platform.projectSyncFailed],
  );

  useEffect(() => {
    const reload = () => void refresh();
    reload();
    window.addEventListener("online", reload);
    window.addEventListener("jisudeng-native-resume", reload);
    return () => {
      window.removeEventListener("online", reload);
      window.removeEventListener("jisudeng-native-resume", reload);
    };
  }, [refresh]);

  useNativeBackHandler(true, () => {
    if (selected) {
      setSelected(null);
      return;
    }
    if (creating) {
      setCreating(false);
      return;
    }
    handleNativeHomeBack(text);
  });

  function openProject(project: MobileProject) {
    setSelected(project);
    setName(project.name);
    setDescription(project.description || "");
    setCreating(false);
    setError("");
  }

  function startCreate() {
    setSelected(null);
    setName("");
    setDescription("");
    setCreating(true);
    setError("");
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const client = await mobilePlatformClient();
      const project = await client.projects.create({
        name: name.trim(),
        description: description.trim(),
        task_ids: [],
        asset_ids: [],
        client_request_id: clientRequestID("project-create"),
      });
      setProjects((current) => [project, ...current]);
      setCreating(false);
      openProject(project);
    } catch {
      setError(text.platform.projectSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!selected || !name.trim() || saving) return;
    setSaving(true);
    try {
      const client = await mobilePlatformClient();
      const project = await client.projects.update(selected.id, {
        name: name.trim(),
        description: description.trim(),
        client_request_id: clientRequestID("project-update"),
      });
      setProjects((current) =>
        current.map((item) => (item.id === project.id ? project : item)),
      );
      setSelected(project);
      setError("");
    } catch {
      setError(text.platform.projectSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project: MobileProject) {
    if (!window.confirm(text.platform.projectDeleteConfirm(project.name)))
      return;
    setSaving(true);
    try {
      const client = await mobilePlatformClient();
      await client.projects.delete(
        project.id,
        clientRequestID("project-delete"),
      );
      setProjects((current) =>
        current.filter((item) => item.id !== project.id),
      );
      if (selected?.id === project.id) setSelected(null);
      setError("");
    } catch {
      setError(text.platform.projectSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AndroidAppShell active="projects" text={text} documentScroll>
      <header className={styles["app-header"]}>
        <div>
          <span>{text.platform.projectHint}</span>
          <h1>{text.platform.projects}</h1>
        </div>
        <button
          type="button"
          className={styles["compact-text-action"]}
          onClick={selected ? () => setSelected(null) : startCreate}
        >
          {selected ? text.common.back : text.platform.projectNew}
        </button>
      </header>

      <section className={styles["project-shortcuts"]}>
        <button type="button" onClick={() => navigate(Path.Gallery)}>
          <ImageIcon />
          <span>{text.platform.openGallery}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(Path.Activity, { state: { view: "tasks" } })}
        >
          <HistoryIcon />
          <span>{text.platform.openTasks}</span>
        </button>
      </section>

      {(creating || selected) && (
        <form
          className={styles["project-editor"]}
          onSubmit={creating ? createProject : saveProject}
        >
          <label className={styles["field-card"]}>
            <span>{text.platform.projectName}</span>
            <input
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder={text.platform.projectNamePlaceholder}
              maxLength={120}
            />
          </label>
          <label className={styles["field-card"]}>
            <span>{text.platform.projectDescription}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              maxLength={4000}
              rows={3}
            />
          </label>
          {selected && (
            <div className={styles["project-counts"]}>
              <span>
                {text.platform.projectTasks(selected.task_ids.length)}
              </span>
              <span>
                {text.platform.projectAssets(selected.asset_ids.length)}
              </span>
            </div>
          )}
          <button
            type="submit"
            className={styles["primary-action"]}
            disabled={saving || !name.trim()}
          >
            {creating ? text.platform.projectCreate : text.common.save}
          </button>
          {selected && (
            <button
              type="button"
              className={styles["danger-action"]}
              disabled={saving}
              onClick={() => void deleteProject(selected)}
            >
              {text.common.delete}
            </button>
          )}
        </form>
      )}

      {!creating && !selected && (
        <section className={styles["project-list"]} aria-live="polite">
          {!loading && projects.length === 0 && (
            <button
              type="button"
              className={styles["conversation-empty"]}
              onClick={startCreate}
            >
              <HistoryIcon />
              <strong>{text.platform.projectEmpty}</strong>
              <span>{text.platform.projectHint}</span>
            </button>
          )}
          {projects.map((project) => (
            <article key={project.id} className={styles["project-row"]}>
              <button type="button" onClick={() => openProject(project)}>
                <i>
                  <HistoryIcon />
                </i>
                <span>
                  <strong>{project.name}</strong>
                  <small>
                    {[
                      text.platform.projectTasks(project.task_ids.length),
                      text.platform.projectAssets(project.asset_ids.length),
                      formatDateTime(project.updated_at, text),
                    ].join(" · ")}
                  </small>
                </span>
              </button>
              <IconButton
                label={text.common.delete}
                disabled={saving}
                onClick={() => void deleteProject(project)}
              >
                <DeleteIcon />
              </IconButton>
            </article>
          ))}
          {page < pages && (
            <button
              type="button"
              className={styles["wide-soft-action"]}
              disabled={loading}
              onClick={() => void refresh(page + 1, true)}
            >
              {text.platform.taskLoadMore}
            </button>
          )}
        </section>
      )}
      {loading && <p className={styles["empty-copy"]}>{text.loading}</p>}
      {error && <div className={styles["form-error"]}>{error}</div>}
    </AndroidAppShell>
  );
}

function AndroidActivityCenter() {
  const managed = useManagedNextChatStore();
  const text = useMobileText();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<"tasks" | "notifications">(() =>
    (location.state as any)?.view === "notifications"
      ? "notifications"
      : "tasks",
  );
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [taskPage, setTaskPage] = useState(1);
  const [taskHasMore, setTaskHasMore] = useState(true);
  const [taskLoadingMore, setTaskLoadingMore] = useState(false);
  const taskPageRef = useRef(1);
  const taskHasMoreRef = useRef(true);
  const taskLoadingMoreRef = useRef(false);
  const taskCursorRef = useRef("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<
    "all" | MobileTaskStatus
  >("all");
  const [taskManaging, setTaskManaging] = useState(() =>
    Boolean((location.state as any)?.manage),
  );
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const taskLongPressRef = useRef<number | null>(null);
  const [notifications, setNotifications] = useState<NativePushInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState<MobileTask | null>(null);
  const [taskProjects, setTaskProjects] = useState<MobileProject[]>([]);
  const [targetProjectId, setTargetProjectId] = useState("");
  const [projectMessage, setProjectMessage] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);
  const [taskDeleteConfirmOpen, setTaskDeleteConfirmOpen] = useState(false);
  const [taskCancelConfirmOpen, setTaskCancelConfirmOpen] = useState(false);
  const [taskNotice, setTaskNotice] = useState("");
  const taskNoticeTimerRef = useRef<number | null>(null);

  function showTaskNotice(message: string) {
    setTaskNotice(message);
    if (taskNoticeTimerRef.current !== null) {
      window.clearTimeout(taskNoticeTimerRef.current);
    }
    taskNoticeTimerRef.current = window.setTimeout(() => {
      setTaskNotice("");
      taskNoticeTimerRef.current = null;
    }, 3200);
  }

  const refresh = useCallback(
    async (append = false, preserveLoaded = false) => {
      if (
        append &&
        (taskLoadingMoreRef.current ||
          !taskHasMoreRef.current ||
          view !== "tasks")
      )
        return;
      if (append) {
        taskLoadingMoreRef.current = true;
        setTaskLoadingMore(true);
      } else setLoading(true);
      try {
        if (view === "notifications") {
          setNotifications(await getNativePushInbox());
        } else {
          const client = await mobilePlatformClient();
          const nextPage = append ? taskPageRef.current + 1 : 1;
          const page = await client.tasks.list({
            page: nextPage,
            page_size: 50,
            cursor: append ? taskCursorRef.current || undefined : undefined,
            limit: 50,
            order: "desc",
            status: taskStatusFilter === "all" ? undefined : taskStatusFilter,
          });
          const items = page.items || [];
          setTasks((current) => {
            if (append) return mergeMobileTaskPages(current, items, "append");
            return mergeMobileTaskPages(
              current,
              items,
              preserveLoaded ? "refresh" : "replace",
            );
          });
          if (!preserveLoaded) {
            const hasMore =
              typeof page.has_more === "boolean"
                ? page.has_more
                : typeof page.pages === "number"
                ? nextPage < page.pages
                : items.length >= 50;
            taskPageRef.current = nextPage;
            taskHasMoreRef.current = hasMore;
            taskCursorRef.current = page.next_cursor || "";
            setTaskPage(nextPage);
            setTaskHasMore(hasMore);
          }
        }
        setError("");
      } catch {
        setError(text.platform.taskRefreshFailed);
      } finally {
        if (append) {
          taskLoadingMoreRef.current = false;
          setTaskLoadingMore(false);
        } else setLoading(false);
      }
    },
    [taskStatusFilter, text.platform.taskRefreshFailed, view],
  );

  useEffect(() => {
    const routeState = (location.state as any) || {};
    const nextView = routeState.view;
    if (nextView === "tasks" || nextView === "notifications") {
      setView(nextView);
      if (routeState.manage) {
        setTaskManaging(true);
        if (typeof routeState.taskId === "string" && routeState.taskId) {
          setSelectedTaskIds((current) =>
            new Set(current).add(routeState.taskId),
          );
        }
      }
      navigate(Path.Activity, { replace: true, state: null });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const onRefresh = () => void refresh(false, true);
    void refresh();
    const timer = window.setInterval(
      onRefresh,
      view === "tasks" ? 15_000 : 60_000,
    );
    window.addEventListener("online", onRefresh);
    window.addEventListener("jisudeng-native-resume", onRefresh);
    window.addEventListener("jisudeng:push-inbox-change", onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", onRefresh);
      window.removeEventListener("jisudeng-native-resume", onRefresh);
      window.removeEventListener("jisudeng:push-inbox-change", onRefresh);
    };
  }, [refresh, view]);

  useEffect(
    () => () => {
      if (taskLongPressRef.current !== null) {
        window.clearTimeout(taskLongPressRef.current);
      }
      if (taskNoticeTimerRef.current !== null) {
        window.clearTimeout(taskNoticeTimerRef.current);
      }
    },
    [],
  );

  useNativeBackHandler(true, () => {
    if (taskDeleteConfirmOpen) {
      setTaskDeleteConfirmOpen(false);
      return;
    }
    if (taskCancelConfirmOpen) {
      setTaskCancelConfirmOpen(false);
      return;
    }
    if (selectedTask) {
      setSelectedTask(null);
      setProjectMessage("");
      return;
    }
    if (taskManaging) {
      leaveTaskManage();
      return;
    }
    handleNativeHomeBack(text);
  });

  async function openTaskDetail(task: MobileTask) {
    setSelectedTask(task);
    setProjectMessage("");
    try {
      const client = await mobilePlatformClient();
      const page = await client.projects.list({ page: 1, page_size: 100 });
      setTaskProjects(page.items || []);
      setTargetProjectId(page.items?.[0]?.id || "");
    } catch {
      setTaskProjects([]);
      setTargetProjectId("");
    }
  }

  async function addSelectedTaskToProject() {
    if (!selectedTask || !targetProjectId || projectBusy) return;
    const project = taskProjects.find((item) => item.id === targetProjectId);
    if (!project) return;
    if (project.task_ids.includes(selectedTask.id)) {
      setProjectMessage(text.platform.projectTaskAlreadyAdded);
      return;
    }
    setProjectBusy(true);
    try {
      const client = await mobilePlatformClient();
      const updated = await client.projects.update(project.id, {
        task_ids: [...project.task_ids, selectedTask.id],
        client_request_id: clientRequestID("project-add-task"),
      });
      setTaskProjects((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setProjectMessage(text.platform.projectTaskAdded);
    } catch {
      setProjectMessage(text.platform.projectSaveFailed);
    } finally {
      setProjectBusy(false);
    }
  }

  async function updateTask(task: MobileTask, action: "cancel" | "retry") {
    try {
      const client = await mobilePlatformClient();
      if (action === "cancel") {
        await client.tasks.cancel(task.id, { reason: "user_cancelled" });
      } else {
        await client.tasks.retry(task.id, {
          client_request_id: clientRequestID("retry"),
        });
      }
      await refresh();
    } catch {
      setError(text.platform.taskRefreshFailed);
    }
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function enterTaskManage(taskId?: string) {
    setTaskManaging(true);
    if (taskId) {
      setSelectedTaskIds((current) => new Set(current).add(taskId));
    }
  }

  function startTaskLongPress(taskId: string) {
    if (taskManaging) return;
    if (taskLongPressRef.current !== null) {
      window.clearTimeout(taskLongPressRef.current);
    }
    taskLongPressRef.current = window.setTimeout(() => {
      enterTaskManage(taskId);
      taskLongPressRef.current = null;
    }, 450);
  }

  function stopTaskLongPress() {
    if (taskLongPressRef.current === null) return;
    window.clearTimeout(taskLongPressRef.current);
    taskLongPressRef.current = null;
  }

  function leaveTaskManage() {
    setTaskManaging(false);
    setSelectedTaskIds(new Set());
  }

  async function deleteSelectedTasks() {
    const selected = tasks.filter((task) =>
      selectedTaskIds.has(String(task.id)),
    );
    const deletable = selected.filter(
      (task) => !["queued", "running", "streaming"].includes(task.status),
    );
    const protectedTaskIds = selected
      .filter((task) =>
        ["queued", "running", "streaming"].includes(task.status),
      )
      .map((task) => String(task.id));
    if (!deletable.length) {
      setError(text.platform.taskRunningCannotDelete);
      return;
    }
    setTaskDeleteConfirmOpen(false);
    const failed = new Set<string>(protectedTaskIds);
    let deletedCount = 0;
    try {
      const client = await mobilePlatformClient();
      const requestId = clientRequestID("task-bulk-delete");
      try {
        const result = await client.tasks.bulkDelete({
          ids: selected.map((task) => String(task.id)),
          client_request_id: requestId,
        });
        deletedCount = result.deleted;
        const returned = new Set(result.results.map((item) => String(item.id)));
        result.results.forEach((result) => {
          if (result.status === "not_terminal" || result.status === "failed") {
            failed.add(String(result.id));
          } else {
            failed.delete(String(result.id));
          }
        });
        selected.forEach((task) => {
          if (!returned.has(String(task.id))) failed.add(String(task.id));
        });
      } catch (error) {
        const olderBackend =
          error instanceof ManagedApiError &&
          (error.status === 404 || error.status === 405);
        if (!olderBackend) throw error;
        for (let index = 0; index < deletable.length; index += 4) {
          const batch = deletable.slice(index, index + 4);
          const results = await Promise.allSettled(
            batch.map((task) => client.tasks.delete(task.id)),
          );
          results.forEach((result, resultIndex) => {
            if (result.status === "rejected") {
              failed.add(String(batch[resultIndex].id));
            } else {
              failed.delete(String(batch[resultIndex].id));
              deletedCount += 1;
            }
          });
        }
      }
      setTasks((current) =>
        current.filter(
          (task) =>
            !selectedTaskIds.has(String(task.id)) ||
            failed.has(String(task.id)),
        ),
      );
      await refresh();
      setSelectedTaskIds(failed);
      if (failed.size) {
        setError(
          protectedTaskIds.length === failed.size
            ? text.platform.taskRunningCannotDelete
            : text.platform.taskDeletePartial(failed.size),
        );
      } else {
        setError("");
        setTaskManaging(false);
      }
      if (deletedCount > 0) {
        showTaskNotice(text.platform.taskDeleteDone(deletedCount));
      }
    } catch {
      setError(text.platform.taskRefreshFailed);
    }
  }

  function requestDeleteSelectedTasks() {
    const deletableCount = tasks.filter(
      (task) =>
        selectedTaskIds.has(String(task.id)) &&
        !["queued", "running", "streaming"].includes(task.status),
    ).length;
    if (!deletableCount) {
      setError(text.platform.taskRunningCannotDelete);
      return;
    }
    setTaskDeleteConfirmOpen(true);
  }

  async function cancelSelectedTasks() {
    const selected = tasks.filter(
      (task) =>
        selectedTaskIds.has(String(task.id)) &&
        ["queued", "running", "streaming"].includes(task.status),
    );
    if (!selected.length) return;
    setTaskCancelConfirmOpen(false);
    const failed = new Set<string>();
    let cancelledCount = 0;
    try {
      const client = await mobilePlatformClient();
      const requestId = clientRequestID("task-bulk-cancel");
      try {
        const result = await client.tasks.bulkCancel({
          ids: selected.map((task) => String(task.id)),
          client_request_id: requestId,
        });
        cancelledCount = result.cancelled;
        const returned = new Set(result.results.map((item) => String(item.id)));
        result.results.forEach((item) => {
          if (item.status === "not_cancellable" || item.status === "failed") {
            failed.add(String(item.id));
          }
        });
        selected.forEach((task) => {
          if (!returned.has(String(task.id))) failed.add(String(task.id));
        });
      } catch (error) {
        const olderBackend =
          error instanceof ManagedApiError &&
          (error.status === 404 || error.status === 405);
        if (!olderBackend) throw error;
        const results = await Promise.allSettled(
          selected.map((task) =>
            client.tasks.cancel(task.id, {
              reason: "user_cancelled",
              client_request_id: clientRequestID("task-cancel"),
            }),
          ),
        );
        results.forEach((result, index) => {
          if (result.status === "rejected")
            failed.add(String(selected[index].id));
          else cancelledCount += 1;
        });
      }
      setTasks((current) =>
        current.map((task) =>
          selectedTaskIds.has(String(task.id)) && !failed.has(String(task.id))
            ? {
                ...task,
                status: "cancelled",
                cancellable: false,
                retryable: true,
              }
            : task,
        ),
      );
      await refresh(false, true);
      setSelectedTaskIds(failed);
      if (failed.size) setError(text.platform.taskCancelPartial(failed.size));
      else {
        setError("");
        setTaskManaging(false);
      }
      if (cancelledCount) {
        showTaskNotice(text.platform.taskCancelDone(cancelledCount));
      }
    } catch {
      setError(text.platform.taskRefreshFailed);
    }
  }

  function requestCancelSelectedTasks() {
    const cancellableCount = tasks.filter(
      (task) =>
        selectedTaskIds.has(String(task.id)) &&
        ["queued", "running", "streaming"].includes(task.status),
    ).length;
    if (cancellableCount) setTaskCancelConfirmOpen(true);
  }

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <AndroidAppShell active="projects" text={text} documentScroll>
      <header className={styles["app-header"]}>
        <div>
          <span>{text.account.activityHint}</span>
          <h1>{text.account.activityCenter}</h1>
        </div>
        <div className={styles["activity-header-actions"]}>
          {selectedTask && (
            <button
              type="button"
              className={styles["compact-text-action"]}
              onClick={() => setSelectedTask(null)}
            >
              {text.common.back}
            </button>
          )}
          {view === "tasks" && !selectedTask && (
            <button
              type="button"
              className={styles["compact-text-action"]}
              onClick={() =>
                taskManaging ? leaveTaskManage() : enterTaskManage()
              }
            >
              {taskManaging ? text.common.cancel : text.platform.taskManage}
            </button>
          )}
          <IconButton
            label={text.common.refresh}
            onClick={() => void refresh()}
          >
            <ReloadIcon />
          </IconButton>
        </div>
      </header>

      {selectedTask && (
        <section className={styles["task-detail"]} aria-live="polite">
          <div className={styles["section-head"]}>
            <div>
              <h2>{mobileTaskOperationLabel(selectedTask, text)}</h2>
              <span>{formatDateTime(selectedTask.created_at, text)}</span>
            </div>
            <em>{mobileTaskStatusLabel(selectedTask.status, text)}</em>
          </div>
          <div className={styles["meta-row"]}>
            <span>{text.platform.tasks}</span>
            <strong>{selectedTask.operation || selectedTask.kind}</strong>
          </div>
          <div className={styles["meta-row"]}>
            <span>{text.platform.taskStatuses[selectedTask.status]}</span>
            <strong>{Math.max(0, selectedTask.progress || 0)}%</strong>
          </div>
          {(selectedTask.error?.message || selectedTask.error_message) && (
            <div className={styles["form-error"]}>
              {selectedTask.error?.message || selectedTask.error_message}
            </div>
          )}
          {!!selectedTask.artifacts?.length && (
            <div className={styles["project-counts"]}>
              <span>
                {text.platform.projectAssets(selectedTask.artifacts.length)}
              </span>
            </div>
          )}
          {taskProjects.length ? (
            <div className={styles["task-project-link"]}>
              <label>
                <span>{text.platform.projectSelect}</span>
                <select
                  value={targetProjectId}
                  onChange={(event) =>
                    setTargetProjectId(event.currentTarget.value)
                  }
                >
                  {taskProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!targetProjectId || projectBusy}
                onClick={() => void addSelectedTaskToProject()}
              >
                {text.platform.projectAddTask}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles["wide-soft-action"]}
              onClick={() => navigate(Path.Projects)}
            >
              {text.platform.projectNew}
            </button>
          )}
          {projectMessage && (
            <div className={styles["form-success"]}>{projectMessage}</div>
          )}
        </section>
      )}

      {!selectedTask && (
        <>
          <div className={styles["conversation-filters"]} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === "tasks"}
              className={clsx({ [styles["active"]]: view === "tasks" })}
              onClick={() => setView("tasks")}
            >
              {text.platform.tasks}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "notifications"}
              className={clsx({ [styles["active"]]: view === "notifications" })}
              onClick={() => setView("notifications")}
            >
              {text.account.notifications}
              {unreadCount ? ` (${unreadCount})` : ""}
            </button>
          </div>

          {error && <div className={styles["form-error"]}>{error}</div>}
          <section
            className={styles["section"]}
            aria-busy={loading}
            aria-live="polite"
          >
            <div className={styles["section-head"]}>
              <h2>
                {view === "tasks"
                  ? text.platform.tasks
                  : text.account.notifications}
              </h2>
              <span>
                {view === "tasks"
                  ? taskManaging
                    ? text.common.selected(selectedTaskIds.size)
                    : text.shortCount(tasks.length)
                  : text.account.notificationUnread(unreadCount)}
              </span>
            </div>

            {view === "tasks" && (
              <select
                className={styles["task-filter-select"]}
                value={taskStatusFilter}
                aria-label={text.platform.tasks}
                onChange={(event) => {
                  setTaskStatusFilter(
                    event.currentTarget.value as "all" | MobileTaskStatus,
                  );
                  taskPageRef.current = 1;
                  taskHasMoreRef.current = true;
                  taskCursorRef.current = "";
                  setTaskPage(1);
                  setTaskHasMore(true);
                  leaveTaskManage();
                }}
              >
                <option value="all">{text.common.all}</option>
                {(
                  Object.keys(text.platform.taskStatuses) as MobileTaskStatus[]
                ).map((status) => (
                  <option key={status} value={status}>
                    {text.platform.taskStatuses[status]}
                  </option>
                ))}
              </select>
            )}

            {view === "tasks" ? (
              <div className={styles["conversation-list"]}>
                {taskManaging && !!tasks.length && (
                  <div className={styles["task-selection-toolbar"]}>
                    <button
                      type="button"
                      disabled={
                        !tasks.some(
                          (task) =>
                            selectedTaskIds.has(String(task.id)) &&
                            ["queued", "running", "streaming"].includes(
                              task.status,
                            ),
                        )
                      }
                      onClick={requestCancelSelectedTasks}
                    >
                      {text.common.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTaskIds(
                          selectedTaskIds.size === tasks.length
                            ? new Set()
                            : new Set(tasks.map((task) => String(task.id))),
                        )
                      }
                    >
                      {text.common.selectAll}
                    </button>
                    <button
                      type="button"
                      className={styles["danger-inline"]}
                      disabled={!selectedTaskIds.size}
                      onClick={requestDeleteSelectedTasks}
                    >
                      <DeleteIcon />
                      <span>{text.common.delete}</span>
                    </button>
                  </div>
                )}
                {!loading && tasks.length === 0 && (
                  <div className={styles["conversation-empty"]}>
                    <HistoryIcon />
                    <strong>{text.platform.taskEmpty}</strong>
                    <span>{text.platform.taskHint}</span>
                  </div>
                )}
                {tasks.map((task) => {
                  const taskId = String(task.id);
                  const selected = selectedTaskIds.has(taskId);
                  return (
                    <article
                      key={task.id}
                      className={clsx(styles["cloud-task-item"], {
                        [styles["selected"]]: selected,
                        [styles["managing"]]: taskManaging,
                      })}
                      onPointerDown={(event) => {
                        if (event.pointerType !== "mouse")
                          startTaskLongPress(taskId);
                      }}
                      onPointerUp={stopTaskLongPress}
                      onPointerCancel={stopTaskLongPress}
                      onPointerLeave={stopTaskLongPress}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        enterTaskManage(taskId);
                      }}
                    >
                      {taskManaging ? (
                        <input
                          type="checkbox"
                          checked={selected}
                          aria-label={text.common.select}
                          onChange={() => toggleTaskSelection(taskId)}
                        />
                      ) : (
                        <i>
                          {task.kind === "image" ? <ImageIcon /> : <ChatIcon />}
                        </i>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          stopTaskLongPress();
                          if (taskManaging) {
                            toggleTaskSelection(taskId);
                            return;
                          }
                          void openTaskDetail(task);
                        }}
                      >
                        <strong>{mobileTaskOperationLabel(task, text)}</strong>
                        <small>
                          {formatDateTime(
                            task.updated_at || task.created_at,
                            text,
                          )}
                        </small>
                      </button>
                      <em>{mobileTaskStatusLabel(task.status, text)}</em>
                      <div>
                        {!taskManaging &&
                          (task.cancellable ||
                            ["queued", "running"].includes(task.status)) && (
                            <button
                              onClick={() => void updateTask(task, "cancel")}
                            >
                              {text.common.cancel}
                            </button>
                          )}
                        {!taskManaging &&
                          (task.retryable ||
                            ["failed", "cancelled", "partial"].includes(
                              task.status,
                            )) && (
                            <button
                              onClick={() => void updateTask(task, "retry")}
                            >
                              {text.common.retry}
                            </button>
                          )}
                      </div>
                    </article>
                  );
                })}
                {!loading && !!tasks.length && (
                  <button
                    type="button"
                    className={styles["wide-soft-action"]}
                    disabled={!taskHasMore || taskLoadingMore}
                    onClick={() => void refresh(true)}
                  >
                    {taskLoadingMore
                      ? text.loading
                      : taskHasMore
                      ? text.platform.taskLoadMore
                      : text.platform.taskAllLoaded}
                  </button>
                )}
              </div>
            ) : (
              <div className={styles["notification-inbox-list"]}>
                {!!notifications.length && (
                  <div className={styles["inline-actions"]}>
                    <button
                      type="button"
                      onClick={() =>
                        void markNativePushInboxRead().then(setNotifications)
                      }
                    >
                      {text.account.markAllNotificationsRead}
                    </button>
                    <button
                      type="button"
                      className={styles["danger-inline"]}
                      onClick={() =>
                        void clearNativePushInbox().then(setNotifications)
                      }
                    >
                      {text.account.clearNotifications}
                    </button>
                  </div>
                )}
                {!loading && notifications.length === 0 && (
                  <p className={styles["empty-copy"]}>
                    {text.account.notificationEmpty}
                  </p>
                )}
                {notifications.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={clsx(styles["notification-inbox-item"], {
                      [styles["unread"]]: !item.read,
                    })}
                    onClick={() => {
                      void markNativePushInboxRead([item.id]).then(
                        setNotifications,
                      );
                      window.dispatchEvent(
                        new CustomEvent("jisudeng:push-open", { detail: item }),
                      );
                    }}
                  >
                    <i aria-hidden="true" />
                    <span>
                      <strong>
                        {item.title || text.account.notifications}
                      </strong>
                      {!!item.body && <p>{item.body}</p>}
                      <small>{formatDateTime(item.receivedAt, text)}</small>
                    </span>
                    <em>{text.account.notificationOpen}</em>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      <ConfirmSheet
        open={taskDeleteConfirmOpen}
        title={text.common.delete}
        body={text.platform.taskDeleteConfirm(
          tasks.filter(
            (task) =>
              selectedTaskIds.has(String(task.id)) &&
              !["queued", "running", "streaming"].includes(task.status),
          ).length,
        )}
        cancelLabel={text.common.cancel}
        confirmLabel={text.common.delete}
        danger
        onClose={() => setTaskDeleteConfirmOpen(false)}
        onConfirm={() => void deleteSelectedTasks()}
      />
      <ConfirmSheet
        open={taskCancelConfirmOpen}
        title={text.common.cancel}
        body={text.platform.taskCancelConfirm(
          tasks.filter(
            (task) =>
              selectedTaskIds.has(String(task.id)) &&
              ["queued", "running", "streaming"].includes(task.status),
          ).length,
        )}
        cancelLabel={text.common.back}
        confirmLabel={text.common.cancel}
        onClose={() => setTaskCancelConfirmOpen(false)}
        onConfirm={() => void cancelSelectedTasks()}
      />
      {taskNotice && (
        <div className={styles["app-toast"]} role="status" aria-live="polite">
          {taskNotice}
        </div>
      )}
    </AndroidAppShell>
  );
}

function ChatSessionDrawer(props: {
  open: boolean;
  sessions: ManagedMobileChatSession[];
  currentId: string;
  text: ManagedMobileText;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  onTogglePin: (id: string) => void;
  onClear: (id: string) => void;
  onExport: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleSessions = props.sessions.filter((session) => {
    const value = [
      chatSessionDisplayTitle(session, props.text),
      session.model,
      session.messages[session.messages.length - 1]?.content,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return value.includes(query.trim().toLowerCase());
  });
  if (!props.open) return null;
  return (
    <div
      className={styles["sheet-mask"]}
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <aside
        className={styles["session-sheet"]}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles["sheet-head"]}>
          <h2>{props.text.chat.sessions}</h2>
          <div>
            <IconButton
              label={props.text.chat.newSession}
              onClick={props.onNew}
            >
              <AddIcon />
            </IconButton>
            <IconButton label={props.text.common.close} onClick={props.onClose}>
              <CloseIcon />
            </IconButton>
          </div>
        </div>
        <label className={styles["session-search"]}>
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={props.text.chat.searchSessions}
          />
        </label>
        <div className={styles["session-list"]}>
          {props.sessions.length === 0 && (
            <p className={styles["empty-copy"]}>{props.text.chat.noSessions}</p>
          )}
          {props.sessions.length > 0 && visibleSessions.length === 0 && (
            <p className={styles["empty-copy"]}>
              {props.text.chat.noMatchingSessions}
            </p>
          )}
          {visibleSessions.map((session) => (
            <div
              key={session.id}
              className={clsx(styles["session-item"], {
                [styles["selected"]]: session.id === props.currentId,
                [styles["pinned"]]: session.pinned,
              })}
            >
              <button
                className={styles["session-select"]}
                onClick={() => props.onSelect(session.id)}
              >
                <span>{chatSessionDisplayTitle(session, props.text)}</span>
                <small>
                  {session.pinned ? `${props.text.common.pinned} · ` : ""}
                  {session.messages.length} ·{" "}
                  {formatDateTime(session.updatedAt, props.text)}
                </small>
              </button>
              <div className={styles["session-actions"]}>
                <IconButton
                  label={
                    session.pinned
                      ? props.text.chat.unpinSession
                      : props.text.chat.pinSession
                  }
                  active={session.pinned}
                  onClick={() => props.onTogglePin(session.id)}
                >
                  <HistoryIcon />
                </IconButton>
                <IconButton
                  label={props.text.chat.renameSession}
                  onClick={() => props.onRename(session.id)}
                >
                  <CopyIcon />
                </IconButton>
                <IconButton
                  label={props.text.chat.exportSession}
                  onClick={() => props.onExport(session.id)}
                >
                  <ShareIcon />
                </IconButton>
                <IconButton
                  label={props.text.chat.clearSession}
                  onClick={() => props.onClear(session.id)}
                >
                  <CloseIcon />
                </IconButton>
                <IconButton
                  label={props.text.common.delete}
                  danger
                  onClick={() => props.onDelete(session.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ChoiceSheet(props: {
  open: boolean;
  title: string;
  text: ManagedMobileText;
  items: Array<{
    id: string;
    title: string;
    detail?: string;
    active?: boolean;
  }>;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  if (!props.open) return null;
  return (
    <div
      className={styles["sheet-mask"]}
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <aside
        className={styles["session-sheet"]}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles["sheet-head"]}>
          <h2>{props.title}</h2>
          <IconButton label={props.text.common.close} onClick={props.onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className={styles["choice-list"]}>
          {props.items.length === 0 && (
            <p className={styles["empty-copy"]}>{props.text.common.empty}</p>
          )}
          {props.items.map((item) => (
            <button
              key={item.id}
              aria-label={`choice-option-${item.id}-${
                item.active ? "selected" : "unselected"
              }`}
              className={clsx({ [styles["selected"]]: item.active })}
              onClick={() => props.onSelect(item.id)}
            >
              <span>
                <strong>{item.title}</strong>
                {item.detail && <small>{item.detail}</small>}
              </span>
              {item.active && <em>{props.text.common.selectedMark}</em>}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function LibrarySheet(props: {
  open: boolean;
  title: string;
  subtitle?: string;
  text: ManagedMobileText;
  compact?: boolean;
  categories: Array<{ id: string; label: string }>;
  activeCategory: string;
  onCategory: (id: string) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div
      className={styles["sheet-mask"]}
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <aside
        className={clsx(styles["session-sheet"], {
          [styles["compact-library-sheet"]]: props.compact,
        })}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles["sheet-head"]}>
          <div>
            <h2>{props.title}</h2>
            {props.subtitle && <small>{props.subtitle}</small>}
          </div>
          <IconButton label={props.text.common.close} onClick={props.onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className={styles["library-tabs"]}>
          {props.categories.map((category) => (
            <button
              key={category.id}
              className={clsx({
                [styles["active"]]: props.activeCategory === category.id,
              })}
              onClick={() => props.onCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
        {props.children}
      </aside>
    </div>
  );
}

function ImagePromptLibrarySheet(props: {
  open: boolean;
  text: ManagedMobileText;
  currentModel?: string;
  accountId?: string;
  backendBaseUrl?: string;
  accessToken?: string;
  onClose: () => void;
  onApply: (template: ImagePromptTemplate) => void;
  onAdapt: (template: ImagePromptTemplate) => void;
  onCopy: (template: ImagePromptTemplate) => void;
}) {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [languageMode, setLanguageMode] =
    useState<ImagePromptLanguageMode>("app");
  const [libraryItems, setLibraryItems] = useState<ImagePromptTemplate[]>(
    IMAGE_PROMPT_TEMPLATES,
  );
  const [libraryCategories, setLibraryCategories] = useState<
    ImagePromptCategory[]
  >(() => fallbackImagePromptCategories(props.text));
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    readStoredJSON("jisudengchat-image-prompt-favorites-v1", [] as string[]),
  );
  const [recentIds, setRecentIds] = useState<string[]>(() =>
    readStoredJSON("jisudengchat-image-prompt-recents-v1", [] as string[]),
  );
  const coverObjectURLsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!props.open) return;
    let alive = true;
    const appLocale = mobileTextLocale(props.text);
    const locale =
      appLocale === "cn"
        ? "zh"
        : appLocale === "jp"
        ? "ja"
        : appLocale === "ko"
        ? "ko"
        : "en";
    const releaseCoverObjectURLs = () => {
      coverObjectURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
      coverObjectURLsRef.current = [];
    };
    async function applyCatalog(catalog: LocalPromptCatalog) {
      const entries = await Promise.all(
        catalog.items.map(async (item) => {
          const coverUrl = await createLocalPromptCoverObjectURL(
            catalog.accountId,
            catalog.locale,
            "image",
            item.id,
            catalog.source,
          );
          return { item, coverUrl };
        }),
      );
      if (!alive) {
        entries.forEach(({ coverUrl }) => {
          if (coverUrl) URL.revokeObjectURL(coverUrl);
        });
        return;
      }
      releaseCoverObjectURLs();
      coverObjectURLsRef.current = entries
        .map(({ coverUrl }) => coverUrl)
        .filter(Boolean);
      const normalized = entries.map(({ item, coverUrl }) =>
        localPromptCatalogItemToImageTemplate(item, coverUrl),
      );
      if (normalized.length > 0) setLibraryItems(normalized);
      const systemCategories = fallbackImagePromptCategories(props.text).filter(
        (item) => ["all", "featured", "favorites", "recent"].includes(item.id),
      );
      const remoteOnly = catalog.categories
        .map(localPromptCatalogCategoryToImageCategory)
        .filter(
          (item) =>
            item.id &&
            !systemCategories.some((system) => system.id === item.id),
        );
      setLibraryCategories([...systemCategories, ...remoteOnly]);
    }
    async function loadLibrary() {
      const accountId = String(props.accountId || "").trim();
      const accessToken = String(props.accessToken || "").trim();
      const backendBaseUrl = String(props.backendBaseUrl || "").trim();
      try {
        if (!accountId) return;
        const cached = await readLocalPromptCatalog(
          accountId,
          locale,
          "image",
          "canvas",
        );
        if (cached) await applyCatalog(cached);
        if (!accessToken || !backendBaseUrl) return;
        const synced = await syncLocalPromptCatalog(
          accountId,
          locale,
          "image",
          backendBaseUrl,
          accessToken,
          undefined,
          "canvas",
        );
        await applyCatalog(synced.catalog);
      } catch {
        if (alive && !String(props.accountId || "").trim()) {
          setLibraryItems(IMAGE_PROMPT_TEMPLATES);
          setLibraryCategories(fallbackImagePromptCategories(props.text));
        }
      }
    }
    loadLibrary();
    return () => {
      alive = false;
      releaseCoverObjectURLs();
    };
  }, [
    props.accessToken,
    props.accountId,
    props.backendBaseUrl,
    props.open,
    props.text,
  ]);

  function markRecent(id: string) {
    setRecentIds((ids) => {
      const next = [id, ...ids.filter((item) => item !== id)].slice(0, 30);
      writeStoredJSON("jisudengchat-image-prompt-recents-v1", next);
      return next;
    });
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((ids) => {
      const next = ids.includes(id)
        ? ids.filter((item) => item !== id)
        : [id, ...ids].slice(0, 200);
      writeStoredJSON("jisudengchat-image-prompt-favorites-v1", next);
      return next;
    });
  }

  const queryValue = query.trim().toLowerCase();
  const items = libraryItems.filter((item) => {
    const categoryMatch =
      category === "all" ||
      (category === "featured" && item.featured) ||
      (category === "favorites" && favoriteIds.includes(item.id)) ||
      (category === "recent" && recentIds.includes(item.id)) ||
      item.category === category ||
      item.categories?.includes(category);
    if (!categoryMatch) return false;
    if (!queryValue) return true;
    return [
      localizedValue(item.title, props.text),
      localizedValue(item.description, props.text),
      localizedValue(item.prompt, props.text),
      item.prompt.cn,
      item.prompt.en,
      item.prompt.jp,
      item.prompt.ko,
      item.author,
      item.source,
      item.domain,
      item.style,
      item.subject,
      ...(item.categories || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(queryValue);
  });
  return (
    <LibrarySheet
      open={props.open}
      title={props.text.image.promptLibrary}
      subtitle={props.text.image.promptLibraryHint}
      text={props.text}
      categories={libraryCategories}
      activeCategory={category}
      onCategory={setCategory}
      onClose={props.onClose}
    >
      <label className={styles["session-search"]}>
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={props.text.image.searchPrompts}
        />
      </label>
      <div className={styles["prompt-language-row"]}>
        {(
          [
            ["app", props.text.image.languageApp],
            ["zh", "中文"],
            [
              "en",
              localizedValue(
                { cn: "英文", en: "English", jp: "英語", ko: "영어" },
                props.text,
              ),
            ],
            [
              "jp",
              localizedValue(
                { cn: "日文", en: "Japanese", jp: "日本語", ko: "일본어" },
                props.text,
              ),
            ],
            [
              "ko",
              localizedValue(
                { cn: "韩文", en: "Korean", jp: "韓国語", ko: "한국어" },
                props.text,
              ),
            ],
            ["both", props.text.image.languageBoth],
          ] as Array<[ImagePromptLanguageMode, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            className={clsx({ [styles["active"]]: languageMode === id })}
            onClick={() => setLanguageMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles["library-list"]}>
        {items.map((item) => (
          <article key={item.id} className={styles["library-item"]}>
            {item.coverUrl && (
              <img
                className={styles["prompt-library-cover"]}
                src={item.coverUrl}
                alt=""
                loading="lazy"
              />
            )}
            <div className={styles["library-item-main"]}>
              <strong>{localizedValue(item.title, props.text)}</strong>
              <small>{localizedValue(item.description, props.text)}</small>
              <p className={styles["image-prompt-text"]}>
                {imagePromptText(item, props.text, languageMode)}
              </p>
              <em className={styles["library-meta"]}>
                {[
                  item.author || "Jisudeng",
                  item.source || "Jisudeng",
                  item.needReferenceImages
                    ? props.text.image.referenceRecommended
                    : "",
                  item.params.size,
                  item.params.quality,
                  item.params.style,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </em>
            </div>
            <div className={styles["inline-actions"]}>
              <button
                onClick={() => {
                  markRecent(item.id);
                  props.onApply(item);
                }}
              >
                <AddIcon />
                <span>{props.text.image.applyPrompt}</span>
              </button>
              <button
                onClick={() => {
                  markRecent(item.id);
                  props.onAdapt(item);
                }}
              >
                <SettingsIcon />
                <span>{props.text.image.adaptPrompt}</span>
              </button>
              <button
                onClick={() => {
                  markRecent(item.id);
                  props.onCopy({
                    ...item,
                    prompt: {
                      cn: imagePromptText(item, props.text, languageMode),
                      en: imagePromptText(item, props.text, languageMode),
                    },
                  });
                }}
              >
                <CopyIcon />
                <span>{props.text.common.copy}</span>
              </button>
              <button onClick={() => toggleFavorite(item.id)}>
                <FavoriteIcon />
                <span>
                  {favoriteIds.includes(item.id)
                    ? props.text.image.unfavoriteImage
                    : props.text.image.favoriteImage}
                </span>
              </button>
            </div>
          </article>
        ))}
        {items.length === 0 && (
          <p className={styles["empty-copy"]}>{props.text.image.noPrompts}</p>
        )}
      </div>
    </LibrarySheet>
  );
}

function ChatAgentLibrarySheet(props: {
  open: boolean;
  text: ManagedMobileText;
  activeId?: string;
  onClose: () => void;
  onSelect: (template: ChatAgentTemplate | null) => void;
}) {
  const [category, setCategory] = useState("all");
  const categories = [
    { id: "all", label: props.text.common.all },
    {
      id: "collaboration",
      label: localizedValue(
        { cn: "协作", en: "Collab", jp: "協働", ko: "협업" },
        props.text,
      ),
    },
    {
      id: "writing",
      label: localizedValue(
        { cn: "写作", en: "Writing", jp: "執筆", ko: "작성" },
        props.text,
      ),
    },
    {
      id: "code",
      label: localizedValue(
        { cn: "代码", en: "Code", jp: "コード", ko: "코드" },
        props.text,
      ),
    },
    {
      id: "operation",
      label: localizedValue(
        { cn: "运营", en: "Ops", jp: "運用", ko: "운영" },
        props.text,
      ),
    },
    {
      id: "support",
      label: localizedValue(
        { cn: "客服", en: "Support", jp: "サポート", ko: "지원" },
        props.text,
      ),
    },
    {
      id: "product",
      label: localizedValue(
        { cn: "产品", en: "Product", jp: "プロダクト", ko: "제품" },
        props.text,
      ),
    },
    {
      id: "ai",
      label: localizedValue(
        { cn: "AI创作", en: "AI", jp: "AI 創作", ko: "AI 창작" },
        props.text,
      ),
    },
    {
      id: "analysis",
      label: localizedValue(
        { cn: "分析", en: "Analysis", jp: "分析", ko: "분석" },
        props.text,
      ),
    },
    {
      id: "business",
      label: localizedValue(
        { cn: "商业", en: "Business", jp: "ビジネス", ko: "비즈니스" },
        props.text,
      ),
    },
    {
      id: "translation",
      label: localizedValue(
        { cn: "翻译", en: "Translation", jp: "翻訳", ko: "번역" },
        props.text,
      ),
    },
    {
      id: "legal",
      label: localizedValue(
        { cn: "法律", en: "Legal", jp: "法務", ko: "법률" },
        props.text,
      ),
    },
  ];
  const items = CHAT_AGENT_TEMPLATES.filter(
    (item) => category === "all" || item.category === category,
  );
  return (
    <LibrarySheet
      open={props.open}
      title={props.text.chat.agentLibrary}
      subtitle={props.text.chat.agentLibraryHint}
      text={props.text}
      compact
      categories={categories}
      activeCategory={category}
      onCategory={setCategory}
      onClose={props.onClose}
    >
      <div className={styles["library-list"]}>
        <article
          className={clsx(
            styles["library-item"],
            styles["agent-library-item"],
            { [styles["active"]]: !props.activeId },
          )}
        >
          <div>
            <strong>{props.text.chat.defaultAgent}</strong>
            <small>{props.text.chat.defaultAgentHint}</small>
          </div>
          <div className={styles["inline-actions"]}>
            <button onClick={() => props.onSelect(null)}>
              <BotIcon />
              <span>{props.text.common.select}</span>
            </button>
          </div>
        </article>
        {items.map((item) => (
          <article
            key={item.id}
            className={clsx(
              styles["library-item"],
              styles["agent-library-item"],
              {
                [styles["active"]]: props.activeId === item.id,
              },
            )}
          >
            <div>
              <strong>{localizedValue(item.title, props.text)}</strong>
              <small>{localizedValue(item.description, props.text)}</small>
              <em>{localizedValue(item.personality, props.text)}</em>
            </div>
            <div className={styles["inline-actions"]}>
              <button onClick={() => props.onSelect(item)}>
                <BotIcon />
                <span>{props.text.common.select}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </LibrarySheet>
  );
}

function ChatSkillLibrarySheet(props: {
  open: boolean;
  text: ManagedMobileText;
  activeId?: string;
  serverSkills: MobileSkill[];
  serverLoading: boolean;
  serverUnavailable: boolean;
  usingSkillId: string;
  onClose: () => void;
  onSelectLocal: (skill: ChatSkillTemplate | null) => void;
  onSelectServer: (skill: MobileSkill) => void;
}) {
  const [category, setCategory] = useState("all");
  const [localDetail, setLocalDetail] = useState<ChatSkillTemplate | null>(
    null,
  );
  const [serverDetail, setServerDetail] = useState<MobileSkill | null>(null);
  const categories = [
    { id: "all", label: props.text.common.all },
    {
      id: "document",
      label: localizedValue(
        { cn: "文档", en: "Docs", jp: "文書", ko: "문서" },
        props.text,
      ),
    },
    {
      id: "image",
      label: localizedValue(
        { cn: "图片", en: "Image", jp: "画像", ko: "이미지" },
        props.text,
      ),
    },
    {
      id: "business",
      label: localizedValue(
        { cn: "商业", en: "Business", jp: "ビジネス", ko: "비즈니스" },
        props.text,
      ),
    },
    {
      id: "marketing",
      label: localizedValue(
        { cn: "营销", en: "Marketing", jp: "マーケ", ko: "마케팅" },
        props.text,
      ),
    },
    {
      id: "code",
      label: localizedValue(
        { cn: "代码", en: "Code", jp: "コード", ko: "코드" },
        props.text,
      ),
    },
    {
      id: "support",
      label: localizedValue(
        { cn: "客服", en: "Support", jp: "サポート", ko: "지원" },
        props.text,
      ),
    },
    {
      id: "legal",
      label: localizedValue(
        { cn: "合同", en: "Legal", jp: "法務", ko: "법무" },
        props.text,
      ),
    },
    {
      id: "education",
      label: localizedValue(
        { cn: "学习", en: "Study", jp: "学習", ko: "학습" },
        props.text,
      ),
    },
    {
      id: "office",
      label: localizedValue(
        { cn: "办公", en: "Office", jp: "オフィス", ko: "오피스" },
        props.text,
      ),
    },
    {
      id: "translation",
      label: localizedValue(
        { cn: "翻译", en: "Translation", jp: "翻訳", ko: "번역" },
        props.text,
      ),
    },
  ];
  const items = CHAT_SKILL_TEMPLATES.filter(
    (item) =>
      category === "all" || normalizedSkillCategory(item.category) === category,
  );
  const serverItems = props.serverSkills.filter(
    (skill) =>
      category === "all" ||
      normalizedSkillCategory(skill.category || skill.slug) === category,
  );
  const detailTitle = localDetail
    ? localizedValue(localDetail.title, props.text)
    : serverDetail
    ? serverSkillTitle(serverDetail, props.text)
    : "";
  const detailDescription = localDetail
    ? localizedValue(localDetail.description, props.text)
    : serverDetail
    ? serverSkillDescription(serverDetail, props.text)
    : "";
  const detailCategory = localDetail
    ? skillCategoryLabel(localDetail.category, props.text)
    : serverDetail
    ? skillCategoryLabel(serverDetail.category || serverDetail.slug, props.text)
    : "";
  const detailExamples = localDetail
    ? localDetail.examples.map((example) => localizedValue(example, props.text))
    : serverDetail?.examples || [];
  const detailInputHint = localDetail
    ? localSkillInputHint(localDetail, props.text)
    : serverDetail
    ? serverSkillInputHint(serverDetail, props.text)
    : "";
  const detailConsumption = localDetail
    ? localSkillConsumptionHint(props.text)
    : serverDetail
    ? serverSkillConsumptionHint(serverDetail, props.text)
    : "";
  const closeDetail = () => {
    setLocalDetail(null);
    setServerDetail(null);
  };
  return (
    <LibrarySheet
      open={props.open}
      title={props.text.platform.skills}
      subtitle={props.text.platform.skillHint}
      text={props.text}
      compact
      categories={categories}
      activeCategory={category}
      onCategory={setCategory}
      onClose={props.onClose}
    >
      <div className={styles["library-list"]}>
        {props.serverLoading && (
          <p className={styles["empty-copy"]}>
            {props.text.platform.skillLoading}
          </p>
        )}
        {props.serverUnavailable && (
          <p className={styles["sync-notice"]}>
            {props.text.platform.skillFallback}
          </p>
        )}
        <article
          className={clsx(
            styles["library-item"],
            styles["skill-library-item"],
            { [styles["active"]]: !props.activeId },
          )}
        >
          <div className={styles["library-item-main"]}>
            <strong>{props.text.platform.noSkill}</strong>
            <small>{props.text.platform.noSkillHint}</small>
            <em>
              {localizedValue(
                {
                  cn: "普通对话",
                  en: "Normal chat",
                  jp: "通常チャット",
                  ko: "일반 채팅",
                },
                props.text,
              )}
            </em>
          </div>
          <div className={styles["inline-actions"]}>
            <button onClick={() => props.onSelectLocal(null)}>
              <PromptIcon />
              <span>{props.text.common.select}</span>
            </button>
          </div>
        </article>
        {serverItems.map((skill) => (
          <article
            key={`server-${skill.id}`}
            className={clsx(
              styles["library-item"],
              styles["skill-library-item"],
              { [styles["active"]]: props.activeId === `server:${skill.slug}` },
            )}
          >
            <div className={styles["library-item-main"]}>
              <strong>{serverSkillTitle(skill, props.text)}</strong>
              <small>{serverSkillDescription(skill, props.text)}</small>
              <div className={styles["skill-badge-row"]}>
                <span>{props.text.platform.skillServerSource}</span>
                <span>
                  {skillCategoryLabel(skill.category || skill.slug, props.text)}
                </span>
                {skill.version?.version && (
                  <span>v{skill.version.version}</span>
                )}
              </div>
              <em>{serverSkillInputHint(skill, props.text)}</em>
            </div>
            <div className={styles["inline-actions"]}>
              <button
                type="button"
                onClick={() => {
                  setLocalDetail(null);
                  setServerDetail(skill);
                }}
              >
                <PromptIcon />
                <span>{props.text.platform.skillDetail}</span>
              </button>
              <button
                disabled={props.usingSkillId === String(skill.id)}
                onClick={() => props.onSelectServer(skill)}
              >
                <AddIcon />
                <span>
                  {props.usingSkillId === String(skill.id)
                    ? props.text.platform.skillUsing
                    : props.text.platform.skillUse}
                </span>
              </button>
            </div>
          </article>
        ))}
        {items.map((item) => (
          <article
            key={item.id}
            className={clsx(
              styles["library-item"],
              styles["skill-library-item"],
              { [styles["active"]]: props.activeId === `local:${item.id}` },
            )}
          >
            <div className={styles["library-item-main"]}>
              <strong>{localizedValue(item.title, props.text)}</strong>
              <small>{localizedValue(item.description, props.text)}</small>
              <div className={styles["skill-badge-row"]}>
                <span>{props.text.platform.skillLocalSource}</span>
                <span>{skillCategoryLabel(item.category, props.text)}</span>
              </div>
              <em>{localSkillInputHint(item, props.text)}</em>
            </div>
            <div className={styles["inline-actions"]}>
              <button
                type="button"
                onClick={() => {
                  setServerDetail(null);
                  setLocalDetail(item);
                }}
              >
                <PromptIcon />
                <span>{props.text.platform.skillDetail}</span>
              </button>
              <button onClick={() => props.onSelectLocal(item)}>
                <AddIcon />
                <span>{props.text.platform.skillUse}</span>
              </button>
            </div>
          </article>
        ))}
        {!props.serverLoading && serverItems.length + items.length === 0 && (
          <p className={styles["empty-copy"]}>{props.text.common.empty}</p>
        )}
      </div>
      {(localDetail || serverDetail) && (
        <div className={styles["skill-detail-overlay"]} role="dialog">
          <section className={styles["skill-detail-card"]}>
            <div className={styles["sheet-head"]}>
              <div>
                <span>{props.text.platform.skillDetail}</span>
                <h2>{detailTitle}</h2>
              </div>
              <button className={styles["icon-button"]} onClick={closeDetail}>
                <CloseIcon />
              </button>
            </div>
            <p>{detailDescription}</p>
            <div className={styles["skill-badge-row"]}>
              <span>
                {localDetail
                  ? props.text.platform.skillLocalSource
                  : props.text.platform.skillServerSource}
              </span>
              <span>{detailCategory}</span>
              {serverDetail?.author && <span>{serverDetail.author}</span>}
              {serverDetail?.version?.version && (
                <span>v{serverDetail.version.version}</span>
              )}
            </div>
            <div className={styles["skill-detail-section"]}>
              <strong>{props.text.platform.skillInputRequirements}</strong>
              <p>{detailInputHint}</p>
            </div>
            <div className={styles["skill-detail-section"]}>
              <strong>{props.text.platform.skillOutput}</strong>
              <p>
                {localDetail
                  ? localizedValue(localDetail.instruction, props.text)
                  : detailDescription}
              </p>
            </div>
            <div className={styles["skill-detail-section"]}>
              <strong>{props.text.platform.skillExamples}</strong>
              {detailExamples.length > 0 ? (
                <ul>
                  {detailExamples.slice(0, 4).map((example, index) => (
                    <li key={`${detailTitle}-example-${index}`}>{example}</li>
                  ))}
                </ul>
              ) : (
                <p>{props.text.platform.skillNoExamples}</p>
              )}
            </div>
            {serverDetail && serverDetail.parameters?.length ? (
              <div className={styles["skill-detail-section"]}>
                <strong>{props.text.platform.skillParameters}</strong>
                <ul>
                  {serverDetail.parameters.slice(0, 6).map((param) => (
                    <li key={param.key}>
                      {isChineseMobileText(props.text) && param.label_zh
                        ? param.label_zh
                        : param.label}
                      {param.required
                        ? ` · ${localizedValue(
                            {
                              cn: "必填",
                              en: "Required",
                              jp: "必須",
                              ko: "필수",
                            },
                            props.text,
                          )}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className={styles["skill-detail-section"]}>
              <strong>{props.text.platform.skillPermissions}</strong>
              {serverDetail?.permissions?.length ? (
                <ul>
                  {serverDetail.permissions.slice(0, 6).map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              ) : (
                <p>{props.text.platform.skillNoPermissions}</p>
              )}
            </div>
            <div className={styles["skill-detail-section"]}>
              <strong>{props.text.platform.skillConsumption}</strong>
              <p>{detailConsumption}</p>
            </div>
            <div className={styles["inline-actions"]}>
              <button type="button" onClick={closeDetail}>
                <CloseIcon />
                <span>{props.text.common.close}</span>
              </button>
              <button
                type="button"
                disabled={
                  !!serverDetail &&
                  props.usingSkillId === String(serverDetail.id)
                }
                onClick={() => {
                  if (localDetail) props.onSelectLocal(localDetail);
                  if (serverDetail) props.onSelectServer(serverDetail);
                }}
              >
                <AddIcon />
                <span>
                  {serverDetail &&
                  props.usingSkillId === String(serverDetail.id)
                    ? props.text.platform.skillUsing
                    : props.text.platform.skillUse}
                </span>
              </button>
            </div>
          </section>
        </div>
      )}
    </LibrarySheet>
  );
}

function MessageActionSheet(props: {
  target: ChatMessageActionTarget;
  text: ManagedMobileText;
  onClose: () => void;
  onCopy: () => void;
  onView: () => void;
  onSelectText: () => void;
  onQuote: () => void;
  onRetry: () => void;
  onReport: () => void;
  onDelete: () => void;
}) {
  const message = props.target.message;
  const canRetry =
    message.role === "user" ||
    message.status === "error" ||
    message.status === "cancelled";
  return (
    <div
      className={styles["sheet-mask"]}
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <aside
        className={styles["session-sheet"]}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles["sheet-head"]}>
          <h2>{props.text.chat.messageActions}</h2>
          <IconButton label={props.text.common.close} onClick={props.onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className={styles["message-action-preview"]}>
          <span>
            {message.role === "user"
              ? props.text.chat.userRole
              : message.role === "assistant"
              ? props.text.chat.assistantRole
              : props.text.chat.systemRole}
          </span>
          <strong>
            {message.content ||
              (message.imageUrls?.length
                ? props.text.chat.imageAttached(message.imageUrls.length)
                : props.text.common.empty)}
          </strong>
        </div>
        <div className={styles["message-actions"]}>
          <button onClick={props.onCopy}>
            <CopyIcon />
            <span>{props.text.common.copy}</span>
          </button>
          <button onClick={props.onView}>
            <MaxIcon />
            <span>{props.text.chat.viewFullText}</span>
          </button>
          <button onClick={props.onSelectText}>
            <AddIcon />
            <span>{props.text.chat.selectAll}</span>
          </button>
          <button onClick={props.onQuote}>
            <ChatIcon />
            <span>{props.text.chat.quote}</span>
          </button>
          <button onClick={props.onRetry} disabled={!canRetry}>
            <ReloadIcon />
            <span>{props.text.chat.retryMessage}</span>
          </button>
          <button onClick={props.onReport}>
            <CloudFailIcon />
            <span>{props.text.account.aiContentReport}</span>
          </button>
          <button className={styles["danger-inline"]} onClick={props.onDelete}>
            <DeleteIcon />
            <span>{props.text.common.delete}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

function SessionActionSheet(props: {
  session: ManagedMobileChatSession | null;
  text: ManagedMobileText;
  onClose: () => void;
  onOpen: () => void;
  onRename: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  if (!props.session) return null;
  return (
    <div
      className={styles["sheet-mask"]}
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <aside
        className={styles["session-sheet"]}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles["sheet-head"]}>
          <div>
            <h2>{props.text.chat.sessions}</h2>
            <small>{chatSessionDisplayTitle(props.session, props.text)}</small>
          </div>
          <IconButton label={props.text.common.close} onClick={props.onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className={styles["message-actions"]}>
          <button onClick={props.onOpen}>
            <ChatIcon />
            <span>{props.text.common.open}</span>
          </button>
          <button onClick={props.onRename}>
            <CopyIcon />
            <span>{props.text.common.rename}</span>
          </button>
          <button onClick={props.onTogglePin}>
            <HistoryIcon />
            <span>
              {props.session.pinned
                ? props.text.common.unpin
                : props.text.common.pin}
            </span>
          </button>
          <button className={styles["danger-inline"]} onClick={props.onDelete}>
            <DeleteIcon />
            <span>{props.text.common.delete}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

function RenameSessionDialog(props: {
  open: boolean;
  title: string;
  initialValue: string;
  text: ManagedMobileText;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(props.initialValue);
  useEffect(() => {
    if (props.open) setValue(props.initialValue);
  }, [props.initialValue, props.open]);
  if (!props.open) return null;
  return (
    <div
      className={styles["sheet-mask"]}
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <aside
        className={styles["confirm-dialog"]}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{props.title}</h2>
        <label className={styles["session-search"]}>
          <input
            autoFocus
            value={value}
            maxLength={60}
            onChange={(event) => setValue(event.currentTarget.value)}
            placeholder={props.text.chat.renamePrompt}
          />
        </label>
        <div className={styles["dialog-actions"]}>
          <button type="button" onClick={props.onClose}>
            {props.text.common.cancel}
          </button>
          <button
            type="button"
            disabled={!value.trim()}
            onClick={() => props.onSubmit(value.trim())}
          >
            {props.text.common.save}
          </button>
        </div>
      </aside>
    </div>
  );
}

function ImageTaskActionSheet(props: {
  item: any | null;
  text: ManagedMobileText;
  onClose: () => void;
  onOpen: () => void;
  onReuse: () => void;
  onRetry: () => void;
  onReport: () => void;
  onDelete: () => void;
}) {
  if (!props.item) return null;
  const canRetry = !["running", "queued"].includes(String(props.item.status));
  return (
    <div
      className={styles["sheet-mask"]}
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <aside
        className={styles["session-sheet"]}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles["sheet-head"]}>
          <div>
            <h2>{props.text.image.details}</h2>
            <small>
              {props.item.params?.prompt ||
                props.item.prompt ||
                props.text.image.generate}
            </small>
          </div>
          <IconButton label={props.text.common.close} onClick={props.onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className={styles["message-actions"]}>
          <button onClick={props.onOpen}>
            <ImageIcon />
            <span>{props.text.image.viewOriginal}</span>
          </button>
          <button onClick={props.onReuse}>
            <CopyIcon />
            <span>{props.text.image.applyPrompt}</span>
          </button>
          <button onClick={props.onRetry} disabled={!canRetry}>
            <ReloadIcon />
            <span>{props.text.image.retryTask}</span>
          </button>
          <button onClick={props.onReport}>
            <CloudFailIcon />
            <span>{props.text.account.aiContentReport}</span>
          </button>
          <button className={styles["danger-inline"]} onClick={props.onDelete}>
            <DeleteIcon />
            <span>{props.text.common.delete}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

function messageRoleLabel(
  message: ManagedMobileChatMessage,
  text: ManagedMobileText,
) {
  if (message.role === "user") return text.chat.userRole;
  if (message.role === "assistant") return text.chat.assistantRole;
  return text.chat.systemRole;
}

function messageTextValue(
  message: ManagedMobileChatMessage,
  text: ManagedMobileText,
) {
  return (
    message.content ||
    (message.imageUrls?.length
      ? text.chat.imageAttached(message.imageUrls.length)
      : "")
  );
}

function reportSnippet(value: string, max = 1200) {
  const normalized = String(value || "").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…`;
}

function writeMobileReportDraft(draft: MobileReportDraft) {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        MOBILE_REPORT_DRAFT_STORAGE_KEY,
        JSON.stringify(draft),
      );
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        MOBILE_REPORT_DRAFT_STORAGE_KEY,
        JSON.stringify(draft),
      );
    }
  } catch {
    // Keep the manual feedback form usable even when storage is blocked.
  }
}

function readMobileReportDraft(): MobileReportDraft | null {
  const stores: Storage[] = [];
  if (typeof sessionStorage !== "undefined") stores.push(sessionStorage);
  if (typeof localStorage !== "undefined") stores.push(localStorage);
  for (const storage of stores) {
    try {
      const raw = storage.getItem(MOBILE_REPORT_DRAFT_STORAGE_KEY);
      if (!raw) continue;
      storage.removeItem(MOBILE_REPORT_DRAFT_STORAGE_KEY);
      const parsed = JSON.parse(raw) as Partial<MobileReportDraft>;
      if (
        parsed?.category === "ai_content_report" &&
        typeof parsed.title === "string" &&
        typeof parsed.content === "string"
      ) {
        return {
          category: "ai_content_report",
          title: parsed.title,
          content: parsed.content,
          createdAt: Number(parsed.createdAt || Date.now()),
        };
      }
    } catch {
      // Ignore malformed drafts and keep the manual feedback form usable.
    }
  }
  return null;
}

function buildChatReportDraft(
  message: ManagedMobileChatMessage,
  text: ManagedMobileText,
): MobileReportDraft {
  const role = messageRoleLabel(message, text);
  const content = messageTextValue(message, text);
  return {
    category: "ai_content_report",
    title: text.account.aiContentReportChatTitle,
    content: [
      text.account.aiContentReportIntro,
      "Surface: chat",
      `Role: ${role}`,
      `Message ID: ${message.id}`,
      `Status: ${message.status || "done"}`,
      `Content:\n${reportSnippet(content || text.common.empty)}`,
    ].join("\n\n"),
    createdAt: Date.now(),
  };
}

function buildImageReportDraft(
  item: any,
  text: ManagedMobileText,
): MobileReportDraft {
  const prompt = item?.params?.prompt || item?.prompt || "";
  const imageCount = imageResults(item).length;
  return {
    category: "ai_content_report",
    title: text.account.aiContentReportImageTitle,
    content: [
      text.account.aiContentReportIntro,
      "Surface: image",
      `Task ID: ${item?.id || text.common.empty}`,
      `Status: ${item?.status || text.common.empty}`,
      `Model: ${item?.model_name || item?.model || text.common.empty}`,
      `Images: ${imageCount}`,
      `Prompt:\n${reportSnippet(prompt || text.common.empty)}`,
      item?.error ? `Error:\n${reportSnippet(item.error)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    createdAt: Date.now(),
  };
}

function parseMarkdownTable(lines: string[], start: number) {
  if (start + 1 >= lines.length) return null;
  const header = lines[start];
  const separator = lines[start + 1];
  if (!header.includes("|")) return null;
  if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separator)) {
    return null;
  }
  const rows: string[][] = [];
  let index = start;
  while (index < lines.length && lines[index].includes("|")) {
    rows.push(
      lines[index]
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
    index += 1;
  }
  if (rows.length < 2) return null;
  return {
    rows: [rows[0], ...rows.slice(2)],
    nextIndex: index,
  };
}

function renderPlainMessageLines(content: string) {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];

  function renderInlineText(value: string, keyPrefix: string) {
    const parts = value.split(/(https?:\/\/[^\s<]+)/gi);
    return parts.map((part, index) => {
      if (!/^https?:\/\//i.test(part)) return part;
      const trailing =
        part.match(/[),.;!?\u3002\uff0c\uff01\uff1b\uff1a]+$/)?.[0] || "";
      const url = trailing ? part.slice(0, -trailing.length) : part;
      return (
        <Fragment key={`${keyPrefix}-link-${index}`}>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault();
              void openExternalUrl(url);
            }}
          >
            {url}
          </a>
          {trailing}
        </Fragment>
      );
    });
  }

  let paragraph: string[] = [];

  function flushParagraph(key: string) {
    if (!paragraph.length) return;
    nodes.push(
      <p key={key}>
        {paragraph
          .join("\n")
          .replace(/^\s{0,3}#{1,6}\s+/gm, "")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .split("\n")
          .map((line, index, lines) => (
            <Fragment key={`${key}-line-${index}`}>
              {index > 0 ? "\n" : null}
              {renderInlineText(line, `${key}-${lines.length}`)}
            </Fragment>
          ))}
      </p>,
    );
    paragraph = [];
  }

  for (let index = 0; index < lines.length; ) {
    const table = parseMarkdownTable(lines, index);
    if (table) {
      flushParagraph(`p-${index}`);
      const [head, ...body] = table.rows;
      nodes.push(
        <div className={styles["message-table-wrap"]} key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {head.map((cell, cellIndex) => (
                  <th key={`${cell}-${cellIndex}`}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      index = table.nextIndex;
      continue;
    }
    if (!lines[index].trim()) {
      flushParagraph(`p-${index}`);
      index += 1;
      continue;
    }
    paragraph.push(lines[index]);
    index += 1;
  }
  flushParagraph("p-tail");
  return nodes;
}

function MobileMessageContent(props: { content: string }) {
  const blocks: ReactNode[] = [];
  const pattern = /```([a-z0-9_-]*)\n?([\s\S]*?)```/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(props.content))) {
    const plain = props.content.slice(lastIndex, match.index);
    if (plain.trim()) {
      blocks.push(
        <div className={styles["message-text"]} key={`text-${lastIndex}`}>
          {renderPlainMessageLines(plain)}
        </div>,
      );
    }
    blocks.push(
      <pre className={styles["message-code"]} key={`code-${match.index}`}>
        <code>{match[2].trim()}</code>
      </pre>,
    );
    lastIndex = match.index + match[0].length;
  }
  const tail = props.content.slice(lastIndex);
  if (tail.trim() || blocks.length === 0) {
    blocks.push(
      <div className={styles["message-text"]} key="text-tail">
        {renderPlainMessageLines(tail)}
      </div>,
    );
  }
  return <>{blocks}</>;
}

function MessageViewerModal(props: {
  target: ChatMessageActionTarget;
  text: ManagedMobileText;
  onClose: () => void;
  onCopy: () => void;
  onQuote: () => void;
  onReport: () => void;
  onDelete: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const message = props.target.message;
  const value = messageTextValue(message, props.text);
  return (
    <div className={styles["message-viewer"]} onClick={props.onClose}>
      <section onClick={(event) => event.stopPropagation()}>
        <header className={styles["viewer-head"]}>
          <IconButton label={props.text.common.close} onClick={props.onClose}>
            <CloseIcon />
          </IconButton>
          <div>
            <span>{messageRoleLabel(message, props.text)}</span>
            <h2>{props.text.chat.messageDetail}</h2>
          </div>
          <IconButton
            label={props.text.chat.selectAll}
            onClick={() => {
              textareaRef.current?.focus();
              textareaRef.current?.select();
            }}
          >
            <MaxIcon />
          </IconButton>
        </header>
        {message.imageUrls?.length ? (
          <div className={styles["message-images"]}>
            {message.imageUrls.map((url) => (
              <img key={url} src={url} alt={props.text.chat.uploadImage} />
            ))}
          </div>
        ) : null}
        <textarea ref={textareaRef} readOnly value={value} />
        <div className={styles["message-actions"]}>
          <button onClick={props.onCopy}>
            <CopyIcon />
            <span>{props.text.common.copy}</span>
          </button>
          <button onClick={props.onQuote}>
            <ChatIcon />
            <span>{props.text.chat.quote}</span>
          </button>
          <button onClick={props.onReport}>
            <CloudFailIcon />
            <span>{props.text.account.aiContentReport}</span>
          </button>
          <button className={styles["danger-inline"]} onClick={props.onDelete}>
            <DeleteIcon />
            <span>{props.text.common.delete}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function AndroidChat() {
  const managed = useManagedNextChatStore();
  const mobileStore = useManagedMobileAppStore();
  const text = useMobileText();
  const location = useLocation();
  const navigate = useNavigate();
  const workspace = managed.workspace;
  const groups = workspace?.models?.groups ?? [];
  const chatGroup = bestChatGroup(workspace);
  const hasChatGroup = Boolean(chatGroup);
  const [preferredChatGroupId, setPreferredChatGroupId] = useState<
    number | undefined
  >(() => storedChatPreferenceGroupID() || undefined);
  const currentSession =
    mobileStore.chatSessions.find(
      (session) => session.id === mobileStore.currentChatId,
    ) || null;
  const defaultChatGroupId = preferredChatGroupID(
    workspace,
    preferredChatGroupId,
  );
  const [draftGroupId, setDraftGroupId] = useState<number | undefined>(
    () => storedChatPreferenceGroupID() || undefined,
  );
  const currentSessionChatGroupId = currentSession
    ? preferredChatGroupID(workspace, currentSession.groupId)
    : undefined;
  const draftChatGroupId = preferredChatGroupID(workspace, draftGroupId);
  const effectiveChatGroupId =
    currentSessionChatGroupId ||
    draftChatGroupId ||
    defaultChatGroupId ||
    chatGroup?.id;
  const models = chatModelsForGroup(workspace, effectiveChatGroupId);
  const fallbackModel = modelValue(models[0]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [sharedMaterials, setSharedMaterials] = useState<MaterialDraft[]>([]);
  const [serverSkills, setServerSkills] = useState<MobileSkill[]>([]);
  const [serverSkillsLoading, setServerSkillsLoading] = useState(false);
  const [serverSkillsUnavailable, setServerSkillsUnavailable] = useState(false);
  const [usingSkillId, setUsingSkillId] = useState("");
  const [serverSkillSelections, setServerSkillSelections] = useState<
    Record<string, ServerSkillSelection>
  >(() => readStoredJSON(SERVER_SKILL_SELECTION_KEY, {}));
  const [draftModel, setDraftModel] = useState(() =>
    storedChatPreferenceModel(storedChatPreferenceGroupID() || undefined),
  );
  const [draftAgentId, setDraftAgentId] = useState("");
  const [draftSkillSelection, setDraftSkillSelection] =
    useState<ServerSkillSelection | null>(null);
  const selectedModel = currentSession?.model || draftModel || fallbackModel;
  const selectedModelIsAvailable =
    Boolean(selectedModel) &&
    models.some((model) => modelValue(model) === selectedModel);
  const webSearchServiceAvailable = isMobileWebSearchAvailable(
    managed.mobileProtocol,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [agentSheetOpen, setAgentSheetOpen] = useState(false);
  const [skillSheetOpen, setSkillSheetOpen] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const activeAgent =
    CHAT_AGENT_TEMPLATES.find(
      (item) => item.id === (currentSession?.agentId || draftAgentId),
    ) || null;
  const activeSkill = currentSession?.id
    ? serverSkillSelections[currentSession.id]
    : draftSkillSelection;
  const [running, setRunning] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceBarOpen, setVoiceBarOpen] = useState(false);
  const [voiceCancelling, setVoiceCancelling] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [groupSwitching, setGroupSwitching] = useState(false);
  const [chatError, setChatError] = useState("");
  const [quotedMessage, setQuotedMessage] = useState<QuotedChatMessage | null>(
    null,
  );
  const [messageActionTarget, setMessageActionTarget] =
    useState<ChatMessageActionTarget | null>(null);
  const [messageViewerTarget, setMessageViewerTarget] =
    useState<ChatMessageActionTarget | null>(null);
  const [chatRenameTarget, setChatRenameTarget] =
    useState<ManagedMobileChatSession | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nativeStreamCancelRef = useRef<(() => void) | null>(null);
  const platformTaskRef = useRef<MobileTask | null>(null);
  const voiceStartYRef = useRef(0);
  const voiceCancelledRef = useRef(false);
  const voiceReleasedRef = useRef(false);
  const voicePttSessionRef = useRef<NativeForegroundPttSession | null>(null);
  const voicePttSessionIdRef = useRef("");
  const voiceAutoSendRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const autoFollowRef = useRef(true);
  const lastScrolledSessionRef = useRef("");
  const autoRetryKeyRef = useRef("");

  const messageError =
    currentSession?.messages
      .slice()
      .reverse()
      .find((message) => message.error?.trim())
      ?.error?.trim() || "";
  const sessionError = chatError.trim() || currentSession?.error?.trim() || "";
  const showChatErrorBar = Boolean(
    sessionError && sessionError !== messageError,
  );

  async function addMaterialDraft(input: {
    blob: Blob;
    name: string;
    kind: string;
    previewUrl?: string;
    localText?: string;
    localOnly?: boolean;
    unsupported?: boolean;
    source?: "camera" | "gallery" | "share" | "upload";
  }) {
    const localId = clientRequestID("material");
    const draft: MaterialDraft = {
      localId,
      name: input.name,
      kind: input.kind,
      state: input.localOnly
        ? "local"
        : input.unsupported
        ? "failed"
        : "uploading",
      previewUrl: input.previewUrl,
      localText: input.localText,
      error: input.unsupported ? text.platform.localFileUnsupported : undefined,
    };
    setSharedMaterials((items) => [...items, draft].slice(-8));
    if (input.localOnly || input.unsupported) return;
    try {
      const asset = await uploadMaterial(
        input.blob,
        input.name,
        input.source || "upload",
      );
      setSharedMaterials((items) =>
        items.map((item) =>
          item.localId === localId ? { ...item, state: "ready", asset } : item,
        ),
      );
    } catch (error) {
      const canSendLocally =
        input.kind === "image" || Boolean(input.localText?.trim());
      setSharedMaterials((items) =>
        items.map((item) =>
          item.localId === localId
            ? {
                ...item,
                state: canSendLocally ? "local" : "failed",
                error: canSendLocally
                  ? ""
                  : error instanceof Error
                  ? localizeManagedMobileError({ message: error.message })
                  : text.platform.localFileUnsupported,
              }
            : item,
        ),
      );
    }
  }

  async function loadServerSkills() {
    if (!managed.accessToken) return;
    setServerSkillsLoading(true);
    try {
      const client = await mobilePlatformClient();
      const page = await client.skills.list({
        locale: text.dateLocale,
        limit: 100,
      });
      setServerSkills(page.items || []);
      setServerSkillsUnavailable(false);
    } catch {
      setServerSkillsUnavailable(true);
    } finally {
      setServerSkillsLoading(false);
    }
  }

  useEffect(() => {
    async function applySharedDraft() {
      const raw = localStorage.getItem(NATIVE_SHARE_DRAFT_KEY);
      if (!raw) return;
      try {
        const draft = JSON.parse(raw) as {
          text?: string;
          files?: NativeSharedMaterial[];
        };
        const value = String(draft.text || "").trim();
        if (value) {
          setInput((current) =>
            current.trim() ? `${current}\n\n${value}` : value,
          );
        }
        const files = Array.isArray(draft.files) ? draft.files : [];
        if (files.length) {
          await Promise.allSettled(
            files.map(async (file) => {
              const material = await readNativeSharedMaterial(
                file.id,
                "dataUrl",
              );
              const dataUrl = material.dataUrl || "";
              if (!dataUrl) throw new Error(text.platform.uploadFailedHint);
              const fileLike = {
                name: file.name || file.fileName,
                type: file.mimeType || "",
                size: Number(file.size || 0),
              };
              const isImage =
                file.kind === "image" || isLocalChatImage(fileLike);
              const isPlainText =
                file.kind === "text" || isLocalChatText(fileLike);
              const rawBlob = dataUrlToBlob(dataUrl);
              const blob = new Blob([rawBlob], {
                type:
                  inferLocalChatAttachmentMimeType(fileLike) || rawBlob.type,
              });
              if (isImage) {
                setAttachments((items) => [...items, dataUrl].slice(0, 6));
              }
              await addMaterialDraft({
                blob,
                name: file.name || `shared-${Date.now()}`,
                kind: isImage ? "image" : isPlainText ? "text" : "other",
                previewUrl: isImage ? dataUrl : undefined,
                localText: isPlainText
                  ? (await blobToText(blob)).slice(0, 120_000)
                  : "",
                localOnly: isImage || isPlainText,
                unsupported: !isImage && !isPlainText,
                source: "share",
              });
            }),
          );
        }
      } catch {
        // Ignore malformed drafts from older app versions.
      } finally {
        localStorage.removeItem(NATIVE_SHARE_DRAFT_KEY);
      }
    }
    void applySharedDraft();
    const onSharedDraft = () => void applySharedDraft();
    window.addEventListener("jisudeng-share-draft-ready", onSharedDraft);
    return () =>
      window.removeEventListener("jisudeng-share-draft-ready", onSharedDraft);
    // The native share listener is intentionally installed once; each event reads current store state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!skillSheetOpen || serverSkills.length || serverSkillsLoading) return;
    void loadServerSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillSheetOpen]);

  useEffect(() => {
    const state = location.state as any;
    const dataUrl = String(state?.materialDataUrl || "");
    const asset = state?.materialAsset as MobileAsset | undefined;
    const localMaterial = state?.materialLocal as LocalMaterial | undefined;
    const materialText = String(state?.materialText || "");
    if (
      (!dataUrl && !asset && !localMaterial && !materialText) ||
      !currentSession?.id
    )
      return;
    if (dataUrl && (!asset || asset.kind === "image")) {
      setAttachments((items) => [...items, dataUrl].slice(0, 6));
    }
    if (materialText.trim()) {
      setInput((value) =>
        value.trim()
          ? `${value}\n\n${materialText.slice(0, 120_000)}`
          : materialText.slice(0, 120_000),
      );
    }
    if (asset || localMaterial) {
      setSharedMaterials((items) =>
        [
          ...items,
          {
            localId: clientRequestID("existing-material"),
            name: localMaterial?.name || mobileAssetTitle(asset!, text),
            kind: localMaterial?.kind || asset?.kind || "file",
            state: localMaterial ? ("local" as const) : ("ready" as const),
            previewUrl:
              (localMaterial?.kind || asset?.kind) === "image"
                ? dataUrl
                : undefined,
            asset,
          },
        ].slice(-8),
      );
    }
    navigate(Path.Chat, { replace: true, state: null });
  }, [currentSession?.id, location.state, navigate, text]);

  useEffect(() => {
    if (!preferredChatGroupId && chatGroup?.id) {
      setPreferredChatGroupId(chatGroup.id);
    }
  }, [chatGroup?.id, preferredChatGroupId]);

  useEffect(() => {
    const retryAfterNetworkRestore = () => {
      if (running || !currentSession?.id) return;
      const latest = useManagedMobileAppStore
        .getState()
        .chatSessions.find((session) => session.id === currentSession.id);
      const failedAssistant = latest?.messages
        .slice()
        .reverse()
        .find(
          (message) =>
            message.role === "assistant" && message.status === "error",
        );
      if (
        !failedAssistant ||
        !/offline|network|timeout|connection|离线|网络|超时|连接/i.test(
          failedAssistant.error || "",
        )
      ) {
        return;
      }
      const retryKey = `${latest?.id}:${failedAssistant.id}`;
      if (autoRetryKeyRef.current === retryKey) return;
      const lastUser = latest?.messages
        .slice()
        .reverse()
        .find((message) => message.role === "user");
      if (!lastUser) return;
      autoRetryKeyRef.current = retryKey;
      void sendChat(
        lastUser.content,
        lastUser.imageUrls || [],
        false,
        failedAssistant.requestId || "",
      );
    };
    window.addEventListener("online", retryAfterNetworkRestore);
    window.addEventListener(
      "jisudeng-network-restored",
      retryAfterNetworkRestore,
    );
    return () => {
      window.removeEventListener("online", retryAfterNetworkRestore);
      window.removeEventListener(
        "jisudeng-network-restored",
        retryAfterNetworkRestore,
      );
    };
    // sendChat reads the active session and current model from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id, running]);

  useEffect(() => {
    if (currentSession) return;
    const preference = resolveChatPreference(
      workspace,
      draftGroupId || preferredChatGroupId || defaultChatGroupId,
      [draftModel],
    );
    if (!preference.groupId || !preference.model) return;
    const preferenceModels = chatModelsForGroup(workspace, preference.groupId);
    if (
      !preferenceModels.some((model) => modelValue(model) === preference.model)
    ) {
      return;
    }
    if (preference.groupId !== preferredChatGroupId) {
      setPreferredChatGroupId(preference.groupId);
    }
    if (preference.groupId !== draftGroupId) {
      setDraftGroupId(preference.groupId);
    }
    if (preference.model !== draftModel) {
      setDraftModel(preference.model);
    }
    if (preference.reason === "fallback") {
      setChatError(text.chat.modelFallback(preference.model));
    }
    persistChatPreference(preference.groupId, preference.model);
  }, [
    currentSession,
    defaultChatGroupId,
    draftGroupId,
    draftModel,
    preferredChatGroupId,
    text,
    workspace,
  ]);

  useEffect(() => {
    if (!effectiveChatGroupId) return;
    if (currentSession?.id) {
      // Browsing an older conversation must not replace the user's last choice.
      if (preferredChatGroupId !== effectiveChatGroupId) {
        setPreferredChatGroupId(effectiveChatGroupId);
      }
      return;
    }
    if (!selectedModelIsAvailable) return;
    persistChatPreference(effectiveChatGroupId, selectedModel || "");
  }, [
    currentSession?.id,
    effectiveChatGroupId,
    preferredChatGroupId,
    selectedModel,
    selectedModelIsAvailable,
  ]);

  useEffect(() => {
    if (!currentSession) return;
    if (models.some((model) => modelValue(model) === currentSession.model)) {
      return;
    }
    const preference = resolveChatPreference(
      workspace,
      currentSession.groupId,
      [storedChatPreferenceModel(currentSession.groupId), currentSession.model],
    );
    if (
      preference.groupId !== currentSession.groupId ||
      !preference.model ||
      !chatModelsForGroup(workspace, preference.groupId).some(
        (model) => modelValue(model) === preference.model,
      )
    ) {
      return;
    }
    mobileStore.updateChatSession(currentSession.id, {
      model: preference.model,
    });
    if (preference.reason === "fallback") {
      persistChatPreference(preference.groupId, preference.model);
      setChatError(text.chat.modelFallback(preference.model));
    }
    // The resolver only reaches a first-model fallback after the saved choice
    // is absent from a loaded group; it never does so while models are pending.
  }, [
    currentSession?.groupId,
    currentSession?.id,
    currentSession?.model,
    models,
    text,
    workspace,
  ]);

  useEffect(() => {
    if (!currentSession || !effectiveChatGroupId) return;
    if (currentSession.groupId === effectiveChatGroupId) return;
    const preference = resolveChatPreference(workspace, effectiveChatGroupId, [
      storedChatPreferenceModel(effectiveChatGroupId),
      currentSession.model,
    ]);
    if (
      preference.groupId !== effectiveChatGroupId ||
      !preference.model ||
      !chatModelsForGroup(workspace, preference.groupId).some(
        (model) => modelValue(model) === preference.model,
      )
    ) {
      return;
    }
    mobileStore.updateChatSession(currentSession.id, {
      groupId: effectiveChatGroupId,
      model: preference.model,
    });
    if (preference.reason === "fallback") {
      persistChatPreference(preference.groupId, preference.model);
      setChatError(text.chat.modelFallback(preference.model));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSession?.id,
    currentSession?.groupId,
    currentSession?.model,
    effectiveChatGroupId,
    text,
    workspace,
  ]);

  useEffect(() => {
    if ((location.state as any)?.openGroupSheet) {
      setGroupSheetOpen(true);
      navigate(Path.Chat, { replace: true, state: null });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const state = location.state as any;
    if (
      !state?.openAgentSheet &&
      !state?.openSkillSheet &&
      !state?.selectAgentId
    )
      return;
    if (state.openAgentSheet) setAgentSheetOpen(true);
    if (state.openSkillSheet) setSkillSheetOpen(true);
    if (state.selectAgentId) {
      const agent = CHAT_AGENT_TEMPLATES.find(
        (item) => item.id === state.selectAgentId,
      );
      if (agent) {
        if (currentSession?.id) {
          mobileStore.updateChatSession(currentSession.id, {
            agentId: agent.id,
          });
          setDraftAgentId("");
        } else {
          setDraftAgentId(agent.id);
        }
        if (agent.starter) {
          setInput((value) =>
            value.trim()
              ? value
              : localizedValue(agent.starter as LocalizedString, text),
          );
        }
      }
    }
    navigate(Path.Chat, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id, location.state, navigate, text]);

  useLayoutEffect(() => {
    if (!currentSession?.id) return;
    if (lastScrolledSessionRef.current === currentSession.id) return;
    lastScrolledSessionRef.current = currentSession.id;
    autoFollowRef.current = true;
    const jumpToBottom = () => {
      const list = listRef.current;
      if (!list) return;
      list.style.scrollBehavior = "auto";
      list.scrollTop = list.scrollHeight;
      requestAnimationFrame(() => {
        const nextList = listRef.current;
        if (!nextList) return;
        nextList.scrollTop = nextList.scrollHeight;
        nextList.style.scrollBehavior = "";
      });
    };
    jumpToBottom();
  }, [currentSession?.id]);

  useEffect(() => {
    if (!autoFollowRef.current) return;
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior:
        lastScrolledSessionRef.current === currentSession?.id
          ? "auto"
          : "smooth",
    });
  }, [
    currentSession?.id,
    currentSession?.messages.length,
    currentSession?.updatedAt,
    running,
  ]);

  function handleMessageListScroll() {
    const list = listRef.current;
    if (!list) return;
    const distanceToBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    const shouldFollow = distanceToBottom < 96;
    autoFollowRef.current = shouldFollow;
  }

  async function attachImages(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = input.files;
    if (!files?.length) return;
    try {
      let imageCount = 0;
      const selectedFiles = Array.from(files)
        .slice(0, 6)
        .filter((file) => !isLocalChatImage(file) || ++imageCount <= 4);
      const imageFiles = selectedFiles.filter(isLocalChatImage);
      const urls = await readImageFiles(imageFiles, 4);
      setAttachments((items) => [...items, ...urls].slice(0, 4));
      let imageIndex = 0;
      await Promise.allSettled(
        selectedFiles.map(async (file) => {
          const kind = localChatAttachmentKind(file);
          const isImage = kind === "image";
          const isPlainText = kind === "text";
          const localFile = normalizeLocalChatAttachmentBlob(file);
          const previewUrl = isImage ? urls[imageIndex++] : undefined;
          const localText = isPlainText
            ? (await blobToText(localFile)).slice(0, 120_000)
            : "";
          return addMaterialDraft({
            blob: localFile,
            name: file.name,
            kind: isImage ? "image" : isPlainText ? "text" : "other",
            previewUrl,
            localText,
            localOnly: isImage || isPlainText,
            unsupported: !isImage && !isPlainText,
            source: "upload",
          });
        }),
      );
    } catch (err) {
      setChatError(localizedMobileErrorMessage(err, text.errors.saveFailed));
    } finally {
      if (input) input.value = "";
    }
  }

  async function capturePhoto() {
    setCapturing(true);
    setChatError("");
    try {
      const result = await captureImage(
        `jisudengchat-camera-${Date.now()}.jpg`,
      );
      if (!result.dataUrl) {
        throw new Error(text.errors.emptyCameraResult);
      }
      setAttachments((items) =>
        [...items, result.dataUrl as string].slice(0, 4),
      );
      await addMaterialDraft({
        blob: dataUrlToBlob(result.dataUrl),
        name: `camera-${Date.now()}.jpg`,
        kind: "image",
        previewUrl: result.dataUrl,
        localOnly: true,
        source: "camera",
      });
    } catch (err) {
      setChatError(
        err instanceof Error && err.message
          ? localizeManagedMobileError({ message: err.message })
          : text.errors.permissionDenied,
      );
    } finally {
      setCapturing(false);
    }
  }

  async function startVoiceInput() {
    if (listening) return;
    setListening(true);
    setChatError("");
    try {
      const result = await recognizeSpeech(
        text.dateLocale,
        text.chat.voicePrompt,
      );
      const recognized = (result.text || "").trim();
      if (!recognized) {
        throw new Error(text.errors.emptySpeechResult);
      }
      setInput((value) =>
        [value.trim(), recognized].filter(Boolean).join("\n"),
      );
    } catch (err) {
      setChatError(
        err instanceof Error && err.message
          ? localizeManagedMobileError({ message: err.message })
          : text.errors.permissionDenied,
      );
    } finally {
      setListening(false);
    }
  }

  async function startVoiceTurn(
    options: {
      event?: PointerEvent<HTMLButtonElement>;
    } = {},
  ) {
    if (listening || running) return;
    options.event?.currentTarget.setPointerCapture?.(options.event.pointerId);
    voiceStartYRef.current = options.event?.clientY || 0;
    voiceCancelledRef.current = false;
    voiceReleasedRef.current = false;
    voiceAutoSendRef.current = false;
    setVoiceCancelling(false);
    setVoiceTranscript("");
    setListening(true);
    setChatError("");
    const sessionId = `chat-ptt-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    voicePttSessionIdRef.current = sessionId;
    try {
      const session = await startForegroundPttSession({
        sessionId,
        language: text.dateLocale,
        prompt: text.chat.voicePrompt,
        onEvent: (result) => {
          if (result.sessionId !== voicePttSessionIdRef.current) return;
          if (result.type === "partial") {
            setVoiceTranscript((result.text || "").trim());
            return;
          }
          if (result.type === "final") {
            const recognized = (result.text || "").trim();
            if (recognized) {
              setInput((value) =>
                [value.trim(), recognized].filter(Boolean).join("\n"),
              );
              setVoiceBarOpen(false);
            } else if (!voiceCancelledRef.current) {
              setChatError(text.errors.emptySpeechResult);
            }
          } else if (result.type === "error" && !voiceCancelledRef.current) {
            setChatError(
              result.errorMessage
                ? localizeManagedMobileError({ message: result.errorMessage })
                : text.errors.permissionDenied,
            );
          }
          if (
            result.type === "final" ||
            result.type === "error" ||
            result.type === "cancelled"
          ) {
            voicePttSessionRef.current?.unsubscribe();
            voicePttSessionRef.current = null;
            voicePttSessionIdRef.current = "";
            setVoiceTranscript("");
            setListening(false);
            setVoiceCancelling(false);
            voiceCancelledRef.current = false;
            voiceReleasedRef.current = false;
            voiceAutoSendRef.current = false;
          }
        },
      });
      if (voicePttSessionIdRef.current !== session.sessionId) {
        session.unsubscribe();
        await session.cancel("stale_session").catch(() => {});
        return;
      }
      voicePttSessionRef.current = session;
      if (voiceCancelledRef.current) {
        await cancelForegroundPttSession(session.sessionId, "cancelled");
      } else if (voiceReleasedRef.current) {
        await stopForegroundPttSession(session.sessionId);
      }
    } catch (err) {
      if (
        !voiceCancelledRef.current &&
        voicePttSessionIdRef.current === sessionId
      ) {
        setChatError(
          err instanceof Error && err.message
            ? localizeManagedMobileError({ message: err.message })
            : text.errors.permissionDenied,
        );
      }
    } finally {
      if (!voicePttSessionRef.current) {
        setListening(false);
        setVoiceCancelling(false);
        voicePttSessionIdRef.current = "";
        voiceCancelledRef.current = false;
        voiceReleasedRef.current = false;
        voiceAutoSendRef.current = false;
      }
    }
  }

  function beginVoiceHold(event: PointerEvent<HTMLButtonElement>) {
    void startVoiceTurn({ event });
  }

  function moveVoiceHold(event: PointerEvent<HTMLButtonElement>) {
    if (!listening) return;
    const shouldCancel = voiceStartYRef.current - event.clientY > 52;
    voiceCancelledRef.current = shouldCancel;
    setVoiceCancelling(shouldCancel);
  }

  function endVoiceHold() {
    if (!listening) return;
    voiceReleasedRef.current = true;
    const sessionId = voicePttSessionIdRef.current;
    if (voiceCancelledRef.current) {
      if (sessionId) {
        cancelForegroundPttSession(sessionId, "cancelled").catch(() => {});
      }
      return;
    }
    if (sessionId) stopForegroundPttSession(sessionId).catch(() => {});
  }

  useEffect(() => {
    return () => {
      notifyForegroundPttRouteChange();
    };
  }, [location.pathname]);

  function makeGatewayMessages(
    sessionId: string,
    excludeMessageId?: string,
    skillOverride?: ServerSkillSelection | null,
  ) {
    const session = useManagedMobileAppStore
      .getState()
      .chatSessions.find((item) => item.id === sessionId);
    const sessionAgent =
      CHAT_AGENT_TEMPLATES.find((item) => item.id === session?.agentId) ||
      activeAgent;
    const selectedSkill = skillOverride ?? serverSkillSelections[sessionId];
    const systemPrompt = [
      text.chat.mobileSystemPrompt,
      sessionAgent ? localizedValue(sessionAgent.systemPrompt, text) : "",
      selectedSkill?.systemPrompt
        ? `当前启用技能：${selectedSkill.title}\n${selectedSkill.systemPrompt}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const messages = (session?.messages || [])
      .filter((message) => message.id !== excludeMessageId)
      .filter(
        (message) => message.role !== "assistant" || message.content.trim(),
      )
      .filter((message) => message.status !== "cancelled")
      .map((message) => ({
        role: message.role,
        content: chatMessageContentForGateway(message),
      }));
    return [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages.filter(
        (message) =>
          message.role !== "system" ||
          (message.content !== text.chat.mobileSystemPrompt &&
            message.content !== systemPrompt),
      ),
    ];
  }

  async function readStreamingResponse(
    response: Response,
    onDelta: (delta: string) => void,
  ) {
    const reader = response.body?.getReader();
    if (!reader) {
      const json = await response.json();
      const content = extractChatContent(json);
      if (content) onDelta(content);
      return;
    }
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\n\n+/);
      buffer = events.pop() || "";
      for (const event of events) {
        const data = event
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s*/, ""))
          .join("\n")
          .trim();
        if (!data || data === "[DONE]") continue;
        try {
          const payload = JSON.parse(data);
          const delta = extractChatContent(payload);
          if (delta) onDelta(delta);
        } catch {
          // Ignore keepalive/non-JSON stream fragments.
        }
      }
    }
  }

  function readGatewayTextResponse(
    bodyText: string,
    onDelta: (delta: string) => void,
  ) {
    if (!bodyText.trim()) return;
    if (bodyText.includes("data:")) {
      bodyText.split(/\n\n+/).forEach((event) => {
        const data = event
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s*/, ""))
          .join("\n")
          .trim();
        if (!data || data === "[DONE]") return;
        try {
          const payload = JSON.parse(data);
          const delta = extractChatContent(payload);
          if (delta) onDelta(delta);
        } catch {
          // Ignore keepalive/non-JSON stream fragments.
        }
      });
      return;
    }
    try {
      const payload = JSON.parse(bodyText);
      const content = extractChatContent(payload);
      if (content) onDelta(content);
    } catch {
      onDelta(bodyText);
    }
  }

  async function sendChat(
    content = input,
    imageUrls = attachments,
    appendUser = true,
    retryRequestId = "",
  ) {
    const rawPrompt = content.trim();
    const prompt =
      appendUser && quotedMessage
        ? [
            `${text.chat.quotePrefix}${
              quotedMessage.content || text.chat.imageMessage
            }`,
            rawPrompt,
          ]
            .filter(Boolean)
            .join("\n\n")
        : rawPrompt;
    const readyMaterials = sharedMaterials.filter(
      (item) => item.state === "ready" && item.asset?.id,
    );
    const readyAssetIds = readyMaterials.map((item) => String(item.asset?.id));
    const localTextMaterials = sharedMaterials.filter(
      (item) => item.state === "local" && item.localText?.trim(),
    );
    if (
      !prompt &&
      imageUrls.length === 0 &&
      readyAssetIds.length === 0 &&
      localTextMaterials.length === 0
    ) {
      setChatError(text.errors.emptyMessage);
      return;
    }
    if (!managed.session) {
      setChatError(text.errors.loginRequired);
      return;
    }
    const requestGroupId =
      currentSession?.groupId || draftChatGroupId || effectiveChatGroupId;
    const model = selectedModel || fallbackModel;
    const requestModelAvailable = Boolean(
      requestGroupId &&
        chatModelsForGroup(workspace, requestGroupId).some(
          (item) => modelValue(item) === model,
        ),
    );
    if (!model || !requestModelAvailable) {
      setChatError(text.errors.noModel);
      return;
    }
    const requestedModel = chatModelsForGroup(workspace, requestGroupId).find(
      (item) => modelValue(item) === model,
    );
    const modelSupportsWebSearch = Boolean(
      requestedModel?.tool_capabilities?.function_calling &&
        requestedModel.tool_capabilities?.web_search,
    );
    const modelSupportsToolChoice = Boolean(
      requestedModel?.tool_capabilities?.tool_choice,
    );
    if (requestGroupId) {
      persistChatPreference(requestGroupId, model);
    }
    const gatewayRequestId =
      retryRequestId || clientRequestID("chat-completion");
    const existingSessionId = currentSession?.id || "";
    const sessionId = mobileStore.ensureChatSession(model, requestGroupId);
    const skillForRequest = existingSessionId
      ? serverSkillSelections[sessionId]
      : draftSkillSelection;
    if (!existingSessionId) {
      mobileStore.updateChatSession(sessionId, {
        model,
        groupId: requestGroupId,
        agentId: draftAgentId,
      });
      if (draftSkillSelection) {
        setServerSkillSelections((current) => {
          const next = { ...current, [sessionId]: draftSkillSelection };
          writeStoredJSON(SERVER_SKILL_SELECTION_KEY, next);
          return next;
        });
      }
    }
    const materialSummary = [...readyMaterials, ...localTextMaterials]
      .map((item) => item.name)
      .join("、");
    const localTextContent = localTextMaterials
      .map((item) => `[${item.name}]\n${item.localText?.trim() || ""}`)
      .join("\n\n");
    const userContent =
      [
        prompt || (materialSummary ? `附件：${materialSummary}` : ""),
        localTextContent,
      ]
        .filter(Boolean)
        .join("\n\n") || text.chat.imageMessage;
    if (appendUser) {
      mobileStore.addChatMessage(sessionId, {
        role: "user",
        content: userContent,
        imageUrls,
        status: "done",
      });
    }
    const retryAssistant = retryRequestId
      ? useManagedMobileAppStore
          .getState()
          .chatSessions.find((session) => session.id === sessionId)
          ?.messages.slice()
          .reverse()
          .find(
            (message) =>
              message.role === "assistant" &&
              message.status === "error" &&
              message.requestId === retryRequestId,
          )
      : undefined;
    const assistantId =
      retryAssistant?.id ||
      mobileStore.addChatMessage(sessionId, {
        role: "assistant",
        content: "",
        requestId: gatewayRequestId,
        status: "streaming",
      });
    if (retryAssistant) {
      mobileStore.updateChatMessage(sessionId, assistantId, {
        content: "",
        error: undefined,
        requestId: gatewayRequestId,
        status: "streaming",
      });
    }
    mobileStore.clearChatError(sessionId);
    mobileStore.updateChatSession(sessionId, { model });
    setDraftModel("");
    setDraftAgentId("");
    setDraftSkillSelection(null);
    setInput("");
    setAttachments([]);
    setSharedMaterials([]);
    setQuotedMessage(null);
    setMoreToolsOpen(false);
    setChatError("");
    setRunning(true);
    autoFollowRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    const performanceTraceId = await startNativePerformanceTrace(
      "chat_completion",
      {
        transport: isDirectNativeStreamAvailable() ? "native" : "web",
        retry: Boolean(retryRequestId),
        attachments: Boolean(imageUrls.length || readyAssetIds.length),
      },
    ).catch(() => "");
    let performanceOutcome = "success";
    let projectedTask: MobileTask | null = null;
    let projectedTaskId = "";
    let cancellationTimer: number | undefined;
    const projectedTaskPromise = (async () => {
      try {
        const client = await mobilePlatformClient();
        const task = await client.tasks.create({
          kind: "chat",
          operation: "chat.completions",
          client_request_id: gatewayRequestId,
          title_zh: userContent.slice(0, 80),
          model,
          group_id: requestGroupId,
          asset_ids: readyAssetIds,
          skill_id: skillForRequest?.id,
          locale: text.dateLocale,
        });
        projectedTask = task;
        projectedTaskId = task.id;
        platformTaskRef.current = task;
        await client.tasks.status(task.id, { status: "running" });
        if (abortRef.current !== controller) return task;
        cancellationTimer = window.setInterval(() => {
          void mobilePlatformClient()
            .then((client) => client.tasks.detail(task.id))
            .then((task) => {
              if (task.status === "cancelled") controller.abort();
            })
            .catch(() => undefined);
        }, 2500);
        return task;
      } catch {
        return null;
      }
    })();
    let contentBuffer = "";
    let lastStreamPersistAt = 0;
    const persistStreamCheckpoint = () => {
      const now = Date.now();
      if (now - lastStreamPersistAt < 200) return;
      lastStreamPersistAt = now;
      mobileStore.updateChatMessage(sessionId, assistantId, {
        content: contentBuffer,
        status: "streaming",
      });
    };
    const path = "/v1/chat/completions";
    try {
      let activeManaged = useManagedNextChatStore.getState();
      if (controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (shouldRefreshManagedSession(activeManaged.session)) {
        await managed.bootstrap({ silent: true });
        activeManaged = useManagedNextChatStore.getState();
      }
      if (
        requestGroupId &&
        currentGroupID(activeManaged.workspace) !== requestGroupId
      ) {
        await managed.switchGroup(requestGroupId);
        activeManaged = useManagedNextChatStore.getState();
      }
      if (controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const gatewayMessages = makeGatewayMessages(
        sessionId,
        assistantId,
        skillForRequest,
      );
      const payload = JSON.stringify({
        model,
        stream: true,
        messages: gatewayMessages,
      });
      const runNonStreamingChatFallback = async (reason: unknown) => {
        const fallbackTransport = isDirectNativeStreamAvailable()
          ? "native"
          : "web";
        recordGatewayDiagnostic("/v1/chat/completions", {
          method: "POST",
          transport: fallbackTransport,
          error: reason,
        });
        const requestFallback = () =>
          managedGatewayRequestText(
            activeManaged.backendBaseUrl,
            "/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "text/event-stream, application/json",
                "Idempotency-Key": gatewayRequestId,
                "X-Request-ID": gatewayRequestId,
              },
              body: payload,
              signal: controller.signal,
            },
            activeManaged.session?.api_key || "",
            text,
          );
        let fallback = await requestFallback();
        if (
          (fallback.status === 401 || fallback.status === 403) &&
          !contentBuffer
        ) {
          await managed.bootstrap({ silent: true }).catch(() => {});
          activeManaged = useManagedNextChatStore.getState();
          fallback = await requestFallback();
        }
        recordGatewayDiagnostic("/v1/chat/completions", {
          method: "POST",
          transport: fallbackTransport,
          status: fallback.status,
          recovered: fallback.ok,
        });
        if (!fallback.ok) {
          throw new Error(
            parseOpenAIError(
              fallback.text,
              fallback.status,
              path,
              fallback.requestId || gatewayRequestId,
            ),
          );
        }
        readGatewayTextResponse(fallback.text, (delta) => {
          contentBuffer += delta;
          persistStreamCheckpoint();
        });
      };
      if (modelSupportsWebSearch && webSearchServiceAvailable) {
        let toolRequestCount = 0;
        const requestToolCompletion = async (
          messages: Array<Record<string, unknown>>,
          options: { stream?: boolean; onDelta?: (delta: string) => void } = {},
        ) => {
          toolRequestCount += 1;
          const toolRequestId = `${gatewayRequestId}-tool-${toolRequestCount}`;
          const requestBody: Record<string, unknown> = {
            model,
            stream: options.stream === true,
            messages,
            tools: [MOBILE_WEB_SEARCH_TOOL],
          };
          if (modelSupportsToolChoice) requestBody.tool_choice = "auto";
          const requestHeaders = {
            "Content-Type": "application/json",
            Accept:
              options.stream === true
                ? "text/event-stream, application/json"
                : "application/json",
            Authorization: `Bearer ${activeManaged.session?.api_key || ""}`,
            "Idempotency-Key": toolRequestId,
            "X-Request-ID": toolRequestId,
          };
          if (options.stream === true) {
            const accumulator = createMobileCompletionStreamAccumulator(
              options.onDelta,
            );
            const consumeEvent = (event: string) => {
              const data = event
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.replace(/^data:\s*/, ""))
                .join("\n")
                .trim();
              if (!data || data === "[DONE]") return;
              try {
                accumulator.ingest(JSON.parse(data));
              } catch {
                // Keepalive and provider extension frames are ignored.
              }
            };
            if (isDirectNativeStreamAvailable()) {
              let eventBuffer = "";
              const nativeStream = await startDirectNativeStreamRequest(
                {
                  url: `${managedGatewayBaseUrl(
                    activeManaged.backendBaseUrl,
                  )}/chat/completions`,
                  method: "POST",
                  headers: requestHeaders,
                  body: JSON.stringify(requestBody),
                  connectTimeout: 15000,
                  readTimeout: 120000,
                },
                {
                  onLine: (line) => {
                    eventBuffer += `${line}\n`;
                    if (line.trim() === "") {
                      consumeEvent(eventBuffer);
                      eventBuffer = "";
                    }
                  },
                },
              );
              const cancelNativeStream = () => {
                nativeStream.cancel().catch(() => undefined);
              };
              controller.signal.addEventListener("abort", cancelNativeStream, {
                once: true,
              });
              try {
                await nativeStream.done;
              } finally {
                controller.signal.removeEventListener(
                  "abort",
                  cancelNativeStream,
                );
              }
              if (eventBuffer.trim()) consumeEvent(eventBuffer);
            } else {
              const response = await fetch(
                `${managedGatewayBaseUrl(
                  activeManaged.backendBaseUrl,
                )}/chat/completions`,
                {
                  method: "POST",
                  headers: requestHeaders,
                  body: JSON.stringify(requestBody),
                  signal: controller.signal,
                },
              );
              if (!response.ok) {
                throw new Error(
                  parseOpenAIError(
                    await response.text().catch(() => ""),
                    response.status,
                    path,
                    toolRequestId,
                  ),
                );
              }
              const reader = response.body?.getReader();
              if (!reader) {
                const json = await response.json();
                accumulator.ingest(json);
              } else {
                const decoder = new TextDecoder();
                let eventBuffer = "";
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  eventBuffer += decoder.decode(value, { stream: true });
                  const events = eventBuffer.split(/\n\n+/);
                  eventBuffer = events.pop() || "";
                  events.forEach(consumeEvent);
                }
                if (eventBuffer.trim()) consumeEvent(eventBuffer);
              }
            }
            recordGatewayDiagnostic("/v1/chat/completions", {
              method: "POST",
              transport: isDirectNativeStreamAvailable() ? "native" : "web",
              status: 200,
              recovered: true,
            });
            return accumulator.payload();
          }
          const response = await managedGatewayRequestText(
            activeManaged.backendBaseUrl,
            "/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": requestHeaders["Content-Type"],
                Accept: requestHeaders.Accept,
                "Idempotency-Key": requestHeaders["Idempotency-Key"],
                "X-Request-ID": requestHeaders["X-Request-ID"],
              },
              body: JSON.stringify(requestBody),
              signal: controller.signal,
            },
            activeManaged.session?.api_key || "",
            text,
          );
          recordGatewayDiagnostic("/v1/chat/completions", {
            method: "POST",
            transport: isDirectNativeStreamAvailable() ? "native" : "web",
            status: response.status,
            recovered: response.ok,
          });
          if (!response.ok) {
            throw new Error(
              parseOpenAIError(
                response.text,
                response.status,
                path,
                response.requestId || toolRequestId,
              ),
            );
          }
          try {
            return JSON.parse(response.text);
          } catch {
            throw new Error(
              parseOpenAIError(
                response.text,
                response.status,
                path,
                response.requestId || toolRequestId,
              ),
            );
          }
        };
        const toolLoop = await runMobileWebSearchToolLoop({
          messages: gatewayMessages,
          locale: text.dateLocale,
          requestCompletion: requestToolCompletion,
          onDelta: (delta) => {
            contentBuffer += delta;
            persistStreamCheckpoint();
          },
          search: async (query, toolCallId) => {
            if (!activeManaged.accessToken) {
              throw new Error(text.errors.loginRequired);
            }
            const requestId = `${gatewayRequestId}-search-${toolCallId}`.slice(
              0,
              256,
            );
            try {
              return await searchMobileWeb(
                activeManaged.backendBaseUrl,
                activeManaged.accessToken,
                query,
                {
                  requestId,
                  toolCallId,
                  locale: text.dateLocale,
                  signal: controller.signal,
                },
              );
            } catch (error) {
              throw new Error(
                localizedMobileErrorMessage(
                  error,
                  text.chat.webSearchUnavailable,
                ),
              );
            }
          },
        });
        contentBuffer = [
          toolLoop.content,
          formatMobileWebSearchSources(toolLoop.sources, text.dateLocale),
        ]
          .filter(Boolean)
          .join("\n\n");
        persistStreamCheckpoint();
      } else if (isDirectNativeStreamAvailable()) {
        let status = 0;
        let eventBuffer = "";
        let recoveredWithFallback = false;
        const nativeStream = await startDirectNativeStreamRequest(
          {
            url: `${managedGatewayBaseUrl(
              activeManaged.backendBaseUrl,
            )}/chat/completions`,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream, application/json",
              Authorization: `Bearer ${activeManaged.session?.api_key || ""}`,
              "Idempotency-Key": gatewayRequestId,
              "X-Request-ID": gatewayRequestId,
            },
            body: payload,
            connectTimeout: 15000,
            readTimeout: 120000,
          },
          {
            onStatus: (nextStatus) => {
              status = nextStatus;
            },
            onLine: (line) => {
              eventBuffer += `${line}\n`;
              if (line.trim() !== "") return;
              readGatewayTextResponse(eventBuffer, (delta) => {
                contentBuffer += delta;
                persistStreamCheckpoint();
              });
              eventBuffer = "";
            },
          },
        );
        const abortNativeStream = () => {
          nativeStream.cancel().catch(() => {});
        };
        nativeStreamCancelRef.current = abortNativeStream;
        if (controller.signal.aborted) {
          abortNativeStream();
          await nativeStream.done.catch(() => {});
          if (nativeStreamCancelRef.current === abortNativeStream) {
            nativeStreamCancelRef.current = null;
          }
          throw new DOMException("Aborted", "AbortError");
        }
        controller.signal.addEventListener("abort", abortNativeStream, {
          once: true,
        });
        try {
          await nativeStream.done;
        } catch (error) {
          if (controller.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          recordGatewayDiagnostic("/v1/chat/completions", {
            method: "POST",
            transport: "native",
            status: status || undefined,
            error,
          });
          if (!contentBuffer) {
            if (status === 401 || status === 403) {
              await managed.bootstrap({ silent: true });
              activeManaged = useManagedNextChatStore.getState();
            }
            await runNonStreamingChatFallback(error);
            recoveredWithFallback = true;
          } else {
            throw error;
          }
        } finally {
          controller.signal.removeEventListener("abort", abortNativeStream);
          if (nativeStreamCancelRef.current === abortNativeStream) {
            nativeStreamCancelRef.current = null;
          }
        }
        if (!recoveredWithFallback && eventBuffer.trim()) {
          readGatewayTextResponse(eventBuffer, (delta) => {
            contentBuffer += delta;
            persistStreamCheckpoint();
          });
        }
        if (
          !recoveredWithFallback &&
          status &&
          (status < 200 || status >= 300)
        ) {
          recordGatewayDiagnostic("/v1/chat/completions", {
            method: "POST",
            transport: "native",
            status,
          });
          if (!contentBuffer) {
            await runNonStreamingChatFallback(new Error(`HTTP ${status}`));
          } else {
            throw new Error(
              parseOpenAIError(contentBuffer, status, path, gatewayRequestId),
            );
          }
        }
      } else {
        try {
          const response = await fetch(
            `${managedGatewayBaseUrl(
              activeManaged.backendBaseUrl,
            )}/chat/completions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "text/event-stream, application/json",
                Authorization: `Bearer ${activeManaged.session?.api_key || ""}`,
                "Idempotency-Key": gatewayRequestId,
                "X-Request-ID": gatewayRequestId,
              },
              body: payload,
              signal: controller.signal,
            },
          );
          if (!response.ok) {
            const bodyText = await response.text().catch(() => "");
            recordGatewayDiagnostic("/v1/chat/completions", {
              method: "POST",
              transport: "web",
              status: response.status,
            });
            if (!contentBuffer) {
              if (response.status === 401 || response.status === 403) {
                await managed.bootstrap({ silent: true }).catch(() => {});
                activeManaged = useManagedNextChatStore.getState();
              }
              await runNonStreamingChatFallback(
                new Error(`HTTP ${response.status}`),
              );
            } else {
              throw new Error(
                parseOpenAIError(
                  bodyText,
                  response.status,
                  path,
                  gatewayRequestId,
                ),
              );
            }
          } else {
            await readStreamingResponse(response, (delta) => {
              contentBuffer += delta;
              persistStreamCheckpoint();
            });
          }
        } catch (streamError) {
          if (controller.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          if (contentBuffer) throw streamError;
          await runNonStreamingChatFallback(streamError);
        }
      }
      if (containsVisibleToolCallMarkup(contentBuffer)) {
        const cleaned = stripVisibleToolCallMarkup(contentBuffer);
        contentBuffer = cleaned || text.chat.assistantThinking;
      }
      const completedContent = contentBuffer || text.chat.assistantThinking;
      mobileStore.updateChatMessage(sessionId, assistantId, {
        content: completedContent,
        status: "done",
      });
      void projectedTaskPromise.then(async (completedTask) => {
        if (!completedTask) return;
        const client = await mobilePlatformClient().catch(() => null);
        await client?.tasks
          .status(completedTask.id, { status: "completed", progress: 100 })
          .catch(() => {});
      });
      await managed.bootstrap({ silent: true }).catch(() => {});
    } catch (err) {
      const aborted = controller.signal.aborted;
      performanceOutcome = aborted ? "cancelled" : "error";
      const message = aborted
        ? text.errors.requestCancelled
        : err instanceof ManagedTransportError
        ? err.message
        : err instanceof Error
        ? localizeManagedMobileError({ message: err.message, path })
        : text.errors.networkFailed;
      mobileStore.updateChatMessage(sessionId, assistantId, {
        content: contentBuffer,
        status: aborted ? "cancelled" : "error",
        error: message,
      });
      mobileStore.updateChatSession(sessionId, { error: message });
      setChatError(message);
      void projectedTaskPromise.then(async (failedTask) => {
        if (!failedTask) return;
        const client = await mobilePlatformClient().catch(() => null);
        await client?.tasks
          .status(failedTask.id, {
            status: aborted ? "cancelled" : "failed",
            error: aborted
              ? undefined
              : { code: "chat_failed", message, retryable: true },
          })
          .catch(() => {});
      });
    } finally {
      void stopNativePerformanceTrace(
        performanceTraceId,
        performanceOutcome,
      ).catch(() => undefined);
      if (cancellationTimer) window.clearInterval(cancellationTimer);
      if (abortRef.current === controller) {
        abortRef.current = null;
        nativeStreamCancelRef.current = null;
        setRunning(false);
      }
      if (projectedTaskId && platformTaskRef.current?.id === projectedTaskId) {
        platformTaskRef.current = null;
      }
    }
  }

  function stopChat() {
    const controller = abortRef.current;
    if (!controller) return;
    controller.abort();
    nativeStreamCancelRef.current?.();
    const task = platformTaskRef.current;
    if (task) {
      void mobilePlatformClient()
        .then((client) =>
          client.tasks.cancel(task.id, { reason: "user_cancelled" }),
        )
        .catch(() => {});
    }
    setRunning(false);
  }

  function retryLast() {
    if (!currentSession) return;
    const lastUser = currentSession.messages
      .slice()
      .reverse()
      .find((message) => message.role === "user");
    if (!lastUser) return;
    const failedAssistant = currentSession.messages
      .slice()
      .reverse()
      .find(
        (message) => message.role === "assistant" && message.status === "error",
      );
    sendChat(
      lastUser.content,
      lastUser.imageUrls || [],
      false,
      failedAssistant?.requestId || "",
    );
  }

  function openMessageActions(
    sessionId: string,
    message: ManagedMobileChatMessage,
  ) {
    setMessageActionTarget({ sessionId, message });
  }

  async function copyMessage(message: ManagedMobileChatMessage) {
    const value = messageTextValue(message, text);
    if (!value) return;
    try {
      await copyTextToClipboard(value);
      setMessageActionTarget(null);
      setMessageViewerTarget(null);
    } catch {
      setChatError(text.errors.copyFailed);
    }
  }

  function quoteMessage(message: ManagedMobileChatMessage) {
    setQuotedMessage({
      id: message.id,
      role: message.role,
      content:
        message.content.trim() ||
        (message.imageUrls?.length
          ? text.chat.imageAttached(message.imageUrls.length)
          : text.chat.imageMessage),
    });
    setMessageActionTarget(null);
    setMessageViewerTarget(null);
  }

  function deleteMessage(target: ChatMessageActionTarget) {
    mobileStore.removeChatMessage(target.sessionId, target.message.id);
    if (quotedMessage?.id === target.message.id) {
      setQuotedMessage(null);
    }
    setMessageActionTarget(null);
    setMessageViewerTarget(null);
  }

  function retryMessage(message: ManagedMobileChatMessage) {
    setMessageActionTarget(null);
    if (message.role === "user") {
      sendChat(message.content, message.imageUrls || [], false);
      return;
    }
    retryLast();
  }

  function selectMessageText(message: ManagedMobileChatMessage) {
    const value = messageTextValue(message, text);
    if (!value) return;
    setInput(value);
    setQuotedMessage(null);
    setMessageActionTarget(null);
    window.setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        `.${styles["composer-row"]} textarea`,
      );
      textarea?.focus();
      textarea?.select();
    }, 0);
  }

  function reportChatMessage(target: ChatMessageActionTarget) {
    writeMobileReportDraft(buildChatReportDraft(target.message, text));
    setMessageActionTarget(null);
    setMessageViewerTarget(null);
    navigate(Path.AccountFeedback);
  }

  function changeModel(model: string) {
    if (
      effectiveChatGroupId &&
      models.some((item) => modelValue(item) === model)
    ) {
      persistChatPreference(effectiveChatGroupId, model);
    }
    if (currentSession?.id) {
      mobileStore.updateChatSession(currentSession.id, { model });
      setDraftModel("");
    } else {
      setDraftModel(model);
    }
    setChatError("");
  }

  function selectAgent(agent: ChatAgentTemplate | null) {
    if (currentSession?.id) {
      mobileStore.updateChatSession(currentSession.id, {
        agentId: agent?.id || "",
      });
      setDraftAgentId("");
    } else {
      setDraftAgentId(agent?.id || "");
    }
    setAgentSheetOpen(false);
    setChatError("");
    if (agent?.starter) {
      setInput((value) =>
        value.trim()
          ? value
          : localizedValue(agent.starter as LocalizedString, text),
      );
    }
  }

  function selectLocalSkill(skill: ChatSkillTemplate | null) {
    const selection = skill
      ? {
          id: `local:${skill.id}`,
          slug: skill.id,
          title: localizedValue(skill.title, text),
          systemPrompt: localizedValue(skill.instruction, text),
        }
      : null;
    if (currentSession?.id) {
      setServerSkillSelections((current) => {
        const next = { ...current };
        if (selection) {
          next[currentSession.id] = selection;
        } else {
          delete next[currentSession.id];
        }
        writeStoredJSON(SERVER_SKILL_SELECTION_KEY, next);
        return next;
      });
      setDraftSkillSelection(null);
    } else {
      setDraftSkillSelection(selection);
    }
    setSkillSheetOpen(false);
    setChatError("");
    if (skill?.starter) {
      setInput((value) =>
        value.trim()
          ? value
          : localizedValue(skill.starter as LocalizedString, text),
      );
    }
  }

  async function selectServerSkill(skill: MobileSkill) {
    setUsingSkillId(String(skill.id));
    setChatError("");
    try {
      const client = await mobilePlatformClient();
      const used = await client.skills.use(skill.slug, {
        locale: text.dateLocale,
        asset_ids: sharedMaterials
          .filter((item) => item.state === "ready" && item.asset?.id)
          .map((item) => String(item.asset?.id)),
      });
      const systemPrompt =
        used.version?.system_prompt || skill.version?.system_prompt || "";
      if (!systemPrompt.trim()) throw new Error(text.platform.skillFallback);
      const selection: ServerSkillSelection = {
        id: String(used.id || skill.id),
        slug: used.slug || skill.slug,
        title: serverSkillTitle(used, text),
        systemPrompt,
      };
      if (currentSession?.id) {
        setServerSkillSelections((current) => {
          const next = { ...current, [currentSession.id]: selection };
          writeStoredJSON(SERVER_SKILL_SELECTION_KEY, next);
          return next;
        });
        setDraftSkillSelection(null);
      } else {
        setDraftSkillSelection(selection);
      }
      setSkillSheetOpen(false);
    } catch (error) {
      setServerSkillsUnavailable(true);
      setChatError(
        error instanceof Error
          ? localizeManagedMobileError({ message: error.message })
          : text.platform.skillFallback,
      );
    } finally {
      setUsingSkillId("");
    }
  }

  async function switchGroup(groupID: number) {
    if (!Number.isFinite(groupID) || groupSwitching) return;
    const previousGroupId = effectiveChatGroupId;
    setGroupSheetOpen(false);
    setGroupSwitching(true);
    setChatError("");
    try {
      const rememberedModel = storedChatPreferenceModel(groupID);
      const requestedPreference = resolveChatPreference(workspace, groupID, [
        rememberedModel,
        currentSession?.model || "",
        draftModel,
        selectedModel,
      ]);
      const nextModel = requestedPreference.model;
      if (requestedPreference.groupId !== groupID || !nextModel) {
        await showNativeNotification(
          text.chat.group,
          text.errors.noModel,
        ).catch(() => {});
        setChatError(text.errors.noModel);
        return;
      }
      if (currentSession?.id) {
        await managed.switchGroup(groupID);
      }
      const latestWorkspace = currentSession?.id
        ? useManagedNextChatStore.getState().workspace || workspace
        : workspace;
      const confirmedPreference = resolveChatPreference(
        latestWorkspace,
        groupID,
        [
          rememberedModel,
          currentSession?.model || "",
          draftModel,
          selectedModel,
          nextModel,
        ],
      );
      const confirmedModel =
        confirmedPreference.groupId === groupID
          ? confirmedPreference.model
          : nextModel;
      persistChatPreference(groupID, confirmedModel);
      setPreferredChatGroupId(groupID);
      if (currentSession?.id) {
        mobileStore.updateChatSession(currentSession.id, {
          groupId: groupID,
          model: confirmedModel,
          error: "",
        });
      } else {
        setDraftGroupId(groupID);
        setDraftModel(confirmedModel);
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? localizeManagedMobileError({ message: err.message })
          : text.errors.switchGroupFailed;
      setChatError(message);
      await showNativeNotification(text.chat.group, message).catch(() => {});
      await managed.bootstrap({ silent: true }).catch(() => {});
      setPreferredChatGroupId(previousGroupId);
      if (!currentSession?.id) {
        setDraftGroupId(previousGroupId);
      }
      if (currentSession?.id) {
        mobileStore.updateChatSession(currentSession.id, {
          error: message,
        });
      }
    } finally {
      setGroupSwitching(false);
    }
  }

  async function switchToChatGroup() {
    if (!chatGroup?.id) return;
    await switchGroup(chatGroup.id);
  }

  function newSession() {
    const storedPreference = readChatPreference();
    const requestedGroupId =
      storedPreference.groupId ||
      draftGroupId ||
      preferredChatGroupId ||
      defaultChatGroupId ||
      currentSession?.groupId ||
      chatGroup?.id;
    const preferredModel =
      rememberedMobileChatModel(storedPreference, requestedGroupId) ||
      storedPreference.model ||
      "";
    const inheritedModel =
      preferredModel || draftModel || currentSession?.model || selectedModel;
    const nextPreference = resolveChatPreference(workspace, requestedGroupId, [
      inheritedModel,
      preferredModel,
    ]);
    const nextGroupId = nextPreference.groupId || requestedGroupId;
    const nextModel = nextPreference.model || fallbackModel;
    if (nextGroupId && nextModel) {
      persistChatPreference(nextGroupId, nextModel);
    }
    mobileStore.setCurrentChatId("");
    setDraftGroupId(nextGroupId);
    setDraftModel(nextModel);
    setDraftAgentId("");
    setDraftSkillSelection(null);
    setInput("");
    setAttachments([]);
    setSharedMaterials([]);
    setQuotedMessage(null);
    setDrawerOpen(false);
    setChatError(
      nextPreference.reason === "fallback"
        ? text.chat.modelFallback(nextModel)
        : "",
    );
  }

  function renameSession(id: string) {
    const session = mobileStore.chatSessions.find((item) => item.id === id);
    if (!session) return;
    setChatRenameTarget(session);
  }

  function clearSession(id: string) {
    if (!window.confirm(text.chat.clearConfirm)) return;
    mobileStore.clearChatSession(id);
  }

  async function exportSession(id: string) {
    const session = mobileStore.chatSessions.find((item) => item.id === id);
    if (!session) return;
    try {
      await shareText(exportChatSessionText(session, text), "JisudengChat");
      await showNativeNotification(
        text.chat.sessions,
        text.chat.exported,
      ).catch(() => {});
    } catch {
      setChatError(text.errors.shareFailed);
    }
  }

  const selectedModelInfo = models.find(
    (model) => modelValue(model) === selectedModel,
  );
  const currentGroupValue = String(effectiveChatGroupId || "");

  useNativeBackHandler(true, () => {
    if (chatRenameTarget) {
      setChatRenameTarget(null);
      return;
    }
    if (messageViewerTarget) {
      setMessageViewerTarget(null);
      return;
    }
    if (messageActionTarget) {
      setMessageActionTarget(null);
      return;
    }
    if (drawerOpen) {
      setDrawerOpen(false);
      return;
    }
    if (groupSheetOpen) {
      setGroupSheetOpen(false);
      return;
    }
    if (modelSheetOpen) {
      setModelSheetOpen(false);
      return;
    }
    if (agentSheetOpen) {
      setAgentSheetOpen(false);
      return;
    }
    if (skillSheetOpen) {
      setSkillSheetOpen(false);
      return;
    }
    if (moreToolsOpen) {
      setMoreToolsOpen(false);
      return;
    }
    if (quotedMessage) {
      setQuotedMessage(null);
      return;
    }
    // A chat is always entered from the dashboard, a session list, or a
    // material handoff. Return there before the root screen can handle its
    // double-back exit gesture. This does not discard the draft or session.
    lastNativeHomeBackAt = 0;
    navigateBack(navigate, Path.Home);
  });

  return (
    <main className={styles["mobile-app"]}>
      <section className={styles["chat-screen"]}>
        <header className={styles["app-header"]}>
          <IconButton
            label={text.common.back}
            onClick={() => navigate(Path.Home)}
          >
            <LeftIcon />
          </IconButton>
          <div>
            <span>{groupNameByID(workspace, effectiveChatGroupId, text)}</span>
            <h1>{text.chat.title}</h1>
          </div>
          <IconButton
            label={text.chat.sessions}
            onClick={() => setDrawerOpen(true)}
          >
            <HistoryIcon />
          </IconButton>
        </header>

        <div className={styles["chat-controls"]}>
          <button
            type="button"
            aria-label="chat-group-selector"
            onClick={() => setGroupSheetOpen(true)}
            disabled={groupSwitching}
          >
            <span>{text.chat.group}</span>
            <strong>
              {groupSwitching
                ? text.chat.switchingGroup
                : groupNameByID(workspace, effectiveChatGroupId, text)}
            </strong>
          </button>
          <button type="button" onClick={() => setModelSheetOpen(true)}>
            <span>{text.chat.model}</span>
            <strong>
              {modelLabel(selectedModelInfo) ||
                selectedModel ||
                text.errors.noModel}
            </strong>
          </button>
        </div>

        <div className={styles["library-action-row"]}>
          <button type="button" onClick={() => setAgentSheetOpen(true)}>
            <BotIcon />
            <span>{text.chat.agentLibrary}</span>
            <strong>
              {activeAgent
                ? localizedValue(activeAgent.title, text)
                : text.chat.defaultAgent}
            </strong>
          </button>
          <button type="button" onClick={() => setSkillSheetOpen(true)}>
            <PromptIcon />
            <span>{text.platform.skills}</span>
            <strong>{activeSkill?.title || text.platform.noSkill}</strong>
          </button>
        </div>

        {models.length === 0 && (
          <div className={styles["chat-routing-hint"]}>
            <div>
              <strong>{text.errors.noModel}</strong>
              <span>
                {chatGroup
                  ? text.chat.switchToChatGroupHint(chatGroup.name)
                  : text.chat.noChatGroupHint}
              </span>
            </div>
            {hasChatGroup && (
              <button
                type="button"
                onClick={switchToChatGroup}
                disabled={groupSwitching}
              >
                {text.chat.switchToChatGroup}
              </button>
            )}
          </div>
        )}

        <div
          className={styles["message-list"]}
          ref={listRef}
          onScroll={handleMessageListScroll}
        >
          {!currentSession?.messages.length && (
            <div
              className={styles["chat-empty"]}
              aria-label={
                currentSession ? "chat-session-empty" : "chat-draft-no-session"
              }
            >
              <ChatIcon />
              <h2>{text.chat.emptyTitle}</h2>
              <p>{text.chat.emptyDesc}</p>
            </div>
          )}
          {currentSession?.messages.map((message, messageIndex) => (
            <article
              key={message.id}
              aria-label={`chat-message-${message.role}-${messageIndex + 1}`}
              className={clsx(styles["message"], styles[message.role])}
            >
              {message.imageUrls?.length ? (
                <div className={styles["message-images"]}>
                  {message.imageUrls.map((url) => (
                    <img key={url} src={url} alt={text.chat.uploadImage} />
                  ))}
                </div>
              ) : null}
              {message.content ? (
                <MobileMessageContent content={message.content} />
              ) : message.status === "streaming" ? null : (
                <p className={styles["message-empty"]}>
                  {message.imageUrls?.length
                    ? text.chat.imageAttached(message.imageUrls.length)
                    : message.role === "user"
                    ? text.errors.emptyMessage
                    : text.common.empty}
                </p>
              )}
              {message.status === "streaming" && (
                <div
                  className={styles["message-generating"]}
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className={styles["message-generating-dots"]}
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>{text.chat.assistantThinking}</span>
                </div>
              )}
              {message.error && (
                <div className={styles["inline-error"]} role="alert">
                  {message.error}
                </div>
              )}
              <div className={styles["message-footer"]}>
                <small className={styles["message-meta"]}>
                  {formatSyncTime(message.updatedAt || message.createdAt, text)}
                  {message.status && message.status !== "done"
                    ? ` · ${text.chat.messageStatus(message.status)}`
                    : ""}
                </small>
                <button
                  type="button"
                  className={styles["message-actions-trigger"]}
                  aria-label={text.chat.messageActions}
                  onClick={() => {
                    if (currentSession?.id) {
                      openMessageActions(currentSession.id, message);
                    }
                  }}
                >
                  <ThreeDotsIcon />
                </button>
              </div>
            </article>
          ))}
        </div>

        {showChatErrorBar && (
          <div className={styles["chat-error-bar"]} role="alert">
            <span>{sessionError}</span>
            {currentSession?.messages.some(
              (message) => message.role === "user",
            ) && <button onClick={retryLast}>{text.chat.retryLast}</button>}
          </div>
        )}

        <form
          className={styles["composer"]}
          onSubmit={(event) => {
            event.preventDefault();
            sendChat();
          }}
        >
          {attachments.length > 0 && (
            <div className={styles["attachment-row"]}>
              {attachments.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() =>
                    setAttachments((items) =>
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  title={text.chat.clearImage}
                >
                  <img src={url} alt={text.chat.uploadImage} />
                  <CloseIcon />
                </button>
              ))}
            </div>
          )}
          {sharedMaterials.length > 0 && (
            <div className={styles["material-chip-row"]}>
              {sharedMaterials.map((material) => (
                <div
                  key={material.localId}
                  className={clsx(styles["material-upload-chip"], {
                    [styles["failed"]]: material.state === "failed",
                    [styles["uploading"]]: material.state === "uploading",
                    [styles["local"]]: material.state === "local",
                  })}
                  title={material.error || material.name}
                >
                  {material.previewUrl ? (
                    <img src={material.previewUrl} alt={material.name} />
                  ) : (
                    <UploadIcon />
                  )}
                  <span>
                    <strong>{material.name}</strong>
                    <small>
                      {material.state === "uploading"
                        ? text.platform.uploadWaiting
                        : material.state === "ready"
                        ? text.platform.uploadReady
                        : material.state === "local"
                        ? text.platform.uploadLocalReady
                        : text.platform.uploadFailed}
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSharedMaterials((items) =>
                        items.filter(
                          (item) => item.localId !== material.localId,
                        ),
                      )
                    }
                    aria-label={text.common.delete}
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
          {quotedMessage && (
            <div className={styles["quote-preview"]}>
              <span>
                {text.chat.quoteTitle} ·{" "}
                {quotedMessage.role === "user"
                  ? text.chat.userRole
                  : text.chat.assistantRole}
              </span>
              <strong>{quotedMessage.content}</strong>
              <button type="button" onClick={() => setQuotedMessage(null)}>
                <CloseIcon />
              </button>
            </div>
          )}
          {moreToolsOpen && (
            <div className={styles["composer-tools"]}>
              <button type="button" onClick={() => fileRef.current?.click()}>
                <UploadIcon />
                <span>{text.chat.attachFile}</span>
              </button>
              <button type="button" onClick={capturePhoto} disabled={capturing}>
                <ImageIcon />
                <span>
                  {capturing ? text.chat.capturing : text.chat.camera}
                </span>
              </button>
            </div>
          )}
          <div className={styles["composer-row"]}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              multiple
              hidden
              onChange={attachImages}
            />
            <IconButton
              label={text.chat.voiceInput}
              onClick={() => {
                setVoiceBarOpen((value) => !value);
                if (!voiceBarOpen) setMoreToolsOpen(false);
              }}
              active={listening}
              disabled={listening}
            >
              <VoiceIcon />
            </IconButton>
            {voiceBarOpen ? (
              <button
                type="button"
                className={clsx(styles["voice-hold-bar"], {
                  [styles["recording"]]: listening,
                  [styles["cancel"]]: voiceCancelling,
                })}
                onPointerDown={beginVoiceHold}
                onPointerMove={moveVoiceHold}
                onPointerUp={endVoiceHold}
                onPointerCancel={() => {
                  voiceCancelledRef.current = true;
                  voiceReleasedRef.current = true;
                  const sessionId = voicePttSessionIdRef.current;
                  if (sessionId) {
                    cancelForegroundPttSession(
                      sessionId,
                      "pointer_cancel",
                    ).catch(() => {});
                  }
                }}
              >
                {voiceCancelling
                  ? text.chat.voiceReleaseCancel
                  : listening
                  ? voiceTranscript || text.chat.voiceReleaseSend
                  : text.chat.voiceHoldToTalk}
              </button>
            ) : (
              <textarea
                aria-label="chat-composer"
                value={input}
                onChange={(event) => setInput(event.currentTarget.value)}
                placeholder={text.chat.inputPlaceholder}
                rows={1}
              />
            )}
            <IconButton
              label={text.chat.moreTools}
              onClick={() => setMoreToolsOpen((value) => !value)}
              active={moreToolsOpen}
            >
              <AddIcon />
            </IconButton>
            {running ? (
              <IconButton label={text.chat.stop} onClick={stopChat} danger>
                <CloseIcon />
              </IconButton>
            ) : (
              <IconButton
                label={text.chat.send}
                type="submit"
                disabled={
                  !input.trim() &&
                  attachments.length === 0 &&
                  !sharedMaterials.some(
                    (item) =>
                      item.state === "ready" ||
                      (item.state === "local" && item.localText?.trim()),
                  )
                }
                active
              >
                <SendIcon />
              </IconButton>
            )}
          </div>
        </form>

        <ChatSessionDrawer
          open={drawerOpen}
          sessions={mobileStore.chatSessions}
          currentId={mobileStore.currentChatId}
          text={text}
          onClose={() => setDrawerOpen(false)}
          onSelect={(id) => {
            mobileStore.setCurrentChatId(id);
            setDrawerOpen(false);
          }}
          onNew={newSession}
          onDelete={(id) => {
            if (!window.confirm(text.account.deleteSessionConfirm)) return;
            mobileStore.removeChatSession(id);
          }}
          onRename={renameSession}
          onTogglePin={(id) => mobileStore.togglePinChatSession(id)}
          onClear={clearSession}
          onExport={(id) => exportSession(id)}
        />
        <ChoiceSheet
          open={groupSheetOpen}
          title={text.chat.group}
          text={text}
          items={groups.map((group) => ({
            id: String(group.id),
            title: group.name,
            detail: text.modelCount(
              group.models?.filter(isChatModel).length || 0,
            ),
            active: String(group.id) === currentGroupValue,
          }))}
          onClose={() => setGroupSheetOpen(false)}
          onSelect={(id) => {
            switchGroup(Number(id));
          }}
        />
        <ChoiceSheet
          open={modelSheetOpen}
          title={text.chat.model}
          text={text}
          items={models.map((model) => ({
            id: modelValue(model),
            title: modelLabel(model),
            detail: model.use_case || text.dashboard.creativeFallback,
            active: modelValue(model) === selectedModel,
          }))}
          onClose={() => setModelSheetOpen(false)}
          onSelect={(id) => {
            setModelSheetOpen(false);
            changeModel(id);
          }}
        />
        <ChatAgentLibrarySheet
          open={agentSheetOpen}
          text={text}
          activeId={currentSession?.agentId || activeAgent?.id}
          onClose={() => setAgentSheetOpen(false)}
          onSelect={selectAgent}
        />
        <ChatSkillLibrarySheet
          open={skillSheetOpen}
          text={text}
          activeId={
            currentSession?.id
              ? serverSkillSelections[currentSession.id]?.id
              : draftSkillSelection?.id || ""
          }
          serverSkills={serverSkills}
          serverLoading={serverSkillsLoading}
          serverUnavailable={serverSkillsUnavailable}
          usingSkillId={usingSkillId}
          onClose={() => setSkillSheetOpen(false)}
          onSelectLocal={selectLocalSkill}
          onSelectServer={selectServerSkill}
        />
        <RenameSessionDialog
          open={Boolean(chatRenameTarget)}
          title={text.chat.renameSession}
          initialValue={
            chatRenameTarget
              ? chatSessionDisplayTitle(chatRenameTarget, text)
              : ""
          }
          text={text}
          onClose={() => setChatRenameTarget(null)}
          onSubmit={(value) => {
            if (!chatRenameTarget) return;
            mobileStore.renameChatSession(chatRenameTarget.id, value);
            setChatRenameTarget(null);
          }}
        />
        {messageActionTarget && (
          <MessageActionSheet
            target={messageActionTarget}
            text={text}
            onClose={() => setMessageActionTarget(null)}
            onCopy={() => copyMessage(messageActionTarget.message)}
            onView={() => {
              setMessageViewerTarget(messageActionTarget);
              setMessageActionTarget(null);
            }}
            onSelectText={() => selectMessageText(messageActionTarget.message)}
            onQuote={() => quoteMessage(messageActionTarget.message)}
            onRetry={() => retryMessage(messageActionTarget.message)}
            onReport={() => reportChatMessage(messageActionTarget)}
            onDelete={() => deleteMessage(messageActionTarget)}
          />
        )}
        {messageViewerTarget && (
          <MessageViewerModal
            target={messageViewerTarget}
            text={text}
            onClose={() => setMessageViewerTarget(null)}
            onCopy={() => copyMessage(messageViewerTarget.message)}
            onQuote={() => quoteMessage(messageViewerTarget.message)}
            onReport={() => reportChatMessage(messageViewerTarget)}
            onDelete={() => deleteMessage(messageViewerTarget)}
          />
        )}
      </section>
    </main>
  );
}

function AndroidContentKit() {
  const managed = useManagedNextChatStore();
  const mobileStore = useManagedMobileAppStore();
  const text = useMobileText();
  const navigate = useNavigate();
  const activeAccountId = String(
    managed.user?.id ||
      managed.session?.user_id ||
      managed.workspace?.user?.id ||
      "",
  );
  const workspace = managed.workspace
    ? {
        ...managed.workspace,
        models:
          managed.workspace.workspaces?.image?.models ||
          managed.workspace.models,
      }
    : null;
  const imageGroup = bestImageGroup(workspace);
  const imageModels = imageModelsForGroup(workspace, imageGroup?.id);
  const chatModel = modelValue(currentChatModels(managed.workspace)[0]);
  const [productName, setProductName] = useState("");
  const [sellingPoints, setSellingPoints] = useState("");
  const [parameters, setParameters] = useState("");
  const [audience, setAudience] = useState("");
  const [platform, setPlatform] = useState("");
  const [tone, setTone] = useState("");
  const [lockProduct, setLockProduct] = useState(true);
  const [lockColor, setLockColor] = useState(true);
  const [lockLogo, setLockLogo] = useState(false);
  const [composition, setComposition] = useState<
    "center" | "left" | "right" | "closeup"
  >("center");
  const [safeArea, setSafeArea] = useState<
    "none" | "top" | "bottom" | "left" | "right"
  >("none");
  const [videoIntent, setVideoIntent] = useState(false);
  const [model, setModel] = useState(() => modelValue(imageModels[0]));
  const [references, setReferences] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [presetId, setPresetId] = useState("ecommerce");
  const [customShots, setCustomShots] = useState<ContentKitShotPlan[]>(() =>
    contentWorkbenchShotOptions()
      .filter((shot) => ["main", "lifestyle", "vertical"].includes(shot.kind))
      .map((shot) => localizedContentKitShot(shot, text)),
  );
  const [presetShotEdits, setPresetShotEdits] = useState<
    Record<string, ContentKitShotPlan[]>
  >({});
  const fileRef = useRef<HTMLInputElement | null>(null);
  const queueRef = useRef(new Set<string>());
  const recoveredQueuesRef = useRef(false);
  const [batchEstimate, setBatchEstimate] = useState<ContentKitBatchEstimate>();
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateUnavailable, setEstimateUnavailable] = useState(false);
  const [assetTagFilter, setAssetTagFilter] = useState<
    "all" | ContentKitAssetTag
  >("all");
  const [previewAssetId, setPreviewAssetId] = useState("");
  const [viewRunId, setViewRunId] = useState("");

  useEffect(() => {
    if (!imageModels.some((item) => modelValue(item) === model)) {
      setModel(modelValue(imageModels[0]));
    }
  }, [imageModels, model]);

  const selectedModel = imageModels.find((item) => modelValue(item) === model);

  const presetOptions = contentWorkbenchPresets().map((preset) => ({
    ...preset,
    title: text.platform.contentKit[preset.titleKey],
    hint: text.platform.contentKit[preset.hintKey],
    shots: preset.shots.map((shot) => localizedContentKitShot(shot, text)),
  }));
  const selectedPreset =
    presetOptions.find((item) => item.id === presetId) ||
    presetOptions.find((item) => item.id === "ecommerce") ||
    presetOptions[0];
  const modelCapabilities = selectedModel?.image_capabilities;
  const maxOutputsPerRun = Math.max(
    1,
    Math.min(
      CONTENT_KIT_MAX_OUTPUTS_PER_RUN,
      Number(
        modelCapabilities?.max_queued_outputs ||
          CONTENT_KIT_MAX_OUTPUTS_PER_RUN,
      ),
    ),
  );
  const recommendedParallelism = Math.max(
    1,
    Math.min(
      CONTENT_KIT_GLOBAL_CONCURRENCY,
      Number(
        modelCapabilities?.recommended_parallelism ||
          CONTENT_KIT_GLOBAL_CONCURRENCY,
      ),
    ),
  );
  const referenceLimit = contentKitReferenceLimit(selectedModel);
  const supportedContentKitSizes = modelCapabilities?.supported_sizes?.length
    ? modelCapabilities.supported_sizes
    : ["1024x1024", "1024x1536", "1536x1024"];

  function planForPreset(preset: (typeof presetOptions)[number]) {
    return preset.id === "custom"
      ? customShots
      : presetShotEdits[preset.id] || preset.shots;
  }

  const selectedPlanShots: ContentKitShotPlan[] = planForPreset(selectedPreset);
  const selectedPlanCount = contentWorkbenchPlanOutputCount(selectedPlanShots);
  const planSignature = selectedPlanShots
    .map(
      (shot) =>
        `${shot.id}:${shot.kind}:${shot.purpose}:${shot.aspect}:${shot.size}:${shot.count}:${shot.promptTemplate}`,
    )
    .join("|");
  const customShotOptions = contentWorkbenchShotOptions().map((shot) =>
    localizedContentKitShot(shot, text),
  );

  function updateSelectedPlan(
    updater: (plan: ContentKitShotPlan[]) => ContentKitShotPlan[],
  ) {
    if (selectedPreset.id === "custom") {
      setCustomShots((current) => updater(current));
      return;
    }
    setPresetShotEdits((current) => ({
      ...current,
      [selectedPreset.id]: updater(
        current[selectedPreset.id] || selectedPreset.shots,
      ),
    }));
  }

  function assetSpecs(
    runId: string,
    plan = selectedPlanShots,
  ): Omit<ManagedMobileContentKitAsset, "status" | "updatedAt">[] {
    return contentKitAssetSpecs(runId, plan, {
      projectName: productName.trim(),
      sellingPoints: sellingPoints.trim(),
      parameters: parameters.trim(),
      audience: audience.trim(),
      platform: platform.trim(),
      tone: tone.trim(),
      scene: selectedPreset.id,
      brandControls: {
        lockProduct,
        lockColor,
        lockLogo,
        composition,
        safeArea,
        videoIntent,
      },
    });
  }

  useEffect(() => {
    if (!managed.accessToken || !model || !selectedPlanCount) {
      setBatchEstimate(undefined);
      setEstimateLoading(false);
      setEstimateUnavailable(false);
      return;
    }
    let cancelled = false;
    setBatchEstimate(undefined);
    setEstimateUnavailable(false);
    const timer = window.setTimeout(() => {
      setEstimateLoading(true);
      const sampleAssets = assetSpecs("content-kit-estimate");
      const batches = Array.from(
        {
          length: Math.ceil(sampleAssets.length / maxOutputsPerRun),
        },
        (_, index) =>
          sampleAssets.slice(
            index * maxOutputsPerRun,
            (index + 1) * maxOutputsPerRun,
          ),
      );
      void Promise.all(
        batches.map((items) =>
          managedAuthenticatedJsonRequest<ContentKitBatchEstimate>(
            "/api/v1/nextchat/image-studio/estimate-batch",
            {
              method: "POST",
              body: JSON.stringify({
                items: items.map((asset) => ({
                  id: asset.id,
                  template_id: "free-create",
                  size: asset.size,
                  model,
                })),
              }),
            },
          ),
        ),
      )
        .then((estimates) => {
          if (cancelled) return;
          setBatchEstimate({
            estimated_cost: estimates.reduce(
              (total, estimate) => total + Number(estimate.estimated_cost || 0),
              0,
            ),
            balance: Number(estimates[0]?.balance || 0),
            sufficient: estimates.every((estimate) => estimate.sufficient),
          });
        })
        .catch(() => {
          if (!cancelled) {
            setBatchEstimate(undefined);
            setEstimateUnavailable(true);
          }
        })
        .finally(() => {
          if (!cancelled) setEstimateLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // assetSpecs captures the current brief; the signature covers every factor used by this estimate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    managed.accessToken,
    maxOutputsPerRun,
    model,
    planSignature,
    selectedPlanCount,
  ]);

  async function attachReferences(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (!input.files?.length) return;
    try {
      if (!referenceLimit) {
        setError(text.platform.contentKit.referenceUnsupported);
        return;
      }
      const images = await readImageFiles(
        Array.from(input.files),
        referenceLimit,
      );
      setReferences((current) =>
        [...current, ...images].slice(0, referenceLimit),
      );
      setError("");
    } catch (err) {
      setError(localizedMobileErrorMessage(err, text.errors.saveFailed));
    } finally {
      input.value = "";
    }
  }

  function patchAsset(
    projectId: string,
    assetId: string,
    patch: Partial<ManagedMobileContentKitAsset>,
  ) {
    const current = useManagedMobileAppStore
      .getState()
      .contentKits.find((item) => item.id === projectId);
    if (!current) return;
    mobileStore.updateContentKit(projectId, {
      assets: current.assets.map((asset) =>
        asset.id === assetId
          ? { ...asset, ...patch, updatedAt: Date.now() }
          : asset,
      ),
    });
  }

  async function hydrateAssetBilling(
    projectId: string,
    assetId: string,
    requestId: string,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const page = await managedAuthenticatedJsonRequest<ContentKitUsagePage>(
          `/api/v1/usage?page=1&page_size=1&client_request_id=${encodeURIComponent(
            requestId,
          )}`,
        );
        const record = page.items?.find(
          (item) => item.request_id === `client:${requestId}`,
        );
        if (record) {
          patchAsset(projectId, assetId, {
            actualCost: Number(record.actual_cost || 0),
            billingRecordId: String(record.id),
            billingStatus: "captured",
          });
          return;
        }
      } catch {
        return;
      }
      if (attempt < 2) await sleep(500 * (attempt + 1));
    }
  }

  async function generateAsset(
    project: ManagedMobileContentKit,
    asset: ManagedMobileContentKitAsset,
  ) {
    if (
      project.referenceImages.length &&
      !imageModelSupportsReferences(project.model, imageModels, false)
    ) {
      patchAsset(project.id, asset.id, {
        status: "failed",
        error: text.platform.contentKit.referenceUnsupported,
      });
      setError(text.platform.contentKit.referenceUnsupported);
      return;
    }
    if (!managed.imageSession) {
      patchAsset(project.id, asset.id, {
        status: "failed",
        error: text.errors.loginRequired,
      });
      return;
    }
    // Persist before the first request. A restart or timeout must replay the
    // same key so the gateway can return the original job instead of billing a
    // second generation.
    const localTaskId =
      asset.requestId || clientRequestID(`content-kit-output-${asset.id}`);
    patchAsset(project.id, asset.id, {
      status: "running",
      error: "",
      taskId: localTaskId,
      requestId: localTaskId,
      billingStatus: "pending",
    });
    let platformTask: MobileTask | null = null;
    try {
      const client = await mobilePlatformClient();
      platformTask = await client.tasks.create({
        kind: "image",
        operation: project.referenceImages.length
          ? "images.edits"
          : "images.generations",
        client_request_id: localTaskId,
        title: asset.label,
        title_zh: asset.label,
        model: project.model,
        group_id: imageGroup?.id,
        parameters: {
          size: asset.size,
          content_kit: project.id,
          project_id: project.id,
          run_id: asset.runId,
          shot_id: asset.shotId,
          scene: asset.scene || project.scene || project.presetId || "custom",
          kind: asset.kind,
          purpose: asset.purpose || "",
          aspect: asset.aspect || "",
          asset: asset.shotId,
          output_id: asset.id,
          variant: asset.variant,
        },
        locale: text.dateLocale,
      });
      patchAsset(project.id, asset.id, { taskId: platformTask.id });
      await client.tasks.status(platformTask.id, { status: "running" });
    } catch {
      // Optional task history must not prevent the local output from running.
    }
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Idempotency-Key": localTaskId,
        "X-Request-ID": localTaskId,
        "X-Client-Request-ID": localTaskId,
      };
      let body: BodyInit;
      const payload = {
        model: project.model,
        prompt: asset.prompt,
        size: asset.size,
        n: 1,
        response_format: "b64_json",
      };
      const endpoint = project.referenceImages.length
        ? "/images/edits"
        : "/images/generations";
      if (project.referenceImages.length) {
        const form = new FormData();
        Object.entries(payload).forEach(([key, value]) =>
          form.append(key, String(value)),
        );
        project.referenceImages.forEach((image, index) =>
          form.append(
            "image",
            dataUrlToBlob(image),
            `reference-${index + 1}.png`,
          ),
        );
        body = form;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(payload);
      }
      const response = await managedGatewayRequestText(
        managed.backendBaseUrl,
        `/v1${endpoint}`,
        { method: "POST", headers, body },
        managed.imageSession.api_key || "",
        text,
      );
      const json = response.text ? JSON.parse(response.text) : null;
      if (!response.ok || json?.error) {
        throw new Error(
          parseOpenAIError(
            response.text,
            response.status,
            `/v1${endpoint}`,
            response.requestId || localTaskId,
          ),
        );
      }
      const image = openAIImageData(json)[0];
      const configuredShot = project.shotPlan?.find(
        (shot) => shot.id === asset.shotId,
      );
      const overlayShot = normalizeContentWorkbenchShot(
        configuredShot || {
          id: asset.shotId,
          scene: asset.scene || project.scene || project.presetId || "custom",
          kind: asset.kind,
          label: asset.label,
          purpose: asset.purpose || asset.label,
          aspect: asset.aspect || "custom",
          size: asset.size,
          count: 1,
          copyFields: (asset.copyFields ||
            []) as WorkbenchShotPlan["copyFields"],
        },
      );
      const saved = await persistContentKitImageResult(image, {
        taskId: localTaskId,
        prompt: asset.prompt,
        model: project.model,
        ownerUserId: String(managed.user?.id || managed.session?.user_id || ""),
        projectId: project.id,
        runId: asset.runId,
        shotId: asset.shotId,
        kind: asset.kind,
        label: asset.label,
        collectionId: project.id,
        overlay: {
          brief: contentKitBriefFromProject(project),
          shot: overlayShot,
        },
      });
      patchAsset(project.id, asset.id, {
        status: "completed",
        projectId: project.id,
        imageUrl: saved.url,
        fileName: saved.fileName,
        error: "",
      });
      void hydrateAssetBilling(project.id, asset.id, localTaskId);
      if (platformTask) {
        const client = await mobilePlatformClient().catch(() => null);
        await client?.tasks
          .status(platformTask.id, { status: "completed", progress: 100 })
          .catch(() => {});
      }
    } catch (err) {
      const message = localizedMobileErrorMessage(
        err,
        text.platform.contentKit.failed,
      );
      patchAsset(project.id, asset.id, { status: "failed", error: message });
      void hydrateAssetBilling(project.id, asset.id, localTaskId);
      if (platformTask) {
        const client = await mobilePlatformClient().catch(() => null);
        await client?.tasks
          .status(platformTask.id, {
            status: "failed",
            error: {
              code: "content_kit_image_failed",
              message,
              retryable: true,
            },
          })
          .catch(() => {});
      }
    }
  }

  async function generateCopy(project: ManagedMobileContentKit) {
    if (!chatModel) {
      mobileStore.updateContentKit(project.id, {
        copyStatus: "failed",
        copyError: text.platform.contentKit.noChatModel,
      });
      return;
    }
    const requestId = clientRequestID("content-kit-copy");
    mobileStore.updateContentKit(project.id, {
      copyStatus: "running",
      copyError: "",
      copyTaskId: requestId,
    });
    try {
      const payload = JSON.stringify({
        model: chatModel,
        stream: false,
        messages: [
          {
            role: "user",
            content: buildContentWorkbenchCopyPrompt(
              contentKitBriefFromProject(project),
            ),
          },
        ],
      });
      const response = await managedGatewayRequestText(
        managed.backendBaseUrl,
        "/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": requestId,
            "X-Request-ID": requestId,
            "X-Client-Request-ID": requestId,
          },
          body: payload,
        },
        managed.session?.api_key || "",
        text,
      );
      if (!response.ok)
        throw new Error(
          parseOpenAIError(
            response.text,
            response.status,
            "/v1/chat/completions",
            response.requestId || requestId,
          ),
        );
      const json = JSON.parse(response.text || "{}");
      const copy =
        json?.choices?.[0]?.message?.content || json?.output_text || "";
      if (!String(copy).trim())
        throw new Error(text.platform.contentKit.failed);
      mobileStore.updateContentKit(project.id, {
        copyStatus: "completed",
        copy: String(copy),
        copyError: "",
      });
    } catch (err) {
      mobileStore.updateContentKit(project.id, {
        copyStatus: "failed",
        copyError: localizedMobileErrorMessage(
          err,
          text.platform.contentKit.failed,
        ),
      });
    }
  }

  function updateRun(
    projectId: string,
    runId: string,
    status:
      | "queued"
      | "running"
      | "paused"
      | "completed"
      | "partial"
      | "cancelled",
  ) {
    const project = useManagedMobileAppStore
      .getState()
      .contentKits.find((item) => item.id === projectId);
    if (!project) return;
    mobileStore.updateContentKit(projectId, {
      runs: (project.runs || []).map((run) =>
        run.id === runId ? { ...run, status, updatedAt: Date.now() } : run,
      ),
    });
  }

  async function runProjectQueue(projectId: string) {
    if (queueRef.current.has(projectId)) return;
    queueRef.current.add(projectId);
    try {
      while (true) {
        const project = useManagedMobileAppStore
          .getState()
          .contentKits.find((item) => item.id === projectId);
        const runId = project?.activeRunId;
        const run = project?.runs?.find((item) => item.id === runId);
        if (
          !project ||
          !runId ||
          !run ||
          run.status === "paused" ||
          run.status === "cancelled"
        ) {
          return;
        }
        if (run.status !== "running") updateRun(projectId, runId, "running");
        const queued = project.assets.filter(
          (asset) =>
            asset.runId === runId &&
            (asset.status === "queued" || asset.status === "idle"),
        );
        if (!queued.length) {
          const outputs = project.assets.filter(
            (asset) => asset.runId === runId,
          );
          const finalStatus = outputs.some(
            (asset) =>
              asset.status === "failed" || asset.status === "cancelled",
          )
            ? "partial"
            : "completed";
          updateRun(projectId, runId, finalStatus);
          const nextRun = project.runs
            ?.filter((item) => item.id !== runId && item.status === "queued")
            .sort((left, right) => left.createdAt - right.createdAt)[0];
          if (!nextRun) return;
          mobileStore.updateContentKit(projectId, {
            activeRunId: nextRun.id,
          });
          continue;
        }
        await Promise.all(
          queued.slice(0, recommendedParallelism).map(async (asset) => {
            while (activeContentKitOutputs.size >= recommendedParallelism) {
              await sleep(80);
            }
            activeContentKitOutputs.add(asset.id);
            try {
              await generateAsset(project, asset);
            } finally {
              activeContentKitOutputs.delete(asset.id);
            }
          }),
        );
      }
    } finally {
      queueRef.current.delete(projectId);
    }
  }

  function pauseProjectQueue(project: ManagedMobileContentKit) {
    if (!project.activeRunId) return;
    updateRun(project.id, project.activeRunId, "paused");
  }

  function cancelProjectQueue(project: ManagedMobileContentKit) {
    const runId = project.activeRunId;
    if (!runId) return;
    mobileStore.updateContentKit(project.id, {
      assets: project.assets.map((asset) =>
        asset.runId === runId &&
        (asset.status === "idle" || asset.status === "queued")
          ? { ...asset, status: "cancelled", updatedAt: Date.now() }
          : asset,
      ),
    });
    updateRun(project.id, runId, "cancelled");
  }

  function retryRunAssets(
    project: ManagedMobileContentKit,
    runId: string,
    assetIds?: string[],
  ) {
    const retryIds = new Set(assetIds || []);
    const retryingAllFailed = retryIds.size === 0;
    const retryable = project.assets.filter(
      (asset) =>
        asset.runId === runId &&
        asset.status === "failed" &&
        (retryingAllFailed || retryIds.has(asset.id)),
    );
    if (!retryable.length) return;

    const activeRun = project.runs?.find(
      (run) => run.id === project.activeRunId,
    );
    if (
      activeRun &&
      activeRun.id !== runId &&
      ["queued", "running", "paused"].includes(activeRun.status)
    ) {
      setError(text.platform.contentKit.queueRunning);
      return;
    }

    const retrying = new Set(retryable.map((asset) => asset.id));
    mobileStore.updateContentKit(project.id, {
      activeRunId: runId,
      assets: project.assets.map((asset) =>
        retrying.has(asset.id)
          ? {
              ...asset,
              // A recovered request reuses its key, while an explicit retry
              // must have a new key so a terminal upstream error is not
              // returned from an idempotency cache.
              requestId: clientRequestID(`content-kit-retry-${asset.id}`),
              taskId: undefined,
              status: "queued",
              error: "",
              billingStatus: "pending",
              updatedAt: Date.now(),
            }
          : asset,
      ),
      runs: (project.runs || []).map((run) =>
        run.id === runId
          ? { ...run, status: "queued", updatedAt: Date.now() }
          : run,
      ),
    });
    setViewRunId(runId);
    setError("");
    void runProjectQueue(project.id);
  }

  function retryFailedAssets(
    project: ManagedMobileContentKit,
    runId = project.activeRunId,
  ) {
    if (!runId) return;
    retryRunAssets(project, runId);
  }

  function createNextRun(project: ManagedMobileContentKit) {
    const plan = contentWorkbenchClonePlan(
      project.shotPlan?.filter((shot) => shot.count > 0) || [],
    );
    const outputCount = contentWorkbenchPlanOutputCount(plan);
    if (
      !outputCount ||
      project.assets.length + outputCount > CONTENT_KIT_MAX_OUTPUTS_PER_PROJECT
    ) {
      setError(text.platform.contentKit.projectLimit);
      return;
    }
    const runId = clientRequestID("content-kit-run");
    // A new run must rebuild every shot from the saved structured brief. Reusing
    // a previous output prompt makes detail and layout shots regress into heroes.
    const assets = contentKitAssetSpecs(
      runId,
      plan,
      contentKitBriefFromProject(project),
      project.id,
    ).map((asset) => ({
      ...asset,
      status: "queued" as const,
      updatedAt: Date.now(),
    }));
    mobileStore.updateContentKit(project.id, {
      activeRunId: runId,
      runs: [
        ...(project.runs || []),
        {
          id: runId,
          presetId: project.presetId || "custom",
          status: "queued",
          total: assets.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      assets: [...project.assets, ...assets],
    });
    setViewRunId(runId);
    setError("");
    void runProjectQueue(project.id);
  }

  async function createProject() {
    if (!productName.trim() || !sellingPoints.trim())
      return setError(text.platform.contentKit.requiredProduct);
    if (!model || !imageModels.length)
      return setError(text.platform.contentKit.noImageModel);
    if (
      selectedPlanShots.some(
        (shot) => !contentKitModelSupportsSize(selectedModel, shot.size),
      )
    ) {
      return setError(text.platform.contentKit.unsupportedSize);
    }
    if (estimateLoading) {
      return setError(text.platform.contentKit.estimateRequired);
    }
    if (batchEstimate && !batchEstimate.sufficient) {
      return setError(text.platform.contentKit.insufficientBalance);
    }
    if (
      references.length &&
      !imageModelSupportsReferences(selectedModel || model, [], false)
    ) {
      return setError(text.platform.contentKit.referenceUnsupported);
    }
    if (
      !selectedPlanCount ||
      selectedPlanCount > CONTENT_KIT_MAX_OUTPUTS_PER_PROJECT
    ) {
      return setError(text.platform.contentKit.planLimit);
    }
    const rawAssets = assetSpecs("content-kit-pending");
    const runs = Array.from(
      { length: Math.ceil(rawAssets.length / maxOutputsPerRun) },
      (_, index) => {
        const runId = clientRequestID("content-kit-run");
        const start = index * maxOutputsPerRun;
        const outputCount = Math.min(
          maxOutputsPerRun,
          rawAssets.length - start,
        );
        return {
          id: runId,
          presetId: selectedPreset.id,
          status: "queued" as const,
          total: outputCount,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      },
    );
    const assets = rawAssets.map((asset, index) => {
      const run = runs[Math.floor(index / maxOutputsPerRun)];
      const variant =
        rawAssets.slice(0, index).filter((item) => item.shotId === asset.shotId)
          .length + 1;
      return {
        ...asset,
        id: `${run.id}-${asset.shotId}-${variant}`,
        runId: run.id,
        variant,
        status: "queued" as const,
        updatedAt: Date.now(),
      };
    });
    const projectId = mobileStore.createContentKit({
      scene: selectedPreset.id,
      productName: productName.trim(),
      sellingPoints: sellingPoints.trim(),
      parameters: parameters.trim(),
      audience: audience.trim(),
      platform: platform.trim(),
      tone: tone.trim(),
      brandControls: {
        lockProduct,
        lockColor,
        lockLogo,
        composition,
        safeArea,
        videoIntent,
      },
      model,
      referenceImages: references,
      presetId: selectedPreset.id,
      shotPlan: contentWorkbenchClonePlan(selectedPlanShots),
      activeRunId: runs[0]?.id,
      runs,
      assets,
      copyStatus: "idle",
    });
    const project = useManagedMobileAppStore
      .getState()
      .contentKits.find((item) => item.id === projectId);
    if (!project) return;
    setError("");
    setShowComposer(false);
    setSelectedProjectId(projectId);
    void runProjectQueue(projectId);
    void generateCopy(project);
  }

  const projects = [...mobileStore.contentKits].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
  const selectedProject = projects.find(
    (item) => item.id === selectedProjectId,
  );

  useEffect(() => {
    if (!managed.imageSession) return;
    if (!recoveredQueuesRef.current) {
      recoveredQueuesRef.current = true;
      projects.forEach((project) => {
        const hasUnconfirmedOutput = project.assets.some(
          (asset) => asset.status === "running",
        );
        const activeRun = project.runs?.find(
          (run) => run.id === project.activeRunId,
        );
        if (hasUnconfirmedOutput) {
          mobileStore.updateContentKit(project.id, {
            assets: project.assets.map((asset) =>
              asset.status === "running"
                ? { ...asset, status: "queued", updatedAt: Date.now() }
                : asset,
            ),
          });
        }
        if (activeRun?.status === "running") {
          updateRun(project.id, activeRun.id, "queued");
        }
      });
    }
    projects.forEach((project) => {
      const run = project.runs?.find((item) => item.id === project.activeRunId);
      if (run?.status === "queued" || run?.status === "running") {
        void runProjectQueue(project.id);
      }
    });
    // Queue membership prevents duplicate workers; resume after local-store hydration or app restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managed.imageSession, mobileStore.contentKits]);

  function taskStatusLabel(status: ManagedMobileContentKitAsset["status"]) {
    if (status === "completed") return text.platform.contentKit.completed;
    if (status === "running") return text.platform.contentKit.generating;
    if (status === "failed") return text.platform.contentKit.failed;
    return text.platform.contentKit.waiting;
  }

  function runStatusLabel(status: string) {
    if (status === "partial") return text.platform.contentKit.partial;
    if (status === "cancelled") return text.platform.contentKit.failed;
    return taskStatusLabel(status as ManagedMobileContentKitAsset["status"]);
  }

  function projectStatus(project: ManagedMobileContentKit) {
    const statuses = [
      ...project.assets.map((item) => item.status),
      project.copyStatus,
    ];
    if (statuses.every((status) => status === "completed")) {
      return text.platform.contentKit.completed;
    }
    if (
      statuses.some(
        (status) =>
          status === "running" || status === "idle" || status === "queued",
      )
    ) {
      return text.platform.contentKit.generating;
    }
    if (statuses.some((status) => status === "completed")) {
      return text.platform.contentKit.partial;
    }
    return text.platform.contentKit.failed;
  }

  function toggleAssetSelection(
    project: ManagedMobileContentKit,
    assetId: string,
  ) {
    mobileStore.updateContentKit(project.id, {
      assets: project.assets.map((asset) =>
        asset.id === assetId
          ? { ...asset, selected: !asset.selected, updatedAt: Date.now() }
          : asset,
      ),
    });
  }

  function toggleAssetTag(
    project: ManagedMobileContentKit,
    assetId: string,
    tag: ContentKitAssetTag,
  ) {
    mobileStore.updateContentKit(project.id, {
      assets: project.assets.map((asset) => {
        if (asset.id !== assetId) return asset;
        const tags = new Set(asset.tags || []);
        if (tags.has(tag)) tags.delete(tag);
        else tags.add(tag);
        return { ...asset, tags: [...tags], updatedAt: Date.now() };
      }),
    });
  }

  async function saveSelectedAssets(project: ManagedMobileContentKit) {
    const selected = project.assets.filter(
      (asset) => asset.selected && asset.imageUrl,
    );
    if (!selected.length)
      return setError(text.platform.contentKit.noSelectedOutputs);
    try {
      for (const asset of selected) {
        await saveImageToGallery(
          asset.imageUrl!,
          asset.fileName || makeImageFileName("content-kit", asset.id),
        );
      }
    } catch {
      setError(text.errors.saveFailed);
    }
  }

  async function shareSelectedAssets(project: ManagedMobileContentKit) {
    const selected = project.assets.filter(
      (asset) => asset.selected && asset.imageUrl,
    );
    if (!selected.length)
      return setError(text.platform.contentKit.noSelectedOutputs);
    try {
      await shareImages(
        selected.map((asset) => ({
          url: asset.imageUrl!,
          fileName:
            asset.fileName || makeImageFileName("content-kit", asset.id),
        })),
        selected.length === 1 ? selected[0].prompt : project.productName,
      );
    } catch {
      setError(text.errors.saveFailed);
    }
  }

  async function removeProject(project: ManagedMobileContentKit) {
    if (
      !window.confirm(
        text.platform.contentKit.removeConfirm(project.productName),
      )
    ) {
      return;
    }
    const localFileNames = project.assets
      .map((asset) => asset.fileName)
      .filter((fileName): fileName is string => Boolean(fileName));
    try {
      await deleteAppImages(localFileNames, activeAccountId);
    } catch {
      setError(text.platform.contentKit.removeLocalFailed);
    }
    mobileStore.removeContentKit(project.id);
    setSelectedProjectId("");
  }

  useNativeBackHandler(true, () => {
    if (previewAssetId) {
      setPreviewAssetId("");
      return;
    }
    if (showPlanEditor) {
      setShowPlanEditor(false);
      return;
    }
    if (showAdvancedFields) {
      setShowAdvancedFields(false);
      return;
    }
    if (showComposer) {
      setShowComposer(false);
      return;
    }
    if (selectedProjectId) {
      setSelectedProjectId("");
      return;
    }
    // Content workbench is opened from the image tab, not a home tab itself.
    navigateBack(navigate, Path.Sd);
  });

  if (selectedProject) {
    const activeRunId = selectedProject.activeRunId;
    const displayedRunId = selectedProject.runs?.some(
      (run) => run.id === viewRunId,
    )
      ? viewRunId
      : activeRunId;
    const runAssets = selectedProject.assets.filter(
      (asset) => !displayedRunId || asset.runId === displayedRunId,
    );
    const completedCount = runAssets.filter(
      (asset) => asset.status === "completed",
    ).length;
    const selectedCount = runAssets.filter((asset) => asset.selected).length;
    const activeRun = selectedProject.runs?.find(
      (run) => run.id === activeRunId,
    );
    const previewAsset = selectedProject.assets.find(
      (asset) => asset.id === previewAssetId,
    );
    const projectScene =
      presetOptions.find(
        (preset) =>
          preset.id === (selectedProject.scene || selectedProject.presetId),
      )?.title ||
      selectedProject.scene ||
      selectedProject.presetId ||
      text.platform.contentKit.presetCustom;
    const tagOptions: Array<{ id: ContentKitAssetTag; label: string }> = [
      { id: "keep", label: text.platform.contentKit.tagKeep },
      { id: "review", label: text.platform.contentKit.tagReview },
      { id: "reject", label: text.platform.contentKit.tagReject },
      { id: "video", label: text.platform.contentKit.tagVideo },
    ];
    const groupedAssets = Array.from(
      runAssets.reduce((groups, asset) => {
        if (assetTagFilter !== "all" && !asset.tags?.includes(assetTagFilter)) {
          return groups;
        }
        const group = groups.get(asset.shotId) || [];
        group.push(asset);
        groups.set(asset.shotId, group);
        return groups;
      }, new Map<string, ManagedMobileContentKitAsset[]>()),
    );
    return (
      <AndroidAppShell active="create" text={text}>
        <header className={styles["detail-header"]}>
          <IconButton
            label={text.common.back}
            onClick={() => setSelectedProjectId("")}
          >
            <LeftIcon />
          </IconButton>
          <div>
            <h1>{selectedProject.productName}</h1>
            <p>{formatDateTime(selectedProject.updatedAt, text)}</p>
          </div>
          <IconButton
            label={text.platform.contentKit.removeProject}
            onClick={() => void removeProject(selectedProject)}
          >
            <DeleteIcon />
          </IconButton>
        </header>
        <section className={styles["content-kit-summary"]}>
          <div>
            <span>{text.platform.contentKit.projectProgress}</span>
            <strong>{`${completedCount}/${runAssets.length}`}</strong>
          </div>
          <div>
            <span>{text.platform.contentKit.copy}</span>
            <strong>{taskStatusLabel(selectedProject.copyStatus)}</strong>
          </div>
          <small>{projectStatus(selectedProject)}</small>
        </section>
        <section className={styles["content-kit-queue-actions"]}>
          <span>
            {activeRun?.status === "paused"
              ? text.platform.contentKit.queuePaused
              : activeRun?.status === "running" ||
                activeRun?.status === "queued"
              ? text.platform.contentKit.queueRunning
              : projectStatus(selectedProject)}
          </span>
          {activeRun?.status === "running" || activeRun?.status === "queued" ? (
            <button
              type="button"
              onClick={() => pauseProjectQueue(selectedProject)}
            >
              {text.platform.contentKit.pauseQueue}
            </button>
          ) : activeRun?.status === "paused" ? (
            <button
              type="button"
              onClick={() => {
                if (!activeRunId) return;
                updateRun(selectedProject.id, activeRunId, "queued");
                void runProjectQueue(selectedProject.id);
              }}
            >
              {text.platform.contentKit.resumeQueue}
            </button>
          ) : null}
          {(activeRun?.status === "running" ||
            activeRun?.status === "queued" ||
            activeRun?.status === "paused") && (
            <button
              type="button"
              onClick={() => cancelProjectQueue(selectedProject)}
            >
              {text.platform.contentKit.cancelQueue}
            </button>
          )}
          {runAssets.some((asset) => asset.status === "failed") && (
            <button
              type="button"
              onClick={() => retryFailedAssets(selectedProject, displayedRunId)}
            >
              {text.platform.contentKit.retryFailed}
            </button>
          )}
          {activeRun &&
            ["completed", "partial", "cancelled"].includes(
              activeRun.status,
            ) && (
              <button
                type="button"
                onClick={() => createNextRun(selectedProject)}
              >
                <AddIcon />
                {text.platform.contentKit.newVersion}
              </button>
            )}
        </section>
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.platform.contentKit.outputGroups}</h2>
            <span>
              {text.platform.contentKit.selectedOutputs(selectedCount)}
            </span>
          </div>
          {(selectedProject.runs || []).length > 1 && (
            <div className={styles["content-kit-run-tabs"]}>
              {(selectedProject.runs || []).map((run, index) => (
                <button
                  key={run.id}
                  type="button"
                  className={clsx({
                    [styles["active"]]: run.id === displayedRunId,
                  })}
                  onClick={() => setViewRunId(run.id)}
                >
                  {`${index + 1} · ${runStatusLabel(run.status)}`}
                </button>
              ))}
            </div>
          )}
          <div className={styles["content-kit-selection-actions"]}>
            <button
              type="button"
              onClick={() => void saveSelectedAssets(selectedProject)}
            >
              <DownloadIcon />
              <span>{text.platform.contentKit.saveSelected}</span>
            </button>
            <button
              type="button"
              onClick={() => void shareSelectedAssets(selectedProject)}
            >
              <ShareIcon />
              <span>{text.platform.contentKit.shareSelected}</span>
            </button>
          </div>
          <div className={styles["content-kit-tag-filters"]}>
            <button
              type="button"
              className={clsx({ [styles["active"]]: assetTagFilter === "all" })}
              onClick={() => setAssetTagFilter("all")}
            >
              {text.platform.contentKit.filterAll}
            </button>
            {tagOptions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={clsx({
                  [styles["active"]]: assetTagFilter === tag.id,
                })}
                onClick={() => setAssetTagFilter(tag.id)}
              >
                {tag.label}
              </button>
            ))}
          </div>
          <div className={styles["content-kit-assets"]}>
            {groupedAssets.map(([shotId, assets]) => (
              <details
                key={shotId}
                className={styles["content-kit-shot-group"]}
              >
                <summary>
                  <strong>{assets[0]?.label || shotId}</strong>
                  <span>{`${
                    assets.filter((asset) => asset.status === "completed")
                      .length
                  }/${assets.length}`}</span>
                </summary>
                <div className={styles["content-kit-output-grid"]}>
                  {assets.map((asset) => (
                    <article
                      key={asset.id}
                      className={clsx(styles["content-kit-asset"], {
                        [styles["selected"]]: asset.selected,
                      })}
                    >
                      <button
                        type="button"
                        className={styles["content-kit-output-preview"]}
                        onClick={() =>
                          asset.imageUrl && setPreviewAssetId(asset.id)
                        }
                        aria-label={text.platform.contentKit.previewOutput}
                      >
                        {asset.imageUrl ? (
                          <img src={asset.imageUrl} alt={asset.label} />
                        ) : (
                          <ImageIcon />
                        )}
                      </button>
                      <span>{`${asset.variant} · ${taskStatusLabel(
                        asset.status,
                      )}`}</span>
                      {asset.imageUrl && (
                        <button
                          type="button"
                          aria-label={text.platform.contentKit.selectOutput}
                          onClick={() =>
                            toggleAssetSelection(selectedProject, asset.id)
                          }
                        >
                          {asset.selected ? "✓" : "+"}
                        </button>
                      )}
                      {asset.imageUrl && (
                        <div className={styles["content-kit-asset-tags"]}>
                          {tagOptions.map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              className={clsx({
                                [styles["active"]]: asset.tags?.includes(
                                  tag.id,
                                ),
                              })}
                              onClick={() =>
                                toggleAssetTag(
                                  selectedProject,
                                  asset.id,
                                  tag.id,
                                )
                              }
                            >
                              {tag.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {asset.status === "failed" && (
                        <button
                          type="button"
                          onClick={() =>
                            retryRunAssets(selectedProject, asset.runId, [
                              asset.id,
                            ])
                          }
                        >
                          <ReloadIcon />
                        </button>
                      )}
                      {asset.error && <small>{asset.error}</small>}
                      {asset.billingStatus === "captured" && (
                        <small className={styles["content-kit-billing"]}>
                          {text.platform.contentKit.actualCost(
                            Number(asset.actualCost || 0),
                          )}
                        </small>
                      )}
                      {asset.billingStatus === "pending" &&
                        asset.status !== "queued" &&
                        asset.status !== "idle" && (
                          <small className={styles["content-kit-billing"]}>
                            {text.platform.contentKit.billingPending}
                          </small>
                        )}
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
        {previewAsset?.imageUrl && (
          <div
            className={styles["content-kit-preview-modal"]}
            role="dialog"
            aria-modal="true"
            aria-label={text.platform.contentKit.previewOutput}
            onClick={() => setPreviewAssetId("")}
          >
            <div onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                aria-label={text.platform.contentKit.closePreview}
                onClick={() => setPreviewAssetId("")}
              >
                ×
              </button>
              <img src={previewAsset.imageUrl} alt={previewAsset.label} />
              <p>{`${previewAsset.label} · ${previewAsset.variant}`}</p>
            </div>
          </div>
        )}
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.platform.contentKit.copy}</h2>
            <span>{taskStatusLabel(selectedProject.copyStatus)}</span>
          </div>
          <article className={styles["content-kit-copy-card"]}>
            {selectedProject.copy ? (
              <p>{selectedProject.copy}</p>
            ) : (
              <span>
                {selectedProject.copyError || text.platform.contentKit.waiting}
              </span>
            )}
            <div className={styles["content-kit-actions"]}>
              {selectedProject.copyStatus === "failed" && (
                <button
                  type="button"
                  onClick={() => void generateCopy(selectedProject)}
                >
                  <ReloadIcon />
                  <span>{text.platform.contentKit.retryItem}</span>
                </button>
              )}
              {selectedProject.copy && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard
                        ?.writeText(selectedProject.copy || "")
                        .catch(() => setError(text.errors.copyFailed))
                    }
                  >
                    <CopyIcon />
                    <span>{text.platform.contentKit.copyResult}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      shareText(
                        selectedProject.copy || "",
                        selectedProject.productName,
                      )
                    }
                  >
                    <ShareIcon />
                    <span>{text.platform.contentKit.shareResult}</span>
                  </button>
                </>
              )}
            </div>
          </article>
        </section>
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.platform.contentKit.brief}</h2>
          </div>
          <div className={styles["content-kit-brief"]}>
            <span>{text.platform.contentKit.outputPlan}</span>
            <p>{projectScene}</p>
            <span>{text.platform.contentKit.sellingPoints}</span>
            <p>{selectedProject.sellingPoints}</p>
            {selectedProject.parameters && (
              <>
                <span>{text.platform.contentKit.parameters}</span>
                <p>{selectedProject.parameters}</p>
              </>
            )}
            {selectedProject.audience && (
              <>
                <span>{text.platform.contentKit.audience}</span>
                <p>{selectedProject.audience}</p>
              </>
            )}
            {selectedProject.platform && (
              <>
                <span>{text.platform.contentKit.platform}</span>
                <p>{selectedProject.platform}</p>
              </>
            )}
            {selectedProject.tone && (
              <>
                <span>{text.platform.contentKit.tone}</span>
                <p>{selectedProject.tone}</p>
              </>
            )}
            <span>{text.platform.contentKit.chooseModel}</span>
            <p>{selectedProject.model}</p>
          </div>
        </section>
      </AndroidAppShell>
    );
  }

  return (
    <AndroidAppShell active="create" text={text}>
      <header className={styles["detail-header"]}>
        <IconButton
          label={text.common.back}
          onClick={() => navigateBack(navigate, Path.Sd)}
        >
          <LeftIcon />
        </IconButton>
        <div>
          <h1>{text.platform.contentKit.title}</h1>
          <p>{text.platform.contentKit.hint}</p>
        </div>
      </header>
      {!showComposer && (
        <section className={styles["section"]}>
          <button
            type="button"
            className={styles["primary-action"]}
            onClick={() => setShowComposer(true)}
          >
            <AddIcon />
            {text.platform.contentKit.newProject}
          </button>
        </section>
      )}
      {showComposer && (
        <section
          className={clsx(styles["section"], styles["content-kit-form"])}
        >
          <div className={styles["content-kit-fields"]}>
            <label>
              <span>{text.platform.contentKit.projectName}</span>
              <input
                aria-label="content-kit-product"
                placeholder={text.platform.contentKit.productPlaceholder}
                value={productName}
                onChange={(event) => setProductName(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>{text.platform.contentKit.sellingPoints}</span>
              <textarea
                aria-label="content-kit-selling-points"
                placeholder={text.platform.contentKit.sellingPointsPlaceholder}
                value={sellingPoints}
                onChange={(event) =>
                  setSellingPoints(event.currentTarget.value)
                }
              />
            </label>
            <label>
              <span>{text.platform.contentKit.parameters}</span>
              <textarea
                aria-label="content-kit-parameters"
                placeholder={text.platform.contentKit.parametersPlaceholder}
                value={parameters}
                onChange={(event) => setParameters(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>{text.platform.contentKit.chooseModel}</span>
              <select
                aria-label="content-kit-model"
                value={model}
                onChange={(event) => setModel(event.currentTarget.value)}
              >
                {imageModels.map((item) => (
                  <option key={modelValue(item)} value={modelValue(item)}>
                    {modelLabel(item)}
                  </option>
                ))}
              </select>
              {selectedModel && <small>{modelValue(selectedModel)}</small>}
            </label>
          </div>
          <div className={styles["content-kit-plan-picker"]}>
            <span>{text.platform.contentKit.outputPlan}</span>
            <div>
              {presetOptions.map((preset) => {
                const count = contentWorkbenchPlanOutputCount(
                  planForPreset(preset),
                );
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-label={`content-kit-preset-${preset.id}`}
                    className={clsx({
                      [styles["active"]]: preset.id === selectedPreset.id,
                    })}
                    onClick={() => {
                      setPresetId(preset.id);
                      setShowPlanEditor(preset.id === "custom");
                    }}
                  >
                    <strong>{preset.title}</strong>
                    <small>{preset.hint}</small>
                    <em>{text.platform.contentKit.plannedImages(count)}</em>
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            className={styles["content-kit-more-settings"]}
            aria-expanded={showPlanEditor}
            onClick={() => setShowPlanEditor((value) => !value)}
          >
            {showPlanEditor
              ? text.platform.contentKit.hidePlanEditor
              : text.platform.contentKit.editPlan}
          </button>
          {showPlanEditor && (
            <div className={styles["content-kit-custom-plan"]}>
              {selectedPlanShots.map((shot) => (
                <div
                  key={shot.id}
                  className={styles["content-kit-custom-shot"]}
                >
                  <div>
                    <span>
                      {shot.kind === "custom" ? (
                        <input
                          aria-label={`${text.platform.contentKit.customShot} name`}
                          value={shot.label}
                          onChange={(event) =>
                            updateSelectedPlan((items) =>
                              items.map((item) =>
                                item.id === shot.id
                                  ? {
                                      ...item,
                                      label: event.currentTarget.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      ) : (
                        <strong>{shot.label}</strong>
                      )}
                      <small>{`${shot.size} · ${shot.aspect}`}</small>
                    </span>
                    <div>
                      <button
                        type="button"
                        aria-label={`${shot.label} -`}
                        disabled={shot.count <= 1}
                        onClick={() =>
                          updateSelectedPlan((items) =>
                            items.map((item) =>
                              item.id === shot.id
                                ? {
                                    ...item,
                                    count: Math.max(1, item.count - 1),
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        -
                      </button>
                      <strong>{shot.count}</strong>
                      <button
                        type="button"
                        aria-label={`${shot.label} +`}
                        disabled={
                          !contentWorkbenchCanIncreaseShotCount(
                            selectedPlanShots,
                            shot.id,
                          )
                        }
                        onClick={() =>
                          updateSelectedPlan((items) =>
                            items.map((item) =>
                              item.id === shot.id
                                ? {
                                    ...item,
                                    count: Math.min(
                                      CONTENT_WORKBENCH_MAX_VARIANTS_PER_SHOT,
                                      item.count + 1,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                    <select
                      aria-label={`${shot.label} size`}
                      value={shot.size}
                      onChange={(event) =>
                        updateSelectedPlan((items) =>
                          items.map((item) =>
                            item.id === shot.id
                              ? { ...item, size: event.currentTarget.value }
                              : item,
                          ),
                        )
                      }
                    >
                      {supportedContentKitSizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`${text.platform.contentKit.removeShot} ${shot.label}`}
                      onClick={() =>
                        updateSelectedPlan((items) =>
                          items.filter((item) => item.id !== shot.id),
                        )
                      }
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                  <label>
                    <span>{text.platform.contentKit.shotPurpose}</span>
                    <input
                      aria-label={`${shot.label} purpose`}
                      placeholder={
                        text.platform.contentKit.shotPurposePlaceholder
                      }
                      value={shot.purpose}
                      onChange={(event) =>
                        updateSelectedPlan((items) =>
                          items.map((item) =>
                            item.id === shot.id
                              ? {
                                  ...item,
                                  purpose: event.currentTarget.value,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
              <div className={styles["content-kit-add-shots"]}>
                {customShotOptions
                  .filter(
                    (option) =>
                      option.kind === "custom" ||
                      !selectedPlanShots.some(
                        (shot) => shot.kind === option.kind,
                      ),
                  )
                  .map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      disabled={
                        selectedPlanCount >= CONTENT_KIT_MAX_OUTPUTS_PER_PROJECT
                      }
                      onClick={() => {
                        const baseShot =
                          option.kind === "custom"
                            ? contentWorkbenchCustomShot(
                                clientRequestID("content-kit-custom-shot"),
                              )
                            : option;
                        const next = localizedContentKitShot(
                          { ...baseShot, scene: selectedPreset.id },
                          text,
                        );
                        updateSelectedPlan((items) => [...items, next]);
                      }}
                    >
                      <AddIcon />
                      <span>{option.label}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          <button
            type="button"
            className={styles["content-kit-more-settings"]}
            aria-expanded={showAdvancedFields}
            onClick={() => setShowAdvancedFields((value) => !value)}
          >
            {showAdvancedFields
              ? text.platform.contentKit.hideMoreSettings
              : text.platform.contentKit.moreSettings}
          </button>
          {showAdvancedFields && (
            <>
              <div className={styles["content-kit-fields"]}>
                <label>
                  <span>{text.platform.contentKit.audience}</span>
                  <input
                    placeholder={text.platform.contentKit.audiencePlaceholder}
                    value={audience}
                    onChange={(event) => setAudience(event.currentTarget.value)}
                  />
                </label>
                <label>
                  <span>{text.platform.contentKit.platform}</span>
                  <input
                    placeholder={text.platform.contentKit.platformPlaceholder}
                    value={platform}
                    onChange={(event) => setPlatform(event.currentTarget.value)}
                  />
                </label>
                <label>
                  <span>{text.platform.contentKit.tone}</span>
                  <input
                    placeholder={text.platform.contentKit.tonePlaceholder}
                    value={tone}
                    onChange={(event) => setTone(event.currentTarget.value)}
                  />
                </label>
              </div>
              <fieldset className={styles["content-kit-consistency"]}>
                <legend>{text.platform.contentKit.consistency}</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={lockProduct}
                    onChange={(event) =>
                      setLockProduct(event.currentTarget.checked)
                    }
                  />
                  <span>{text.platform.contentKit.lockProduct}</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={lockColor}
                    onChange={(event) =>
                      setLockColor(event.currentTarget.checked)
                    }
                  />
                  <span>{text.platform.contentKit.lockColor}</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={lockLogo}
                    onChange={(event) =>
                      setLockLogo(event.currentTarget.checked)
                    }
                  />
                  <span>{text.platform.contentKit.lockLogo}</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={videoIntent}
                    onChange={(event) =>
                      setVideoIntent(event.currentTarget.checked)
                    }
                  />
                  <span>{text.platform.contentKit.videoIntent}</span>
                </label>
                <label>
                  <span>{text.platform.contentKit.composition}</span>
                  <select
                    value={composition}
                    onChange={(event) =>
                      setComposition(
                        event.currentTarget.value as typeof composition,
                      )
                    }
                  >
                    <option value="center">
                      {text.platform.contentKit.compositionCenter}
                    </option>
                    <option value="left">
                      {text.platform.contentKit.compositionLeft}
                    </option>
                    <option value="right">
                      {text.platform.contentKit.compositionRight}
                    </option>
                    <option value="closeup">
                      {text.platform.contentKit.compositionCloseup}
                    </option>
                  </select>
                </label>
                <label>
                  <span>{text.platform.contentKit.safeArea}</span>
                  <select
                    value={safeArea}
                    onChange={(event) =>
                      setSafeArea(event.currentTarget.value as typeof safeArea)
                    }
                  >
                    <option value="none">
                      {text.platform.contentKit.safeAreaNone}
                    </option>
                    <option value="top">
                      {text.platform.contentKit.safeAreaTop}
                    </option>
                    <option value="bottom">
                      {text.platform.contentKit.safeAreaBottom}
                    </option>
                    <option value="left">
                      {text.platform.contentKit.safeAreaLeft}
                    </option>
                    <option value="right">
                      {text.platform.contentKit.safeAreaRight}
                    </option>
                  </select>
                </label>
              </fieldset>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={attachReferences}
          />
          <button
            type="button"
            aria-label="content-kit-add-reference"
            disabled={!referenceLimit}
            onClick={() => fileRef.current?.click()}
          >
            {text.platform.contentKit.references}
            {references.length ? ` (${references.length})` : ""}
          </button>
          {references.length > 0 && (
            <div className={styles["content-kit-references"]}>
              {references.map((image, index) => (
                <img key={`${index}-${image.slice(-12)}`} src={image} alt="" />
              ))}
            </div>
          )}
          {error && <div className={styles["form-error"]}>{error}</div>}
          <div className={styles["content-kit-preflight"]}>
            <div>
              <span>
                {text.platform.contentKit.plannedImages(selectedPlanCount)}
              </span>
              <small>{model || text.platform.contentKit.noImageModel}</small>
            </div>
            {estimateLoading ? (
              <small>{text.platform.contentKit.estimateLoading}</small>
            ) : batchEstimate ? (
              <small
                className={clsx({
                  [styles["insufficient"]]: !batchEstimate.sufficient,
                })}
              >{`${text.platform.contentKit.estimatedCost} ${batchEstimate.estimated_cost} · ${text.platform.contentKit.availableBalance} ${batchEstimate.balance}`}</small>
            ) : estimateUnavailable ? (
              <small>{text.platform.contentKit.estimateUnavailable}</small>
            ) : (
              <small>{text.platform.contentKit.estimateLoading}</small>
            )}
          </div>
          {referenceLimit > 0 && (
            <small className={styles["content-kit-reference-limit"]}>
              {text.platform.contentKit.referenceLimit(referenceLimit)}
            </small>
          )}
          <button
            type="button"
            className={styles["primary-action"]}
            aria-label="content-kit-generate"
            disabled={
              estimateLoading ||
              (batchEstimate ? !batchEstimate.sufficient : false)
            }
            onClick={() => void createProject()}
          >
            {text.platform.contentKit.create}
          </button>
        </section>
      )}
      <section className={styles["section"]}>
        <div className={styles["section-head"]}>
          <h2>{text.platform.contentKit.projects}</h2>
          <span>{text.shortCount(projects.length)}</span>
        </div>
        {mobileStore.contentKits.length === 0 && (
          <p className={styles["empty-copy"]}>
            {text.platform.contentKit.noProjects}
          </p>
        )}
        <div className={styles["content-kit-project-list"]}>
          {projects.map((project) => {
            const cover = project.assets.find((asset) => asset.imageUrl)
              ?.imageUrl;
            const completed = project.assets.filter(
              (asset) => asset.status === "completed",
            ).length;
            return (
              <button
                type="button"
                key={project.id}
                className={styles["content-kit-project"]}
                onClick={() => setSelectedProjectId(project.id)}
              >
                {cover ? (
                  <img src={cover} alt="" />
                ) : (
                  <i>
                    <ImageIcon />
                  </i>
                )}
                <span>
                  <strong>{project.productName}</strong>
                  <small>{formatDateTime(project.updatedAt, text)}</small>
                  <em>{`${
                    text.platform.contentKit.projectProgress
                  } ${completed}/${project.assets.length} · ${projectStatus(
                    project,
                  )}`}</em>
                </span>
                <b>{text.common.open}</b>
              </button>
            );
          })}
        </div>
      </section>
    </AndroidAppShell>
  );
}

const VIDEO_STUDIO_PREF_KEY = "jisudeng-mobile-video-studio-preferences";

function videoStudioPreferenceKey(accountID: string) {
  return `${VIDEO_STUDIO_PREF_KEY}:${String(accountID || "anonymous")}`;
}

const DEFAULT_VIDEO_STUDIO_PREFERENCES = {
  groupId: 0,
  model: "",
  resolution: "720p",
  ratio: "16:9",
  duration: 8,
  generateAudio: false,
  watermark: false,
};

function videoStudioCopy() {
  const locale = getManagedMobileLocale();
  const copies = {
    cn: {
      title: "视频创作",
      image: "图片",
      video: "视频",
      group: "视频分组",
      model: "视频模型",
      prompt: "视频提示词",
      placeholder: "描述你要生成的视频画面、动作和镜头",
      script: "AI 编写提示词",
      scriptModel: "剧本模型",
      scriptFollowing: "跟随当前聊天",
      scriptNoModel: "当前聊天没有可用的文本模型",
      scripting: "正在整理提示词",
      scriptFailed: "提示词生成失败",
      noGroup: "当前账号没有可用的视频分组",
      noModel: "当前视频分组没有已授权的视频模型",
      groupHint: "请让管理员为该分组配置视频模型和视频价格后再生成。",
      resolution: "分辨率",
      ratio: "画面比例",
      duration: "时长",
      seconds: "秒",
      smartDuration: "智能时长",
      audio: "生成声音",
      watermark: "添加水印",
      reference: "参考素材",
      choose: "选择",
      generate: "生成视频",
      generating: "正在生成",
      cancel: "取消生成",
      retry: "重试",
      download: "保存到手机",
      saveAsset: "保存到素材库",
      ready: "视频已生成",
      timeout: "生成超时，任务仍可重试",
      failed: "视频生成失败",
      noResult: "没有获取到视频结果",
      history: "本地视频历史",
      emptyHistory: "生成完成的视频会保留在这里",
      refresh: "刷新能力",
      selectPrompt: "提示词",
      unsupported: "当前模型不支持此参数",
      materialLibrary: "从素材库选择",
      clearReferences: "清空参考",
      materialEmpty: "没有适用于当前模型的已同步素材",
      materialLoading: "正在检查素材更新",
      materialKinds: { image: "图片", video: "视频", audio: "音频" },
    },
    en: {
      title: "Video creation",
      image: "Image",
      video: "Video",
      group: "Video group",
      model: "Video model",
      prompt: "Video prompt",
      placeholder: "Describe the scene, motion, and camera you want",
      script: "Write with AI",
      scriptModel: "Script model",
      scriptFollowing: "Following current chat",
      scriptNoModel: "No chat text model is available",
      scripting: "Preparing prompt",
      scriptFailed: "Could not prepare the prompt",
      noGroup: "No video group is available for this account",
      noModel: "No authorized video model is available in this group",
      groupHint:
        "Ask an administrator to configure a video model and video pricing.",
      resolution: "Resolution",
      ratio: "Aspect ratio",
      duration: "Duration",
      seconds: "sec",
      smartDuration: "Smart duration",
      audio: "Generate audio",
      watermark: "Add watermark",
      reference: "Reference material",
      choose: "Choose",
      generate: "Generate video",
      generating: "Generating",
      cancel: "Cancel generation",
      retry: "Retry",
      download: "Save to device",
      saveAsset: "Save to materials",
      ready: "Video ready",
      timeout: "Generation timed out; you can retry the task",
      failed: "Video generation failed",
      noResult: "No video result was returned",
      history: "Local video history",
      emptyHistory: "Completed videos will stay here",
      refresh: "Refresh capabilities",
      selectPrompt: "Prompt library",
      unsupported: "This model does not support this option",
      materialLibrary: "Choose from materials",
      clearReferences: "Clear references",
      materialEmpty: "No synced material is supported by this model",
      materialLoading: "Checking material updates",
      materialKinds: { image: "Image", video: "Video", audio: "Audio" },
    },
    jp: {
      title: "動画作成",
      image: "画像",
      video: "動画",
      group: "動画グループ",
      model: "動画モデル",
      prompt: "動画プロンプト",
      placeholder: "生成したい場面、動き、カメラを入力してください",
      script: "AIでプロンプト作成",
      scriptModel: "脚本モデル",
      scriptFollowing: "現在のチャットに連動",
      scriptNoModel: "現在のチャットに利用可能なテキストモデルがありません",
      scripting: "プロンプトを作成中",
      scriptFailed: "プロンプトを作成できませんでした",
      noGroup: "このアカウントで利用できる動画グループがありません",
      noModel: "このグループに承認済みの動画モデルがありません",
      groupHint: "管理者に動画モデルと料金の設定を依頼してください。",
      resolution: "解像度",
      ratio: "縦横比",
      duration: "長さ",
      seconds: "秒",
      smartDuration: "スマート時間",
      audio: "音声を生成",
      watermark: "透かしを追加",
      reference: "参考素材",
      choose: "選択",
      generate: "動画を生成",
      generating: "生成中",
      cancel: "生成をキャンセル",
      retry: "再試行",
      download: "端末に保存",
      saveAsset: "素材ライブラリに保存",
      ready: "動画が完成しました",
      timeout: "生成がタイムアウトしました。再試行できます",
      failed: "動画生成に失敗しました",
      noResult: "動画結果を取得できませんでした",
      history: "端末内の動画履歴",
      emptyHistory: "完成した動画がここに保存されます",
      refresh: "機能を更新",
      selectPrompt: "プロンプト",
      unsupported: "このモデルはこの項目に対応していません",
      materialLibrary: "素材ライブラリから選択",
      clearReferences: "参考素材を解除",
      materialEmpty: "このモデルで使える同期済み素材はありません",
      materialLoading: "素材の更新を確認中",
      materialKinds: { image: "画像", video: "動画", audio: "音声" },
    },
    ko: {
      title: "동영상 만들기",
      image: "이미지",
      video: "동영상",
      group: "동영상 그룹",
      model: "동영상 모델",
      prompt: "동영상 프롬프트",
      placeholder: "원하는 장면, 움직임, 카메라를 설명하세요",
      script: "AI로 프롬프트 작성",
      scriptModel: "스크립트 모델",
      scriptFollowing: "현재 채팅을 따름",
      scriptNoModel: "현재 채팅에서 사용할 수 있는 텍스트 모델이 없습니다",
      scripting: "프롬프트 작성 중",
      scriptFailed: "프롬프트를 작성할 수 없습니다",
      noGroup: "이 계정에서 사용할 수 있는 동영상 그룹이 없습니다",
      noModel: "이 그룹에 승인된 동영상 모델이 없습니다",
      groupHint: "관리자에게 동영상 모델과 요금 설정을 요청하세요.",
      resolution: "해상도",
      ratio: "화면 비율",
      duration: "길이",
      seconds: "초",
      smartDuration: "스마트 길이",
      audio: "오디오 생성",
      watermark: "워터마크 추가",
      reference: "참고 자료",
      choose: "선택",
      generate: "동영상 생성",
      generating: "생성 중",
      cancel: "생성 취소",
      retry: "다시 시도",
      download: "기기에 저장",
      saveAsset: "자료실에 저장",
      ready: "동영상이 완성되었습니다",
      timeout: "생성 시간이 초과되었습니다. 다시 시도할 수 있습니다",
      failed: "동영상 생성 실패",
      noResult: "동영상 결과를 받지 못했습니다",
      history: "로컬 동영상 기록",
      emptyHistory: "완성된 동영상이 여기에 보관됩니다",
      refresh: "기능 새로고침",
      selectPrompt: "프롬프트",
      unsupported: "이 모델은 이 옵션을 지원하지 않습니다",
      materialLibrary: "자료실에서 선택",
      clearReferences: "참고 자료 비우기",
      materialEmpty: "이 모델에서 사용할 수 있는 동기화된 자료가 없습니다",
      materialLoading: "자료 업데이트 확인 중",
      materialKinds: { image: "이미지", video: "동영상", audio: "오디오" },
    },
  } as const;
  return copies[locale] || copies.cn;
}

function AndroidCreationStudio() {
  const installedRelease = useInstalledAndroidReleaseVersion();
  const playDistribution = isPlayDistribution(installedRelease);
  const [mode, setMode] = useState<"image" | "video">(() => {
    if (typeof localStorage === "undefined") return "image";
    return !playDistribution &&
      localStorage.getItem("jisudeng-mobile-creation-mode") === "video"
      ? "video"
      : "image";
  });
  useEffect(() => {
    if (playDistribution && mode === "video") setMode("image");
  }, [mode, playDistribution]);
  const setCreationMode = (next: "image" | "video") => {
    setMode(next);
    try {
      localStorage.setItem("jisudeng-mobile-creation-mode", next);
    } catch {
      // Private browsing can disable localStorage; the in-memory mode still works.
    }
  };
  const copy = videoStudioCopy();
  return (
    <div className={styles["creation-screen"]}>
      <div className={styles["creation-mode-switch"]} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "image"}
          className={clsx(styles["creation-mode-button"], {
            [styles["creation-mode-active"]]: mode === "image",
          })}
          onClick={() => setCreationMode("image")}
        >
          <span>
            <ImageIcon />
            {copy.image}
          </span>
        </button>
        {!playDistribution && (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "video"}
            className={clsx(styles["creation-mode-button"], {
              [styles["creation-mode-active"]]: mode === "video",
            })}
            onClick={() => setCreationMode("video")}
          >
            <span>
              <PlayIcon />
              {copy.video}
            </span>
          </button>
        )}
      </div>
      {!playDistribution && mode === "video" ? (
        <AndroidVideoStudio />
      ) : (
        <AndroidImageStudio />
      )}
    </div>
  );
}

type MobileVideoServerCapabilities = {
  operations?: string[];
  supported_resolutions?: string[];
  supported_ratios?: string[];
  supported_durations?: number[];
  max_reference_images?: number;
  max_reference_videos?: number;
  max_reference_audios?: number;
  generate_audio?: boolean;
  watermark?: boolean;
};

type MobileVideoServerGroup = {
  id: number;
  name: string;
  platform?: string;
  video_available?: boolean;
  video_unavailable_code?: string;
  models?: string[];
  capabilities?: MobileVideoServerCapabilities;
  model_capabilities?: Record<string, MobileVideoServerCapabilities>;
};

type MobileVideoServerBootstrap = {
  groups?: MobileVideoServerGroup[];
};

type MobileVideoPrompt = {
  id: number | string;
  title: string;
  description?: string;
  prompt_text?: string;
  purpose?: string;
  category?: string;
  categories?: string[];
  version?: number;
  updated_at?: string;
  media?: Array<{ url?: string; media_type?: string }>;
  coverUrl?: string;
};

type MobileVideoServerTask = {
  id: string;
  status?:
    | "queued"
    | "running"
    | "streaming"
    | "completed"
    | "partial"
    | "failed"
    | "cancelled";
  progress?: number;
  artifacts?: Array<{
    url?: string;
    content_url?: string;
    content_type?: string;
    kind?: string;
  }>;
  error?: { code?: string; message?: string } | null;
};

type MobileVideoHistoryItem = LocalVideoEntry & { url: string };

function localPromptCatalogItemToVideoPrompt(
  item: LocalPromptCatalogItem,
  coverUrl = "",
): MobileVideoPrompt {
  return {
    // Canvas prompt IDs are stable strings (for example
    // `gpt-image-2-prompts-598`). Never coerce them to a number: NaN IDs
    // break React keys, local cover lookups, and delta tombstones.
    id: item.id,
    title: item.title,
    description: item.description,
    prompt_text: item.prompt_text,
    purpose: item.purpose,
    category: item.category,
    categories: item.categories,
    version: item.version,
    updated_at: item.updated_at,
    coverUrl: coverUrl || undefined,
    media: item.media,
  };
}

function mobileVideoServerGroupsToWorkspace(
  groups: MobileVideoServerGroup[],
): ManagedWorkspaceGroup[] {
  return groups.map((group) => ({
    id: Number(group.id),
    name: String(group.name || group.id),
    platform: group.platform,
    video_available: group.video_available,
    video_unavailable_code: group.video_unavailable_code,
    video_capabilities: group.capabilities,
    models: (group.models || []).map((name) => ({
      id: name,
      name,
      platform: group.platform,
      video_capabilities:
        group.model_capabilities?.[name] || group.capabilities,
    })),
  }));
}

function AndroidVideoStudio() {
  const managed = useManagedNextChatStore();
  const mobileStore = useManagedMobileAppStore();
  const text = useMobileText();
  const copy = videoStudioCopy();
  const activeAccountId = String(
    managed.user?.id ||
      managed.session?.user_id ||
      managed.workspace?.user?.id ||
      "",
  );
  const preferenceKey = videoStudioPreferenceKey(activeAccountId);
  const [preferences, setPreferences] = useState(() =>
    readStoredJSON(preferenceKey, DEFAULT_VIDEO_STUDIO_PREFERENCES),
  );
  const [serverGroups, setServerGroups] = useState<ManagedWorkspaceGroup[]>([]);
  const [serverBootstrapLoaded, setServerBootstrapLoaded] = useState(false);
  const [serverBootstrapLoading, setServerBootstrapLoading] = useState(false);
  const loadServerCapabilities = useCallback(async () => {
    if (!managed.accessToken) {
      setServerGroups([]);
      setServerBootstrapLoaded(false);
      return;
    }
    setServerBootstrapLoading(true);
    try {
      const payload =
        await managedAuthenticatedJsonRequest<MobileVideoServerBootstrap>(
          "/api/v1/mobile/video/bootstrap",
        );
      setServerGroups(
        mobileVideoServerGroupsToWorkspace(payload?.groups || []),
      );
      setServerBootstrapLoaded(true);
    } catch {
      // Keep the managed bootstrap as a short-lived compatibility fallback;
      // creation still uses the server-owned task API and will fail closed if
      // its capabilities are unavailable.
      setServerBootstrapLoaded(false);
    } finally {
      setServerBootstrapLoading(false);
    }
  }, [managed.accessToken]);
  useEffect(() => {
    void loadServerCapabilities();
  }, [loadServerCapabilities]);
  const groups = useMemo(
    () => (serverBootstrapLoaded ? serverGroups : []),
    [serverBootstrapLoaded, serverGroups],
  );
  const preferredGroup = groups.find(
    (group) => group.id === Number(preferences.groupId),
  );
  const selectedGroup = preferredGroup || groups[0];
  const videoModels = (selectedGroup?.models || []).filter((model) =>
    managedVideoCapabilities(model, selectedGroup),
  );
  const fallbackModel = videoModels[0];
  const selectedModel =
    videoModels.find((model) => modelValue(model) === preferences.model) ||
    fallbackModel;
  const capabilities = managedVideoCapabilities(selectedModel, selectedGroup);
  const resolutions: string[] =
    capabilities?.resolutions || capabilities?.supported_resolutions || [];
  const ratios: string[] =
    capabilities?.ratios || capabilities?.supported_ratios || [];
  const durations: number[] =
    capabilities?.durations || capabilities?.supported_durations || [];
  const [prompt, setPrompt] = useState("");
  const [scriptRunning, setScriptRunning] = useState(false);
  const [references, setReferences] = useState<string[]>([]);
  const [referenceAssetIDs, setReferenceAssetIDs] = useState<string[]>([]);
  const [referenceAssetKinds, setReferenceAssetKinds] = useState<
    Record<string, LocalMaterialKind>
  >({});
  const [referenceMaterials, setReferenceMaterials] = useState<LocalMaterial[]>(
    [],
  );
  const [referenceMaterialsLoading, setReferenceMaterialsLoading] =
    useState(false);
  const [referenceLibraryOpen, setReferenceLibraryOpen] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "running" | "completed" | "failed" | "cancelled"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState("");
  const [taskID, setTaskID] = useState("");
  const [error, setError] = useState("");
  const [videoPrompts, setVideoPrompts] = useState<MobileVideoPrompt[]>([]);
  const [videoPromptCategories, setVideoPromptCategories] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [videoPromptCategory, setVideoPromptCategory] = useState("all");
  const [videoPromptQuery, setVideoPromptQuery] = useState("");
  const [history, setHistory] = useState<MobileVideoHistoryItem[]>([]);
  const historyObjectURLsRef = useRef<string[]>([]);
  const videoPromptObjectURLsRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const referenceObjectURLsRef = useRef<string[]>([]);
  const resultObjectURLRef = useRef<string>("");
  const scriptAbortRef = useRef<AbortController | null>(null);

  const referenceLimitForKind = useCallback(
    (kind: LocalMaterialKind) => {
      switch (kind) {
        case "image":
          return Math.max(
            0,
            Number(
              capabilities?.max_reference_images ??
                (capabilities?.image_to_video ? 1 : 0),
            ),
          );
        case "video":
          return Math.max(
            0,
            Number(
              capabilities?.max_reference_videos ??
                (capabilities?.video_reference ? 1 : 0),
            ),
          );
        case "audio":
          return Math.max(
            0,
            Number(
              capabilities?.max_reference_audios ??
                (capabilities?.audio_reference ? 1 : 0),
            ),
          );
        default:
          return 0;
      }
    },
    [capabilities],
  );

  const selectableReferenceMaterials = useMemo(
    () =>
      referenceMaterials.filter(
        (material) =>
          Boolean(material.remoteId) &&
          referenceLimitForKind(material.kind) > 0,
      ),
    [referenceLimitForKind, referenceMaterials],
  );

  const refreshReferenceMaterials = useCallback(async () => {
    if (!activeAccountId) {
      setReferenceMaterials([]);
      return;
    }
    setReferenceMaterialsLoading(true);
    try {
      const items =
        managed.accessToken && managed.backendBaseUrl
          ? (
              await syncLocalMaterials(
                activeAccountId,
                managed.backendBaseUrl,
                managed.accessToken,
              )
            ).materials
          : await listLocalMaterials(activeAccountId);
      setReferenceMaterials(items);
    } catch {
      // The current device cache remains selectable if a lightweight delta
      // check is offline or temporarily unavailable.
      setReferenceMaterials(await listLocalMaterials(activeAccountId));
    } finally {
      setReferenceMaterialsLoading(false);
    }
  }, [activeAccountId, managed.accessToken, managed.backendBaseUrl]);

  const scriptSelection = useMemo(
    () =>
      resolveMobileVideoScriptSelection({
        workspace: managed.workspace,
        chatSessions: mobileStore.chatSessions,
        currentChatId: mobileStore.currentChatId,
        preference: readChatPreference(),
      }),
    [managed.workspace, mobileStore.chatSessions, mobileStore.currentChatId],
  );
  const scriptGroup = useMemo(
    () =>
      scriptSelection.groupId
        ? managed.workspace?.models?.groups?.find(
            (group) => group.id === scriptSelection.groupId,
          )
        : undefined,
    [managed.workspace, scriptSelection.groupId],
  );

  useEffect(() => {
    setPreferences(
      readStoredJSON(preferenceKey, DEFAULT_VIDEO_STUDIO_PREFERENCES),
    );
  }, [preferenceKey]);

  useEffect(() => {
    void refreshReferenceMaterials();
  }, [refreshReferenceMaterials]);

  useEffect(() => {
    referenceObjectURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
    referenceObjectURLsRef.current = [];
    setReferences([]);
    setReferenceAssetIDs([]);
    setReferenceAssetKinds({});
    setReferenceLibraryOpen(false);
  }, [activeAccountId]);

  useEffect(() => {
    let disposed = false;
    const loadHistory = async () => {
      historyObjectURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
      historyObjectURLsRef.current = [];
      setHistory([]);
      if (!activeAccountId) return;
      const cachedEntries = await listLocalVideosWithBlobs(activeAccountId);
      const hydrated: MobileVideoHistoryItem[] = [];
      for (const { entry, blob } of cachedEntries) {
        const url = URL.createObjectURL(blob);
        historyObjectURLsRef.current.push(url);
        hydrated.push({ ...entry, url });
      }
      if (!disposed) setHistory(hydrated);

      // Reconcile completed server tasks so a result generated on another
      // session/device is downloaded once into this account's local cache.
      if (!managed.accessToken || disposed) return;
      try {
        const page = await managedAuthenticatedJsonRequest<{
          items?: MobileVideoServerTask[];
        }>("/api/v1/mobile/video/jobs?page=1&page_size=24");
        // The index can survive Android/WebView storage eviction while an
        // individual IndexedDB blob does not. Only entries returned with a
        // binary are actually cached, so missing blobs get one authenticated
        // repair download below.
        const known = new Set(cachedEntries.map(({ entry }) => entry.taskId));
        const next = [...hydrated];
        for (const task of page?.items || []) {
          const state = String(task.status || "").toLowerCase();
          if (
            !task.id ||
            known.has(task.id) ||
            !["completed", "partial"].includes(state)
          )
            continue;
          const artifact = task.artifacts?.find(
            (item) => item.url || item.content_url,
          );
          const artifactURL = artifact?.url || artifact?.content_url;
          if (!artifactURL) continue;
          const blob = await managedDownloadBlob(
            managed.backendBaseUrl,
            artifactURL,
            managed.accessToken,
          );
          const entry = await saveLocalVideo(activeAccountId, task.id, blob, {
            prompt: "",
            createdAt:
              Date.parse(String((task as any).created_at || "")) || Date.now(),
          });
          const url = URL.createObjectURL(blob);
          historyObjectURLsRef.current.push(url);
          next.push({ ...entry, url });
          known.add(task.id);
        }
        if (!disposed) setHistory(next.slice(0, 24));
      } catch {
        // Local history remains usable when the server is temporarily offline.
      }
    };
    void loadHistory();
    return () => {
      disposed = true;
      historyObjectURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
      historyObjectURLsRef.current = [];
    };
  }, [activeAccountId, managed.accessToken, managed.backendBaseUrl]);

  useEffect(() => {
    return () => {
      scriptAbortRef.current?.abort();
      referenceObjectURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
      referenceObjectURLsRef.current = [];
      if (resultObjectURLRef.current)
        URL.revokeObjectURL(resultObjectURLRef.current);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const appLocale = mobileTextLocale(text);
    const locale =
      appLocale === "cn" ? "zh" : appLocale === "jp" ? "ja" : appLocale;
    const releasePromptObjectURLs = () => {
      videoPromptObjectURLsRef.current.forEach((url) =>
        URL.revokeObjectURL(url),
      );
      videoPromptObjectURLsRef.current = [];
    };
    const applyCatalog = async (catalog: LocalPromptCatalog) => {
      const entries = await Promise.all(
        catalog.items.map(async (item) => ({
          item,
          coverUrl: await createLocalPromptCoverObjectURL(
            catalog.accountId,
            catalog.locale,
            "video",
            item.id,
            catalog.source,
          ),
        })),
      );
      if (disposed) {
        entries.forEach(({ coverUrl }) => {
          if (coverUrl) URL.revokeObjectURL(coverUrl);
        });
        return;
      }
      releasePromptObjectURLs();
      videoPromptObjectURLsRef.current = entries
        .map(({ coverUrl }) => coverUrl)
        .filter(Boolean);
      setVideoPrompts(
        entries.map(({ item, coverUrl }) => ({
          ...localPromptCatalogItemToVideoPrompt(item, coverUrl),
          id: item.id,
        })),
      );
      setVideoPromptCategories([
        { id: "all", label: copy.selectPrompt },
        ...catalog.categories.map((category) => ({
          id: category.id,
          label: category.label,
        })),
      ]);
    };
    const loadPromptCatalog = async () => {
      releasePromptObjectURLs();
      setVideoPrompts([]);
      setVideoPromptCategories([]);
      setVideoPromptCategory("all");
      if (!activeAccountId) return;
      // Video creation reuses the same published Creation Space prompt
      // directory as the image studio. The Canvas mirror owns the prompt
      // bodies and covers, so it must be synced in the canvas namespace.
      const cached = await readLocalPromptCatalog(
        activeAccountId,
        locale,
        "video",
        "canvas",
      );
      if (cached) await applyCatalog(cached);
      if (!managed.accessToken || !managed.backendBaseUrl || disposed) return;
      try {
        const synced = await syncLocalPromptCatalog(
          activeAccountId,
          locale,
          "video",
          managed.backendBaseUrl,
          managed.accessToken,
          undefined,
          "canvas",
        );
        await applyCatalog(synced.catalog);
      } catch {
        // The cached catalog remains usable while the server is unavailable.
      }
    };
    void loadPromptCatalog();
    return () => {
      disposed = true;
      releasePromptObjectURLs();
    };
  }, [
    activeAccountId,
    managed.accessToken,
    managed.backendBaseUrl,
    text,
    copy.selectPrompt,
  ]);

  const visibleVideoPrompts = useMemo(() => {
    const query = videoPromptQuery.trim().toLowerCase();
    return videoPrompts.filter((item) => {
      const categories = [
        item.category,
        item.purpose,
        ...(item.categories || []),
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      if (
        videoPromptCategory !== "all" &&
        !categories.includes(videoPromptCategory.toLowerCase())
      ) {
        return false;
      }
      if (!query) return true;
      return [item.title, item.description, item.prompt_text]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [videoPromptCategory, videoPromptQuery, videoPrompts]);

  useEffect(() => {
    const next = {
      ...preferences,
      groupId: selectedGroup?.id || 0,
      model: modelValue(selectedModel),
      resolution: resolutions.includes(preferences.resolution)
        ? preferences.resolution
        : resolutions[0],
      ratio: ratios.includes(preferences.ratio) ? preferences.ratio : ratios[0],
      duration: durations.includes(Number(preferences.duration))
        ? Number(preferences.duration)
        : durations[0],
    };
    setPreferences(next);
    writeStoredJSON(preferenceKey, next);
    // The dependency list intentionally follows server capability changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preferenceKey,
    selectedGroup?.id,
    selectedModel?.id,
    resolutions.join(","),
    ratios.join(","),
    durations.join(","),
  ]);

  function clearSelectedReferences() {
    referenceObjectURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
    referenceObjectURLsRef.current = [];
    setReferences([]);
    setReferenceAssetIDs([]);
    setReferenceAssetKinds({});
  }

  function toggleReferenceMaterial(material: LocalMaterial) {
    const id = String(material.remoteId || "").trim();
    if (!id) return;
    if (referenceAssetIDs.includes(id)) {
      setReferenceAssetIDs((items) => items.filter((item) => item !== id));
      setReferenceAssetKinds((items) => {
        const next = { ...items };
        delete next[id];
        return next;
      });
      return;
    }
    const count = Object.values(referenceAssetKinds).filter(
      (kind) => kind === material.kind,
    ).length;
    if (count >= referenceLimitForKind(material.kind)) {
      setError(copy.unsupported);
      return;
    }
    setReferenceAssetIDs((items) => [...items, id]);
    setReferenceAssetKinds((items) => ({ ...items, [id]: material.kind }));
    setError("");
  }

  async function chooseReferences(event: ChangeEvent<HTMLInputElement>) {
    const currentTotal = referenceAssetIDs.length;
    const maxReferences = ["image", "video", "audio"]
      .map((kind) => referenceLimitForKind(kind as LocalMaterialKind))
      .reduce((total, value) => total + value, 0);
    const files = Array.from(event.currentTarget.files || []).slice(
      0,
      Math.max(0, maxReferences - currentTotal),
    );
    try {
      const counts = files.reduce(
        (result, file) => {
          const kind = localMaterialKind(file);
          result[kind] = (result[kind] || 0) + 1;
          return result;
        },
        Object.values(referenceAssetKinds).reduce(
          (result, kind) => ({ ...result, [kind]: (result[kind] || 0) + 1 }),
          {} as Record<string, number>,
        ),
      );
      if (
        !files.length ||
        (counts.image || 0) > referenceLimitForKind("image") ||
        (counts.video || 0) > referenceLimitForKind("video") ||
        (counts.audio || 0) > referenceLimitForKind("audio")
      ) {
        throw new Error(copy.unsupported);
      }
      const objectURLs = files.map((file) => URL.createObjectURL(file));
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const form = new FormData();
          form.append("file", file, file.name);
          form.append("kind", localMaterialKind(file));
          form.append("source", "upload");
          return managedFormDataRequest<{ id?: string }>(
            "/api/v1/mobile/assets",
            form,
            text,
            { idempotencyKey: clientRequestID("mobile-video-asset") },
          );
        }),
      );
      const ids = uploaded
        .map((asset) => String(asset?.id || ""))
        .filter(Boolean);
      if (ids.length !== files.length) throw new Error(copy.failed);
      referenceObjectURLsRef.current.push(...objectURLs);
      setReferences((items) => [...items, ...objectURLs]);
      setReferenceAssetIDs((items) => [...new Set([...items, ...ids])]);
      setReferenceAssetKinds((items) => {
        const next = { ...items };
        ids.forEach((id, index) => {
          next[id] = localMaterialKind(files[index]);
        });
        return next;
      });
      await refreshReferenceMaterials();
      setError("");
    } catch (referenceError) {
      setError(
        referenceError instanceof Error &&
          referenceError.message === copy.unsupported
          ? copy.unsupported
          : copy.failed,
      );
    } finally {
      event.currentTarget.value = "";
    }
  }

  async function writeVideoPromptWithChatModel() {
    const brief = prompt.trim();
    if (!brief) {
      setError(copy.placeholder);
      return;
    }
    if (
      !scriptSelection.groupId ||
      !scriptSelection.model ||
      !managed.session
    ) {
      setError(copy.scriptNoModel);
      return;
    }
    const modelIsStillAvailable = scriptGroup?.models?.some(
      (model) =>
        isChatModel(model) && modelValue(model) === scriptSelection.model,
    );
    if (!modelIsStillAvailable) {
      setError(copy.scriptNoModel);
      return;
    }

    const controller = new AbortController();
    scriptAbortRef.current?.abort();
    scriptAbortRef.current = controller;
    setScriptRunning(true);
    setError("");
    const requestID = clientRequestID("mobile-video-script");
    try {
      let activeManaged = useManagedNextChatStore.getState();
      if (shouldRefreshManagedSession(activeManaged.session)) {
        await managed.bootstrap({ silent: true });
        activeManaged = useManagedNextChatStore.getState();
      }
      if (!activeManaged.session?.api_key)
        throw new Error(text.errors.loginRequired);
      if (currentGroupID(activeManaged.workspace) !== scriptSelection.groupId) {
        await managed.switchGroup(scriptSelection.groupId);
        activeManaged = useManagedNextChatStore.getState();
      }
      if (controller.signal.aborted) return;
      const chatAPIKey = activeManaged.session?.api_key;
      if (!chatAPIKey) throw new Error(text.errors.loginRequired);
      const response = await managedGatewayRequestText(
        activeManaged.backendBaseUrl,
        "/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Idempotency-Key": requestID,
            "X-Request-ID": requestID,
            "X-Client-Request-ID": requestID,
          },
          body: JSON.stringify({
            model: scriptSelection.model,
            stream: false,
            messages: [
              {
                role: "user",
                content: buildMobileVideoScriptPrompt(brief, text.dateLocale),
              },
            ],
          }),
          signal: controller.signal,
        },
        chatAPIKey,
        text,
      );
      if (!response.ok) {
        throw new Error(
          parseOpenAIError(
            response.text,
            response.status,
            "/v1/chat/completions",
            response.requestId || requestID,
          ),
        );
      }
      let output = "";
      try {
        output = extractChatContent(JSON.parse(response.text || "{}"));
      } catch {
        output = response.text;
      }
      if (!output.trim()) throw new Error(copy.scriptFailed);
      setPrompt(output.trim());
    } catch (scriptError) {
      if (!controller.signal.aborted) {
        setError(
          scriptError instanceof Error
            ? localizedMobileErrorMessage(scriptError, copy.scriptFailed)
            : copy.scriptFailed,
        );
      }
    } finally {
      if (scriptAbortRef.current === controller) scriptAbortRef.current = null;
      if (!controller.signal.aborted) setScriptRunning(false);
    }
  }

  async function waitForVideoTask(
    initialTask: MobileVideoServerTask,
    requestID: string,
    controller: AbortController,
  ) {
    const id = String(initialTask?.id || "");
    if (!id) throw new Error(copy.noResult);
    setTaskID(id);
    const deadline = Date.now() + MOBILE_VIDEO_POLL_TIMEOUT_MS;
    let latest: MobileVideoServerTask = initialTask;
    let attempt = 0;
    while (Date.now() < deadline) {
      if (controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const state = String(latest.status || "").toLowerCase();
      const artifact = latest.artifacts?.find(
        (item) => item.url || item.content_url,
      );
      if (artifact && ["completed", "partial"].includes(state)) break;
      if (["failed", "cancelled"].includes(state)) {
        throw new Error(latest.error?.message || copy.failed);
      }
      await new Promise((resolve) =>
        window.setTimeout(resolve, MOBILE_VIDEO_POLL_INTERVAL_MS),
      );
      latest = await managedAuthenticatedJsonRequest<MobileVideoServerTask>(
        `/api/v1/mobile/video/jobs/${encodeURIComponent(id)}`,
        {
          method: "GET",
          headers: { "X-Request-ID": requestID },
          signal: controller.signal,
        },
      );
      setProgress(Math.min(94, 12 + Math.min(80, ++attempt * 5)));
    }
    if (Date.now() >= deadline) throw new Error(copy.timeout);
    const artifact = latest.artifacts?.find(
      (item) => item.url || item.content_url,
    );
    const url =
      artifact?.url ||
      artifact?.content_url ||
      `/api/v1/mobile/video/jobs/${encodeURIComponent(id)}/content`;
    if (!url || !managed.accessToken) throw new Error(copy.noResult);
    const blob = await managedDownloadBlob(
      managed.backendBaseUrl,
      url,
      managed.accessToken,
      controller.signal,
    );
    const localEntry = await saveLocalVideo(activeAccountId, id, blob, {
      prompt: prompt.trim(),
      createdAt: Date.now(),
    });
    // The result is now durable in this account's device cache. Release the
    // private relay copy in the background; a transient acknowledgement error
    // never turns a successful local save into a failed generation.
    void managedAuthenticatedJsonRequest(
      `/api/v1/mobile/video/jobs/${encodeURIComponent(id)}/content/acknowledge`,
      { method: "POST" },
    ).catch(() => undefined);
    if (resultObjectURLRef.current) {
      URL.revokeObjectURL(resultObjectURLRef.current);
    }
    resultObjectURLRef.current = URL.createObjectURL(blob);
    setResultUrl(resultObjectURLRef.current);
    setStatus("completed");
    setProgress(100);
    const historyURL = URL.createObjectURL(blob);
    historyObjectURLsRef.current.push(historyURL);
    const entry: MobileVideoHistoryItem = { ...localEntry, url: historyURL };
    setHistory((items) =>
      [entry, ...items.filter((item) => item.taskId !== id)].slice(0, 24),
    );
  }

  function handleVideoRunError(controller: AbortController, runError: unknown) {
    if (controller.signal.aborted) {
      setStatus("cancelled");
      setError(text.errors.requestCancelled);
      return;
    }
    setStatus("failed");
    setError(runError instanceof Error ? runError.message : copy.failed);
  }

  async function runVideo() {
    if (!selectedGroup || !selectedModel || !capabilities) {
      setError(groups.length ? copy.noModel : copy.noGroup);
      return;
    }
    if (!prompt.trim()) {
      setError(copy.placeholder);
      return;
    }
    if (!managed.accessToken || !serverBootstrapLoaded) {
      setError(copy.noGroup);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const requestID = clientRequestID("mobile-video");
    setStatus("running");
    setProgress(8);
    setTaskID("");
    setResultUrl("");
    setError("");
    try {
      const createData = await managedAuthenticatedJsonRequest<{
        task?: MobileVideoServerTask;
      }>("/api/v1/mobile/video/jobs", {
        method: "POST",
        headers: {
          "Idempotency-Key": requestID,
          "X-Request-ID": requestID,
        },
        body: JSON.stringify({
          group_id: Number(selectedGroup.id),
          model: modelValue(selectedModel),
          prompt: prompt.trim(),
          resolution: preferences.resolution,
          ratio: preferences.ratio,
          duration_seconds: Number(preferences.duration),
          reference_asset_ids: referenceAssetIDs,
          generate_audio: Boolean(
            capabilities.generate_audio && preferences.generateAudio,
          ),
          watermark: Boolean(capabilities.watermark && preferences.watermark),
          client_request_id: requestID,
        }),
        signal: controller.signal,
      });
      await waitForVideoTask(
        createData?.task || (createData as unknown as MobileVideoServerTask),
        requestID,
        controller,
      );
    } catch (runError) {
      handleVideoRunError(controller, runError);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function retryVideo() {
    if (!taskID || !managed.accessToken) {
      await runVideo();
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const requestID = clientRequestID("mobile-video-retry");
    setStatus("running");
    setProgress(8);
    setResultUrl("");
    setError("");
    try {
      const current =
        await managedAuthenticatedJsonRequest<MobileVideoServerTask>(
          `/api/v1/mobile/video/jobs/${encodeURIComponent(taskID)}`,
          {
            method: "GET",
            headers: { "X-Request-ID": requestID },
            signal: controller.signal,
          },
        );
      const currentState = String(current.status || "").toLowerCase();
      if (!["failed", "cancelled"].includes(currentState)) {
        // A client-side polling timeout must not submit a second provider job.
        // Resume the durable server task first; only a terminal retryable task
        // is allowed to create a new task.
        await waitForVideoTask(current, requestID, controller);
      } else {
        const retry =
          await managedAuthenticatedJsonRequest<MobileVideoServerTask>(
            `/api/v1/mobile/video/jobs/${encodeURIComponent(taskID)}/retry`,
            {
              method: "POST",
              headers: {
                "Idempotency-Key": requestID,
                "X-Request-ID": requestID,
              },
              body: JSON.stringify({ client_request_id: requestID }),
              signal: controller.signal,
            },
          );
        await waitForVideoTask(retry, requestID, controller);
      }
    } catch (retryError) {
      handleVideoRunError(controller, retryError);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function cancelVideo() {
    abortRef.current?.abort();
    if (taskID && managed.accessToken) {
      void managedAuthenticatedJsonRequest(
        `/api/v1/mobile/video/jobs/${encodeURIComponent(taskID)}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      ).catch(() => undefined);
    }
  }

  async function removeHistoryItem(item: MobileVideoHistoryItem) {
    try {
      await deleteLocalVideos(activeAccountId, [item.id]);
      URL.revokeObjectURL(item.url);
      historyObjectURLsRef.current = historyObjectURLsRef.current.filter(
        (url) => url !== item.url,
      );
      setHistory((items) =>
        items.filter((candidate) => candidate.id !== item.id),
      );
      if (item.taskId === taskID) {
        setResultUrl("");
        setTaskID("");
      }
    } catch {
      setError(copy.failed);
    }
  }

  async function downloadVideo(url: string, id: string) {
    try {
      // Local history is played from an IndexedDB blob URL. Android's
      // DownloadManager cannot consume blob: URLs, so it downloads the same
      // server-owned task artifact with the active account's short-lived JWT.
      // The token remains a request header and is never put in a URL or file.
      const useAuthenticatedTaskDownload = Boolean(
        isNativeAndroid() &&
          id &&
          managed.accessToken &&
          managed.backendBaseUrl,
      );
      const downloadURL = useAuthenticatedTaskDownload
        ? managedApiUrl(
            managed.backendBaseUrl,
            `/api/v1/mobile/video/jobs/${encodeURIComponent(id)}/content`,
          )
        : url;
      await startNativeDownload(
        downloadURL,
        `jisudeng-video-${id}.mp4`,
        copy.title,
        useAuthenticatedTaskDownload
          ? { authorization: `Bearer ${managed.accessToken}` }
          : undefined,
      );
    } catch {
      setError(text.errors.downloadFailed);
    }
  }

  async function saveVideoAsAsset() {
    if (!taskID || !managed.accessToken) return;
    try {
      const requestID = clientRequestID("mobile-video-save-asset");
      const localVideo = (await listLocalVideosWithBlobs(activeAccountId)).find(
        ({ entry }) => entry.taskId === taskID,
      );
      if (!localVideo) throw new Error(copy.noResult);
      const form = new FormData();
      form.append("file", localVideo.blob, `video-${taskID}.mp4`);
      form.append("kind", "video");
      form.append("source", "video_result");
      await managedFormDataRequest("/api/v1/mobile/assets", form, text, {
        requestId: requestID,
        idempotencyKey: requestID,
      });
      await refreshReferenceMaterials();
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.failed);
    }
  }

  const noCapability =
    !selectedGroup ||
    !selectedModel ||
    !capabilities ||
    resolutions.length === 0 ||
    ratios.length === 0 ||
    durations.length === 0;
  return (
    <AndroidAppShell active="create" text={text}>
      <header className={styles["app-header"]}>
        <div>
          <span>{selectedGroup?.name || copy.video}</span>
          <h1>{copy.title}</h1>
        </div>
        <IconButton
          label={copy.refresh}
          disabled={serverBootstrapLoading}
          onClick={() => {
            void Promise.all([managed.bootstrap(), loadServerCapabilities()]);
          }}
        >
          <ReloadIcon />
        </IconButton>
      </header>
      <section className={styles["image-panel"]}>
        {noCapability && (
          <div className={styles["image-routing-hint"]}>
            <div>
              <strong>{groups.length ? copy.noModel : copy.noGroup}</strong>
              <span>{copy.groupHint}</span>
            </div>
          </div>
        )}
        <div className={styles["form-grid"]}>
          <label>
            <span>{copy.group}</span>
            <select
              value={String(selectedGroup?.id || "")}
              onChange={(event) => {
                const group = groups.find(
                  (item) => String(item.id) === event.currentTarget.value,
                );
                setPreferences((current) => ({
                  ...current,
                  groupId: group?.id || 0,
                  model: "",
                }));
              }}
              disabled={!groups.length}
            >
              {groups.length ? (
                groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))
              ) : (
                <option value="">{copy.noGroup}</option>
              )}
            </select>
          </label>
          <label>
            <span>{copy.model}</span>
            <select
              value={modelValue(selectedModel)}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  model: event.currentTarget.value,
                }))
              }
              disabled={!videoModels.length}
            >
              {videoModels.length ? (
                videoModels.map((model) => (
                  <option key={modelValue(model)} value={modelValue(model)}>
                    {modelLabel(model)}
                  </option>
                ))
              ) : (
                <option value="">{copy.noModel}</option>
              )}
            </select>
          </label>
          <label>
            <span>{copy.resolution}</span>
            <select
              value={String(preferences.resolution)}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  resolution: event.currentTarget.value,
                }))
              }
              disabled={noCapability}
            >
              {resolutions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.ratio}</span>
            <select
              value={String(preferences.ratio)}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  ratio: event.currentTarget.value,
                }))
              }
              disabled={noCapability}
            >
              {ratios.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.duration}</span>
            <select
              value={String(preferences.duration)}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  duration: Number(event.currentTarget.value),
                }))
              }
              disabled={noCapability}
            >
              {durations.map((value) => (
                <option key={value} value={value}>
                  {value === -1
                    ? copy.smartDuration
                    : `${value} ${copy.seconds}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          aria-label="video-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.currentTarget.value)}
          placeholder={copy.placeholder}
          disabled={noCapability}
        />
        <div className={styles["video-script-helper"]}>
          <span>
            <small>{copy.scriptModel}</small>
            <strong>
              {scriptSelection.model
                ? `${groupNameByID(
                    managed.workspace,
                    scriptSelection.groupId,
                    text,
                  )} · ${scriptSelection.model}`
                : copy.scriptNoModel}
            </strong>
            <em>{copy.scriptFollowing}</em>
          </span>
          <button
            type="button"
            onClick={() => void writeVideoPromptWithChatModel()}
            disabled={!prompt.trim() || !scriptSelection.model || scriptRunning}
          >
            <PromptIcon />
            {scriptRunning ? copy.scripting : copy.script}
          </button>
        </div>
        {videoPrompts.length > 0 && (
          <div
            className={styles["video-prompt-library"]}
            aria-label={copy.selectPrompt}
          >
            <span>{copy.selectPrompt}</span>
            <div className={styles["video-prompt-filters"]}>
              <select
                aria-label={copy.selectPrompt}
                value={videoPromptCategory}
                onChange={(event) =>
                  setVideoPromptCategory(event.currentTarget.value)
                }
              >
                {(videoPromptCategories.length
                  ? videoPromptCategories
                  : [{ id: "all", label: text.common.all }]
                ).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.id === "all" ? text.common.all : category.label}
                  </option>
                ))}
              </select>
              <input
                type="search"
                aria-label={copy.selectPrompt}
                value={videoPromptQuery}
                onChange={(event) =>
                  setVideoPromptQuery(event.currentTarget.value)
                }
                placeholder={copy.selectPrompt}
              />
            </div>
            <div className={styles["video-prompt-scroller"]}>
              {visibleVideoPrompts.map((item) => {
                return (
                  <button
                    type="button"
                    key={String(item.id)}
                    onClick={() => setPrompt(item.prompt_text || item.title)}
                    disabled={noCapability}
                  >
                    {item.coverUrl && (
                      <img src={item.coverUrl} alt="" loading="lazy" />
                    )}
                    <strong>{item.title}</strong>
                    <small>{item.prompt_text || item.description}</small>
                  </button>
                );
              })}
              {!visibleVideoPrompts.length && <span>{text.common.empty}</span>}
            </div>
          </div>
        )}
        <div className={styles["library-action-row"]}>
          <button
            type="button"
            onClick={() => referenceInputRef.current?.click()}
            disabled={noCapability}
          >
            <UploadIcon />
            <span>{copy.reference}</span>
            <strong>
              {referenceAssetIDs.length
                ? `${referenceAssetIDs.length}`
                : copy.choose}
            </strong>
          </button>
          <button
            type="button"
            onClick={() => setReferenceLibraryOpen((open) => !open)}
            disabled={noCapability || referenceMaterialsLoading}
            aria-expanded={referenceLibraryOpen}
          >
            <UploadIcon />
            <span>{copy.materialLibrary}</span>
            <strong>
              {referenceMaterialsLoading
                ? copy.materialLoading
                : selectableReferenceMaterials.length}
            </strong>
          </button>
          <button
            type="button"
            onClick={clearSelectedReferences}
            disabled={!referenceAssetIDs.length}
          >
            <DeleteIcon />
            <span>{copy.clearReferences}</span>
            <strong>{referenceAssetIDs.length || ""}</strong>
          </button>
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            hidden
            onChange={(event) => void chooseReferences(event)}
          />
        </div>
        {referenceLibraryOpen && (
          <div
            className={styles["video-reference-library"]}
            aria-label={copy.materialLibrary}
          >
            {referenceMaterialsLoading ? (
              <span>{copy.materialLoading}</span>
            ) : selectableReferenceMaterials.length ? (
              selectableReferenceMaterials.map((material) => {
                const id = String(material.remoteId || "");
                const selected = referenceAssetIDs.includes(id);
                const kind = material.kind as "image" | "video" | "audio";
                return (
                  <button
                    key={material.id}
                    type="button"
                    aria-pressed={selected}
                    className={clsx({
                      [styles["reference-selected"]]: selected,
                    })}
                    onClick={() => toggleReferenceMaterial(material)}
                  >
                    <UploadIcon />
                    <span>
                      <strong>{material.name}</strong>
                      <small>{copy.materialKinds[kind]}</small>
                    </span>
                    <b>{selected ? "-" : "+"}</b>
                  </button>
                );
              })
            ) : (
              <span>{copy.materialEmpty}</span>
            )}
          </div>
        )}
        <div className={styles["form-grid"]}>
          <label className={styles["checkbox-row"]}>
            <input
              type="checkbox"
              checked={Boolean(preferences.generateAudio)}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  generateAudio: event.currentTarget.checked,
                }))
              }
              disabled={!capabilities?.generate_audio}
            />
            <span>{copy.audio}</span>
          </label>
          <label className={styles["checkbox-row"]}>
            <input
              type="checkbox"
              checked={Boolean(preferences.watermark)}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  watermark: event.currentTarget.checked,
                }))
              }
              disabled={!capabilities?.watermark}
            />
            <span>{copy.watermark}</span>
          </label>
        </div>
        {error && <div className={styles["form-error"]}>{error}</div>}
        {status === "running" && (
          <div className={styles["content-kit-preflight"]}>
            <span>
              {copy.generating} · {progress}%
            </span>
            <button type="button" onClick={cancelVideo}>
              {copy.cancel}
            </button>
          </div>
        )}
        {(status === "failed" || status === "cancelled") && taskID && (
          <div className={styles["content-kit-preflight"]}>
            <span>{error || copy.failed}</span>
            <button type="button" onClick={() => void retryVideo()}>
              {copy.retry}
            </button>
          </div>
        )}
        <button
          type="button"
          className={styles["primary-action"]}
          disabled={noCapability || status === "running"}
          onClick={() => void runVideo()}
        >
          <PlayIcon />
          {status === "running" ? copy.generating : copy.generate}
        </button>
        {resultUrl && status === "completed" && (
          <div className={styles["video-result-card"]}>
            <video controls playsInline src={resultUrl} />
            <div>
              <strong>{copy.ready}</strong>
              <button
                type="button"
                onClick={() => void downloadVideo(resultUrl, taskID)}
              >
                <DownloadIcon />
                {copy.download}
              </button>
              <button type="button" onClick={() => void saveVideoAsAsset()}>
                <UploadIcon />
                {copy.saveAsset}
              </button>
            </div>
          </div>
        )}
      </section>
      <section className={styles["section"]}>
        <div className={styles["section-head"]}>
          <h2>{copy.history}</h2>
          <span>{history.length}</span>
        </div>
        {history.length === 0 && (
          <p className={styles["empty-copy"]}>{copy.emptyHistory}</p>
        )}
        <div className={styles["content-kit-project-list"]}>
          {history.map((item) => (
            <div className={styles["content-kit-project"]} key={item.id}>
              <video muted playsInline src={item.url} />
              <span>
                <strong>{item.prompt.slice(0, 50) || item.taskId}</strong>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </span>
              <button
                type="button"
                onClick={() => void downloadVideo(item.url, item.taskId)}
              >
                <DownloadIcon />
              </button>
              <button
                type="button"
                aria-label={text.common.delete}
                onClick={() => void removeHistoryItem(item)}
              >
                <DeleteIcon />
              </button>
            </div>
          ))}
        </div>
      </section>
    </AndroidAppShell>
  );
}

function AndroidImageStudio() {
  const managed = useManagedNextChatStore();
  const text = useMobileText();
  const sdStore = useSdStore();
  const navigate = useNavigate();
  const location = useLocation();
  const activeAccountId = String(
    managed.user?.id ||
      managed.session?.user_id ||
      managed.workspace?.user?.id ||
      "",
  );
  const workspace = managed.workspace
    ? {
        ...managed.workspace,
        models:
          managed.workspace.workspaces?.image?.models ||
          managed.workspace.models,
      }
    : null;
  const groups = workspace?.models?.groups ?? [];
  const imageGroup = bestImageGroup(workspace);
  const hasImageGroup = Boolean(imageGroup);
  const imagePrefs = readStoredJSON(IMAGE_PREF_STORAGE_KEY, {
    groupId: 0,
    model: "",
    size: "1024x1024",
    quality: "auto",
    style: "auto",
    count: 1,
  });
  const [selectedImageGroupId, setSelectedImageGroupId] = useState<
    number | undefined
  >(() => Number(imagePrefs.groupId) || imageGroup?.id);
  const effectiveImageGroupId = selectedImageGroupId || imageGroup?.id;
  const models = modelsForGroup(workspace, effectiveImageGroupId);
  const imageModelOptions = imageModelsForGroup(
    workspace,
    effectiveImageGroupId,
  );
  // The backend must declare image capabilities. Never infer edit support from
  // a model name; older servers therefore show an explicit unsupported state.
  const allowLegacyImageCapabilityFallback = false;
  const fallbackModel = imageModelOptions[0];
  const [selectedModel, setSelectedModel] = useState(
    String(imagePrefs.model || modelValue(fallbackModel)),
  );
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(String(imagePrefs.size || "1024x1024"));
  const [quality, setQuality] = useState(String(imagePrefs.quality || "auto"));
  const [style, setStyle] = useState(String(imagePrefs.style || "auto"));
  const [count, setCount] = useState(
    Math.max(1, Math.min(4, Number(imagePrefs.count || 1))),
  );
  const [references, setReferences] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [promptSheetOpen, setPromptSheetOpen] = useState(false);
  const [sizeSheetOpen, setSizeSheetOpen] = useState(false);
  const [qualitySheetOpen, setQualitySheetOpen] = useState(false);
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  const [groupSwitching, setGroupSwitching] = useState(false);
  const [imageActionTarget, setImageActionTarget] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const platformTaskRef = useRef<MobileTask | null>(null);
  const platformTaskRunIdRef = useRef("");
  const platformTaskPollRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const gallery = sdStore.draw.filter(
    (item: any) => item.status === "success" && imageResults(item).length > 0,
  );
  const activeTask = sdStore.draw.find(
    (item: any) => item.status === "running",
  );
  const failedImageTaskIds = useMemo(
    () =>
      sdStore.draw
        .filter((item: any) => {
          if (item.status === "running" || item.status === "queued") {
            return false;
          }
          const hasResult = imageResults(item).length > 0;
          return (
            item.status === "error" ||
            item.status === "cancelled" ||
            item.status === "failed" ||
            (item.status === "partial" && !hasResult)
          );
        })
        .map((item: any) => String(item.id)),
    [sdStore.draw],
  );

  useEffect(() => {
    const fallback = modelValue(fallbackModel);
    const selectedBelongsToImageGroup = imageModelOptions.some(
      (model) => modelValue(model) === selectedModel,
    );
    if (fallback && (!selectedModel || !selectedBelongsToImageGroup)) {
      setSelectedModel(fallback);
    }
  }, [fallbackModel, imageModelOptions, selectedModel]);

  useEffect(() => {
    if (!selectedImageGroupId && imageGroup?.id) {
      setSelectedImageGroupId(imageGroup.id);
    }
  }, [imageGroup?.id, selectedImageGroupId]);

  useEffect(() => {
    writeStoredJSON(IMAGE_PREF_STORAGE_KEY, {
      groupId: effectiveImageGroupId || 0,
      model: selectedModel,
      size,
      quality,
      style,
      count,
    });
  }, [effectiveImageGroupId, selectedModel, size, quality, style, count]);

  useEffect(() => {
    const state = location.state as any;
    const dataUrl = String(state?.materialDataUrl || "");
    if (!dataUrl) return;
    setReferences((items) => [...items, dataUrl].slice(0, 6));
    navigate(Path.Sd, { replace: true, state: null });
  }, [location.state, navigate]);

  const sizeOptions = useMemo(
    () => imageSizeOptionsForModel(selectedModel || modelValue(fallbackModel)),
    [fallbackModel, selectedModel],
  );
  const qualityOptions = useMemo(
    () =>
      imageQualityOptionsForModel(
        selectedModel || modelValue(fallbackModel),
        text,
      ),
    [fallbackModel, selectedModel, text],
  );

  useEffect(() => {
    if (!sizeOptions.some((item) => item.id === size) && sizeOptions[0]) {
      setSize(sizeOptions[0].id);
    }
  }, [size, sizeOptions]);

  useEffect(() => {
    if (!qualityOptions.some((item) => item.id === quality)) {
      setQuality(qualityOptions[0]?.id || "auto");
    }
  }, [quality, qualityOptions]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  function updateTask(id: string, patch: Record<string, any>) {
    sdStore.update((state) => {
      const item = state.draw.find((row: any) => row.id === id);
      if (item) Object.assign(item, patch, { updated_at: Date.now() });
      state.currentId += 1;
    });
  }

  function startProgress(id: string) {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
    }
    progressTimerRef.current = window.setInterval(() => {
      const item = useSdStore.getState().draw.find((row: any) => row.id === id);
      if (!item || item.status !== "running") return;
      const next = Math.min(92, Number(item.progress || 12) + 4);
      updateTask(id, { progress: next });
    }, 2000);
  }

  function stopProgress() {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  async function persistImageFromResult(
    result: any,
    context: {
      taskId: string;
      index: number;
      prompt: string;
      model: string;
      signal?: AbortSignal;
    },
  ) {
    let imageData = "";
    if (context.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (typeof result === "string") {
      if (/^https?:\/\//i.test(result)) {
        const res = await fetch(result, { signal: context.signal });
        const blob = await res.blob();
        if (context.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        imageData = await compressImage(blob, 1024 * 1024);
      } else {
        imageData = result.startsWith("data:")
          ? result
          : `data:image/png;base64,${result}`;
      }
    } else if (result?.b64_json) {
      imageData = `data:image/png;base64,${result.b64_json}`;
    } else if (result?.image && typeof result.image === "string") {
      if (/^https?:\/\//i.test(result.image)) {
        const res = await fetch(result.image, { signal: context.signal });
        const blob = await res.blob();
        if (context.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        imageData = await compressImage(blob, 1024 * 1024);
      } else {
        imageData = result.image.startsWith("data:")
          ? result.image
          : `data:image/png;base64,${result.image}`;
      }
    } else if (result?.url) {
      const res = await fetch(result.url, { signal: context.signal });
      const blob = await res.blob();
      if (context.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      imageData = await compressImage(blob, 1024 * 1024);
    }
    if (!imageData) throw new Error(text.image.emptyResult);
    if (context.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const saved = await saveImageToAppStorage(
      imageData,
      makeImageFileName(text.image.filePrefix, context.taskId, context.index),
      {
        prompt: context.prompt,
        model: context.model,
        taskId: context.taskId,
        ownerUserId: String(managed.user?.id || managed.session?.user_id || ""),
      },
    );
    return {
      url: saved.localUrl || imageData,
      fileName: saved.fileName,
    };
  }

  async function attachReferences(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = input.files;
    if (!files?.length) return;
    try {
      const selectedFiles = Array.from(files).slice(0, 6);
      const urls = await readImageFiles(selectedFiles, 6);
      setReferences((items) => [...items, ...urls].slice(0, 6));
      if (
        !imageModelSupportsReferences(
          selectedModel,
          imageModelOptions,
          allowLegacyImageCapabilityFallback,
        )
      ) {
        setError(
          firstReferenceImageModel(
            imageModelOptions,
            allowLegacyImageCapabilityFallback,
          )
            ? text.image.referenceModelUnsupported(selectedModel)
            : text.image.noReferenceModel,
        );
      }
    } catch (err) {
      setError(localizedMobileErrorMessage(err, text.errors.saveFailed));
    } finally {
      if (input) input.value = "";
    }
  }

  function switchImageGroup(groupID: number) {
    if (!Number.isFinite(groupID) || groupSwitching) return;
    setGroupSheetOpen(false);
    setGroupSwitching(true);
    setError("");
    void managed
      .switchImageGroup(groupID)
      .then(() => {
        const nextModels = imageModelsForGroup(workspace, groupID);
        const nextModel = nextModels[0];
        setSelectedImageGroupId(groupID);
        setSelectedModel(modelValue(nextModel));
        if (!nextModel) {
          setError(text.errors.noImageModelsInCurrentGroup);
        } else if (
          references.length &&
          !imageModelSupportsReferences(
            nextModel,
            [],
            allowLegacyImageCapabilityFallback,
          )
        ) {
          setError(text.image.referenceModelUnsupported(modelValue(nextModel)));
        }
      })
      .catch((err) => {
        setError(
          localizedMobileErrorMessage(err, text.errors.switchGroupFailed),
        );
      })
      .finally(() => {
        setGroupSwitching(false);
      });
  }

  async function switchToImageGroup() {
    if (!imageGroup?.id) return;
    await switchImageGroup(imageGroup.id);
  }

  async function runImageTask(overrides?: Partial<any>) {
    const promptText = (overrides?.prompt || prompt).trim();
    let model = overrides?.model || selectedModel || modelValue(fallbackModel);
    const taskGroupId = effectiveImageGroupId;
    const taskSize = overrides?.size || size;
    const taskQuality = overrides?.quality || quality;
    const taskStyle = overrides?.style || style;
    const taskCount = Math.max(
      1,
      Math.min(4, Number(overrides?.n || count || 1)),
    );
    // Snapshot inputs once. A batch must not change from edit to generation if
    // the composer state is refreshed while one of its individual requests runs.
    const taskReferences = Array.isArray(
      overrides?.referenceImages || references,
    )
      ? [...(overrides?.referenceImages || references)]
      : [];
    const imageOperation = taskReferences.length
      ? "images.edits"
      : "images.generations";
    const e2eFixture = await getNativeE2EFixtureFlags().catch(() => ({
      image502ThenSuccess: false,
    }));
    const useLocalImageFixture = e2eFixture.image502ThenSuccess === true;

    if (
      taskReferences.length &&
      !imageModelSupportsReferences(
        model,
        imageModelOptions,
        allowLegacyImageCapabilityFallback,
      )
    ) {
      setError(
        firstReferenceImageModel(
          imageModelOptions,
          allowLegacyImageCapabilityFallback,
        )
          ? text.image.referenceModelUnsupported(model)
          : text.image.noReferenceModel,
      );
      return;
    }

    if (!promptText) {
      setError(text.errors.emptyPrompt);
      return;
    }
    if (!managed.imageSession) {
      setError(text.errors.loginRequired);
      return;
    }
    if (!model || imageModelOptions.length === 0) {
      setError(
        describeImageError("", {
          text,
          selectedModel: model,
          imageModelCount: imageModelOptions.length,
          hasImageGroup,
        }),
      );
      return;
    }

    const id = `image-${Date.now()}`;
    const createdAt = new Date().toLocaleString(text.dateLocale);
    const modelInfo = models.find(
      (item) => item.name === model || item.id === model,
    );
    const draft = {
      id,
      status: "queued",
      progress: 4,
      model,
      model_name: modelInfo?.display_name || modelInfo?.name || model,
      params: {
        prompt: promptText,
        size: taskSize,
        quality: taskQuality,
        style: taskStyle,
        n: taskCount,
        referenceImages: taskReferences,
      },
      result_items: Array.from({ length: taskCount }, (_, index) => ({
        index,
        status: "queued",
      })),
      created_at: createdAt,
    };

    setError("");
    sdStore.update((state) => {
      state.draw = [draft, ...state.draw];
      state.currentId += 1;
    });

    const controller = new AbortController();
    abortRef.current = controller;
    updateTask(id, { status: "running", progress: 12 });
    startProgress(id);
    const performanceTraceId = await startNativePerformanceTrace(
      "image_generation",
      {
        operation: imageOperation === "images.edits" ? "edit" : "generate",
        batch: taskCount,
        references: Boolean(taskReferences.length),
      },
    ).catch(() => "");
    let performanceOutcome = "success";

    // Project the local image batch into the mobile task history. This is
    // deliberately best-effort: the image gateway remains the source of
    // truth for generation and billing, while the projection enables the
    // dashboard to show progress and lets the user cancel remotely.
    let projectedTask: MobileTask | null = null;
    const projectedTaskPromise = (async () => {
      try {
        const client = await mobilePlatformClient();
        const task = await client.tasks.create({
          kind: "image",
          operation: imageOperation,
          client_request_id: id,
          title: promptText.slice(0, 80),
          title_zh: promptText.slice(0, 80),
          model,
          group_id: taskGroupId,
          parameters: {
            size: taskSize,
            quality: taskQuality,
            style: taskStyle,
            n: taskCount,
            reference_count: taskReferences.length,
            local_task_id: id,
          },
          locale: text.dateLocale,
        });
        // Authentication may delay the optional projection until after the
        // local request has finished. Do not attach a late task to a newer run.
        if (abortRef.current !== controller) return task;
        projectedTask = task;
        platformTaskRef.current = task;
        platformTaskRunIdRef.current = id;
        updateTask(id, { platform_task_id: task.id });
        await client.tasks.status(task.id, { status: "running", progress: 12 });
        if (abortRef.current !== controller) return task;
        platformTaskPollRef.current = window.setInterval(() => {
          void mobilePlatformClient()
            .then((nextClient) => nextClient.tasks.detail(task.id))
            .then((remoteTask) => {
              if (
                remoteTask.status === "cancelled" &&
                abortRef.current === controller
              ) {
                controller.abort();
              }
            })
            .catch(() => undefined);
        }, 2500);
        return task;
      } catch {
        return null;
      }
    })();

    const endpoint =
      imageOperation === "images.edits"
        ? "/images/edits"
        : "/images/generations";
    const taskBackendBaseUrl = managed.backendBaseUrl;
    const initialImageApiKey = managed.imageSession?.api_key || "";
    const basePayload: Record<string, any> = {
      model,
      prompt: promptText,
      size: taskSize,
      response_format: "b64_json",
    };
    if (taskQuality !== "auto") basePayload.quality = taskQuality;
    if (taskStyle !== "auto" && imageModelSupportsStyle(model)) {
      basePayload.style = taskStyle;
    }
    if (taskReferences.length) basePayload.input_fidelity = "high";

    function buildImageRequest(
      requestIndex: number,
      imageApiKey = initialImageApiKey,
    ) {
      const payload: Record<string, any> = { ...basePayload, n: 1 };
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${imageApiKey}`,
        "Idempotency-Key": `android-image-${id}-${requestIndex + 1}`,
        "X-Request-ID": `android-image-${id}-${requestIndex + 1}`,
      };
      let body: BodyInit;
      if (taskReferences.length) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
        taskReferences.forEach((url: string, index: number) => {
          formData.append(
            "image",
            dataUrlToBlob(url),
            `reference-${index + 1}.png`,
          );
        });
        body = formData;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(payload);
      }
      return { headers, body };
    }

    const requestImageText = async (requestIndex: number) => {
      let authAttempt = 0;
      let lastError: unknown = null;
      while (authAttempt <= 1) {
        const latestManaged = useManagedNextChatStore.getState();
        const request = buildImageRequest(
          requestIndex,
          latestManaged.imageSession?.api_key || "",
        );
        try {
          const response = await managedGatewayRequestText(
            taskBackendBaseUrl,
            `/v1${endpoint}`,
            {
              method: "POST",
              headers: request.headers,
              body: request.body,
              signal: controller.signal,
            },
            latestManaged.imageSession?.api_key || "",
            text,
          );
          if (
            (response.status === 401 || response.status === 403) &&
            authAttempt < 1
          ) {
            authAttempt += 1;
            await managed.bootstrap({ silent: true }).catch(() => undefined);
            continue;
          }
          return response;
        } catch (error) {
          lastError = error;
          throw error;
        }
      }
      throw lastError;
    };

    const savedResults: string[] = [];
    const localFiles: string[] = [];
    const failures: string[] = [];
    const resultItems = Array.from({ length: taskCount }, (_, index) => ({
      index,
      status: "queued",
      url: "",
      fileName: "",
      error: "",
    }));
    try {
      let activeManaged = useManagedNextChatStore.getState();
      if (
        !useLocalImageFixture &&
        taskGroupId &&
        currentGroupID(activeManaged.workspace) !== taskGroupId
      ) {
        await managed.switchImageGroup(taskGroupId);
        activeManaged = useManagedNextChatStore.getState();
      }
      for (let requestIndex = 0; requestIndex < taskCount; requestIndex += 1) {
        if (controller.signal.aborted)
          throw new Error(text.errors.requestCancelled);
        resultItems[requestIndex] = {
          ...resultItems[requestIndex],
          status: "running",
        };
        updateTask(id, {
          status: "running",
          progress: Math.min(
            94,
            12 + Math.floor((requestIndex / taskCount) * 78),
          ),
          result_items: [...resultItems],
        });
        void projectedTaskPromise.then(async (task) => {
          if (!task) return;
          const client = await mobilePlatformClient().catch(() => null);
          await client?.tasks
            .status(task.id, {
              status: "running",
              progress: Math.min(
                96,
                12 + Math.floor((requestIndex / taskCount) * 78),
              ),
            })
            .catch(() => {});
        });
        try {
          const response = await requestImageText(requestIndex);
          if (controller.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          const res = {
            ok: response.ok,
            status: response.status,
          };
          const responseText = response.text;
          let json: any = null;
          try {
            json = responseText ? JSON.parse(responseText) : null;
          } catch {
            json = null;
          }
          if (!res.ok || json?.error) {
            const raw =
              json?.error?.message ||
              json?.message ||
              json?.error ||
              responseText;
            const localized = parseOpenAIError(
              responseText,
              res.status,
              `/v1${endpoint}`,
              response.requestId || `android-image-${id}-${requestIndex + 1}`,
            );
            const described = describeImageError(raw || localized, {
              text,
              selectedModel: model,
              imageModelCount: imageModelOptions.length,
              hasImageGroup,
              status: res.status,
            });
            const diagnostics = localized.match(/\(HTTP [^)]+\)$/)?.[0] || "";
            const message =
              diagnostics && !described.includes(diagnostics)
                ? `${described} ${diagnostics}`
                : described;
            if (
              res.status === 401 ||
              res.status === 402 ||
              res.status === 403
            ) {
              throw new Error(message);
            }
            failures.push(message);
            resultItems[requestIndex] = {
              ...resultItems[requestIndex],
              status: "failed",
              error: message,
            };
            updateTask(id, { result_items: [...resultItems] });
            continue;
          }
          const images = openAIImageData(json);
          if (!images.length) {
            failures.push(text.image.emptyResult);
            resultItems[requestIndex] = {
              ...resultItems[requestIndex],
              status: "failed",
              error: text.image.emptyResult,
            };
            updateTask(id, { result_items: [...resultItems] });
            continue;
          }
          for (const item of images) {
            if (controller.signal.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }
            if (savedResults.length >= taskCount) break;
            const saved = await persistImageFromResult(item, {
              taskId: id,
              index: savedResults.length,
              prompt: promptText,
              model,
              signal: controller.signal,
            });
            savedResults.push(saved.url);
            if (saved.fileName) localFiles.push(saved.fileName);
            resultItems[requestIndex] = {
              ...resultItems[requestIndex],
              status: "success",
              url: saved.url,
              fileName: saved.fileName || "",
              error: "",
            };
          }
          updateTask(id, {
            status: "running",
            progress: Math.min(
              96,
              12 + Math.floor(((requestIndex + 1) / taskCount) * 78),
            ),
            img_data: savedResults[0],
            results: [...savedResults],
            local_files: [...localFiles],
            result_items: [...resultItems],
          });
        } catch (singleErr) {
          if (controller.signal.aborted) throw singleErr;
          const message =
            singleErr instanceof Error && singleErr.message
              ? singleErr.message
              : text.image.generateFailed;
          failures.push(message);
          resultItems[requestIndex] = {
            ...resultItems[requestIndex],
            status: "failed",
            error: message,
          };
          updateTask(id, { result_items: [...resultItems] });
          if (
            /权限|余额|登录|unauthorized|permission|balance|insufficient/.test(
              message.toLowerCase(),
            )
          ) {
            break;
          }
        }
      }
      if (!savedResults.length) {
        throw new Error(failures[0] || text.image.emptyResult);
      }
      const partialMessage =
        failures.length || savedResults.length < taskCount
          ? text.image.partialSuccess(
              savedResults.length,
              taskCount,
              failures[0] || text.image.generateFailed,
            )
          : "";
      updateTask(id, {
        status: partialMessage ? "partial" : "success",
        progress: 100,
        img_data: savedResults[0],
        results: savedResults,
        local_files: localFiles,
        result_items: resultItems.map((item, index) =>
          item.status === "queued"
            ? {
                ...item,
                status: savedResults[index] ? "success" : "failed",
                url: savedResults[index] || item.url,
                fileName: localFiles[index] || item.fileName,
                error:
                  savedResults[index] || item.error
                    ? item.error
                    : text.image.generateFailed,
              }
            : item,
        ),
        error: partialMessage,
      });
      void projectedTaskPromise.then(async (task) => {
        if (!task) return;
        const client = await mobilePlatformClient().catch(() => null);
        await client?.tasks
          .status(task.id, {
            status: partialMessage ? "partial" : "completed",
            progress: 100,
            artifacts: savedResults.map((url, index) => ({
              type: "image",
              id: `${id}-${index + 1}`,
              url,
            })),
          })
          .catch(() => {});
      });
      if (partialMessage) setError(partialMessage);
      setReferences([]);
      await showNativeNotification(text.image.title, text.image.savedToDevice);
      await managed.bootstrap({ silent: true }).catch(() => {});
    } catch (err) {
      const aborted = controller.signal.aborted;
      performanceOutcome = aborted ? "cancelled" : "error";
      const message = aborted
        ? text.errors.requestCancelled
        : err instanceof ManagedTransportError
        ? err.message
        : err instanceof Error
        ? describeImageError(localizedMobileErrorMessage(err, err.message), {
            text,
            selectedModel: model,
            imageModelCount: imageModelOptions.length,
            hasImageGroup,
          })
        : text.image.generateFailed;
      updateTask(id, {
        status: aborted ? "cancelled" : "error",
        progress: aborted ? 0 : 100,
        error: message,
      });
      void projectedTaskPromise.then(async (task) => {
        if (!task) return;
        const client = await mobilePlatformClient().catch(() => null);
        await client?.tasks
          .status(task.id, {
            status: aborted ? "cancelled" : "failed",
            error: aborted
              ? undefined
              : {
                  code: "image_generation_failed",
                  message,
                  retryable: true,
                },
          })
          .catch(() => {});
      });
      if (abortRef.current === controller) setError(message);
    } finally {
      void stopNativePerformanceTrace(
        performanceTraceId,
        performanceOutcome,
      ).catch(() => undefined);
      if (platformTaskPollRef.current) {
        window.clearInterval(platformTaskPollRef.current);
        platformTaskPollRef.current = null;
      }
      if (platformTaskRunIdRef.current === id) {
        platformTaskRef.current = null;
        platformTaskRunIdRef.current = "";
      }
      if (abortRef.current === controller) {
        stopProgress();
        abortRef.current = null;
      }
    }
  }

  function cancelTask() {
    abortRef.current?.abort();
    const platformTask = platformTaskRef.current;
    if (platformTask) {
      void mobilePlatformClient()
        .then((client) =>
          client.tasks.cancel(platformTask.id, { reason: "user_cancelled" }),
        )
        .catch(() => {});
    }
    if (activeTask?.id) {
      updateTask(activeTask.id, {
        status: "cancelled",
        progress: 0,
        error: text.errors.requestCancelled,
      });
    }
  }

  function retryTask(item: any) {
    runImageTask({
      prompt: item?.params?.prompt,
      model: item?.model,
      size: item?.params?.size,
      quality: item?.params?.quality,
      style: item?.params?.style,
      n: item?.params?.n,
      referenceImages: item?.params?.referenceImages || [],
    });
  }

  function reuseImageTaskPrompt(item: any) {
    setPrompt(item?.params?.prompt || item?.prompt || "");
    if (item?.params?.size) setSize(item.params.size);
    if (item?.params?.quality) setQuality(item.params.quality);
    if (item?.params?.style) setStyle(item.params.style);
    if (item?.params?.n) {
      setCount(Math.max(1, Math.min(4, Number(item.params.n || 1))));
    }
    setImageActionTarget(null);
    setError("");
  }

  function reportImageTask(item: any) {
    writeMobileReportDraft(buildImageReportDraft(item, text));
    setImageActionTarget(null);
    setPreview(null);
    navigate(Path.AccountFeedback);
  }

  function retrySingleImage(item: any, index: number) {
    runImageTask({
      prompt: item?.params?.prompt,
      model: item?.model,
      size: item?.params?.size,
      quality: item?.params?.quality,
      style: item?.params?.style,
      n: 1,
      referenceImages: item?.params?.referenceImages || [],
      retryIndex: index,
    });
  }

  async function deleteImageTasks(ids: string[], confirmMessage?: string) {
    const targetIds = ids.filter(Boolean);
    if (!targetIds.length) return false;
    if (!window.confirm(confirmMessage || text.image.deleteTaskConfirm))
      return false;
    setError("");
    try {
      const items = sdStore.draw.filter((item: any) =>
        targetIds.includes(String(item.id)),
      );
      const removedUrls = items.flatMap(imageResults);
      const localFileNames = items.flatMap(imageLocalFileNames);
      if (localFileNames.length) {
        await deleteAppImages(localFileNames, activeAccountId);
      }
      await Promise.allSettled(
        removedUrls
          .filter((url: string) => url.startsWith("/api/cache"))
          .map((url: string) => removeImage(url)),
      );
      sdStore.update((state) => {
        state.draw = state.draw.filter(
          (item: any) => !targetIds.includes(String(item.id)),
        );
        state.currentId += 1;
      });
      if (preview && targetIds.includes(String(preview.id))) {
        setPreview(null);
      }
      setError(text.common.done);
      return true;
    } catch (err) {
      setError(localizedMobileErrorMessage(err, text.errors.saveFailed));
      return false;
    }
  }

  function clearFailedImageTasks() {
    if (!failedImageTaskIds.length) {
      setError(text.image.failedCleared);
      return;
    }
    void deleteImageTasks(
      failedImageTaskIds,
      text.image.clearFailedConfirm,
    ).then((deleted) => {
      if (deleted) setError(text.image.failedCleared);
    });
  }

  function applyPromptTemplate(template: ImagePromptTemplate) {
    setPrompt(localizedValue(template.prompt, text));
    if (template.params.size) setSize(template.params.size);
    if (template.params.quality) setQuality(template.params.quality);
    if (template.params.style) setStyle(template.params.style);
    if (template.params.count) setCount(template.params.count);
    setPromptSheetOpen(false);
    setError(
      template.needReferenceImages && references.length === 0
        ? text.image.referenceRecommendedHint
        : "",
    );
  }

  function adaptPromptTemplate(template: ImagePromptTemplate) {
    const sizeOptionsForCurrentModel = imageSizeOptionsForModel(
      selectedModel || modelValue(fallbackModel),
    );
    const preferredSize =
      template.params.size &&
      sizeOptionsForCurrentModel.some(
        (item) => item.id === template.params.size,
      )
        ? template.params.size
        : sizeOptionsForCurrentModel[0]?.id || size;
    applyPromptTemplate({
      ...template,
      params: {
        ...template.params,
        size: preferredSize,
        style: imageModelSupportsStyle(selectedModel)
          ? template.params.style
          : "auto",
      },
    });
  }

  async function copyPromptTemplate(template: ImagePromptTemplate) {
    try {
      await navigator.clipboard?.writeText(
        localizedValue(template.prompt, text),
      );
      setError(text.chat.copied);
    } catch {
      setError(text.errors.copyFailed);
    }
  }

  async function saveItems(ids: string[]) {
    const items = gallery.filter((item: any) => ids.includes(item.id));
    for (const item of items) {
      const urls = imageResults(item);
      for (let index = 0; index < urls.length; index += 1) {
        await saveImageToGallery(
          urls[index],
          makeImageFileName(text.image.filePrefix, item.id, index),
        );
      }
    }
    await showNativeNotification(text.image.title, text.image.savedToAlbum);
  }

  async function shareItems(ids: string[]) {
    const selected = gallery.filter((item: any) => ids.includes(item.id));
    const images = selected.flatMap((item: any) =>
      imageResults(item).map((url: string, index: number) => ({
        url,
        fileName: makeImageFileName(text.image.filePrefix, item.id, index),
      })),
    );
    if (!images.length) return;
    const shareTextValue = selected[0]?.params?.prompt;
    if (images.length === 1) {
      await shareImage(images[0].url, images[0].fileName, shareTextValue);
      return;
    }
    await shareImages(images, shareTextValue);
  }

  const selectedImageModelInfo = imageModelOptions.find(
    (model) => modelValue(model) === selectedModel,
  );
  const currentGroupValue = String(effectiveImageGroupId || "");
  const selectedSizeOption = sizeOptions.find((item) => item.id === size);
  const styleOptions = [
    { id: "auto", title: text.image.styleAuto },
    { id: "vivid", title: text.image.styleVivid },
    { id: "natural", title: text.image.styleNatural },
    { id: "photographic", title: text.image.stylePhoto },
    { id: "anime", title: text.image.styleAnime },
    { id: "digital-art", title: text.image.styleDigital },
  ];

  useNativeBackHandler(true, () => {
    if (imageActionTarget) {
      setImageActionTarget(null);
      return;
    }
    if (preview) {
      setPreview(null);
      return;
    }
    if (groupSheetOpen) {
      setGroupSheetOpen(false);
      return;
    }
    if (modelSheetOpen) {
      setModelSheetOpen(false);
      return;
    }
    if (promptSheetOpen) {
      setPromptSheetOpen(false);
      return;
    }
    if (sizeSheetOpen) {
      setSizeSheetOpen(false);
      return;
    }
    if (qualitySheetOpen) {
      setQualitySheetOpen(false);
      return;
    }
    if (styleSheetOpen) {
      setStyleSheetOpen(false);
      return;
    }
    handleNativeHomeBack(text);
  });

  return (
    <AndroidAppShell active="create" text={text}>
      <header className={styles["app-header"]}>
        <div>
          <span>{groupNameByID(workspace, effectiveImageGroupId, text)}</span>
          <h1>{text.image.title}</h1>
        </div>
        <IconButton
          label={text.common.refresh}
          onClick={() => managed.bootstrap().catch(() => {})}
        >
          <ReloadIcon />
        </IconButton>
      </header>

      <section className={styles["image-panel"]}>
        {imageModelOptions.length === 0 && (
          <div className={styles["image-routing-hint"]}>
            <div>
              <strong>{text.errors.noImageModelsInCurrentGroup}</strong>
              <span>
                {imageGroup
                  ? text.image.switchToImageGroupHint(imageGroup.name)
                  : text.image.noImageGroupHint}
              </span>
            </div>
            {imageGroup && (
              <button type="button" onClick={switchToImageGroup}>
                {text.image.switchToImageGroup}
              </button>
            )}
          </div>
        )}
        <div className={styles["library-action-row"]}>
          <button type="button" onClick={() => setPromptSheetOpen(true)}>
            <PromptIcon />
            <span>{text.image.promptLibrary}</span>
            <strong>{text.image.promptLibraryHint}</strong>
          </button>
        </div>
        <textarea
          aria-label="image-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.currentTarget.value)}
          placeholder={text.image.promptPlaceholder}
        />
        <div className={styles["form-grid"]}>
          <button
            type="button"
            aria-label="image-group-selector"
            onClick={() => setGroupSheetOpen(true)}
            disabled={groupSwitching}
          >
            <span>{text.chat.group}</span>
            <strong>
              {groupSwitching
                ? text.chat.switchingGroup
                : groupNameByID(workspace, effectiveImageGroupId, text)}
            </strong>
          </button>
          <button type="button" onClick={() => setModelSheetOpen(true)}>
            <span>{text.image.model}</span>
            <strong>
              {modelLabel(selectedImageModelInfo) ||
                selectedModel ||
                text.errors.noModel}
            </strong>
          </button>
          <button type="button" onClick={() => setSizeSheetOpen(true)}>
            <span>{text.image.size}</span>
            <strong>
              {selectedSizeOption
                ? imageSizeLabel(selectedSizeOption, text)
                : size.replace("x", "×")}
            </strong>
          </button>
          <button type="button" onClick={() => setQualitySheetOpen(true)}>
            <span>{text.image.quality}</span>
            <strong>
              {qualityOptions.find((item) => item.id === quality)?.title ||
                text.image.qualityAuto}
            </strong>
          </button>
          <button type="button" onClick={() => setStyleSheetOpen(true)}>
            <span>{text.image.style}</span>
            <strong>
              {styleOptions.find((item) => item.id === style)?.title ||
                text.image.styleAuto}
            </strong>
          </button>
        </div>

        <div className={styles["stepper-row"]}>
          <span>{text.image.count}</span>
          <div>
            {[1, 2, 3, 4].map((item) => (
              <button
                key={item}
                className={clsx({ [styles["active"]]: count === item })}
                onClick={() => setCount(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className={styles["reference-panel"]}>
          <div>
            <strong>{text.image.references}</strong>
            <span>{text.image.referenceHint}</span>
          </div>
          <input
            ref={fileRef}
            aria-label="image-reference-input"
            hidden
            type="file"
            accept="image/*"
            multiple
            onChange={attachReferences}
          />
          <button
            aria-label="image-add-reference"
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon />
            <span>{text.image.addReference}</span>
          </button>
        </div>
        {references.length > 0 &&
          !imageModelSupportsReferences(
            selectedModel,
            imageModelOptions,
            allowLegacyImageCapabilityFallback,
          ) && (
            <div className={styles["reference-model-picker"]}>
              <strong>
                {text.image.referenceModelUnsupported(selectedModel)}
              </strong>
              <div>
                {imageModelOptions
                  .filter((model) =>
                    imageModelSupportsReferences(
                      model,
                      [],
                      allowLegacyImageCapabilityFallback,
                    ),
                  )
                  .map((model) => (
                    <button
                      key={modelValue(model)}
                      type="button"
                      onClick={() => {
                        setSelectedModel(modelValue(model));
                        setError("");
                      }}
                    >
                      {modelLabel(model)}
                    </button>
                  ))}
              </div>
            </div>
          )}
        {references.length > 0 && (
          <div className={styles["reference-list"]}>
            {references.map((url, index) => (
              <button
                key={url}
                onClick={() => {
                  setReferences((items) =>
                    items.filter((_, itemIndex) => itemIndex !== index),
                  );
                }}
              >
                <img src={url} alt={text.image.references} />
                <CloseIcon />
              </button>
            ))}
            <button
              type="button"
              aria-label="image-clear-references"
              onClick={() => {
                setReferences([]);
              }}
            >
              {text.image.clearReferences}
            </button>
          </div>
        )}

        {activeTask && (
          <div className={styles["task-progress"]}>
            <div>
              <span>{text.image.progress}</span>
              <strong>
                {[
                  imageTaskStatusText(activeTask, text),
                  imageTaskResultText(activeTask, text),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </strong>
            </div>
            <progress value={Number(activeTask.progress || 0)} max={100} />
            <button onClick={cancelTask}>{text.image.cancelTask}</button>
          </div>
        )}

        {error && <div className={styles["form-error"]}>{error}</div>}
        <button
          className={styles["primary-action"]}
          aria-label="image-generate"
          onClick={() => runImageTask()}
          disabled={
            Boolean(activeTask) ||
            !prompt.trim() ||
            !managed.session ||
            imageModelOptions.length === 0
          }
        >
          {activeTask ? text.image.generating : text.image.generate}
        </button>
      </section>

      <section className={styles["section"]}>
        <div className={styles["section-head"]}>
          <h2>{text.image.details}</h2>
          {failedImageTaskIds.length > 0 && (
            <button type="button" onClick={clearFailedImageTasks}>
              {text.image.clearFailed}
            </button>
          )}
        </div>
        <div className={styles["task-list"]}>
          {sdStore.draw.length === 0 && (
            <p className={styles["empty-copy"]}>{text.image.noHistory}</p>
          )}
          {sdStore.draw.slice(0, 8).map((item: any) => {
            const urls = imageResults(item);
            const status = [
              imageTaskStatusText(item, text),
              imageTaskResultText(item, text),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <article
                key={item.id}
                className={clsx(
                  styles["image-task-card"],
                  styles["image-task-card-with-actions"],
                )}
              >
                <button
                  type="button"
                  className={styles["image-task-main"]}
                  onClick={() => setPreview(item)}
                >
                  <i>
                    {urls[0] ? (
                      <img
                        src={urls[0]}
                        alt={item.params?.prompt || item.model_name}
                      />
                    ) : (
                      <ImageIcon />
                    )}
                  </i>
                  <span>
                    <strong>{item.params?.prompt || item.model_name}</strong>
                    <small>{status}</small>
                  </span>
                </button>
                <div className={styles["image-task-actions"]}>
                  {(item.status === "error" ||
                    item.status === "cancelled" ||
                    item.status === "partial") && (
                    <button type="button" onClick={() => retryTask(item)}>
                      {text.image.retryTask}
                    </button>
                  )}
                  <IconButton
                    label={text.image.details}
                    onClick={() => setImageActionTarget(item)}
                  >
                    <ThreeDotsIcon />
                  </IconButton>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {preview && (
        <div
          className={styles["image-preview"]}
          onClick={() => setPreview(null)}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <div className={styles["preview-head"]}>
              <strong>{preview.model_name || preview.model}</strong>
              <IconButton
                label={text.common.close}
                onClick={() => setPreview(null)}
              >
                <CloseIcon />
              </IconButton>
            </div>
            <div className={styles["preview-images"]}>
              {imageResults(preview).map((url, index) => (
                <img
                  key={url}
                  src={url}
                  alt={`${preview.params?.prompt || preview.id}-${index}`}
                />
              ))}
            </div>
            <p>{preview.params?.prompt || preview.error}</p>
            {imageTaskResultText(preview, text) && (
              <p>{imageTaskResultText(preview, text)}</p>
            )}
            <div className={styles["image-task-slots"]}>
              {imageTaskSlots(preview, text).map((slot) => (
                <div key={`${preview.id}-${slot.index}`}>
                  <span>{text.image.singleResult(slot.index + 1)}</span>
                  <strong>{slot.label}</strong>
                  {slot.error && <small>{slot.error}</small>}
                  {slot.status === "failed" && (
                    <button
                      onClick={() => retrySingleImage(preview, slot.index)}
                    >
                      {text.image.retrySingle}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p>{text.image.costHint}</p>
            {preview.error && <p>{preview.error}</p>}
            <div className={styles["inline-actions"]}>
              {imageResults(preview)[0] && (
                <>
                  <button
                    onClick={() =>
                      shareItems([preview.id]).catch(() =>
                        setError(text.errors.shareFailed),
                      )
                    }
                  >
                    <ShareIcon />
                    <span>{text.common.share}</span>
                  </button>
                  <button
                    onClick={() =>
                      saveItems([preview.id]).catch(() =>
                        setError(text.errors.saveFailed),
                      )
                    }
                  >
                    <DownloadIcon />
                    <span>{text.image.saveToAlbum}</span>
                  </button>
                  <button onClick={() => reportImageTask(preview)}>
                    <CloudFailIcon />
                    <span>{text.account.aiContentReport}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <ImageTaskActionSheet
        item={imageActionTarget}
        text={text}
        onClose={() => setImageActionTarget(null)}
        onOpen={() => {
          if (!imageActionTarget) return;
          setPreview(imageActionTarget);
          setImageActionTarget(null);
        }}
        onReuse={() => {
          if (imageActionTarget) reuseImageTaskPrompt(imageActionTarget);
        }}
        onRetry={() => {
          if (!imageActionTarget) return;
          retryTask(imageActionTarget);
          setImageActionTarget(null);
        }}
        onReport={() => reportImageTask(imageActionTarget)}
        onDelete={() => {
          if (!imageActionTarget) return;
          void deleteImageTasks([String(imageActionTarget.id)]).then(
            (deleted) => {
              if (deleted) setImageActionTarget(null);
            },
          );
        }}
      />
      <ChoiceSheet
        open={groupSheetOpen}
        title={text.chat.group}
        text={text}
        items={groups.map((group) => ({
          id: String(group.id),
          title: group.name,
          detail: text.modelCount(
            group.models?.filter(isImageModel).length || 0,
          ),
          active: String(group.id) === currentGroupValue,
        }))}
        onClose={() => setGroupSheetOpen(false)}
        onSelect={(id) => {
          switchImageGroup(Number(id));
        }}
      />
      <ChoiceSheet
        open={modelSheetOpen}
        title={text.image.model}
        text={text}
        items={imageModelOptions
          .filter(
            (model) =>
              !references.length ||
              imageModelSupportsReferences(
                model,
                [],
                allowLegacyImageCapabilityFallback,
              ),
          )
          .map((model) => ({
            id: modelValue(model),
            title: modelLabel(model),
            detail: model.use_case || text.image.title,
            active: modelValue(model) === selectedModel,
          }))}
        onClose={() => setModelSheetOpen(false)}
        onSelect={(id) => {
          setModelSheetOpen(false);
          setSelectedModel(id);
        }}
      />
      <ImagePromptLibrarySheet
        open={promptSheetOpen}
        text={text}
        currentModel={selectedModel}
        accountId={activeAccountId}
        backendBaseUrl={managed.backendBaseUrl}
        accessToken={managed.accessToken}
        onClose={() => setPromptSheetOpen(false)}
        onApply={applyPromptTemplate}
        onAdapt={adaptPromptTemplate}
        onCopy={copyPromptTemplate}
      />
      <ChoiceSheet
        open={sizeSheetOpen}
        title={text.image.size}
        text={text}
        items={sizeOptions.map((item) => ({
          id: item.id,
          title: imageSizeLabel(item, text),
          detail: item.id.replace("x", "×"),
          active: item.id === size,
        }))}
        onClose={() => setSizeSheetOpen(false)}
        onSelect={(id) => {
          setSizeSheetOpen(false);
          setSize(id);
        }}
      />
      <ChoiceSheet
        open={qualitySheetOpen}
        title={text.image.quality}
        text={text}
        items={qualityOptions.map((item) => ({
          ...item,
          active: item.id === quality,
        }))}
        onClose={() => setQualitySheetOpen(false)}
        onSelect={(id) => {
          setQualitySheetOpen(false);
          setQuality(id);
        }}
      />
      <ChoiceSheet
        open={styleSheetOpen}
        title={text.image.style}
        text={text}
        items={styleOptions.map((item) => ({
          ...item,
          detail:
            item.id !== "auto" && !imageModelSupportsStyle(selectedModel)
              ? text.image.styleLimited
              : undefined,
          active: item.id === style,
        }))}
        onClose={() => setStyleSheetOpen(false)}
        onSelect={(id) => {
          setStyleSheetOpen(false);
          setStyle(id);
        }}
      />
    </AndroidAppShell>
  );
}

function AndroidGallery() {
  const text = useMobileText();
  const managed = useManagedNextChatStore();
  const sdStore = useSdStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [nativeImages, setNativeImages] = useState<NativeAppImage[]>([]);
  const [unassignedImages, setUnassignedImages] = useState<NativeAppImage[]>(
    [],
  );
  const [selectedUnassignedFileNames, setSelectedUnassignedFileNames] =
    useState<string[]>([]);
  const [unassignedImagesLoading, setUnassignedImagesLoading] = useState(false);
  const [unassignedImagesClaiming, setUnassignedImagesClaiming] =
    useState(false);
  const [localMaterials, setLocalMaterials] = useState<LocalMaterial[]>([]);
  const [localMaterialsLoading, setLocalMaterialsLoading] = useState(false);
  const localMaterialFileRef = useRef<HTMLInputElement | null>(null);
  const [preferences, setPreferences] = useState<GalleryPreferences>(() =>
    readGalleryPreferences(),
  );
  const noticeTimerRef = useRef<number | null>(null);
  const drawGallery = sdStore.draw.filter(
    (item: any) => item.status === "success" && imageResults(item).length > 0,
  );
  const rawGallery = useMemo(
    () => mergeGalleryItems(drawGallery, nativeImages),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sdStore.currentId, sdStore.draw.length, nativeImages],
  );
  const gallery = useMemo(
    () => mergeManualGalleryCollections(rawGallery, preferences),
    [rawGallery, preferences],
  );
  const filteredGallery = useMemo(
    () =>
      gallery.filter((item: any) =>
        galleryItemMatchesFilter(item, filter, preferences),
      ),
    [gallery, filter, preferences],
  );
  const activeAccountId = String(
    managed.user?.id ||
      managed.session?.user_id ||
      managed.workspace?.user?.id ||
      "",
  );

  function showNotice(message: string) {
    setNotice(message);
    setError("");
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 2400);
  }

  async function refreshNativeImages() {
    try {
      setNativeImages(await listAppImages(activeAccountId));
    } catch (err) {
      setError(localizedMobileErrorMessage(err, text.errors.syncFailed));
    }
  }

  async function refreshUnassignedImages(ownerUserId = activeAccountId) {
    const owner = String(ownerUserId || "").trim();
    if (!owner) {
      setUnassignedImages([]);
      setSelectedUnassignedFileNames([]);
      return;
    }
    setUnassignedImagesLoading(true);
    try {
      const items = await listUnassignedAppImages(owner);
      const currentOwner = String(
        useManagedNextChatStore.getState().user?.id ||
          useManagedNextChatStore.getState().session?.user_id ||
          useManagedNextChatStore.getState().workspace?.user?.id ||
          "",
      );
      if (currentOwner !== owner) return;
      setUnassignedImages(items);
      setSelectedUnassignedFileNames((selected) =>
        selected.filter((fileName) =>
          items.some((item) => item.fileName === fileName),
        ),
      );
    } catch (err) {
      setError(
        localizedMobileErrorMessage(err, text.image.legacyMigrationFailed),
      );
    } finally {
      setUnassignedImagesLoading(false);
    }
  }

  async function refreshLocalMaterials() {
    if (!activeAccountId) {
      setLocalMaterials([]);
      return;
    }
    setLocalMaterialsLoading(true);
    try {
      if (managed.accessToken && managed.backendBaseUrl) {
        const synced = await syncLocalMaterials(
          activeAccountId,
          managed.backendBaseUrl,
          managed.accessToken,
        );
        setLocalMaterials(synced.materials);
      } else {
        setLocalMaterials(await listLocalMaterials(activeAccountId));
      }
      setError("");
    } catch {
      setError(text.platform.materialRefreshFailed);
    } finally {
      setLocalMaterialsLoading(false);
    }
  }

  async function importMaterials(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []).slice(0, 8);
    if (!files.length) return;
    if (!activeAccountId) {
      setError(text.errors.loginRequired);
      input.value = "";
      return;
    }
    setLocalMaterialsLoading(true);
    try {
      const imported = await importLocalMaterials(activeAccountId, files);
      setLocalMaterials((items) => [...imported, ...items]);
      // A local import remains available if the network fails, but an online
      // import must also become a server-owned asset. Otherwise it cannot be
      // selected by video jobs, synced to a second device, or removed remotely.
      if (managed.accessToken && managed.backendBaseUrl) {
        const uploadedAssets = await Promise.all(
          files.map((file) => uploadMaterial(file, file.name, "upload")),
        );
        const synced = await syncLocalMaterials(
          activeAccountId,
          managed.backendBaseUrl,
          managed.accessToken,
        );
        // Do not remove the device copy until every upload is visible in the
        // authoritative sync response. A successful upload followed by a
        // transient sync/ETag race must never turn into local data loss.
        const uploadedIDs = uploadedAssets
          .map((asset) => String(asset?.id || "").trim())
          .filter(Boolean);
        const syncedIDs = new Set(
          synced.materials
            .map((material) => String(material.remoteId || "").trim())
            .filter(Boolean),
        );
        if (
          uploadedIDs.length !== files.length ||
          uploadedIDs.some((id) => !syncedIDs.has(id))
        ) {
          throw new Error(text.platform.materialRefreshFailed);
        }
        // The server copy is now cached under its remote ID. Remove only the
        // temporary local import records to avoid showing duplicate material.
        await deleteLocalMaterials(
          activeAccountId,
          imported.map((material) => material.id),
        );
        setLocalMaterials(await listLocalMaterials(activeAccountId));
        if (!synced.materials.length && imported.length) {
          throw new Error(text.platform.materialRefreshFailed);
        }
      }
      showNotice(text.platform.uploadReady);
    } catch {
      setError(text.platform.uploadFailedHint);
    } finally {
      input.value = "";
      setLocalMaterialsLoading(false);
    }
  }

  async function deleteLocalMaterial(material: LocalMaterial) {
    if (!window.confirm(text.platform.deleteAssetConfirm)) return;
    try {
      if (material.remoteId) {
        const client = await mobilePlatformClient();
        await client.assets.delete(material.remoteId, {
          headers: { "X-Request-ID": clientRequestID("mobile-asset-delete") },
        });
      }
      await deleteLocalMaterials(activeAccountId, [material.id]);
      setLocalMaterials((items) =>
        items.filter((item) => item.id !== material.id),
      );
      showNotice(text.platform.assetDeleted);
    } catch {
      setError(text.platform.materialRefreshFailed);
    }
  }

  async function reuseLocalMaterial(
    material: LocalMaterial,
    target: "chat" | "image",
  ) {
    try {
      if (target === "image" && material.kind !== "image") {
        throw new Error(text.platform.materialRefreshFailed);
      }
      if (target === "chat" && !["image", "text"].includes(material.kind)) {
        throw new Error(text.platform.localFileUnsupported);
      }
      const materialDataUrl =
        material.kind === "image"
          ? await readLocalMaterialDataUrl(activeAccountId, material.id)
          : "";
      let materialText = "";
      if (material.kind === "text") {
        const blob = await readLocalMaterialBlob(activeAccountId, material.id);
        if (!blob) throw new Error(text.platform.materialRefreshFailed);
        materialText = await blobToText(blob);
      }
      navigate(target === "chat" ? Path.Chat : Path.Sd, {
        state: {
          materialDataUrl,
          materialName: material.name,
          materialText,
          materialLocal: material,
        },
      });
    } catch (reuseError) {
      setError(
        localizedMobileErrorMessage(
          reuseError,
          text.platform.materialRefreshFailed,
        ),
      );
    }
  }

  useEffect(() => {
    refreshNativeImages().catch(() => {});
    refreshLocalMaterials().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdStore.currentId, activeAccountId]);

  useEffect(() => {
    void refreshUnassignedImages(activeAccountId);
    // The native request itself is scoped to this account and stale results are
    // discarded before rendering after an account change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  function toggleSelected(id: string) {
    setSelectedIds((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  }

  function toggleUnassignedImage(fileName: string) {
    setSelectedUnassignedFileNames((items) =>
      items.includes(fileName)
        ? items.filter((item) => item !== fileName)
        : [...items, fileName],
    );
  }

  async function claimSelectedUnassignedImages() {
    const fileNames = selectedUnassignedFileNames.filter((fileName) =>
      unassignedImages.some((item) => item.fileName === fileName),
    );
    if (!fileNames.length || !activeAccountId) return;
    if (!window.confirm(text.image.legacyMigrationConfirm(fileNames.length))) {
      return;
    }
    setUnassignedImagesClaiming(true);
    setError("");
    try {
      const result = await claimUnassignedAppImages(fileNames, activeAccountId);
      const claimed = Number(result.claimed ?? result.items?.length ?? 0);
      if (claimed <= 0) {
        throw new Error(text.image.legacyMigrationFailed);
      }
      setSelectedUnassignedFileNames([]);
      await Promise.all([refreshNativeImages(), refreshUnassignedImages()]);
      showNotice(text.image.legacyMigrationDone(claimed));
    } catch (err) {
      setError(
        localizedMobileErrorMessage(err, text.image.legacyMigrationFailed),
      );
    } finally {
      setUnassignedImagesClaiming(false);
    }
  }

  async function deleteItems(ids: string[]) {
    if (!ids.length) return;
    if (!window.confirm(text.image.deleteConfirm)) return;
    setError("");
    try {
      const items = gallery.filter((item: any) => ids.includes(item.id));
      const sourceIds = new Set(
        items.flatMap((item: any) => item.memberIds || [item.id]),
      );
      const removedUrls = items.flatMap(imageResults);
      const localFileNames = items.flatMap(imageLocalFileNames);
      if (localFileNames.length) {
        await deleteAppImages(localFileNames, activeAccountId);
      }
      await Promise.allSettled(
        removedUrls
          .filter((url: string) => url.startsWith("/api/cache"))
          .map((url: string) => removeImage(url)),
      );
      sdStore.update((state) => {
        state.draw = state.draw.filter((item: any) => !sourceIds.has(item.id));
        state.currentId += 1;
      });
      setNativeImages((items) =>
        items.filter((item) => !localFileNames.includes(item.fileName)),
      );
      setSelectedIds([]);
      setSelectionMode(false);
      setPreview(null);
      showNotice(text.common.done);
    } catch (err) {
      setError(localizedMobileErrorMessage(err, text.errors.saveFailed));
    }
  }

  async function saveItems(ids: string[]) {
    const items = gallery.filter((item: any) => ids.includes(item.id));
    let savedCount = 0;
    for (const item of items) {
      const urls = imageResults(item);
      for (let index = 0; index < urls.length; index += 1) {
        await saveImageToGallery(
          urls[index],
          makeImageFileName(text.image.filePrefix, item.id, index),
        );
        savedCount += 1;
      }
    }
    showNotice(text.image.savedToAlbumCount(savedCount));
    await showNativeNotification(text.image.title, text.image.savedToAlbum);
  }

  async function shareItems(ids: string[]) {
    const selected = gallery.filter((item: any) => ids.includes(item.id));
    const images = selected.flatMap((item: any) =>
      imageResults(item).map((url: string, index: number) => ({
        url,
        fileName: makeImageFileName(text.image.filePrefix, item.id, index),
      })),
    );
    if (!images.length) return;
    const shareTextValue = selected[0]?.params?.prompt;
    if (images.length === 1) {
      await shareImage(images[0].url, images[0].fileName, shareTextValue);
      return;
    }
    await shareImages(images, shareTextValue);
  }

  function updateGalleryPreferences(
    ids: string[],
    updater: (current: GalleryPreference) => GalleryPreference,
  ) {
    if (!ids.length) return;
    setPreferences((current) => {
      const next = { ...current };
      gallery
        .filter((item: any) => ids.includes(item.id))
        .forEach((item: any) => {
          galleryItemPreferenceKeys(item).forEach((key: string) => {
            const updated = updater(next[key] || {});
            next[key] = { ...updated, updatedAt: Date.now() };
            if (
              !next[key].favorite &&
              !next[key].category &&
              !next[key].collectionId
            ) {
              delete next[key];
            }
          });
        });
      writeGalleryPreferences(next);
      return next;
    });
  }

  function toggleFavorite(item: any) {
    const active = Boolean(galleryItemPreference(item, preferences).favorite);
    updateGalleryPreferences([item.id], (current) => ({
      ...current,
      favorite: !active,
    }));
    showNotice(active ? text.image.favoriteRemoved : text.image.favoriteSaved);
  }

  function markCategory(ids: string[], category: GalleryCategory) {
    updateGalleryPreferences(ids, (current) => ({
      ...current,
      category,
    }));
    showNotice(text.image.categoryUpdated);
  }

  function createManualCollection() {
    if (selectedIds.length < 2) return;
    const name = window.prompt(text.image.collectionNamePrompt)?.trim();
    if (!name) return;
    const collectionId = clientRequestID("gallery-collection");
    updateGalleryPreferences(selectedIds, (current) => ({
      ...current,
      collectionId,
      collectionName: name,
    }));
    setSelectedIds([]);
    setSelectionMode(false);
    showNotice(text.image.collectionCreated);
  }

  function removeManualCollection(item: any) {
    if (!item?.manualCollectionId) return;
    updateGalleryPreferences([item.id], (current) => ({
      ...current,
      collectionId: "",
      collectionName: "",
    }));
    showNotice(text.image.collectionRemoved);
  }

  useNativeBackHandler(true, () => {
    if (originalUrl) {
      setOriginalUrl("");
      return;
    }
    if (preview) {
      setPreview(null);
      return;
    }
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedIds([]);
      return;
    }
    handleNativeHomeBack(text);
  });

  return (
    <AndroidAppShell active="projects" text={text}>
      <header className={styles["app-header"]}>
        <div>
          <span>{text.image.referenceHint}</span>
          <h1>{text.image.gallery}</h1>
        </div>
        <IconButton
          label={text.image.generate}
          onClick={() => navigate(Path.Sd)}
        >
          <AddIcon />
        </IconButton>
      </header>

      <section className={styles["gallery-status-card"]}>
        <div>
          <strong>JisudengChat</strong>
          <span>{text.image.localGalleryHint}</span>
        </div>
        <em>{text.shortCount(gallery.length + localMaterials.length)}</em>
      </section>

      {activeAccountId && unassignedImages.length > 0 && (
        <section
          className={clsx(styles["section"], styles["legacy-image-migration"])}
          aria-label="legacy-image-migration"
        >
          <div className={styles["section-head"]}>
            <div>
              <h2>{text.image.legacyMigrationTitle}</h2>
              <span>
                {text.image.legacyMigrationHint(unassignedImages.length)}
              </span>
            </div>
          </div>
          <div className={styles["legacy-image-actions"]}>
            <button
              type="button"
              disabled={unassignedImagesLoading || unassignedImagesClaiming}
              onClick={() =>
                setSelectedUnassignedFileNames(
                  unassignedImages.map((item) => item.fileName),
                )
              }
            >
              {text.image.legacyMigrationSelectAll}
            </button>
            <button
              type="button"
              disabled={
                unassignedImagesLoading ||
                unassignedImagesClaiming ||
                !selectedUnassignedFileNames.length
              }
              onClick={() => setSelectedUnassignedFileNames([])}
            >
              {text.image.legacyMigrationClear}
            </button>
            <button
              type="button"
              disabled={
                unassignedImagesLoading ||
                unassignedImagesClaiming ||
                !selectedUnassignedFileNames.length
              }
              onClick={claimSelectedUnassignedImages}
            >
              {text.image.legacyMigrationClaim(
                selectedUnassignedFileNames.length,
              )}
            </button>
          </div>
          <div className={styles["legacy-image-list"]}>
            {unassignedImages.map((image, index) => {
              const selected = selectedUnassignedFileNames.includes(
                image.fileName,
              );
              return (
                <label
                  key={image.fileName}
                  className={clsx(styles["legacy-image-item"], {
                    [styles["selected"]]: selected,
                  })}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={
                      unassignedImagesLoading || unassignedImagesClaiming
                    }
                    onChange={() => toggleUnassignedImage(image.fileName)}
                    aria-label={`legacy-image-item-${index + 1}`}
                  />
                  <img
                    src={image.localUrl}
                    alt={image.label || image.fileName}
                  />
                </label>
              );
            })}
          </div>
        </section>
      )}

      <section className={styles["section"]}>
        <div className={styles["section-head"]}>
          <div>
            <h2>{text.platform.materials}</h2>
            <span>{text.platform.materialHint}</span>
          </div>
          <button
            onClick={() => localMaterialFileRef.current?.click()}
            disabled={localMaterialsLoading}
          >
            {text.platform.uploadMaterial}
          </button>
          <input
            ref={localMaterialFileRef}
            hidden
            multiple
            type="file"
            accept="image/*,audio/*,video/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={importMaterials}
          />
        </div>
        {!localMaterialsLoading && localMaterials.length === 0 && (
          <p className={styles["empty-copy"]}>{text.platform.materialEmpty}</p>
        )}
        <div className={styles["cloud-asset-list"]}>
          {localMaterials.map((material) => {
            return (
              <article key={material.id}>
                <i>
                  <UploadIcon />
                </i>
                <span>
                  <strong>{material.name}</strong>
                  <small>{formatDateTime(material.createdAt, text)}</small>
                </span>
                <div>
                  <button
                    disabled={
                      material.kind !== "image" && material.kind !== "text"
                    }
                    onClick={() => reuseLocalMaterial(material, "chat")}
                  >
                    {text.platform.addToChat}
                  </button>
                  {material.kind === "image" && (
                    <button
                      onClick={() => reuseLocalMaterial(material, "image")}
                    >
                      {text.platform.addToImage}
                    </button>
                  )}
                  <button
                    className={styles["danger-inline"]}
                    onClick={() => deleteLocalMaterial(material)}
                  >
                    <DeleteIcon />
                    <span>{text.common.delete}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className={styles["conversation-filters"]}>
        {(
          [
            ["all", text.common.all],
            ["favorites", text.image.favorites],
            ["products", text.image.products],
            ["posters", text.image.posters],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={clsx({ [styles["active"]]: filter === id })}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className={styles["section"]}>
        <div className={styles["section-head"]}>
          <h2>{text.image.gallery}</h2>
          <button
            onClick={() => {
              setSelectionMode((value) => !value);
              setSelectedIds([]);
            }}
          >
            {selectionMode ? text.common.done : text.image.batchManage}
          </button>
        </div>
        {selectionMode && (
          <div className={styles["gallery-actions"]}>
            <button
              onClick={() => deleteItems(selectedIds)}
              disabled={!selectedIds.length}
            >
              <DeleteIcon />
              <span>{text.image.deleteSelected}</span>
            </button>
            <button
              onClick={() => shareItems(selectedIds)}
              disabled={!selectedIds.length}
            >
              <ShareIcon />
              <span>{text.image.shareSelected}</span>
            </button>
            <button
              onClick={() => saveItems(selectedIds)}
              disabled={!selectedIds.length}
            >
              <DownloadIcon />
              <span>{text.image.saveSelected}</span>
            </button>
            <button
              onClick={() => {
                updateGalleryPreferences(selectedIds, (current) => ({
                  ...current,
                  favorite: true,
                }));
                showNotice(text.image.favoriteSaved);
              }}
              disabled={!selectedIds.length}
            >
              <FavoriteIcon />
              <span>{text.image.favoriteImage}</span>
            </button>
            <button
              onClick={() => markCategory(selectedIds, "products")}
              disabled={!selectedIds.length}
            >
              <ImageIcon />
              <span>{text.image.productTag}</span>
            </button>
            <button
              onClick={() => markCategory(selectedIds, "posters")}
              disabled={!selectedIds.length}
            >
              <MaxIcon />
              <span>{text.image.posterTag}</span>
            </button>
            <button
              onClick={createManualCollection}
              disabled={selectedIds.length < 2}
            >
              <CopyIcon />
              <span>{text.image.createCollection}</span>
            </button>
          </div>
        )}
        <div
          className={styles["local-gallery"]}
          aria-label={`local-gallery-count-${gallery.length}`}
        >
          {gallery.length === 0 && (
            <p className={styles["empty-copy"]}>{text.image.noGallery}</p>
          )}
          {gallery.length > 0 && filteredGallery.length === 0 && (
            <p className={styles["empty-copy"]}>
              {text.image.noFilteredGallery}
            </p>
          )}
          {filteredGallery.map((item: any, index: number) => {
            const preference = galleryItemPreference(item, preferences);
            return (
              <button
                key={item.id}
                aria-label={`local-gallery-item-${index + 1}`}
                className={clsx({
                  [styles["selected"]]: selectedIds.includes(item.id),
                  [styles["tall"]]: index % 3 === 0,
                })}
                onClick={() =>
                  selectionMode ? toggleSelected(item.id) : setPreview(item)
                }
              >
                <img
                  src={imageResults(item)[0]}
                  alt={item.params?.prompt || item.id}
                />
                {imageResults(item).length > 1 && (
                  <small>{text.photoCount(imageResults(item).length)}</small>
                )}
                {(preference.favorite || preference.category) && (
                  <span className={styles["gallery-badges"]}>
                    {preference.favorite && <FavoriteIcon />}
                    {preference.category === "products" &&
                      text.image.productTag}
                    {preference.category === "posters" && text.image.posterTag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {notice && <div className={styles["app-toast"]}>{notice}</div>}
      {error && <div className={styles["form-error"]}>{error}</div>}

      {preview && (
        <div
          className={styles["image-preview"]}
          onClick={() => setPreview(null)}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <div className={styles["preview-head"]}>
              <strong>{preview.model_name || preview.model}</strong>
              <IconButton
                label={text.common.close}
                onClick={() => setPreview(null)}
              >
                <CloseIcon />
              </IconButton>
            </div>
            <div className={styles["preview-images"]}>
              {imageResults(preview).map((url, index) => (
                <img
                  key={url}
                  src={url}
                  alt={`${preview.params?.prompt || preview.id}-${index}`}
                />
              ))}
            </div>
            <p>{preview.params?.prompt || preview.error}</p>
            <div className={styles["gallery-tag-row"]}>
              <button
                className={clsx({
                  [styles["active"]]: galleryItemPreference(
                    preview,
                    preferences,
                  ).favorite,
                })}
                onClick={() => toggleFavorite(preview)}
              >
                <FavoriteIcon />
                <span>
                  {galleryItemPreference(preview, preferences).favorite
                    ? text.image.unfavoriteImage
                    : text.image.favoriteImage}
                </span>
              </button>
              <button
                className={clsx({
                  [styles["active"]]:
                    galleryItemPreference(preview, preferences).category ===
                    "products",
                })}
                onClick={() => markCategory([preview.id], "products")}
              >
                <ImageIcon />
                <span>{text.image.markProduct}</span>
              </button>
              <button
                className={clsx({
                  [styles["active"]]:
                    galleryItemPreference(preview, preferences).category ===
                    "posters",
                })}
                onClick={() => markCategory([preview.id], "posters")}
              >
                <MaxIcon />
                <span>{text.image.markPoster}</span>
              </button>
              {galleryItemPreference(preview, preferences).category && (
                <button onClick={() => markCategory([preview.id], "")}>
                  <CloseIcon />
                  <span>{text.image.clearTag}</span>
                </button>
              )}
              {preview.manualCollectionId && (
                <button onClick={() => removeManualCollection(preview)}>
                  <CloseIcon />
                  <span>{text.image.removeCollection}</span>
                </button>
              )}
            </div>
            <div className={styles["inline-actions"]}>
              <button
                onClick={() => setOriginalUrl(imageResults(preview)[0] || "")}
              >
                <ImageIcon />
                <span>{text.image.viewOriginal}</span>
              </button>
              <button
                onClick={() =>
                  shareItems([preview.id]).catch(() =>
                    setError(text.errors.shareFailed),
                  )
                }
              >
                <ShareIcon />
                <span>{text.common.share}</span>
              </button>
              <button
                onClick={() =>
                  saveItems([preview.id]).catch(() =>
                    setError(text.errors.saveFailed),
                  )
                }
              >
                <DownloadIcon />
                <span>{text.image.saveToAlbum}</span>
              </button>
              <button
                className={styles["danger-inline"]}
                onClick={() =>
                  deleteItems([preview.id]).catch(() =>
                    setError(text.errors.saveFailed),
                  )
                }
              >
                <DeleteIcon />
                <span>{text.common.delete}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {originalUrl && (
        <div
          className={clsx(styles["image-preview"], styles["original-viewer"])}
          onClick={() => setOriginalUrl("")}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <div className={styles["preview-head"]}>
              <strong>{text.image.viewOriginal}</strong>
              <IconButton
                label={text.common.close}
                onClick={() => setOriginalUrl("")}
              >
                <CloseIcon />
              </IconButton>
            </div>
            <div className={styles["preview-images"]}>
              <img src={originalUrl} alt={text.image.viewOriginal} />
            </div>
            <div className={styles["inline-actions"]}>
              <button
                onClick={() =>
                  saveImageToGallery(
                    originalUrl,
                    makeImageFileName(text.image.filePrefix, "original", 0),
                  )
                    .then(() => {
                      showNotice(text.image.originalSaved);
                      return showNativeNotification(
                        text.image.title,
                        text.image.savedToAlbum,
                      );
                    })
                    .catch(() => setError(text.errors.saveFailed))
                }
              >
                <DownloadIcon />
                <span>{text.image.saveToAlbum}</span>
              </button>
              <button
                onClick={() =>
                  shareImage(
                    originalUrl,
                    makeImageFileName(text.image.filePrefix, "original", 0),
                  ).catch(() => setError(text.errors.shareFailed))
                }
              >
                <ShareIcon />
                <span>{text.common.share}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AndroidAppShell>
  );
}

function arrayPayload(value: any) {
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value)) return value;
  return [];
}

function orderPrimaryId(order: any) {
  return String(order?.id || order?.order_id || order?.out_trade_no || "");
}

function transactionPrimaryId(item: any) {
  return String(
    item?.id ||
      item?.transaction_id ||
      item?.log_id ||
      `${item?.created_at || item?.createdAt || ""}-${
        item?.balance_delta || item?.balanceDelta || item?.amount || ""
      }`,
  );
}

function localizedSubscriptionStatus(status: string, text: ManagedMobileText) {
  const key = String(status || "")
    .trim()
    .toLowerCase();
  const labelsByLocale: Record<ManagedMobileLocale, Record<string, string>> = {
    cn: {
      active: "生效中",
      pending: "待生效",
      queued: "待生效",
      exhausted: "额度已用完",
      expired: "已过期",
      suspended: "已暂停",
      revoked: "已撤销",
      cancelled: "已取消",
      canceled: "已取消",
    },
    en: {
      active: "Active",
      pending: "Pending activation",
      queued: "Queued",
      exhausted: "Quota exhausted",
      expired: "Expired",
      suspended: "Suspended",
      revoked: "Revoked",
      cancelled: "Cancelled",
      canceled: "Cancelled",
    },
    jp: {
      active: "有効",
      pending: "有効化待ち",
      queued: "待機中",
      exhausted: "枠を使い切りました",
      expired: "期限切れ",
      suspended: "一時停止",
      revoked: "取り消し済み",
      cancelled: "キャンセル済み",
      canceled: "キャンセル済み",
    },
    ko: {
      active: "활성",
      pending: "활성 대기",
      queued: "대기 중",
      exhausted: "한도 소진",
      expired: "만료됨",
      suspended: "일시 중지",
      revoked: "철회됨",
      cancelled: "취소됨",
      canceled: "취소됨",
    },
  };
  const locale = mobileTextLocale(text);
  const labels = labelsByLocale[locale] || labelsByLocale.en;
  const fallback = localizedValue(
    {
      cn: "状态未知",
      en: "Status unavailable",
      jp: "状態不明",
      ko: "상태 알 수 없음",
    },
    text,
  );
  return labels[key] || fallback;
}

function SubscriptionUsageRows(props: {
  subscription: any;
  text: ManagedMobileText;
}) {
  const periods = subscriptionUsagePeriods(
    props.subscription,
    props.text.account,
  );
  if (!periods.length) {
    return (
      <small className={styles["usage-unlimited"]}>
        {props.text.account.unlimitedUsage}
      </small>
    );
  }
  return (
    <div className={styles["subscription-usage-list"]}>
      {periods.map((period) => {
        const progress = Math.min(100, (period.used / period.limit) * 100);
        return (
          <div key={period.label} className={styles["subscription-usage"]}>
            <span>{period.label}</span>
            <strong>{`${formatUsageUSD(period.used)} / ${formatUsageUSD(
              period.limit,
            )}`}</strong>
            <progress value={progress} max={100} />
            <small>{`${props.text.account.remaining} ${formatUsageUSD(
              period.remaining,
            )}`}</small>
          </div>
        );
      })}
    </div>
  );
}

function formatQuota(value: number | undefined, unit: string | undefined) {
  if (!Number.isFinite(Number(value))) return "";
  const normalized = String(unit || "").toLowerCase();
  if (/cny|rmb|balance|money|¥/.test(normalized)) return formatMoney(value);
  if (/usd|\$/.test(normalized)) return formatUsageUSD(Number(value));
  return [Number(value).toLocaleString(), unit || ""].filter(Boolean).join(" ");
}

function paymentMethodsFromCheckout(checkout?: CheckoutInfo) {
  return Object.entries(checkout?.methods || {})
    .map(([key, value]) => ({
      ...value,
      payment_type: value.payment_type || key,
    }))
    .filter((method) => method.available !== false);
}

function isWechatPaymentMethod(method: CheckoutMethod) {
  const searchable = [
    method.payment_type,
    method.display_name,
    method.display_name_zh,
    method.display_name_en,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(^|[_\s-])wx(pay)?($|[_\s-])|wechat|weixin|微信/.test(searchable);
}

function directActualPaymentMethodsFromCheckout(checkout?: CheckoutInfo) {
  return paymentMethodsFromCheckout(checkout).filter(
    (method) => !isWechatPaymentMethod(method),
  );
}

function hasWechatPaymentMethod(checkout?: CheckoutInfo) {
  return paymentMethodsFromCheckout(checkout).some(isWechatPaymentMethod);
}

function mobileDisplayLocale(text: ManagedMobileText) {
  return mobileTextLocale(text);
}

function localizedApiField(
  value: Record<string, unknown> | null | undefined,
  text: ManagedMobileText,
  defaultFields: string[],
  fallback = "",
) {
  return localizedMobileDisplay(value as any, {
    locale: mobileDisplayLocale(text),
    defaultFields,
    fallback,
  });
}

function couponDisplayName(coupon: UserCoupon, text: ManagedMobileText) {
  return (
    localizedApiField(coupon as Record<string, unknown>, text, [
      "template_name",
      "name",
    ]) || `#${coupon.id}`
  );
}

function planDisplayName(
  plan: Record<string, unknown>,
  text: ManagedMobileText,
) {
  return localizedApiField(plan, text, ["product_name", "name"]);
}

type PlayBillingOrderType = "balance" | "subscription";

type PlayBillingCandidate = {
  productId: string;
  productType: NativePlayBillingProductType;
  title: string;
  description?: string;
  formattedPrice?: string;
  amount?: number;
  planId?: number | string;
  orderType: PlayBillingOrderType;
  offerToken?: string;
};

function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(
  record: Record<string, unknown>,
  fields: string[],
): string {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return "";
}

function numberField(
  record: Record<string, unknown>,
  fields: string[],
): number | undefined {
  for (const field of fields) {
    const value = record[field];
    const numberValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return undefined;
}

function normalizePlayBillingProductType(
  value: unknown,
  fallback: NativePlayBillingProductType,
): NativePlayBillingProductType {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (/^subs|subscription/.test(normalized)) return "subs";
  if (/^inapp|one[-_\s]?time|consumable|managed/.test(normalized))
    return "inapp";
  return fallback;
}

function normalizePlayBillingOrderType(
  value: unknown,
  fallback: PlayBillingOrderType,
): PlayBillingOrderType {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (/sub|plan|package|member|权益|套餐/.test(normalized))
    return "subscription";
  if (/balance|recharge|top[_-\s]?up|credit|wallet|充值|余额/.test(normalized))
    return "balance";
  return fallback;
}

function playBillingProductId(record: Record<string, unknown>) {
  return stringField(record, [
    "google_play_product_id",
    "googlePlayProductId",
    "play_billing_product_id",
    "playBillingProductId",
    "play_product_id",
    "playProductId",
    "android_product_id",
    "androidProductId",
    "product_id",
    "sku",
  ]);
}

function playBillingCandidateFromRecord(
  rawRecord: unknown,
  text: ManagedMobileText,
  fallback: {
    orderType: PlayBillingOrderType;
    productType: NativePlayBillingProductType;
  },
): PlayBillingCandidate | null {
  const record = asPlainRecord(rawRecord);
  const productId = playBillingProductId(record);
  if (!productId) return null;
  const orderType = normalizePlayBillingOrderType(
    record.order_type ?? record.orderType ?? record.kind ?? record.type,
    fallback.orderType,
  );
  const productType = normalizePlayBillingProductType(
    record.play_billing_product_type ??
      record.google_play_product_type ??
      record.android_product_type ??
      record.billing_product_type ??
      record.playBillingProductType ??
      record.googlePlayProductType ??
      record.androidProductType ??
      record.billingProductType ??
      record.product_type ??
      record.productType,
    fallback.productType,
  );
  const amount = numberField(record, [
    "amount",
    "price",
    "pay_amount",
    "value",
    "balance",
  ]);
  const title =
    localizedApiField(record, text, [
      "title",
      "name",
      "display_name",
      "product_name",
    ]) ||
    stringField(record, ["title", "name", "display_name", "product_name"]) ||
    productId;
  const formattedPrice =
    stringField(record, [
      "formatted_price",
      "formattedPrice",
      "price_text",
      "display_price",
    ]) || (amount !== undefined ? formatMoney(amount) : "");
  return {
    productId,
    productType,
    title,
    description:
      localizedApiField(record, text, ["description", "summary", "subtitle"]) ||
      stringField(record, ["description", "summary", "subtitle"]),
    formattedPrice,
    amount,
    planId: stringField(record, ["plan_id", "planId", "id"]),
    orderType,
    offerToken: stringField(record, [
      "offer_token",
      "offerToken",
      "base_plan_offer_token",
      "basePlanOfferToken",
    ]),
  };
}

function playBillingCandidateKey(candidate: PlayBillingCandidate) {
  return [
    candidate.orderType,
    candidate.productType,
    candidate.productId,
    candidate.planId || "",
  ].join(":");
}

function dedupePlayBillingCandidates(candidates: PlayBillingCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = playBillingCandidateKey(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function playBillingCandidatesForOrder(
  checkout: CheckoutInfo | undefined,
  accountData: AccountData,
  text: ManagedMobileText,
  orderType: PlayBillingOrderType,
) {
  const records: PlayBillingCandidate[] = [];
  const checkoutRecord = asPlainRecord(checkout);
  const productFields = [
    "play_billing_products",
    "playBillingProducts",
    "google_play_products",
    "googlePlayProducts",
    "android_products",
    "androidProducts",
    "recharge_play_billing_products",
    "rechargePlayBillingProducts",
    "balance_play_billing_products",
    "balancePlayBillingProducts",
    "subscription_play_billing_products",
    "subscriptionPlayBillingProducts",
  ];
  productFields.forEach((field) => {
    arrayPayload(checkoutRecord[field]).forEach((item: unknown) => {
      const fallbackOrderType: PlayBillingOrderType =
        /subscription|plan|package/i.test(field) ? "subscription" : "balance";
      const candidate = playBillingCandidateFromRecord(item, text, {
        orderType: fallbackOrderType,
        productType: "inapp",
      });
      if (candidate) records.push(candidate);
    });
  });
  const plans = [
    ...arrayPayload(checkout?.plans),
    ...arrayPayload(accountData.plans),
  ];
  plans.forEach((plan) => {
    const candidate = playBillingCandidateFromRecord(plan, text, {
      orderType: "subscription",
      productType: "inapp",
    });
    if (candidate) {
      records.push({
        ...candidate,
        title: planDisplayName(asPlainRecord(plan), text) || candidate.title,
        orderType: "subscription",
        productType: candidate.productType || "inapp",
      });
    }
  });
  return dedupePlayBillingCandidates(
    records.filter((candidate) => candidate.orderType === orderType),
  );
}

function planDescription(
  plan: Record<string, unknown>,
  text: ManagedMobileText,
) {
  return localizedMobileDisplay(plan as any, {
    kind: "description",
    locale: mobileDisplayLocale(text),
    defaultFields: ["description", "group_name", "target_group_name"],
  });
}

function planValidityLabel(
  plan: Record<string, unknown>,
  text: ManagedMobileText,
) {
  const localized = localizedApiField(plan, text, [
    "duration",
    "validity",
    "duration_label",
    "validity_label",
  ]);
  if (localized) return localized;
  const days = Number(plan.validity_days);
  return Number.isFinite(days) && days > 0
    ? text.account.validityDays(days)
    : "";
}

function localizedPlanFeature(feature: unknown, text: ManagedMobileText) {
  if (typeof feature === "string") return feature;
  if (feature && typeof feature === "object") {
    return localizedApiField(feature as Record<string, unknown>, text, [
      "label",
      "name",
      "title",
      "description",
    ]);
  }
  return "";
}

function paymentMethodLabel(method: CheckoutMethod, text: ManagedMobileText) {
  const localizedName = localizedApiField(
    method as Record<string, unknown>,
    text,
    ["display_name"],
  );
  if (localizedName) return localizedName;
  const key = (method.payment_type || "").toLowerCase();
  const labelsByLocale: Record<ManagedMobileLocale, Record<string, string>> = {
    cn: {
      alipay: "支付宝",
      wxpay: "微信支付",
      wxpay_direct: "微信支付",
      stripe: "银行卡",
      airwallex: "国际支付",
      easypay: "快捷支付",
      usdt: "USDT 支付",
      usdt_trc20: "USDT TRC20",
      "usdt.trc20": "USDT TRC20",
      bepusdt: "USDT 支付",
      epusdt: "USDT 支付",
      ldc: "USDT 支付",
      paynow: "PayNow",
    },
    en: {
      alipay: "Alipay",
      wxpay: "WeChat Pay",
      wxpay_direct: "WeChat Pay",
      stripe: "Card",
      airwallex: "Airwallex",
      easypay: "EasyPay",
      usdt: "USDT",
      usdt_trc20: "USDT TRC20",
      "usdt.trc20": "USDT TRC20",
      bepusdt: "USDT",
      epusdt: "USDT",
      ldc: "USDT",
      paynow: "PayNow",
    },
    jp: {
      alipay: "Alipay",
      wxpay: "WeChat Pay",
      wxpay_direct: "WeChat Pay",
      stripe: "カード",
      airwallex: "国際決済",
      easypay: "EasyPay",
      usdt: "USDT",
      usdt_trc20: "USDT TRC20",
      "usdt.trc20": "USDT TRC20",
      bepusdt: "USDT",
      epusdt: "USDT",
      ldc: "USDT",
      paynow: "PayNow",
    },
    ko: {
      alipay: "Alipay",
      wxpay: "WeChat Pay",
      wxpay_direct: "WeChat Pay",
      stripe: "카드",
      airwallex: "국제 결제",
      easypay: "EasyPay",
      usdt: "USDT",
      usdt_trc20: "USDT TRC20",
      "usdt.trc20": "USDT TRC20",
      bepusdt: "USDT",
      epusdt: "USDT",
      ldc: "USDT",
      paynow: "PayNow",
    },
  };
  const labels = labelsByLocale[mobileTextLocale(text)] || labelsByLocale.en;
  return labels[key] || method.payment_type || text.account.paymentMethod;
}

function DirectWechatReplacementPaymentButton(props: {
  text: ManagedMobileText;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={styles["primary-payment-action"]}
      data-distribution-commerce="direct-wechat-replaced-code-shop"
      onClick={props.onOpen}
    >
      <strong>{props.text.account.directWechatReplacementTitle}</strong>
      <small>{props.text.account.directWechatReplacementHint}</small>
      <em>{props.text.account.directCodeShopAction}</em>
    </button>
  );
}

function isPendingOrderStatus(status?: string) {
  if (!status) return true;
  return /pending|created|unpaid|waiting|processing/i.test(status || "");
}

function paymentOrderFailureReason(order?: PaymentOrderCreateResult | null) {
  return (
    order?.failed_reason ||
    order?.failure_reason ||
    order?.error ||
    order?.message ||
    ""
  );
}

function firstPaymentField(
  order: PaymentOrderCreateResult | null | undefined,
  fields: Array<keyof PaymentOrderCreateResult>,
) {
  for (const field of fields) {
    const value = order?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function primaryPaymentUrl(order?: PaymentOrderCreateResult | null) {
  return firstPaymentField(order, [
    "deeplink",
    "deep_link",
    "scheme_url",
    "app_url",
    "mweb_url",
    "h5_url",
    "payment_url",
    "checkout_url",
    "pay_url",
    "url",
  ]);
}

function displayPaymentUrl(order?: PaymentOrderCreateResult | null) {
  return firstPaymentField(order, [
    "pay_url",
    "payment_url",
    "checkout_url",
    "h5_url",
    "mweb_url",
    "url",
  ]);
}

function paymentQrCode(order?: PaymentOrderCreateResult | null) {
  return firstPaymentField(order, ["qr_code", "code_url"]);
}

function navigateBack(
  navigate: ReturnType<typeof useNavigate>,
  fallback: Path,
) {
  if (window.history.length > 1) {
    navigate(-1);
    return;
  }
  navigate(fallback);
}

function AndroidDetailShell(props: {
  title: string;
  subtitle?: string;
  text: ManagedMobileText;
  fallback?: Path;
  onBack?: () => void;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  useNativeDocumentScroll();
  useNativeBackHandler(true, () => {
    if (props.onBack) {
      props.onBack();
      return;
    }
    navigateBack(navigate, props.fallback || Path.Settings);
  });
  return (
    <main className={clsx(styles["mobile-app"], styles["native-page"])}>
      <section className={styles["app-shell"]}>
        <div className={clsx(styles["app-scroll"], styles["detail-scroll"])}>
          <header
            className={clsx(styles["app-header"], styles["detail-header"])}
          >
            <IconButton
              label={props.text.common.back}
              onClick={() =>
                props.onBack
                  ? props.onBack()
                  : navigateBack(navigate, props.fallback || Path.Settings)
              }
            >
              <LeftIcon />
            </IconButton>
            <div>
              <span>{props.subtitle || "JisudengChat"}</span>
              <h1>{props.title}</h1>
            </div>
            {props.onRefresh ? (
              <IconButton
                label={props.text.common.refresh}
                onClick={props.onRefresh}
              >
                <ReloadIcon />
              </IconButton>
            ) : (
              <span className={styles["header-spacer"]} aria-hidden="true" />
            )}
          </header>
          {props.children}
        </div>
      </section>
    </main>
  );
}

function AccountMenuItem(props: {
  icon: ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button className={styles["account-menu-item"]} onClick={props.onClick}>
      <i>{props.icon}</i>
      <span>
        <strong>{props.title}</strong>
        <small>{props.detail}</small>
      </span>
      <em>›</em>
    </button>
  );
}

function ConfirmSheet(props: {
  open: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!props.open) return null;
  return (
    <div
      className={styles["sheet-mask"]}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-sheet-title"
      onClick={props.onClose}
    >
      <div
        className={styles["confirm-dialog"]}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-sheet-title">{props.title}</h2>
        <p>{props.body}</p>
        <div className={styles["dialog-actions"]}>
          <button onClick={props.onClose}>{props.cancelLabel}</button>
          <button
            className={clsx({ [styles["danger-inline"]]: props.danger })}
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AndroidSystemSettings() {
  const text = useMobileText();
  const navigate = useNavigate();
  const installedRelease = useInstalledAndroidReleaseVersion();
  const currentVersion = formatAndroidReleaseVersion(
    installedRelease,
    text.account.unknownVersion,
  );

  return (
    <AndroidDetailShell
      title={text.account.systemSettings}
      subtitle={text.account.systemSettingsHint}
      text={text}
      fallback={Path.Settings}
    >
      <section className={styles["account-menu-group"]}>
        <div className={styles["account-menu-list"]}>
          <AccountMenuItem
            icon={<PaletteIcon />}
            title={text.account.appearance}
            detail={text.account.appearanceModes}
            onClick={() => navigate(Path.AccountAppearance)}
          />
          <AccountMenuItem
            icon={<PromptIcon />}
            title={text.account.appLanguage}
            detail={text.account.languageSystem}
            onClick={() => navigate(Path.AccountLanguage)}
          />
          <AccountMenuItem
            icon={<DiscoveryIcon />}
            title={text.account.webOpenMode}
            detail={text.account.webOpenInApp}
            onClick={() => navigate(Path.AccountWebOpenMode)}
          />
          <AccountMenuItem
            icon={<EyeIcon />}
            title={text.account.permissions}
            detail={text.account.permissionDetail}
            onClick={() => navigate(Path.AccountPermissions)}
          />
          <AccountMenuItem
            icon={<DownloadIcon />}
            title={text.account.version}
            detail={`${text.account.currentVersion} ${currentVersion}`}
            onClick={() => navigate(Path.AccountUpdate)}
          />
          <AccountMenuItem
            icon={<ChatIcon />}
            title={text.account.feedback}
            detail={text.account.feedbackProgress}
            onClick={() => navigate(Path.AccountFeedback)}
          />
        </div>
      </section>
    </AndroidDetailShell>
  );
}

function AndroidAppearanceSettings() {
  const text = useMobileText();
  return (
    <AndroidDetailShell
      title={text.account.appearance}
      subtitle={text.account.appearanceModes}
      text={text}
      fallback={Path.AccountSystemSettings}
    >
      <section className={styles["section"]}>
        <ThemeSwitch text={text} />
      </section>
    </AndroidDetailShell>
  );
}

function AndroidLanguageSettings() {
  const text = useMobileText();
  return (
    <AndroidDetailShell
      title={text.account.appLanguage}
      subtitle={text.account.languageSystem}
      text={text}
      fallback={Path.AccountSystemSettings}
    >
      <section className={styles["section"]}>
        <MobileLanguageSettings text={text} />
      </section>
    </AndroidDetailShell>
  );
}

function AndroidWebOpenModeSettings() {
  const text = useMobileText();
  const [webOpenMode, setWebOpenMode] = useState<WebOpenMode>(() =>
    readWebOpenMode(),
  );
  return (
    <AndroidDetailShell
      title={text.account.webOpenMode}
      subtitle={text.account.systemSettings}
      text={text}
      fallback={Path.AccountSystemSettings}
    >
      <section className={styles["section"]}>
        <div className={styles["web-open-mode"]}>
          {(["in_app", "external"] as WebOpenMode[]).map((mode) => (
            <button
              key={mode}
              className={clsx({ [styles["active"]]: webOpenMode === mode })}
              onClick={() => {
                setWebOpenMode(mode);
                writeWebOpenMode(mode);
              }}
            >
              {mode === "in_app"
                ? text.account.webOpenInApp
                : text.account.webOpenExternal}
            </button>
          ))}
        </div>
      </section>
    </AndroidDetailShell>
  );
}

function AndroidPaymentOrderCard(props: {
  order: PaymentOrderCreateResult;
  text: ManagedMobileText;
  busy?: boolean;
  onVerify: () => void;
  onCancel: () => void;
  onCopy: () => void;
  onOpenPay: () => void;
}) {
  const order = props.order;
  const qrCode = paymentQrCode(order);
  const payFrameUrl = displayPaymentUrl(order);
  const qrImage =
    qrCode && /^(data:image|https?:\/\/)/i.test(qrCode) ? qrCode : "";
  const failureReason = paymentOrderFailureReason(order);
  return (
    <section className={styles["payment-result-card"]}>
      <div className={styles["section-head"]}>
        <h2>{props.text.account.paymentInfo}</h2>
        <span>
          {props.text.account.orderStatus(
            localizedOrderStatus(order.status || "-", props.text),
          )}
        </span>
      </div>
      <div className={styles["meta-row"]}>
        <span>{props.text.account.orderNo}</span>
        <strong>
          {order.out_trade_no || order.order_id || order.id || "-"}
        </strong>
      </div>
      <div className={styles["meta-row"]}>
        <span>{props.text.account.payAmount}</span>
        <strong>{formatMoney(order.pay_amount || order.amount)}</strong>
      </div>
      {order.expires_at && (
        <div className={styles["meta-row"]}>
          <span>{props.text.account.expiresAt}</span>
          <strong>{formatDateTime(order.expires_at, props.text)}</strong>
        </div>
      )}
      {order.failed_at && (
        <div className={styles["meta-row"]}>
          <span>{props.text.account.failedAt}</span>
          <strong>{formatDateTime(order.failed_at, props.text)}</strong>
        </div>
      )}
      {failureReason && (
        <div className={styles["form-error"]}>
          {props.text.account.failedReason}: {failureReason}
        </div>
      )}
      {qrImage ? (
        <div className={styles["payment-qr"]}>
          <img src={qrImage} alt={props.text.account.qrCode} />
          <span>{props.text.account.scanInAppHint}</span>
        </div>
      ) : qrCode ? (
        <code className={styles["payment-code"]}>{qrCode}</code>
      ) : null}
      {primaryPaymentUrl(order) ? (
        <>
          <button
            className={styles["primary-action"]}
            onClick={props.onOpenPay}
          >
            {props.text.account.openPaymentTool}
          </button>
          {payFrameUrl && /^https?:\/\//i.test(payFrameUrl) ? (
            <iframe
              className={styles["payment-frame"]}
              title={props.text.account.paymentFrameTitle}
              src={payFrameUrl}
              sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation-by-user-activation"
            />
          ) : null}
          <button className={styles["wide-soft-action"]} onClick={props.onCopy}>
            {props.text.account.copyPayUrl}
          </button>
        </>
      ) : !qrCode ? (
        <p className={styles["empty-copy"]}>
          {props.text.account.paymentNoInfo}
        </p>
      ) : null}
      <div className={styles["inline-actions"]}>
        <button
          onClick={props.onVerify}
          disabled={
            props.busy || (!order.out_trade_no && !order.order_id && !order.id)
          }
        >
          <ReloadIcon />
          <span>{props.text.account.verifyPayment}</span>
        </button>
        <button
          className={styles["danger-inline"]}
          onClick={props.onCancel}
          disabled={props.busy || !isPendingOrderStatus(order.status)}
        >
          <CloseIcon />
          <span>{props.text.account.cancelOrder}</span>
        </button>
      </div>
    </section>
  );
}

function AccountDataNotice(props: {
  data: AccountData;
  text: ManagedMobileText;
}) {
  if (
    !props.data.loading &&
    !props.data.error &&
    !props.data.partialErrors?.length
  ) {
    return props.data.updatedAt ? (
      <div className={styles["sync-notice"]}>
        {props.text.account.lastSyncedAt(
          formatSyncTime(props.data.updatedAt, props.text),
        )}
      </div>
    ) : null;
  }
  return (
    <div
      className={clsx(styles["sync-notice"], {
        [styles["warning"]]:
          props.data.error || props.data.partialErrors?.length,
      })}
    >
      {props.data.loading
        ? props.text.account.refreshingData
        : props.data.error ||
          props.text.account.partialSyncFailed(
            props.data.partialErrors?.join("、") || props.text.common.empty,
          )}
    </div>
  );
}

function AndroidPlayBillingPanel(props: {
  text: ManagedMobileText;
  candidates: PlayBillingCandidate[];
  products: Record<string, NativePlayBillingProduct>;
  loading: boolean;
  busyProductId: string;
  error: string;
  message: string;
  onBuy: (candidate: PlayBillingCandidate) => void;
  onRedeem: () => void;
}) {
  return (
    <section
      className={styles["section"]}
      data-distribution-commerce="play-billing"
    >
      <div className={styles["section-head"]}>
        <h2>{props.text.account.playBillingTitle}</h2>
        <span>
          {props.loading
            ? props.text.loading
            : props.text.shortCount(props.candidates.length)}
        </span>
      </div>
      <p className={styles["empty-copy"]}>
        {props.text.account.playBillingHint}
      </p>
      {!props.candidates.length && (
        <div className={styles["form-error"]}>
          {props.text.account.playBillingNoProducts}
        </div>
      )}
      {props.error && <div className={styles["form-error"]}>{props.error}</div>}
      {props.message && (
        <div className={styles["form-success"]}>{props.message}</div>
      )}
      <div className={styles["payment-method-list"]}>
        {props.candidates.map((candidate) => {
          const product = props.products[candidate.productId];
          const title = product?.title || candidate.title;
          const description =
            product?.description ||
            candidate.description ||
            candidate.productId;
          const price =
            product?.formattedPrice ||
            candidate.formattedPrice ||
            (candidate.amount !== undefined
              ? formatMoney(candidate.amount)
              : props.text.account.playBillingPricePending);
          const busy = props.busyProductId === candidate.productId;
          return (
            <button
              key={playBillingCandidateKey(candidate)}
              type="button"
              className={styles["primary-payment-action"]}
              onClick={() => props.onBuy(candidate)}
              disabled={busy || props.loading}
            >
              <strong>{title}</strong>
              <small>
                {price} · {description}
              </small>
              <em>
                {busy
                  ? props.text.account.playBillingBuying
                  : props.text.account.playBillingBuy}
              </em>
            </button>
          );
        })}
      </div>
      <button className={styles["wide-soft-action"]} onClick={props.onRedeem}>
        {props.text.account.openRedeemCenter}
      </button>
    </section>
  );
}

function AndroidAccountSettings() {
  const managed = useManagedNextChatStore();
  const mobileStore = useManagedMobileAppStore();
  const sdStore = useSdStore();
  const text = useMobileText();
  const workspace = managed.workspace;
  const location = useLocation();
  const navigate = useNavigate();
  const clientConfig = useMemo(() => getClientConfig(), []);
  const installedRelease = useInstalledAndroidReleaseVersion();
  const [accountData, setAccountData] = useState<AccountData>({
    loading: true,
    error: "",
  });
  const [checkoutInfo, setCheckoutInfo] = useState<CheckoutInfo | undefined>();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponStatus, setCouponStatus] = useState("available");
  const [selectedCouponID, setSelectedCouponID] = useState<number | null>(null);
  const [couponQuote, setCouponQuote] = useState<CouponPaymentQuote | null>(
    null,
  );
  const [couponError, setCouponError] = useState("");
  const [rechargeAmount, setRechargeAmount] = useState("50");
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState("");
  const [redeemError, setRedeemError] = useState("");
  const [playBillingProducts, setPlayBillingProducts] = useState<
    Record<string, NativePlayBillingProduct>
  >({});
  const [playBillingLoading, setPlayBillingLoading] = useState(false);
  const [playBillingBusyProductId, setPlayBillingBusyProductId] = useState("");
  const [playBillingMessage, setPlayBillingMessage] = useState("");
  const [playBillingError, setPlayBillingError] = useState("");
  const [createdOrder, setCreatedOrder] =
    useState<PaymentOrderCreateResult | null>(() => readPendingPaymentOrder());
  const paymentVerifyInFlightRef = useRef(false);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [updateState, setUpdateState] = useState<{
    loading: boolean;
    checked: boolean;
    manifest?: AndroidUpdateManifest;
    error: string;
  }>({
    loading: false,
    checked: false,
    error: "",
  });
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [galleryGranted, setGalleryGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [microphoneGranted, setMicrophoneGranted] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [pushInbox, setPushInbox] = useState<NativePushInboxItem[]>([]);
  const [pushInboxLoading, setPushInboxLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const feedbackDraft = useRef(
    readStoredJSON<{
      title: string;
      category: MobileFeedbackCategory;
      content: string;
    }>(FEEDBACK_DRAFT_STORAGE_KEY, {
      title: "",
      category: "bug",
      content: "",
    }),
  );
  const [feedbackTitle, setFeedbackTitle] = useState(
    feedbackDraft.current.title,
  );
  const [feedbackCategory, setFeedbackCategory] =
    useState<MobileFeedbackCategory>(
      MOBILE_FEEDBACK_CATEGORIES.includes(feedbackDraft.current.category)
        ? feedbackDraft.current.category
        : "bug",
    );
  const [feedbackContent, setFeedbackContent] = useState(
    feedbackDraft.current.content,
  );
  const [feedbackScreenshots, setFeedbackScreenshots] = useState<
    MobileFeedbackScreenshotDraft[]
  >([]);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackError, setFeedbackError] = useState("");

  useEffect(() => {
    writeStoredJSON(FEEDBACK_DRAFT_STORAGE_KEY, {
      title: feedbackTitle,
      category: feedbackCategory,
      content: feedbackContent,
    });
  }, [feedbackCategory, feedbackContent, feedbackTitle]);
  const [webOpenMode, setWebOpenMode] = useState<WebOpenMode>(() =>
    readWebOpenMode(),
  );
  const [profile, setProfile] = useState<MobileUserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [totpStatus, setTotpStatus] = useState<MobileTotpStatus | null>(null);
  const [totpSetup, setTotpSetup] = useState<MobileTotpSetup | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [accountDeletionReason, setAccountDeletionReason] = useState("");
  const [accountDeletionVerifyCode, setAccountDeletionVerifyCode] =
    useState("");
  const [accountDeletionConfirm, setAccountDeletionConfirm] = useState("");
  const [accountDeletionBusy, setAccountDeletionBusy] = useState(false);
  const [accountDeletionMessage, setAccountDeletionMessage] = useState("");
  const [accountDeletionError, setAccountDeletionError] = useState("");
  const [inviteSummary, setInviteSummary] = useState<{
    aff_code: string;
    campaign_id?: string;
    attribution_token?: string;
    app_download_url?: string;
  } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteShareBusy, setInviteShareBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteCampaign, setInviteCampaign] =
    useState<InviteCampaignProgress | null>(null);
  const [invitePosterTheme, setInvitePosterTheme] =
    useState<InvitePosterTheme>("midnight");
  const [inviteRewardBusy, setInviteRewardBusy] = useState<number | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [welfareData, setWelfareData] = useState<PlayWelfareData | null>(null);
  const [welfareLoading, setWelfareLoading] = useState(false);
  const [welfareError, setWelfareError] = useState("");
  const [playActionBusy, setPlayActionBusy] = useState<string | null>(null);
  const [playActionMessage, setPlayActionMessage] = useState("");
  const [playActionError, setPlayActionError] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [teamActionBusy, setTeamActionBusy] = useState<string | null>(null);
  const [teamActionMessage, setTeamActionMessage] = useState("");
  const [teamActionError, setTeamActionError] = useState("");
  const [teamApplicationTarget, setTeamApplicationTarget] =
    useState<PlayWelfareTeamDirectoryEntry | null>(null);
  const [teamApplicationMessage, setTeamApplicationMessage] = useState("");
  const [teamHistoryMonth, setTeamHistoryMonth] = useState("");
  const [teamSeasonDetail, setTeamSeasonDetail] =
    useState<PlayWelfareTeamSeasonDetail | null>(null);
  const [teamSeasonLoading, setTeamSeasonLoading] = useState(false);
  const [teamSeasonError, setTeamSeasonError] = useState("");
  const [supportTickets, setSupportTickets] = useState<MobileSupportTicket[]>(
    [],
  );
  const [supportTicket, setSupportTicket] =
    useState<MobileSupportTicketDetail | null>(null);
  const [supportReply, setSupportReply] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportError, setSupportError] = useState("");
  const activeAccountId = String(
    managed.user?.id ||
      managed.session?.user_id ||
      managed.workspace?.user?.id ||
      "",
  );
  const welfareAccountID = workspace?.user?.id || managed.user?.id || 0;

  useEffect(() => {
    setWelfareData(null);
    setPlayActionBusy(null);
    setPlayActionMessage("");
    setPlayActionError("");
    setQuizAnswers({});
  }, [welfareAccountID]);

  async function signOut(clearAll: boolean) {
    setShowLogoutConfirm(false);
    const installationId = mobileInstallationId();
    if (installationId) {
      await mobilePlatformClient()
        .then((client) => client.devices.delete(installationId))
        .catch(() => undefined);
    }
    if (clearAll) {
      await clearLoginCredentials().catch(() => undefined);
      const localImages = await listAppImages(activeAccountId).catch(() => []);
      const fileNames = localImages
        .map((item) => item.fileName || "")
        .filter(Boolean);
      if (fileNames.length) {
        await deleteAppImages(fileNames, activeAccountId).catch(
          () => undefined,
        );
      }
      await clearLocalMaterials(activeAccountId).catch(() => undefined);
      await clearLocalPromptCatalogs(activeAccountId).catch(() => undefined);
      await clearLocalVideos(activeAccountId).catch(() => undefined);
      clearAccountScopedLocalStorage(activeAccountId);
      mobileStore.clearActiveAccount();
      sdStore.clearActiveAccount();
    }
    await managed.logout();
  }
  const downloadPollRef = useRef<number | null>(null);
  const paymentFeedbackRef = useRef<HTMLDivElement | null>(null);
  const feedbackFileInputRef = useRef<HTMLInputElement | null>(null);
  const teamSeasonRequestRef = useRef(0);
  const selectedOrderID = useMemo(
    () => new URLSearchParams(location.search).get("id") || "",
    [location.search],
  );
  const selectedTransactionID = useMemo(
    () => new URLSearchParams(location.search).get("tx") || "",
    [location.search],
  );
  const selectedSupportTicketID = useMemo(
    () => new URLSearchParams(location.search).get("ticket") || "",
    [location.search],
  );

  const currentVersion = formatAndroidReleaseVersion(
    installedRelease,
    text.account.unknownVersion,
  );
  const latestRelease = androidManifestReleaseVersion(updateState.manifest);
  const latestVersion = formatAndroidReleaseVersion(latestRelease);
  const apkUrl = resolveAndroidUrl(
    updateState.manifest?.apkUrl ||
      updateState.manifest?.androidApkUrl ||
      updateState.manifest?.url ||
      clientConfig?.androidApkUrl ||
      "",
    clientConfig,
  );
  const updateDecision = evaluateAndroidUpdate(
    installedRelease,
    updateState.manifest,
  );
  const hasUpdate = updateDecision.hasUpdate;
  const playDistribution = isPlayDistribution(installedRelease);
  const notes = manifestNotes(updateState.manifest, text);
  const supportLines = extractSupportLines(workspace?.support_contact);
  const paymentMethods = playDistribution
    ? []
    : directActualPaymentMethodsFromCheckout(checkoutInfo);
  const directRedeemShopUrl = playDistribution
    ? ""
    : String(clientConfig?.androidDirectRedeemShopUrl || "").trim();
  const replacedWechatPaymentAvailable =
    !playDistribution &&
    !!directRedeemShopUrl &&
    hasWechatPaymentMethod(checkoutInfo);
  const visiblePaymentOptionCount =
    paymentMethods.length + (replacedWechatPaymentAvailable ? 1 : 0);
  const route = location.pathname;
  const legacySystemRoute = (
    {
      "/account/permissions": Path.AccountPermissions,
      "/account/update": Path.AccountUpdate,
      "/account/feedback": Path.AccountFeedback,
      "/account/support": Path.AccountFeedback,
    } as Record<string, Path>
  )[route];
  useEffect(() => {
    if (legacySystemRoute) {
      navigate(legacySystemRoute, { replace: true });
    }
  }, [legacySystemRoute, navigate]);
  const playRechargeCandidates = useMemo(
    () =>
      playBillingCandidatesForOrder(checkoutInfo, accountData, text, "balance"),
    [checkoutInfo, accountData, text],
  );
  const playPlanCandidates = useMemo(
    () =>
      playBillingCandidatesForOrder(
        checkoutInfo,
        accountData,
        text,
        "subscription",
      ),
    [checkoutInfo, accountData, text],
  );
  const activePlayBillingCandidates = useMemo(() => {
    if (route === Path.AccountRecharge) return playRechargeCandidates;
    if (route === Path.AccountPlans) return playPlanCandidates;
    return [] as PlayBillingCandidate[];
  }, [playPlanCandidates, playRechargeCandidates, route]);
  const playBillingProductQueryKey = activePlayBillingCandidates
    .map((candidate) => `${candidate.productType}:${candidate.productId}`)
    .sort()
    .join("|");
  const accountGroupID = storedChatGroupID(workspace);
  const accountGroupName = stableChatGroupName(workspace, text);
  const isAdmin = isMobileAdminAvailable(managed.mobileProtocol);
  const unreadPushCount = pushInbox.filter((item) => !item.read).length;
  const refreshPushInbox = useCallback(async () => {
    setPushInboxLoading(true);
    try {
      setPushInbox(await getNativePushInbox());
    } finally {
      setPushInboxLoading(false);
    }
  }, []);
  useEffect(() => {
    if (route !== Path.AccountFeedbackNew) return;
    const draft = readMobileReportDraft();
    if (!draft) return;
    setFeedbackCategory("ai_content_report");
    setFeedbackTitle(draft.title);
    setFeedbackContent(draft.content);
    setFeedbackError("");
    setFeedbackMessage("");
  }, [route]);
  const adminClient = useMemo(
    () => ({
      baseUrl: managed.backendBaseUrl,
      accessToken: managed.accessToken,
      mobileProtocol: managed.mobileProtocol,
    }),
    [managed.accessToken, managed.backendBaseUrl, managed.mobileProtocol],
  );
  const inviteRegisterUrl = useMemo(() => {
    if (!inviteSummary?.aff_code && !inviteSummary?.attribution_token)
      return "";
    const url = new URL(resolveWebUrl("/register", clientConfig));
    if (inviteSummary.aff_code) {
      url.searchParams.set("aff_code", inviteSummary.aff_code);
    }
    if (inviteSummary.campaign_id)
      url.searchParams.set("campaign_id", inviteSummary.campaign_id);
    if (inviteSummary.attribution_token)
      url.searchParams.set("invite_token", inviteSummary.attribution_token);
    return url.toString();
  }, [clientConfig, inviteSummary]);

  const inviteAppUrl = useMemo(() => {
    if (!inviteSummary?.aff_code && !inviteSummary?.attribution_token)
      return "";
    const url = new URL(
      inviteSummary.app_download_url ||
        resolveWebUrl("/download/android", clientConfig),
    );
    if (inviteSummary.aff_code) {
      url.searchParams.set("aff_code", inviteSummary.aff_code);
    }
    url.searchParams.set("source", "invite_poster_app_qr");
    if (inviteSummary.campaign_id)
      url.searchParams.set("campaign_id", inviteSummary.campaign_id);
    if (inviteSummary.attribution_token)
      url.searchParams.set("invite_token", inviteSummary.attribution_token);
    return url.toString();
  }, [clientConfig, inviteSummary]);

  const refreshInviteGrowth = useCallback(
    async (includeShareToken = false) => {
      if (!managed.accessToken) return;
      setInviteLoading(true);
      setInviteError("");
      try {
        const [affiliate, campaigns] = await Promise.all([
          managedAuthenticatedJsonRequest<{ aff_code?: string }>(
            "/api/v1/user/aff",
          ),
          managedAuthenticatedJsonRequest<InviteCampaignProgress[]>(
            "/api/v1/user/aff/campaigns",
          ),
        ]);
        const campaign =
          (campaigns || []).find(
            (item) => item?.campaign?.status === "running",
          ) ||
          campaigns?.[0] ||
          null;
        setInviteCampaign(campaign);
        let attributionToken = "";
        if (includeShareToken && campaign?.enrollment?.campaign_id) {
          const tokenResult = await managedAuthenticatedJsonRequest<{
            token?: string;
          }>(`/api/v1/user/aff/campaigns/${campaign.campaign.id}/invite-token`);
          attributionToken = tokenResult?.token || "";
        }
        setInviteSummary(
          affiliate?.aff_code
            ? {
                aff_code: affiliate.aff_code,
                ...(campaign?.campaign?.id
                  ? { campaign_id: String(campaign.campaign.id) }
                  : {}),
                ...(attributionToken
                  ? { attribution_token: attributionToken }
                  : {}),
              }
            : null,
        );
      } catch {
        setInviteSummary(null);
        setInviteCampaign(null);
        setInviteError(text.account.inviteGrowthUnavailable);
      } finally {
        setInviteLoading(false);
      }
    },
    [managed.accessToken, text.account.inviteGrowthUnavailable],
  );

  useEffect(() => {
    if (route !== Path.AccountInvite && route !== Path.AccountWelfare) return;
    void refreshInviteGrowth(route === Path.AccountInvite);
  }, [route, refreshInviteGrowth]);

  const refreshWelfare = useCallback(async () => {
    if (!managed.accessToken) {
      setWelfareData(null);
      setWelfareError(text.errors.loginRequired);
      return;
    }
    setWelfareLoading(true);
    setWelfareError("");
    try {
      const data = await loadPlayWelfareData(
        managedAuthenticatedJsonRequest,
        workspace?.user?.id || managed.user?.id,
      );
      setWelfareData(data);
      if (data.unavailable.length >= 6) {
        setWelfareError(text.account.welfareUnavailable);
      } else if (data.unavailable.length) {
        setWelfareError(
          text.account.welfarePartialUnavailable(data.unavailable.length),
        );
      }
    } catch {
      setWelfareData(null);
      setWelfareError(text.account.welfareUnavailable);
    } finally {
      setWelfareLoading(false);
    }
  }, [
    managed.accessToken,
    managed.user?.id,
    text.account.welfarePartialUnavailable,
    text.account.welfareUnavailable,
    text.errors.loginRequired,
    workspace?.user?.id,
  ]);

  useEffect(() => {
    if (route !== Path.AccountWelfare) return;
    void refreshWelfare();
  }, [route, refreshWelfare]);

  const refreshTeamSeason = useCallback(
    async (month: string) => {
      if (!month || !managed.accessToken) return;
      const requestID = ++teamSeasonRequestRef.current;
      setTeamSeasonLoading(true);
      setTeamSeasonError("");
      setTeamSeasonDetail(null);
      try {
        const detail = await loadPlayWelfareTeamSeason(
          managedAuthenticatedJsonRequest,
          month,
        );
        if (requestID === teamSeasonRequestRef.current) {
          setTeamSeasonDetail(detail);
        }
      } catch {
        if (requestID === teamSeasonRequestRef.current) {
          setTeamSeasonError(text.account.welfareTeamSeasonUnavailable);
        }
      } finally {
        if (requestID === teamSeasonRequestRef.current) {
          setTeamSeasonLoading(false);
        }
      }
    },
    [managed.accessToken, text.account.welfareTeamSeasonUnavailable],
  );

  useEffect(() => {
    if (route !== Path.AccountWelfare) return;
    const seasons = welfareData?.teamSeasons || [];
    if (!seasons.length) {
      setTeamHistoryMonth("");
      setTeamSeasonDetail(null);
      return;
    }
    setTeamHistoryMonth((current) =>
      seasons.some((season) => season.month === current)
        ? current
        : seasons[0].month,
    );
  }, [route, welfareData?.teamSeasons]);

  useEffect(() => {
    if (route !== Path.AccountWelfare || !teamHistoryMonth) return;
    void refreshTeamSeason(teamHistoryMonth);
  }, [route, refreshTeamSeason, teamHistoryMonth]);

  function welfareTeamError(error: unknown, fallback: string) {
    if (!(error instanceof Error) || !error.message) return fallback;
    const apiError = error instanceof ManagedApiError ? error : undefined;
    const raw = `${apiError?.code || ""} ${error.message}`.trim();
    const localized = localizeManagedMobileError({
      message: raw,
      status: apiError?.status,
      path: apiError?.path,
    });
    return localized === raw || localized === error.message
      ? fallback
      : localized;
  }

  function playMutationHeaders(prefix: string) {
    const requestID = clientRequestID(prefix);
    return {
      "Idempotency-Key": requestID,
      "X-Request-ID": requestID,
      "X-Client-Request-ID": requestID,
    };
  }

  function playRewardMessage(result: {
    reward_amount?: number;
    balance_added?: number;
    coupon?: { name?: string };
    redeem_code?: { code?: string };
  }) {
    const amount = result.balance_added ?? result.reward_amount ?? 0;
    const details = [
      amount > 0 ? text.account.welfareRewardMessage(formatMoney(amount)) : "",
      result.coupon?.name
        ? text.account.welfareRewardCoupon(result.coupon.name)
        : "",
      result.redeem_code?.code
        ? text.account.welfareRewardCode(result.redeem_code.code)
        : "",
    ].filter(Boolean);
    return details.join(" · ") || text.account.welfareRewardNone;
  }

  async function submitDailyCheckin(makeup = false) {
    if (playActionBusy) return;
    const status = welfareData?.checkinStatus;
    if (
      !status?.enabled ||
      (makeup
        ? !status.can_makeup
        : !status.coupon_pool_ready ||
          status.checked_in_today ||
          !status.eligible)
    ) {
      return;
    }
    setPlayActionBusy(makeup ? "checkin-makeup" : "checkin");
    setPlayActionMessage("");
    setPlayActionError("");
    try {
      const result =
        await managedAuthenticatedJsonRequest<PlayWelfareCheckinResult>(
          makeup
            ? PLAY_WELFARE_REWARD_ENDPOINTS.checkinMakeup
            : PLAY_WELFARE_REWARD_ENDPOINTS.checkin,
          {
            method: "POST",
            headers: playMutationHeaders(
              makeup ? "play-checkin-makeup" : "play-checkin",
            ),
          },
        );
      const amount = formatMoney(result.balance_added ?? result.reward_amount);
      setPlayActionMessage(
        makeup
          ? text.account.welfareCheckinMakeupSuccess(amount)
          : [
              text.account.welfareCheckinCompleted,
              playRewardMessage(result),
            ].join(" · "),
      );
      await Promise.all([
        refreshWelfare(),
        refreshAccountData().catch(() => undefined),
      ]);
    } catch (error) {
      setPlayActionError(
        welfareTeamError(error, text.account.welfareCheckinUnavailable),
      );
    } finally {
      setPlayActionBusy(null);
    }
  }

  async function openDailyBlindbox() {
    if (playActionBusy) return;
    const status = welfareData?.blindboxStatus;
    if (!status?.enabled || !status.coupon_pool_ready || !status.can_open) {
      return;
    }
    setPlayActionBusy("blindbox");
    setPlayActionMessage("");
    setPlayActionError("");
    try {
      const result =
        await managedAuthenticatedJsonRequest<PlayWelfareBlindboxResult>(
          PLAY_WELFARE_REWARD_ENDPOINTS.blindboxOpen,
          {
            method: "POST",
            headers: playMutationHeaders("play-blindbox"),
          },
        );
      setPlayActionMessage(
        [text.account.welfareBlindboxCompleted, playRewardMessage(result)]
          .filter(Boolean)
          .join(" · "),
      );
      await Promise.all([
        refreshWelfare(),
        refreshAccountData().catch(() => undefined),
      ]);
    } catch (error) {
      setPlayActionError(
        welfareTeamError(error, text.account.welfareBlindboxUnavailable),
      );
    } finally {
      setPlayActionBusy(null);
    }
  }

  async function submitDailyQuiz() {
    if (playActionBusy) return;
    const quiz = welfareData?.quizToday;
    if (
      !quiz?.enabled ||
      !quiz.coupon_pool_ready ||
      quiz.already_submitted ||
      !quiz.questions.length
    ) {
      return;
    }
    const answers = quiz.questions.map((question) => ({
      question_id: question.id,
      choice_index: quizAnswers[question.id],
    }));
    if (answers.some((answer) => !Number.isInteger(answer.choice_index))) {
      setPlayActionError(text.account.welfareQuizNeedAnswers);
      return;
    }
    setPlayActionBusy("quiz");
    setPlayActionMessage("");
    setPlayActionError("");
    try {
      const result =
        await managedAuthenticatedJsonRequest<PlayWelfareQuizSubmitResult>(
          PLAY_WELFARE_REWARD_ENDPOINTS.quizSubmit,
          {
            method: "POST",
            headers: {
              ...playMutationHeaders("play-quiz"),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ answers }),
          },
        );
      setQuizAnswers({});
      setPlayActionMessage(
        `${text.account.welfareQuizSubmitted(
          result.score,
          result.total,
        )} · ${playRewardMessage(result)}`,
      );
      await Promise.all([
        refreshWelfare(),
        refreshAccountData().catch(() => undefined),
      ]);
    } catch (error) {
      setPlayActionError(
        welfareTeamError(error, text.account.welfareQuizUnavailable),
      );
    } finally {
      setPlayActionBusy(null);
    }
  }

  async function submitTeamApplication() {
    if (!teamApplicationTarget || teamActionBusy) return;
    setTeamActionBusy("application");
    setTeamActionMessage("");
    setTeamActionError("");
    try {
      await managedAuthenticatedJsonRequest(
        PLAY_WELFARE_TEAM_ENDPOINTS.application,
        {
          method: "POST",
          headers: {
            ...playMutationHeaders("play-team-application"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            team_id: teamApplicationTarget.team_id,
            message: teamApplicationMessage.trim(),
          }),
        },
      );
      setTeamApplicationTarget(null);
      setTeamApplicationMessage("");
      setTeamActionMessage(text.account.welfareTeamApplicationSubmitted);
      await refreshWelfare();
    } catch (error) {
      setTeamActionError(
        welfareTeamError(error, text.account.welfareTeamApplicationFailed),
      );
    } finally {
      setTeamActionBusy(null);
    }
  }

  async function decideTeamApplication(
    applicationID: number,
    decision: "approve" | "reject",
  ) {
    if (teamActionBusy) return;
    setTeamActionBusy(`decision-${applicationID}`);
    setTeamActionMessage("");
    setTeamActionError("");
    try {
      await managedAuthenticatedJsonRequest(
        `${PLAY_WELFARE_TEAM_ENDPOINTS.application}/${applicationID}/decision`,
        {
          method: "POST",
          headers: {
            ...playMutationHeaders(
              `play-team-decision-${applicationID}-${decision}`,
            ),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ decision }),
        },
      );
      setTeamActionMessage(
        decision === "approve"
          ? text.account.welfareTeamApplicationApproved
          : text.account.welfareTeamApplicationRejected,
      );
      await refreshWelfare();
    } catch (error) {
      setTeamActionError(
        welfareTeamError(error, text.account.welfareTeamDecisionFailed),
      );
    } finally {
      setTeamActionBusy(null);
    }
  }

  async function updateTeamRecruiting(recruiting: boolean) {
    if (teamActionBusy) return;
    setTeamActionBusy("recruiting");
    setTeamActionMessage("");
    setTeamActionError("");
    try {
      await managedAuthenticatedJsonRequest(
        PLAY_WELFARE_TEAM_ENDPOINTS.recruiting,
        {
          method: "PUT",
          headers: {
            ...playMutationHeaders("play-team-recruiting"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recruiting }),
        },
      );
      setTeamActionMessage(text.account.welfareTeamRecruitingUpdated);
      await refreshWelfare();
    } catch (error) {
      setTeamActionError(
        welfareTeamError(error, text.account.welfareTeamRecruitingFailed),
      );
    } finally {
      setTeamActionBusy(null);
    }
  }

  async function rotateTeamInvite() {
    if (teamActionBusy) return;
    setTeamActionBusy("invite");
    setTeamActionMessage("");
    setTeamActionError("");
    try {
      const invite =
        await managedAuthenticatedJsonRequest<PlayWelfareTeamInvite>(
          PLAY_WELFARE_TEAM_ENDPOINTS.inviteRotate,
          {
            method: "POST",
            headers: playMutationHeaders("play-team-invite-rotate"),
          },
        );
      setWelfareData((current) => {
        if (!current?.teamMe?.team) return current;
        return {
          ...current,
          teamMe: {
            ...current.teamMe,
            team: { ...current.teamMe.team, invite_code: invite.invite_code },
          },
        };
      });
      setTeamActionMessage(text.account.welfareTeamInviteRotated);
      await refreshWelfare();
    } catch (error) {
      setTeamActionError(
        welfareTeamError(error, text.account.welfareTeamInviteRotateFailed),
      );
    } finally {
      setTeamActionBusy(null);
    }
  }

  async function shareTeamInvite() {
    const team = welfareData?.teamMe?.team;
    if (!team?.invite_code || teamActionBusy) return;
    setTeamActionBusy("share-invite");
    setTeamActionMessage("");
    setTeamActionError("");
    try {
      await shareText(
        text.account.welfareTeamInviteShareText(team.name, team.invite_code),
        text.account.welfareTeamInviteCode,
      );
      setTeamActionMessage(text.account.welfareTeamInviteShared);
    } catch (error) {
      setTeamActionError(
        welfareTeamError(error, text.account.welfareTeamInviteShareFailed),
      );
    } finally {
      setTeamActionBusy(null);
    }
  }

  async function enrollInviteCampaign() {
    if (!inviteCampaign?.campaign?.id || inviteLoading) return;
    setInviteLoading(true);
    setInviteMessage("");
    setInviteError("");
    try {
      await managedAuthenticatedJsonRequest(
        `/api/v1/user/aff/campaigns/${inviteCampaign.campaign.id}/enroll`,
        {
          method: "POST",
          headers: playMutationHeaders("play-invite-campaign-enroll"),
        },
      );
      await refreshInviteGrowth(true);
      setInviteMessage(text.account.inviteGrowthEnrolled);
    } catch {
      setInviteError(text.account.inviteGrowthUnavailable);
    } finally {
      setInviteLoading(false);
    }
  }

  async function claimInviteReward(reward: InviteCampaignReward) {
    if (!inviteCampaign?.campaign?.id || inviteRewardBusy !== null) return;
    setInviteRewardBusy(reward.id);
    setInviteMessage("");
    setInviteError("");
    try {
      await managedAuthenticatedJsonRequest(
        `/api/v1/user/aff/campaigns/${inviteCampaign.campaign.id}/rewards/${reward.id}/claim`,
        {
          method: "POST",
          headers: {
            ...playMutationHeaders(`play-invite-reward-${reward.id}`),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            campaign_version: inviteCampaign.campaign.version,
          }),
        },
      );
      await refreshInviteGrowth(true);
      setInviteMessage(text.account.inviteGrowthClaimed);
    } catch {
      setInviteError(text.account.inviteGrowthClaimFailed);
    } finally {
      setInviteRewardBusy(null);
    }
  }

  async function shareInviteGrowth() {
    if (!inviteRegisterUrl || !inviteAppUrl || inviteShareBusy) return;
    setInviteShareBusy(true);
    setInviteMessage("");
    setInviteError("");
    const shareScope = `${Date.now()}`;
    const poster = buildInvitePosterPayload({
      registerUrl: inviteRegisterUrl,
      appUrl: inviteAppUrl,
      headline: text.account.inviteGrowthPosterTitle,
      body: text.account.inviteGrowthPosterBody,
      locale: text.dateLocale,
      theme: invitePosterTheme,
    });
    try {
      const dataUrl = await createInvitePosterDataUrl(poster);
      await reportInviteLifecycleEvent(
        managed.backendBaseUrl,
        managed.accessToken,
        "share_opened",
        currentVersion,
        getInviteInstallationId(),
        {
          eventId: getStableInviteEventId(`share-opened:${shareScope}`),
          attributionToken: inviteSummary?.attribution_token,
          metadata: {
            surface: inviteSummary?.attribution_token
              ? "account_invite_campaign"
              : "account_invite_referral",
            aff_code: inviteSummary?.aff_code || "",
            campaign_id: inviteSummary?.campaign_id || "",
            poster_theme: invitePosterTheme,
          },
        },
      ).catch(() => undefined);
      await shareImage(
        dataUrl,
        `jisudeng-invite-${Date.now()}.png`,
        `${text.account.inviteGrowthShareText}\n${inviteRegisterUrl}`,
      );
      await reportInviteLifecycleEvent(
        managed.backendBaseUrl,
        managed.accessToken,
        "share_completed",
        currentVersion,
        getInviteInstallationId(),
        {
          eventId: getStableInviteEventId(`share-completed:${shareScope}`),
          attributionToken: inviteSummary?.attribution_token,
          metadata: {
            surface: inviteSummary?.attribution_token
              ? "account_invite_campaign"
              : "account_invite_referral",
            aff_code: inviteSummary?.aff_code || "",
            campaign_id: inviteSummary?.campaign_id || "",
            poster_theme: invitePosterTheme,
          },
        },
      ).catch(() => undefined);
      setInviteMessage(text.account.inviteGrowthShared);
    } catch {
      try {
        await reportInviteLifecycleEvent(
          managed.backendBaseUrl,
          managed.accessToken,
          "share_opened",
          currentVersion,
          getInviteInstallationId(),
          {
            eventId: getStableInviteEventId(`share-opened:${shareScope}`),
            attributionToken: inviteSummary?.attribution_token,
            metadata: {
              surface: inviteSummary?.attribution_token
                ? "account_invite_campaign_text_fallback"
                : "account_invite_referral_text_fallback",
              aff_code: inviteSummary?.aff_code || "",
              campaign_id: inviteSummary?.campaign_id || "",
            },
          },
        ).catch(() => undefined);
        await shareText(poster.shareText, text.account.inviteGrowth);
        await reportInviteLifecycleEvent(
          managed.backendBaseUrl,
          managed.accessToken,
          "share_completed",
          currentVersion,
          getInviteInstallationId(),
          {
            eventId: getStableInviteEventId(`share-completed:${shareScope}`),
            attributionToken: inviteSummary?.attribution_token,
            metadata: {
              surface: inviteSummary?.attribution_token
                ? "account_invite_campaign_text_fallback"
                : "account_invite_referral_text_fallback",
              aff_code: inviteSummary?.aff_code || "",
              campaign_id: inviteSummary?.campaign_id || "",
              poster_theme: invitePosterTheme,
            },
          },
        ).catch(() => undefined);
        setInviteMessage(text.account.inviteGrowthShared);
      } catch {
        setInviteError(text.account.inviteGrowthUnavailable);
      }
    } finally {
      setInviteShareBusy(false);
    }
  }

  async function copyInviteGrowthLink() {
    if (!inviteRegisterUrl) return;
    try {
      await navigator.clipboard.writeText(inviteRegisterUrl);
      setInviteMessage(text.account.inviteGrowthCopy);
    } catch {
      setInviteMessage(text.account.inviteGrowthUnavailable);
    }
  }

  async function refreshSupportTickets() {
    if (!managed.accessToken) return;
    setSupportBusy(true);
    try {
      const client = await mobilePlatformClient();
      const page = await client.support.tickets.list({
        limit: 50,
        order: "desc",
      });
      setSupportTickets(page.items || []);
      setSupportError("");
      const detailID =
        route === Path.AccountFeedbackDetail ? selectedSupportTicketID : "";
      if (detailID) {
        setSupportTicket(await client.support.tickets.detail(detailID));
      } else {
        setSupportTicket(null);
      }
    } catch (error) {
      setSupportError(
        error instanceof Error && error.message
          ? localizeManagedMobileError({ message: error.message })
          : text.platform.supportTicketRefreshFailed,
      );
    } finally {
      setSupportBusy(false);
    }
  }

  async function openSupportTicket(ticket: MobileSupportTicket) {
    navigate(
      `${Path.AccountFeedbackDetail}?ticket=${encodeURIComponent(ticket.id)}`,
    );
  }

  async function replySupportTicket() {
    const content = supportReply.trim();
    if (!supportTicket || !content) {
      setSupportError(text.platform.supportReplyRequired);
      return;
    }
    setSupportBusy(true);
    try {
      const client = await mobilePlatformClient();
      await client.support.tickets.message(supportTicket.id, {
        content,
        client_message_id: clientRequestID("support"),
      });
      setSupportReply("");
      setSupportTicket(await client.support.tickets.detail(supportTicket.id));
      setSupportError("");
    } catch (error) {
      setSupportError(
        error instanceof Error && error.message
          ? localizeManagedMobileError({ message: error.message })
          : text.platform.supportTicketRefreshFailed,
      );
    } finally {
      setSupportBusy(false);
    }
  }

  async function closeSupportTicketRecord() {
    if (!supportTicket || !window.confirm(text.platform.supportCloseConfirm))
      return;
    setSupportBusy(true);
    try {
      const client = await mobilePlatformClient();
      await client.support.tickets.close(supportTicket.id, {
        reason: "user_closed",
      });
      setSupportTicket(null);
      await refreshSupportTickets();
    } catch (error) {
      setSupportError(
        error instanceof Error && error.message
          ? localizeManagedMobileError({ message: error.message })
          : text.platform.supportTicketRefreshFailed,
      );
    } finally {
      setSupportBusy(false);
    }
  }

  async function refreshProfile() {
    if (!managed.accessToken) return;
    setProfileLoading(true);
    setProfileError("");
    try {
      const [profileResult, totpResult] = await Promise.all([
        managedAuthenticatedJsonRequest<MobileUserProfile>(
          "/api/v1/user/profile",
        ),
        managedAuthenticatedJsonRequest<MobileTotpStatus>(
          "/api/v1/user/totp/status",
        ),
      ]);
      const nextProfile = profileResult || {};
      setProfile(nextProfile);
      setProfileUsername(
        nextProfile.username || workspace?.user?.username || "",
      );
      setProfileAvatarUrl(
        nextProfile.avatar_url || workspace?.user?.avatar_url || "",
      );
      setResetEmail(nextProfile.email || workspace?.user?.email || "");
      setTotpStatus(totpResult || {});
    } catch (error) {
      setProfileError(
        localizedMobileErrorMessage(error, text.errors.syncFailed),
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function saveProfile() {
    if (profileBusy) return;
    setProfileBusy(true);
    setProfileMessage("");
    setProfileError("");
    try {
      const result = await managedAuthenticatedJsonRequest<MobileUserProfile>(
        "/api/v1/user",
        {
          method: "PUT",
          body: JSON.stringify({
            username: profileUsername.trim(),
            avatar_url: profileAvatarUrl.trim() || null,
          }),
        },
      );
      setProfile(
        result || {
          ...profile,
          username: profileUsername.trim(),
          avatar_url: profileAvatarUrl.trim() || null,
        },
      );
      setProfileMessage(text.account.profileSaved);
      await managed.bootstrap({ silent: true }).catch(() => undefined);
    } catch (error) {
      setProfileError(
        localizedMobileErrorMessage(error, text.errors.saveFailed),
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword() {
    if (profileBusy) return;
    if (!currentPassword || newPassword.length < 6) {
      setProfileError(text.account.passwordChangeRequired);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setProfileError(text.login.passwordMismatch);
      return;
    }
    setProfileBusy(true);
    setProfileMessage("");
    setProfileError("");
    try {
      await managedAuthenticatedJsonRequest("/api/v1/user/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setProfileMessage(text.account.passwordChanged);
    } catch (error) {
      setProfileError(
        localizedMobileErrorMessage(error, text.errors.saveFailed),
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function sendProfileResetCode() {
    if (profileBusy || !resetEmail.trim()) return;
    setProfileBusy(true);
    setProfileMessage("");
    setProfileError("");
    try {
      await managedAuthenticatedJsonRequest(
        "/api/v1/auth/mobile/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email: resetEmail.trim() }),
        },
      );
      setProfileMessage(text.account.resetCodeSent);
    } catch (error) {
      setProfileError(
        localizedMobileErrorMessage(error, text.errors.networkFailed),
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function resetProfilePassword() {
    if (profileBusy) return;
    if (!resetEmail.trim() || !resetCode.trim() || resetPassword.length < 6) {
      setProfileError(text.account.resetPasswordRequired);
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setProfileError(text.login.passwordMismatch);
      return;
    }
    setProfileBusy(true);
    setProfileMessage("");
    setProfileError("");
    try {
      await managedAuthenticatedJsonRequest(
        "/api/v1/auth/mobile/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: resetEmail.trim(),
            verify_code: resetCode.trim(),
            new_password: resetPassword,
          }),
        },
      );
      setResetCode("");
      setResetPassword("");
      setConfirmResetPassword("");
      setProfileMessage(text.account.resetPasswordDone);
    } catch (error) {
      setProfileError(
        localizedMobileErrorMessage(error, text.errors.saveFailed),
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function startTotpSetup() {
    if (profileBusy) return;
    setProfileBusy(true);
    setProfileMessage("");
    setProfileError("");
    try {
      const setup = await managedAuthenticatedJsonRequest<MobileTotpSetup>(
        "/api/v1/user/totp/setup",
        { method: "POST" },
      );
      setTotpSetup(setup || null);
      setProfileMessage(text.account.totpSetupStarted);
    } catch (error) {
      setProfileError(
        localizedMobileErrorMessage(error, text.errors.saveFailed),
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function sendTotpEmailCode() {
    if (profileBusy) return;
    setProfileBusy(true);
    setProfileMessage("");
    setProfileError("");
    try {
      await managedAuthenticatedJsonRequest("/api/v1/user/totp/send-code", {
        method: "POST",
      });
      setProfileMessage(text.account.totpCodeSent);
    } catch (error) {
      setProfileError(
        localizedMobileErrorMessage(error, text.errors.saveFailed),
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function enableTotp() {
    if (profileBusy || !totpCode.trim()) return;
    setProfileBusy(true);
    setProfileMessage("");
    setProfileError("");
    try {
      await managedAuthenticatedJsonRequest("/api/v1/user/totp/enable", {
        method: "POST",
        body: JSON.stringify({
          code: totpCode.trim(),
          totp_code: totpCode.trim(),
          setup_token: totpSetup?.setup_token,
        }),
      });
      setTotpCode("");
      setTotpSetup(null);
      setTotpStatus({ ...(totpStatus || {}), enabled: true });
      setProfileMessage(text.account.totpEnabled);
    } catch (error) {
      setProfileError(
        localizedMobileErrorMessage(error, text.errors.saveFailed),
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function disableTotp() {
    if (profileBusy || !totpCode.trim()) return;
    setProfileBusy(true);
    setProfileMessage("");
    setProfileError("");
    try {
      await managedAuthenticatedJsonRequest("/api/v1/user/totp/disable", {
        method: "POST",
        body: JSON.stringify({
          code: totpCode.trim(),
          totp_code: totpCode.trim(),
        }),
      });
      setTotpCode("");
      setTotpStatus({ ...(totpStatus || {}), enabled: false });
      setProfileMessage(text.account.totpDisabled);
    } catch (error) {
      setProfileError(
        localizedMobileErrorMessage(error, text.errors.saveFailed),
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function sendAccountDeletionCode() {
    if (accountDeletionBusy) return;
    const email = profile?.email || workspace?.user?.email || resetEmail;
    setAccountDeletionBusy(true);
    setAccountDeletionMessage("");
    setAccountDeletionError("");
    try {
      try {
        await managedAuthenticatedJsonRequest("/api/v1/user/totp/send-code", {
          method: "POST",
        });
      } catch (error) {
        if (
          !(
            error instanceof ManagedApiError &&
            [404, 405, 501].includes(error.status || 0) &&
            email
          )
        ) {
          throw error;
        }
        await managedAuthenticatedJsonRequest(
          "/api/v1/auth/mobile/forgot-password",
          {
            method: "POST",
            body: JSON.stringify({ email }),
          },
        );
      }
      setAccountDeletionMessage(text.account.accountDeletionCodeSent);
    } catch (error) {
      setAccountDeletionError(
        localizedMobileErrorMessage(error, text.errors.networkFailed),
      );
    } finally {
      setAccountDeletionBusy(false);
    }
  }

  async function submitAccountDeletionRequest() {
    if (!managed.accessToken) {
      setAccountDeletionError(text.errors.loginRequired);
      return;
    }
    if (
      accountDeletionReason.trim().length < 5 ||
      !accountDeletionVerifyCode.trim() ||
      accountDeletionConfirm.trim().toUpperCase() !== "DELETE"
    ) {
      setAccountDeletionError(text.account.accountDeletionRequired);
      return;
    }
    setAccountDeletionBusy(true);
    setAccountDeletionMessage("");
    setAccountDeletionError("");
    try {
      const deviceInfo = (await getNativeDeviceInfo().catch(
        () => ({}),
      )) as Record<string, any>;
      const userId =
        profile?.id || workspace?.user?.id || managed.user?.id || "";
      const email = profile?.email || workspace?.user?.email || "";
      const balance = formatMoney(workspace?.user?.balance);
      const content = [
        "account_deletion_request",
        `user_id: ${userId || "-"}`,
        `email: ${email || "-"}`,
        `balance: ${balance}`,
        `app_version: ${installedRelease.name}`,
        `verification_code: ${accountDeletionVerifyCode.trim()}`,
        `confirmation: ${accountDeletionConfirm.trim()}`,
        `reason: ${accountDeletionReason.trim()}`,
        text.account.accountDeletionTicketBody,
      ].join("\n");
      const form = new FormData();
      form.append("title", text.account.accountDeletionTicketTitle);
      form.append("category", "account_deletion_request");
      form.append("content", content);
      form.append("app_version", installedRelease.name);
      form.append("platform", "android");
      form.append("installation_id", getInviteInstallationId());
      form.append("channel", "official_android");
      form.append("backend_url", managed.backendBaseUrl);
      form.append(
        "device_model",
        [deviceInfo.manufacturer, deviceInfo.model].filter(Boolean).join(" "),
      );
      form.append("android_version", String(deviceInfo.androidVersion || ""));
      form.append("system_version", String(deviceInfo.sdkInt || ""));
      form.append(
        "device_info",
        JSON.stringify({
          ...deviceInfo,
          userAgent: navigator.userAgent,
          language: navigator.language,
          screen: `${window.screen.width}x${window.screen.height}`,
        }),
      );
      const result = await submitFeedbackForm(form, "account-deletion");
      setAccountDeletionMessage(
        result?.ticket_id || result?.id
          ? `${text.account.accountDeletionSubmitted} · #${
              result.ticket_id || result.id
            }`
          : text.account.accountDeletionSubmitted,
      );
      setAccountDeletionReason("");
      setAccountDeletionVerifyCode("");
      setAccountDeletionConfirm("");
    } catch (error) {
      setAccountDeletionError(
        localizedMobileErrorMessage(error, text.errors.saveFailed),
      );
    } finally {
      setAccountDeletionBusy(false);
    }
  }

  async function refreshAccountData() {
    if (!managed.accessToken) {
      setAccountData((state) => ({
        ...state,
        loading: false,
        error: text.errors.loginRequired,
      }));
      return;
    }
    setAccountData((state) => ({ ...state, loading: true, error: "" }));
    try {
      let summary: MobileAccountSummary | null = null;
      for (const path of [
        "/api/v1/mobile/account-summary",
        "/api/v1/nextchat/mobile/account-summary",
      ]) {
        try {
          summary =
            await managedAuthenticatedJsonRequest<MobileAccountSummary>(path);
          break;
        } catch (error) {
          if (!(error instanceof ManagedApiError) || error.status !== 404) {
            throw error;
          }
        }
      }
      if (!summary) {
        throw new ManagedApiError(
          "account summary unavailable",
          404,
          "/api/v1/mobile/account-summary",
        );
      }
      const labels: Record<string, string> = {
        orders: text.account.orders,
        transactions: text.account.balanceDetails,
        wallet: text.account.balance,
        plans: text.account.packages,
        payment: text.account.paymentInfo,
        subscriptions: text.account.subscriptions,
      };
      let summarySubscriptions = summary.subscriptions || [];
      const partialErrors = [...(summary.partial_errors || [])];

      // Account summaries from current servers include usage progress. Older
      // deployments still return 200 without it, so supplement only those
      // records rather than treating a valid account summary as complete.
      if (needsSubscriptionProgressRefresh(summarySubscriptions)) {
        try {
          const progress = await managedAuthenticatedJsonRequest<any>(
            "/api/v1/subscriptions/progress",
          );
          summarySubscriptions = mergeSubscriptionProgress(
            summarySubscriptions,
            arrayPayload(progress),
          );
        } catch (error) {
          const progressRouteUnavailable =
            error instanceof ManagedApiError && error.status === 404;
          if (
            !progressRouteUnavailable &&
            !partialErrors.some((item) => item.source === "subscriptions")
          ) {
            partialErrors.push({ source: "subscriptions" });
          }
        }
      }
      setAccountData({
        loading: false,
        error: "",
        partialErrors: partialErrors.map(
          (item) => labels[item.source || ""] || text.errors.syncFailed,
        ),
        updatedAt: Date.now(),
        orders: summary.orders || [],
        transactions: summary.transactions || [],
        wallet: summary.wallet,
        plans: summary.plans || [],
        subscriptions: summarySubscriptions,
      });
      managed.clearLastError();
      return;
    } catch (error) {
      if (!(error instanceof ManagedApiError) || error.status !== 404) {
        setAccountData((state) => ({
          ...state,
          loading: false,
          error:
            error instanceof Error && error.message
              ? localizeManagedMobileError({ message: error.message })
              : text.errors.syncFailed,
        }));
        return;
      }
    }
    const settle = async (path: string): Promise<PromiseSettledResult<any>> => {
      try {
        return {
          status: "fulfilled",
          value: await managedAuthenticatedJsonRequest<any>(path),
        };
      } catch (reason) {
        return { status: "rejected", reason };
      }
    };
    const [
      orders,
      transactions,
      wallet,
      plans,
      subscriptions,
      subscriptionProgress,
    ] = await Promise.all([
      settle("/api/v1/payment/orders/my?page=1&page_size=30"),
      settle("/api/v1/user/wallet/transactions?page=1&page_size=30"),
      settle("/api/v1/user/wallet/summary"),
      settle("/api/v1/payment/plans"),
      settle("/api/v1/subscriptions"),
      settle("/api/v1/subscriptions/progress"),
    ]);
    const subscriptionsAvailable =
      subscriptions.status === "fulfilled" ||
      subscriptionProgress.status === "fulfilled";
    const failures = [
      orders.status === "rejected" ? text.account.orders : "",
      transactions.status === "rejected" ? text.account.balanceDetails : "",
      wallet.status === "rejected" ? text.account.balance : "",
      plans.status === "rejected" ? text.account.packages : "",
      !subscriptionsAvailable ? text.account.subscriptions : "",
    ].filter(Boolean);
    setAccountData((state) => {
      const hasAnySuccess = [
        orders,
        transactions,
        wallet,
        plans,
        subscriptions,
        subscriptionProgress,
      ].some((result) => result.status === "fulfilled");
      const subscriptionRecords =
        subscriptions.status === "fulfilled"
          ? arrayPayload(subscriptions.value)
          : [];
      const progressRecords =
        subscriptionProgress.status === "fulfilled"
          ? arrayPayload(subscriptionProgress.value)
          : [];
      if (hasAnySuccess) {
        managed.clearLastError();
      }
      return {
        loading: false,
        error: hasAnySuccess ? "" : text.errors.syncFailed,
        partialErrors: failures,
        updatedAt: hasAnySuccess ? Date.now() : state.updatedAt,
        orders:
          orders.status === "fulfilled"
            ? arrayPayload(orders.value)
            : state.orders,
        transactions:
          transactions.status === "fulfilled"
            ? arrayPayload(transactions.value)
            : state.transactions,
        wallet: wallet.status === "fulfilled" ? wallet.value : state.wallet,
        plans:
          plans.status === "fulfilled"
            ? arrayPayload(plans.value)
            : state.plans,
        subscriptions: subscriptionsAvailable
          ? mergeSubscriptionProgress(subscriptionRecords, progressRecords)
          : state.subscriptions,
      };
    });
  }

  async function loadCheckoutInfo() {
    if (!managed.accessToken) {
      throw new Error(text.errors.loginRequired);
    }
    return managedAuthenticatedJsonRequest<CheckoutInfo>(
      "/api/v1/payment/checkout-info",
    );
  }

  function applyCheckoutInfo(info: CheckoutInfo) {
    setCheckoutInfo(info);
    if (playDistribution) {
      setPaymentMethod("");
      return;
    }
    const methods = directActualPaymentMethodsFromCheckout(info);
    const firstMethod = methods[0]?.payment_type || "";
    setPaymentMethod((value) =>
      methods.some((method) => method.payment_type === value)
        ? value
        : firstMethod,
    );
    if (info.global_min && Number(rechargeAmount) < info.global_min) {
      setRechargeAmount(String(info.global_min));
    }
  }

  async function refreshCheckoutInfo() {
    if (!managed.accessToken) return;
    setCheckoutLoading(true);
    setPaymentError("");
    try {
      applyCheckoutInfo(await loadCheckoutInfo());
    } catch (error) {
      setPaymentError(
        localizedMobileErrorMessage(error, text.errors.syncFailed),
      );
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function refreshCoupons(status = couponStatus) {
    if (!managed.accessToken) return;
    setCouponLoading(true);
    try {
      const response = await managedAuthenticatedJsonRequest<any>(
        `/api/v1/coupons/me?status=${encodeURIComponent(
          status,
        )}&page=1&page_size=100`,
      );
      setCoupons(arrayPayload(response) as UserCoupon[]);
      setCouponError("");
    } catch (error) {
      setCouponError(
        localizedMobileErrorMessage(error, text.errors.syncFailed),
      );
    } finally {
      setCouponLoading(false);
    }
  }

  async function selectPaymentCoupon(
    couponID: number | null,
    orderType: "balance" | "subscription",
    plan?: any,
  ) {
    if (playDistribution) {
      setSelectedCouponID(null);
      setCouponQuote(null);
      setCouponError(text.account.playCommerceUnavailable);
      return;
    }
    setSelectedCouponID(couponID);
    setCouponQuote(null);
    setCouponError("");
    if (!couponID) return;
    const amount =
      orderType === "subscription"
        ? Number(plan?.price || plan?.amount || 0)
        : Number(rechargeAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    try {
      const method = await ensurePaymentMethod();
      const quote = await managedAuthenticatedJsonRequest<CouponPaymentQuote>(
        "/api/v1/payment/coupons/quote",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coupon_id: couponID,
            amount,
            payment_type: method,
            order_type: orderType,
            plan_id: orderType === "subscription" ? Number(plan?.id || 0) : 0,
          }),
        },
      );
      setCouponQuote(quote);
    } catch (error) {
      setSelectedCouponID(null);
      setCouponError(
        localizedMobileErrorMessage(error, text.errors.syncFailed),
      );
    }
  }

  async function ensurePaymentMethod() {
    if (playDistribution) {
      throw new Error(text.account.playCommerceUnavailable);
    }
    let methods = paymentMethods;
    if (!methods.length) {
      setCheckoutLoading(true);
      try {
        const info = await loadCheckoutInfo();
        applyCheckoutInfo(info);
        methods = directActualPaymentMethodsFromCheckout(info);
      } finally {
        setCheckoutLoading(false);
      }
    }
    const method = paymentMethod || methods[0]?.payment_type || "";
    if (!method) {
      throw new Error(text.errors.noPaymentMethod);
    }
    return method;
  }

  async function checkUpdate() {
    if (playDistribution) {
      setUpdateState((state) => ({
        ...state,
        loading: false,
        checked: true,
        error: "",
      }));
      return;
    }
    const manifestUrl = getAndroidManifestUrl(clientConfig);
    if (!manifestUrl) {
      setUpdateState({
        loading: false,
        checked: true,
        error: text.account.missingManifestUrl,
      });
      return;
    }

    setUpdateState((state) => ({ ...state, loading: true, error: "" }));
    try {
      const response = await fetch(manifestUrl, { cache: "no-store" });
      const manifest = (await response.json()) as AndroidUpdateManifest;
      if (!response.ok) {
        throw new Error(text.account.manifestReadFailed);
      }
      setUpdateState({
        loading: false,
        checked: true,
        manifest,
        error: "",
      });
    } catch (error) {
      setUpdateState({
        loading: false,
        checked: true,
        error:
          error instanceof Error && error.message
            ? error.message
            : text.account.checkUpdateFailed,
      });
    }
  }

  async function startApkDownload() {
    if (!apkUrl) return;
    setDownloadProgress(0);
    setDownloadStatus(text.account.downloading(0));
    try {
      const result = await startNativeDownload(
        apkUrl,
        "jisudengchat-android.apk",
        "JisudengChat Android",
      );
      if (!result.id) {
        setDownloadProgress(100);
        setDownloadStatus(text.account.installingApk);
        await installDownloadedApk(
          undefined,
          result.path,
          updateState.manifest?.sha256,
        ).catch((error) => {
          setDownloadStatus(
            error instanceof Error && /install permission/i.test(error.message)
              ? text.account.installPermissionRequired
              : text.errors.downloadFailed,
          );
        });
        return;
      }
      if (downloadPollRef.current)
        window.clearInterval(downloadPollRef.current);
      downloadPollRef.current = window.setInterval(async () => {
        const status = await getNativeDownloadStatus(String(result.id));
        const progress = Math.round(status.progress || 0);
        setDownloadProgress(progress);
        setDownloadStatus(
          status.status === "success"
            ? text.account.downloaded
            : text.account.downloading(progress),
        );
        if (status.status === "success" || status.status === "failed") {
          if (downloadPollRef.current) {
            window.clearInterval(downloadPollRef.current);
            downloadPollRef.current = null;
          }
          if (status.status === "success") {
            setDownloadStatus(text.account.installingApk);
            await installDownloadedApk(
              String(result.id),
              status.localUri,
              updateState.manifest?.sha256,
            ).catch((error) => {
              setDownloadStatus(
                error instanceof Error &&
                  /install permission|unknown app sources/i.test(error.message)
                  ? text.account.installPermissionRequired
                  : text.account.installOpenFailed,
              );
            });
            await showNativeNotification(
              "JisudengChat",
              text.account.downloaded,
            );
          }
          if (status.status === "failed") {
            setDownloadStatus(text.errors.downloadFailed);
          }
        }
      }, 1000);
    } catch {
      setDownloadStatus(text.errors.downloadFailed);
    }
  }

  function feedbackDiagnostics(deviceInfo: Record<string, any> = {}) {
    const deviceLabel = [
      deviceInfo.manufacturer,
      deviceInfo.model,
      deviceInfo.androidVersion ? `Android ${deviceInfo.androidVersion}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return [
      "JisudengChat Android feedback",
      `version=${currentVersion}`,
      `user=${workspace?.user?.email || workspace?.user?.id || ""}`,
      `group=${accountGroupName}`,
      `backend=${managed.backendBaseUrl}`,
      `device=${deviceLabel || navigator.userAgent || ""}`,
      `lastSync=${managed.lastSyncAt}`,
      `lastError=${
        managed.lastError || accountData.error || paymentError || ""
      }`,
      mobileNetworkDiagnosticLine(),
      `requestDiagnostics=${JSON.stringify(
        getManagedRequestDiagnostics(8).map((item) => ({
          at: item.at,
          method: item.method,
          path: item.path,
          transport: item.transport,
          attempt: item.attempt,
          status: item.status,
          category: item.category,
          message: item.message,
        })),
      )}`,
      `crashLog=${
        localStorage.getItem(accountStorageKey(CRASH_LOG_STORAGE_KEY)) || ""
      }`,
    ]
      .map((line) => sanitizeDiagnosticText(line))
      .join("\n");
  }

  async function copyFeedback() {
    const deviceInfo = (await getNativeDeviceInfo().catch(
      () => ({}),
    )) as Record<string, any>;
    const payload = feedbackDiagnostics(deviceInfo);
    try {
      await shareText(payload, "JisudengChat");
      await navigator.clipboard?.writeText(payload);
      alert(text.account.feedbackCopied);
    } catch {
      alert(text.errors.copyFailed);
    }
  }

  async function addFeedbackScreenshotsFromFiles(files: FileList | File[]) {
    const remaining = 3 - feedbackScreenshots.length;
    if (remaining <= 0) {
      setFeedbackError(text.account.feedbackScreenshotLimit);
      return;
    }
    setFeedbackError("");
    const selected = Array.from(files).slice(0, remaining);
    const drafts: MobileFeedbackScreenshotDraft[] = [];
    for (const file of selected) {
      drafts.push({
        id: `feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dataUrl: await compressImage(file, 420 * 1024),
        fileName: file.name || `feedback-${Date.now()}.png`,
      });
    }
    setFeedbackScreenshots((items) => [...items, ...drafts].slice(0, 3));
  }

  async function addFeedbackCameraScreenshot() {
    if (feedbackScreenshots.length >= 3) {
      setFeedbackError(text.account.feedbackScreenshotLimit);
      return;
    }
    setFeedbackError("");
    try {
      const result = await captureImage(`feedback-${Date.now()}.jpg`);
      if (!result.dataUrl) {
        throw new Error(text.errors.emptyCameraResult);
      }
      const dataUrl = await compressImage(
        dataUrlToBlob(result.dataUrl),
        420 * 1024,
      );
      setFeedbackScreenshots((items) =>
        [
          ...items,
          {
            id: `feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            dataUrl,
            fileName: `feedback-${Date.now()}.jpg`,
          },
        ].slice(0, 3),
      );
    } catch (error) {
      setFeedbackError(
        localizedMobileErrorMessage(error, text.errors.permissionDenied),
      );
    }
  }

  function removeFeedbackScreenshot(id: string) {
    setFeedbackScreenshots((items) => items.filter((item) => item.id !== id));
  }

  async function submitFeedbackForm(
    form: FormData,
    requestPrefix = "feedback",
  ) {
    // Reuse the same keys when the canonical support route falls back to
    // its legacy compatibility route. Native transport retries are then
    // traceable and the backend can deduplicate the approved submission.
    const feedbackRequestId = clientRequestID(requestPrefix);
    const feedbackRequestOptions = {
      requestId: feedbackRequestId,
      idempotencyKey: feedbackRequestId,
    };
    try {
      return await managedFormDataRequest<any>(
        "/api/v1/mobile/support/tickets",
        form,
        text,
        feedbackRequestOptions,
      );
    } catch (error) {
      if (
        error instanceof ManagedApiError &&
        [404, 405, 501].includes(error.status || 0)
      ) {
        return managedFormDataRequest<any>(
          "/api/v1/play/mobile-feedback",
          form,
          text,
          feedbackRequestOptions,
        );
      }
      throw error;
    }
  }

  async function submitFeedback() {
    if (!managed.accessToken) {
      setFeedbackError(text.errors.loginRequired);
      return;
    }
    if (feedbackTitle.trim().length < 2 || feedbackContent.trim().length < 5) {
      setFeedbackError(text.errors.feedbackInvalid);
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackError("");
    setFeedbackMessage("");
    try {
      const deviceInfo = (await getNativeDeviceInfo().catch(
        () => ({}),
      )) as Record<string, any>;
      const form = new FormData();
      const groupID = accountGroupID;
      form.append("title", feedbackTitle.trim());
      form.append("category", feedbackCategory);
      form.append("content", feedbackContent.trim());
      form.append("app_version", installedRelease.name);
      form.append("platform", "android");
      form.append("installation_id", getInviteInstallationId());
      form.append("channel", "official_android");
      const referral = loadInviteReferral();
      if (referral?.campaign_id) {
        form.append("referrer", `campaign:${referral.campaign_id}`);
      } else if (referral?.aff_code) {
        form.append("referrer", `affiliate:${referral.aff_code}`);
      }
      form.append(
        "device_model",
        [deviceInfo.manufacturer, deviceInfo.model].filter(Boolean).join(" "),
      );
      form.append("android_version", String(deviceInfo.androidVersion || ""));
      form.append("system_version", String(deviceInfo.sdkInt || ""));
      form.append("group_name", accountGroupName);
      if (groupID) form.append("group_id", String(groupID));
      form.append("backend_url", managed.backendBaseUrl);
      form.append(
        "last_error",
        sanitizeDiagnosticText(
          managed.lastError || accountData.error || paymentError || "",
        ),
      );
      form.append(
        "crash_log",
        sanitizeDiagnosticText(
          localStorage.getItem(accountStorageKey(CRASH_LOG_STORAGE_KEY)) || "",
        ),
      );
      form.append(
        "device_info",
        JSON.stringify({
          ...deviceInfo,
          userAgent: navigator.userAgent,
          language: navigator.language,
          screen: `${window.screen.width}x${window.screen.height}`,
          diagnostics: feedbackDiagnostics(deviceInfo),
        }),
      );
      feedbackScreenshots.forEach((shot, index) => {
        form.append(
          "screenshots",
          dataUrlToBlob(shot.dataUrl),
          shot.fileName || `feedback-${index + 1}.png`,
        );
      });
      const result = await submitFeedbackForm(form, "feedback");
      setFeedbackMessage(
        result?.ticket_id || result?.id
          ? `${text.account.feedbackSubmitted} · #${
              result.ticket_id || result.id
            }`
          : text.account.feedbackSubmitted,
      );
      setFeedbackTitle("");
      setFeedbackContent("");
      setFeedbackCategory("bug");
      setFeedbackScreenshots([]);
      navigate(Path.AccountFeedback, { replace: true });
      await refreshSupportTickets();
    } catch (error) {
      setFeedbackError(
        localizedMobileErrorMessage(error, text.errors.saveFailed),
      );
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  async function redeemAccountCode() {
    const code = redeemCode.trim();
    if (!managed.accessToken) {
      setRedeemError(text.errors.loginRequired);
      return;
    }
    if (!code) {
      setRedeemError(text.account.redeemCodeRequired);
      return;
    }
    setRedeemBusy(true);
    setRedeemError("");
    setRedeemMessage("");
    const payload = {
      code,
      redeem_code: code,
      coupon_code: code,
      promo_code: code,
      source: "android_app",
    };
    const endpoints = [
      "/api/v1/redeem-codes/redeem",
      "/api/v1/redeem",
      "/api/v1/user/redeem-code",
      "/api/v1/redeem/redeem",
      "/api/v1/payment/redeem",
    ];
    let firstError = "";
    try {
      for (const endpoint of endpoints) {
        try {
          const result = await managedAuthenticatedJsonRequest<any>(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          const amount = result?.amount || result?.balance || result?.value;
          const planName =
            result?.plan_name || result?.package_name || result?.product_name;
          setRedeemMessage(
            [
              text.account.redeemSuccess,
              amount ? formatMoney(amount) : "",
              planName ? String(planName) : "",
            ]
              .filter(Boolean)
              .join(" · "),
          );
          setRedeemCode("");
          await managed.bootstrap().catch(() => {});
          await refreshAccountData().catch(() => {});
          await refreshCheckoutInfo().catch(() => {});
          return;
        } catch (error) {
          const message = localizedMobileErrorMessage(
            error,
            text.account.redeemFailed,
          );
          firstError ||= message;
          if (!/404|not found|不存在|未找到|no route|路由/i.test(message)) {
            break;
          }
        }
      }
      throw new Error(firstError || text.account.redeemUnavailable);
    } catch (error) {
      setRedeemError(
        localizedMobileErrorMessage(error, text.account.redeemFailed),
      );
    } finally {
      setRedeemBusy(false);
    }
  }

  async function openDirectRedeemCodeShop() {
    if (!directRedeemShopUrl) return;
    if (webOpenMode === "in_app") {
      navigate(Path.AccountDirectCodeShop);
      return;
    }
    try {
      await openExternalUrl(directRedeemShopUrl);
      setRedeemError("");
      setPaymentError("");
    } catch (error) {
      const message = localizedMobileErrorMessage(
        error,
        text.errors.paymentFailed,
      );
      setRedeemError(message);
      setPaymentError(message);
      void showNativeToast(message).catch(() => undefined);
    }
  }

  async function submitPlayBillingPurchase(
    candidate: PlayBillingCandidate,
    purchase: NativePlayBillingPurchase,
  ) {
    const purchaseToken = purchase.purchaseToken;
    if (!purchaseToken) {
      throw new Error("play_billing_missing_purchase_token");
    }
    const client = await mobilePlatformClient();
    const requestId = clientRequestID("play-billing");
    const result = await client.playBilling.submitPurchase(
      {
        product_id: candidate.productId,
        product_type: candidate.productType,
        purchase_token: purchaseToken,
        order_id: purchase.orderId,
        package_name: purchase.packageName || "com.jisudeng.chat",
        purchase_time: purchase.purchaseTime,
        purchase_state: purchase.purchaseState,
        acknowledged: purchase.acknowledged,
        quantity: purchase.quantity,
        original_json: purchase.originalJson,
        signature: purchase.signature,
        plan_id: candidate.planId,
        amount: candidate.amount,
        order_type: candidate.orderType,
        locale: text.dateLocale,
        client_request_id: requestId,
      },
      {
        headers: {
          "X-Request-ID": requestId,
          "X-Client-Request-ID": requestId,
          "Idempotency-Key": requestId,
        },
      },
    );
    if (result.consume && !result.consumed) {
      await consumePlayBillingPurchase(purchaseToken);
    }
    if (result.acknowledge && !result.acknowledged) {
      await acknowledgePlayBillingPurchase(purchaseToken);
    }
    return result;
  }

  async function purchasePlayBillingItem(candidate: PlayBillingCandidate) {
    if (!managed.accessToken) {
      setPlayBillingError(text.errors.loginRequired);
      return;
    }
    if (playBillingBusyProductId) return;
    setPlayBillingBusyProductId(candidate.productId);
    setPlayBillingError("");
    setPlayBillingMessage("");
    try {
      const product = playBillingProducts[candidate.productId];
      const result = await launchPlayBillingPurchase({
        productId: candidate.productId,
        productType: candidate.productType,
        offerToken: product?.offerToken || candidate.offerToken,
        obfuscatedAccountId: activeAccountId || undefined,
      });
      if (result.status === "cancelled") {
        setPlayBillingMessage(text.account.playBillingCancelled);
        return;
      }
      if (result.status === "pending") {
        setPlayBillingMessage(text.account.playBillingPending);
        return;
      }
      if (result.status !== "purchased") {
        throw new Error(
          result.debugMessage ||
            result.reason ||
            "play_billing_purchase_failed",
        );
      }
      const purchases = result.purchases || [];
      if (!purchases.length) throw new Error("play_billing_missing_purchase");
      const serverResults = [];
      for (const purchase of purchases) {
        serverResults.push(
          await submitPlayBillingPurchase(candidate, purchase),
        );
      }
      const successMessage =
        serverResults
          .map((item) => item.message)
          .filter(Boolean)
          .join(" · ") || text.account.playBillingSubmitted;
      setPlayBillingMessage(successMessage);
      await Promise.all([
        refreshAccountData().catch(() => undefined),
        managed.bootstrap({ silent: true }).catch(() => undefined),
      ]);
    } catch (error) {
      const fallback =
        error instanceof ManagedApiError &&
        [404, 501, 503].includes(error.status || 0)
          ? text.account.playBillingBackendRequired
          : text.account.playBillingFailed;
      setPlayBillingError(localizedMobileErrorMessage(error, fallback));
    } finally {
      setPlayBillingBusyProductId("");
    }
  }

  async function createPaymentOrder(
    orderType: "balance" | "subscription",
    plan?: any,
  ) {
    if (playDistribution) {
      setPaymentError(text.account.playCommerceUnavailable);
      window.setTimeout(
        () =>
          paymentFeedbackRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        0,
      );
      return;
    }
    const amount =
      orderType === "subscription"
        ? Number(plan?.price || plan?.amount || 0)
        : Number(rechargeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError(text.errors.emptyAmount);
      window.setTimeout(
        () =>
          paymentFeedbackRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        0,
      );
      return;
    }

    setPaymentBusy(true);
    setPaymentError("");
    try {
      if (orderType === "balance" && checkoutInfo?.balance_disabled) {
        throw new Error(text.errors.balancePaymentDisabled);
      }
      const method = await ensurePaymentMethod();
      const client = await mobilePlatformClient();
      const result = normalizeMobilePaymentOrder(
        await client.payments.create({
          provider: method,
          payment_type: method,
          amount,
          order_type: orderType,
          plan_id: orderType === "subscription" ? Number(plan?.id || 0) : 0,
          is_mobile: true,
          payment_source: "android_app",
          coupon_id: selectedCouponID || undefined,
          return_url: resolvePaymentReturnUrl(clientConfig),
          client_request_id: clientRequestID("payment"),
          locale: text.dateLocale,
        }),
        orderType,
      );
      setCreatedOrder(result);
      await refreshCoupons().catch(() => {});
      setOrderDetail(null);
      const payUrl = primaryPaymentUrl(result);
      if (payUrl) {
        await openExternalUrl(payUrl).catch((error) => {
          setPaymentError(
            localizedMobileErrorMessage(error, text.errors.paymentFailed),
          );
        });
      }
      window.setTimeout(
        () =>
          paymentFeedbackRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        0,
      );
      await refreshAccountData().catch(() => {});
    } catch (error) {
      setPaymentError(
        localizedMobileErrorMessage(error, text.errors.paymentFailed),
      );
      window.setTimeout(
        () =>
          paymentFeedbackRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        0,
      );
    } finally {
      setPaymentBusy(false);
    }
  }

  async function verifyCreatedOrder() {
    if (paymentVerifyInFlightRef.current || !createdOrder) return;
    paymentVerifyInFlightRef.current = true;
    try {
      await verifyCreatedOrderOnce();
    } finally {
      paymentVerifyInFlightRef.current = false;
    }
  }

  async function verifyCreatedOrderOnce() {
    const mobileOrderId = createdOrder?.order_id || createdOrder?.id;
    if (mobileOrderId) {
      let shouldTryLegacyPaymentVerify = false;
      setPaymentBusy(true);
      setPaymentError("");
      try {
        const client = await mobilePlatformClient();
        const detail = normalizeMobilePaymentOrder(
          await client.payments.sync(mobileOrderId, {
            client_request_id: clientRequestID("payment-sync"),
          }),
          createdOrder?.order_type,
        );
        setCreatedOrder((order) =>
          order
            ? {
                ...order,
                ...detail,
                pay_url: detail.pay_url || order.pay_url,
                payment_url: detail.payment_url || order.payment_url,
                checkout_url: detail.checkout_url || order.checkout_url,
                h5_url: detail.h5_url || order.h5_url,
                mweb_url: detail.mweb_url || order.mweb_url,
                deeplink: detail.deeplink || order.deeplink,
                deep_link: detail.deep_link || order.deep_link,
                scheme_url: detail.scheme_url || order.scheme_url,
                app_url: detail.app_url || order.app_url,
                url: detail.url || order.url,
                qr_code: detail.qr_code || order.qr_code,
                code_url: detail.code_url || order.code_url,
              }
            : detail,
        );
        setOrderDetail(detail.order || detail);
        await managed.bootstrap({ silent: true }).catch(() => {});
        await refreshAccountData().catch(() => {});
        return;
      } catch (error) {
        if (
          error instanceof ManagedApiError &&
          [404, 405, 501].includes(error.status || 0)
        ) {
          shouldTryLegacyPaymentVerify = true;
        } else {
          setPaymentError(
            localizedMobileErrorMessage(error, text.errors.orderVerifyFailed),
          );
        }
      } finally {
        setPaymentBusy(false);
      }
      if (!shouldTryLegacyPaymentVerify) return;
    }
    if (createdOrder?.resume_token) {
      setPaymentBusy(true);
      setPaymentError("");
      try {
        const detail = await managedApiJsonRequest<any>(
          managed.backendBaseUrl,
          "/api/v1/payment/public/orders/resolve",
          {
            method: "POST",
            body: JSON.stringify({ resume_token: createdOrder.resume_token }),
          },
        );
        setCreatedOrder((order) =>
          order
            ? { ...order, ...detail, order_id: detail.id || order.order_id }
            : order,
        );
        setOrderDetail(detail);
        await managed.bootstrap({ silent: true }).catch(() => {});
        await refreshAccountData().catch(() => {});
        return;
      } catch (error) {
        setPaymentError(
          localizedMobileErrorMessage(error, text.errors.orderVerifyFailed),
        );
      } finally {
        setPaymentBusy(false);
      }
    }
    if (mobileOrderId && !createdOrder?.out_trade_no) {
      setPaymentBusy(true);
      setPaymentError("");
      try {
        const detail = await managedAuthenticatedJsonRequest<any>(
          `/api/v1/payment/orders/${mobileOrderId}`,
        );
        setCreatedOrder((order) =>
          order
            ? {
                ...order,
                ...detail,
                order_id: detail.id || order.order_id,
                pay_url: order.pay_url,
                payment_url: order.payment_url,
                checkout_url: order.checkout_url,
                h5_url: order.h5_url,
                mweb_url: order.mweb_url,
                deeplink: order.deeplink,
                deep_link: order.deep_link,
                scheme_url: order.scheme_url,
                app_url: order.app_url,
                url: order.url,
                qr_code: order.qr_code,
                code_url: order.code_url,
              }
            : order,
        );
        setOrderDetail(detail);
        await managed.bootstrap().catch(() => {});
        await refreshAccountData().catch(() => {});
      } catch (error) {
        setPaymentError(
          localizedMobileErrorMessage(error, text.errors.orderVerifyFailed),
        );
      } finally {
        setPaymentBusy(false);
      }
      return;
    }
    if (!createdOrder?.out_trade_no) return;
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const detail = await managedAuthenticatedJsonRequest<any>(
        "/api/v1/payment/orders/verify",
        {
          method: "POST",
          body: JSON.stringify({ out_trade_no: createdOrder.out_trade_no }),
        },
      );
      setCreatedOrder((order) =>
        order
          ? {
              ...order,
              ...detail,
              order_id: detail.id || order.order_id,
              pay_url: order.pay_url,
              payment_url: order.payment_url,
              checkout_url: order.checkout_url,
              h5_url: order.h5_url,
              mweb_url: order.mweb_url,
              deeplink: order.deeplink,
              deep_link: order.deep_link,
              scheme_url: order.scheme_url,
              app_url: order.app_url,
              url: order.url,
              qr_code: order.qr_code,
              code_url: order.code_url,
            }
          : order,
      );
      setOrderDetail(detail);
      await managed.bootstrap().catch(() => {});
      await refreshAccountData().catch(() => {});
    } catch (error) {
      setPaymentError(
        localizedMobileErrorMessage(error, text.errors.orderVerifyFailed),
      );
    } finally {
      setPaymentBusy(false);
    }
  }

  async function cancelCreatedOrder() {
    const id = createdOrder?.order_id || createdOrder?.id;
    if (!id) return;
    setPaymentBusy(true);
    setPaymentError("");
    try {
      await managedAuthenticatedJsonRequest<any>(
        `/api/v1/payment/orders/${id}/cancel`,
        { method: "POST" },
      );
      setCreatedOrder((order) =>
        order ? { ...order, status: "cancelled" } : order,
      );
      await refreshAccountData().catch(() => {});
      await refreshCoupons().catch(() => {});
    } catch (error) {
      setPaymentError(
        localizedMobileErrorMessage(error, text.errors.requestCancelled),
      );
    } finally {
      setPaymentBusy(false);
    }
  }

  async function fetchOrderDetail(id: string) {
    if (!id || !managed.accessToken) return;
    setOrderDetail(null);
    try {
      const client = await mobilePlatformClient();
      const detail = normalizeMobilePaymentOrder(
        await client.payments.detail(id),
      );
      setOrderDetail(detail.order || detail);
      setPaymentError("");
    } catch (error) {
      if (
        !(error instanceof ManagedApiError) ||
        ![404, 405, 501].includes(error.status || 0)
      ) {
        setPaymentError(
          localizedMobileErrorMessage(error, text.errors.syncFailed),
        );
        return;
      }
      try {
        const detail = await managedAuthenticatedJsonRequest<any>(
          `/api/v1/payment/orders/${id}`,
        );
        setOrderDetail(detail);
      } catch (legacyError) {
        setPaymentError(
          localizedMobileErrorMessage(legacyError, text.errors.syncFailed),
        );
      }
    }
  }

  function copyPayUrl() {
    const url = primaryPaymentUrl(createdOrder);
    if (!url) return;
    navigator.clipboard?.writeText(url).catch(() => {});
    shareText(url, "JisudengChat").catch(() => {});
  }

  async function openCreatedOrderPay() {
    const url = primaryPaymentUrl(createdOrder);
    if (!url) {
      setPaymentError(text.account.paymentNoInfo);
      return;
    }
    try {
      setPaymentError("");
      await openExternalUrl(url);
    } catch (error) {
      setPaymentError(
        localizedMobileErrorMessage(error, text.errors.paymentFailed),
      );
    }
  }

  useEffect(() => {
    refreshAccountData().catch((error) => {
      setAccountData({
        loading: false,
        error: localizedMobileErrorMessage(error, text.errors.syncFailed),
      });
    });
    refreshCheckoutInfo().catch(() => {});
    refreshCoupons().catch(() => {});
    return () => {
      if (downloadPollRef.current)
        window.clearInterval(downloadPollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCoupons([]);
    setSelectedCouponID(null);
    setCouponQuote(null);
    setCouponStatus("available");
    refreshCoupons("available").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managed.session?.user_id]);

  useEffect(() => {
    if (route === Path.AccountRecharge || route === Path.AccountPlans) {
      setCouponStatus("available");
      refreshCoupons("available").catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    if (!playDistribution) return;
    setCreatedOrder(null);
    setPaymentMethod("");
    setPaymentError("");
    setCouponQuote(null);
  }, [playDistribution]);

  useEffect(() => {
    if (!playDistribution) return;
    if (route !== Path.AccountRecharge && route !== Path.AccountPlans) {
      return;
    }
    if (!activePlayBillingCandidates.length) {
      setPlayBillingProducts({});
      setPlayBillingError(text.account.playBillingNoProducts);
      return;
    }
    let cancelled = false;
    setPlayBillingLoading(true);
    setPlayBillingError("");
    const grouped = activePlayBillingCandidates.reduce(
      (groups, candidate) => {
        const ids = groups[candidate.productType] || [];
        if (!ids.includes(candidate.productId)) ids.push(candidate.productId);
        groups[candidate.productType] = ids;
        return groups;
      },
      {} as Record<NativePlayBillingProductType, string[]>,
    );
    Promise.all(
      (
        Object.entries(grouped) as Array<
          [NativePlayBillingProductType, string[]]
        >
      ).map(([productType, productIds]) =>
        queryPlayBillingProducts(productIds, productType),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const nextProducts: Record<string, NativePlayBillingProduct> = {};
        const errors: string[] = [];
        results.forEach((result) => {
          result.products?.forEach((product) => {
            nextProducts[product.productId] = product;
          });
          if (!result.available && result.reason) errors.push(result.reason);
          if (result.debugMessage && result.responseCode)
            errors.push(result.debugMessage);
        });
        setPlayBillingProducts(nextProducts);
        setPlayBillingError(
          errors.length ? text.account.playBillingUnavailable(errors[0]) : "",
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setPlayBillingProducts({});
        setPlayBillingError(
          localizedMobileErrorMessage(
            error,
            text.account.playBillingUnavailable("query_failed"),
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setPlayBillingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activePlayBillingCandidates,
    playBillingProductQueryKey,
    playDistribution,
    route,
    text.account,
  ]);

  useEffect(() => {
    persistPendingPaymentOrder(createdOrder);
  }, [createdOrder]);

  useEffect(() => {
    const verifyAfterResume = () => {
      if (createdOrder && isPendingOrderStatus(createdOrder.status)) {
        verifyCreatedOrder().catch(() => {});
      }
    };
    const verifyAfterVisibilityChange = () => {
      if (document.visibilityState === "visible") verifyAfterResume();
    };
    window.addEventListener("jisudeng-native-resume", verifyAfterResume);
    window.addEventListener("jisudeng-payment-return", verifyAfterResume);
    document.addEventListener("visibilitychange", verifyAfterVisibilityChange);
    return () => {
      window.removeEventListener("jisudeng-native-resume", verifyAfterResume);
      window.removeEventListener("jisudeng-payment-return", verifyAfterResume);
      document.removeEventListener(
        "visibilitychange",
        verifyAfterVisibilityChange,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    createdOrder?.out_trade_no,
    createdOrder?.resume_token,
    createdOrder?.status,
  ]);

  useEffect(() => {
    if (
      route === Path.AccountUpdate &&
      !playDistribution &&
      !updateState.checked &&
      !updateState.loading
    ) {
      checkUpdate().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playDistribution, route, updateState.checked, updateState.loading]);

  useEffect(() => {
    if (route === Path.AccountOrders && selectedOrderID) {
      fetchOrderDetail(selectedOrderID).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, selectedOrderID]);

  useEffect(() => {
    if (route === Path.AccountSupport) void refreshSupportTickets();
    if (route === Path.AccountFeedback) void refreshSupportTickets();
    if (route === Path.AccountFeedbackDetail) void refreshSupportTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, selectedSupportTicketID]);

  useEffect(() => {
    const refresh = () => void refreshPushInbox();
    refresh();
    window.addEventListener("jisudeng:push-inbox-change", refresh);
    window.addEventListener("jisudeng-native-resume", refresh);
    return () => {
      window.removeEventListener("jisudeng:push-inbox-change", refresh);
      window.removeEventListener("jisudeng-native-resume", refresh);
    };
  }, [refreshPushInbox]);

  useEffect(() => {
    if (route === Path.AccountProfile) void refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, managed.accessToken]);

  useEffect(() => {
    if (
      !(
        createdOrder?.order_id ||
        createdOrder?.id ||
        createdOrder?.out_trade_no
      ) ||
      !isPendingOrderStatus(createdOrder.status)
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      verifyCreatedOrder().catch(() => {});
    }, 6000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    createdOrder?.order_id,
    createdOrder?.id,
    createdOrder?.out_trade_no,
    createdOrder?.status,
  ]);

  useNativeBackHandler(route === Path.Settings, () => {
    if (showLogoutConfirm) {
      setShowLogoutConfirm(false);
      return;
    }
    handleNativeHomeBack(text);
  });

  if (route === Path.AccountAdmin) {
    return (
      <AndroidDetailShell
        title={text.account.adminCenter}
        subtitle={
          isAdmin ? text.account.adminRecognized : text.account.adminUnavailable
        }
        text={text}
        onRefresh={() => managed.bootstrap({ silent: true })}
      >
        {isAdmin ? (
          <Suspense fallback={<MobileLoading />}>
            <MobileAdminWorkspace client={adminClient} text={text} />
          </Suspense>
        ) : (
          <p className={styles["empty-copy"]}>
            {text.account.adminUnavailable}
          </p>
        )}
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountNotifications) {
    return (
      <AndroidDetailShell
        title={text.account.notifications}
        subtitle={text.account.notificationHint}
        text={text}
        onRefresh={() => void refreshPushInbox()}
      >
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.notifications}</h2>
            <span>{text.account.notificationUnread(unreadPushCount)}</span>
          </div>
          {!!pushInbox.length && (
            <div className={styles["inline-actions"]}>
              <button
                type="button"
                onClick={() =>
                  void markNativePushInboxRead().then(setPushInbox)
                }
              >
                {text.account.markAllNotificationsRead}
              </button>
              <button
                type="button"
                className={styles["danger-inline"]}
                onClick={() => void clearNativePushInbox().then(setPushInbox)}
              >
                {text.account.clearNotifications}
              </button>
            </div>
          )}
          <div
            className={styles["notification-inbox-list"]}
            aria-live="polite"
            aria-busy={pushInboxLoading}
          >
            {!pushInboxLoading && pushInbox.length === 0 && (
              <p className={styles["empty-copy"]}>
                {text.account.notificationEmpty}
              </p>
            )}
            {pushInbox.map((item) => (
              <button
                type="button"
                key={item.id}
                className={clsx(styles["notification-inbox-item"], {
                  [styles["unread"]]: !item.read,
                })}
                onClick={() => {
                  void markNativePushInboxRead([item.id]).then(setPushInbox);
                  window.dispatchEvent(
                    new CustomEvent("jisudeng:push-open", { detail: item }),
                  );
                }}
              >
                <i aria-hidden="true" />
                <span>
                  <strong>{item.title || text.account.notifications}</strong>
                  {!!item.body && <p>{item.body}</p>}
                  <small>{formatDateTime(item.receivedAt, text)}</small>
                </span>
                <em>{text.account.notificationOpen}</em>
              </button>
            ))}
          </div>
        </section>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountDirectCodeShop && directRedeemShopUrl) {
    return (
      <AndroidDetailShell
        title={text.account.directCodeShopTitle}
        subtitle={text.account.webOpenInApp}
        text={text}
        fallback={Path.AccountRedeem}
      >
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.openShopInApp}</h2>
            <span>{text.account.webOpenInApp}</span>
          </div>
          <iframe
            className={styles["direct-code-shop-frame"]}
            title={text.account.directCodeShopTitle}
            src={directRedeemShopUrl}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
          <div className={styles["inline-actions"]}>
            <button
              onClick={() => {
                navigator.clipboard
                  ?.writeText(directRedeemShopUrl)
                  .then(() => setRedeemMessage(text.account.shopLinkCopied))
                  .catch(() => setRedeemError(text.account.copyShopLink));
              }}
            >
              <CopyIcon />
              <span>{text.account.copyShopLink}</span>
            </button>
            <button onClick={() => openExternalUrl(directRedeemShopUrl)}>
              <DownloadIcon />
              <span>{text.account.openExternalBrowser}</span>
            </button>
          </div>
          {redeemMessage && (
            <div className={styles["form-success"]}>{redeemMessage}</div>
          )}
          {redeemError && (
            <div className={styles["form-error"]}>{redeemError}</div>
          )}
          <button
            className={styles["primary-action"]}
            onClick={() => navigate(Path.AccountRedeem)}
          >
            {text.account.directCodeShopRedeemAction}
          </button>
        </section>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountProfile) {
    const avatarUrl =
      profileAvatarUrl ||
      profile?.avatar_url ||
      workspace?.user?.avatar_url ||
      "";
    const displayName =
      profileUsername ||
      profile?.username ||
      workspace?.user?.username ||
      workspace?.user?.email ||
      "JisudengChat";
    const totpEnabled = Boolean(totpStatus?.enabled || profile?.totp_enabled);

    return (
      <AndroidDetailShell
        title={text.account.profile}
        subtitle={displayName}
        text={text}
        onRefresh={refreshProfile}
      >
        <AccountDataNotice
          data={{
            loading: profileLoading,
            error: profileError,
            updatedAt: profile ? Date.now() : undefined,
          }}
          text={text}
        />
        {profileMessage && (
          <div className={styles["form-success"]}>{profileMessage}</div>
        )}
        {profileError && (
          <div className={styles["form-error"]}>{profileError}</div>
        )}
        <section className={styles["profile-security-section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.profile}</h2>
            <span>{text.account.profileHint}</span>
          </div>
          <div className={styles["profile-avatar-preview"]}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} />
            ) : (
              <i>{displayName.slice(0, 1).toUpperCase()}</i>
            )}
            <span>
              <strong>{displayName}</strong>
              <small>{profile?.email || workspace?.user?.email || "-"}</small>
            </span>
          </div>
          <label className={styles["field-card"]}>
            <span>{text.account.username}</span>
            <input
              value={profileUsername}
              onChange={(event) =>
                setProfileUsername(event.currentTarget.value)
              }
              placeholder={text.account.username}
              autoComplete="nickname"
            />
          </label>
          <label className={styles["field-card"]}>
            <span>{text.account.avatarUrl}</span>
            <input
              value={profileAvatarUrl}
              onChange={(event) =>
                setProfileAvatarUrl(event.currentTarget.value)
              }
              placeholder="https://"
              inputMode="url"
              autoComplete="url"
            />
          </label>
          <button
            className={styles["primary-action"]}
            onClick={saveProfile}
            disabled={profileBusy}
          >
            {profileBusy ? text.loading : text.account.profileSave}
          </button>
        </section>

        <section className={styles["profile-security-section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.changePassword}</h2>
            <span>{text.account.security}</span>
          </div>
          <label className={styles["field-card"]}>
            <span>{text.account.currentPassword}</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) =>
                setCurrentPassword(event.currentTarget.value)
              }
              autoComplete="current-password"
            />
          </label>
          <label className={styles["field-card"]}>
            <span>{text.account.newPassword}</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.currentTarget.value)}
              autoComplete="new-password"
            />
          </label>
          <label className={styles["field-card"]}>
            <span>{text.account.confirmPassword}</span>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(event) =>
                setConfirmNewPassword(event.currentTarget.value)
              }
              autoComplete="new-password"
            />
          </label>
          <button
            className={styles["primary-action"]}
            onClick={changePassword}
            disabled={profileBusy}
          >
            {text.account.changePassword}
          </button>
        </section>

        <section className={styles["profile-security-section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.forgotPassword}</h2>
            <span>{text.account.resetPassword}</span>
          </div>
          <label className={styles["field-card"]}>
            <span>{text.login.email}</span>
            <input
              value={resetEmail}
              onChange={(event) => setResetEmail(event.currentTarget.value)}
              placeholder={text.login.email}
              inputMode="email"
              autoComplete="email"
            />
          </label>
          <button
            className={styles["wide-soft-action"]}
            onClick={sendProfileResetCode}
            disabled={profileBusy || !resetEmail.trim()}
          >
            {text.account.sendResetCode}
          </button>
          <label className={styles["field-card"]}>
            <span>{text.account.resetCode}</span>
            <input
              value={resetCode}
              onChange={(event) => setResetCode(event.currentTarget.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
          <label className={styles["field-card"]}>
            <span>{text.account.newPassword}</span>
            <input
              type="password"
              value={resetPassword}
              onChange={(event) => setResetPassword(event.currentTarget.value)}
              autoComplete="new-password"
            />
          </label>
          <label className={styles["field-card"]}>
            <span>{text.account.confirmPassword}</span>
            <input
              type="password"
              value={confirmResetPassword}
              onChange={(event) =>
                setConfirmResetPassword(event.currentTarget.value)
              }
              autoComplete="new-password"
            />
          </label>
          <button
            className={styles["primary-action"]}
            onClick={resetProfilePassword}
            disabled={profileBusy}
          >
            {text.account.resetPassword}
          </button>
        </section>

        <section className={styles["profile-security-section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.totp}</h2>
            <span>
              {totpEnabled
                ? text.account.totpEnabled
                : text.account.totpDisabled}
            </span>
          </div>
          {!totpEnabled && (
            <button
              className={styles["wide-soft-action"]}
              onClick={startTotpSetup}
              disabled={profileBusy}
            >
              {text.account.startTotpSetup}
            </button>
          )}
          {totpSetup && (
            <div className={styles["totp-setup-card"]}>
              {totpSetup.qr_code_url && (
                <img src={totpSetup.qr_code_url} alt={text.account.totp} />
              )}
              {totpSetup.secret && (
                <code>
                  {text.account.totpSecret}: {totpSetup.secret}
                </code>
              )}
            </div>
          )}
          <label className={styles["field-card"]}>
            <span>{text.account.totpCode}</span>
            <input
              value={totpCode}
              onChange={(event) => setTotpCode(event.currentTarget.value)}
              inputMode="numeric"
              maxLength={8}
              autoComplete="one-time-code"
            />
          </label>
          <div className={styles["inline-actions"]}>
            {!totpEnabled ? (
              <button
                onClick={enableTotp}
                disabled={profileBusy || !totpCode.trim()}
              >
                <FavoriteIcon />
                <span>{text.account.enableTotp}</span>
              </button>
            ) : (
              <button
                className={styles["danger-inline"]}
                onClick={disableTotp}
                disabled={profileBusy || !totpCode.trim()}
              >
                <CloseIcon />
                <span>{text.account.disableTotp}</span>
              </button>
            )}
            <button onClick={sendTotpEmailCode} disabled={profileBusy}>
              <SendIcon />
              <span>{text.account.sendTotpCode}</span>
            </button>
          </div>
        </section>

        <section className={styles["profile-security-section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.accountDeletion}</h2>
            <span>{text.account.accountDeletionReview}</span>
          </div>
          <p className={styles["empty-copy"]}>
            {text.account.accountDeletionHint}
          </p>
          <div className={styles["form-error"]}>
            {text.account.accountDeletionWarning}
          </div>
          <label className={styles["field-card"]}>
            <span>{text.account.accountDeletionReason}</span>
            <textarea
              value={accountDeletionReason}
              onChange={(event) =>
                setAccountDeletionReason(event.currentTarget.value)
              }
              placeholder={text.account.accountDeletionReasonPlaceholder}
              rows={3}
            />
          </label>
          <div className={styles["inline-actions"]}>
            <button
              onClick={sendAccountDeletionCode}
              disabled={accountDeletionBusy}
            >
              <SendIcon />
              <span>{text.account.accountDeletionSendCode}</span>
            </button>
          </div>
          <label className={styles["field-card"]}>
            <span>{text.account.accountDeletionVerifyCode}</span>
            <input
              value={accountDeletionVerifyCode}
              onChange={(event) =>
                setAccountDeletionVerifyCode(event.currentTarget.value)
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={text.account.accountDeletionVerifyCode}
            />
          </label>
          <label className={styles["field-card"]}>
            <span>{text.account.accountDeletionConfirmLabel}</span>
            <input
              value={accountDeletionConfirm}
              onChange={(event) =>
                setAccountDeletionConfirm(event.currentTarget.value)
              }
              placeholder={text.account.accountDeletionConfirmPlaceholder}
              autoCapitalize="characters"
              autoComplete="off"
            />
          </label>
          {accountDeletionError && (
            <div className={styles["form-error"]}>{accountDeletionError}</div>
          )}
          {accountDeletionMessage && (
            <div className={styles["form-success"]}>
              {accountDeletionMessage}
            </div>
          )}
          <button
            className={styles["danger-action"]}
            onClick={submitAccountDeletionRequest}
            disabled={accountDeletionBusy}
          >
            {accountDeletionBusy
              ? text.account.feedbackSubmitting
              : text.account.accountDeletionSubmit}
          </button>
        </section>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountRedeem) {
    return (
      <AndroidDetailShell
        title={text.account.redeemCenter}
        subtitle={text.account.redeemCenterHint}
        text={text}
        onRefresh={refreshAccountData}
      >
        <AccountDataNotice data={accountData} text={text} />
        {directRedeemShopUrl && (
          <section
            className={styles["section"]}
            data-distribution-commerce="direct-external-code-shop"
          >
            <div className={styles["section-head"]}>
              <h2>{text.account.directCodeShopTitle}</h2>
              <span>{text.account.redeemShortHint}</span>
            </div>
            <p className={styles["empty-copy"]}>
              {text.account.directCodeShopHint}
            </p>
            <button
              className={styles["primary-action"]}
              onClick={openDirectRedeemCodeShop}
            >
              {text.account.directCodeShopAction}
            </button>
            <p className={styles["empty-copy"]}>
              {text.account.directCodeShopComplianceHint}
            </p>
          </section>
        )}
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.redeemCode}</h2>
            <span>{formatMoney(workspace?.user?.balance)}</span>
          </div>
          <label className={styles["field-card"]}>
            <span>{text.account.redeemCode}</span>
            <input
              value={redeemCode}
              onChange={(event) =>
                setRedeemCode(event.currentTarget.value.toUpperCase())
              }
              placeholder={text.account.redeemCodePlaceholder}
              autoCapitalize="characters"
              autoComplete="off"
            />
          </label>
          <p className={styles["empty-copy"]}>{text.account.redeemHint}</p>
          {redeemError && (
            <div className={styles["form-error"]}>{redeemError}</div>
          )}
          {redeemMessage && (
            <div className={styles["form-success"]}>{redeemMessage}</div>
          )}
          <button
            className={styles["primary-action"]}
            onClick={redeemAccountCode}
            disabled={redeemBusy || !redeemCode.trim()}
          >
            {redeemBusy ? text.account.redeeming : text.account.redeemNow}
          </button>
        </section>
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.redeemRecords}</h2>
            <span>
              {text.shortCount(accountData.transactions?.length || 0)}
            </span>
          </div>
          <div className={styles["compact-list"]}>
            {accountData.transactions
              ?.filter((item: any) =>
                /redeem|coupon|promo|兑换|优惠/i.test(
                  [
                    item.reason,
                    item.type,
                    item.category,
                    item.source,
                    item.remark,
                    item.description,
                  ]
                    .filter(Boolean)
                    .join(" "),
                ),
              )
              .slice(0, 8)
              .map((item: any) => (
                <button
                  key={transactionPrimaryId(item)}
                  onClick={() =>
                    navigate(
                      `${Path.AccountWallet}?tx=${transactionPrimaryId(item)}`,
                    )
                  }
                >
                  <span>{localizedTransactionReason(item, text)}</span>
                  <strong>
                    {formatTransactionAmount(
                      item.balance_delta ||
                        item.balanceDelta ||
                        item.amount ||
                        0,
                    )}
                  </strong>
                  <small>
                    {formatDateTime(item.created_at || item.createdAt, text)}
                  </small>
                </button>
              ))}
            {!accountData.transactions?.some((item: any) =>
              /redeem|coupon|promo|兑换|优惠/i.test(
                [
                  item.reason,
                  item.type,
                  item.category,
                  item.source,
                  item.remark,
                  item.description,
                ]
                  .filter(Boolean)
                  .join(" "),
              ),
            ) && (
              <p className={styles["empty-copy"]}>
                {text.account.noRedeemRecords}
              </p>
            )}
          </div>
        </section>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountCoupons) {
    const statuses = ["available", "locked", "used", "expired"];
    const statusTitles: Record<string, string> = {
      available: text.account.couponAvailable,
      locked: text.account.couponLocked,
      used: text.account.couponUsed,
      expired: text.account.couponExpired,
    };
    return (
      <AndroidDetailShell
        title={text.account.coupons}
        subtitle={text.account.chooseCoupon}
        text={text}
        onRefresh={() => refreshCoupons()}
      >
        <div className={styles["payment-method-list"]}>
          {statuses.map((status) => (
            <button
              key={status}
              className={clsx({
                [styles["selected"]]: couponStatus === status,
              })}
              onClick={() => {
                setCouponStatus(status);
                refreshCoupons(status).catch(() => {});
              }}
            >
              <strong>{statusTitles[status]}</strong>
            </button>
          ))}
        </div>
        {couponError && (
          <div className={styles["form-error"]}>{couponError}</div>
        )}
        <div className={styles["compact-list"]}>
          {couponLoading && (
            <p className={styles["empty-copy"]}>{text.loading}</p>
          )}
          {!couponLoading && !coupons.length && (
            <p className={styles["empty-copy"]}>{text.account.noCoupons}</p>
          )}
          {coupons.map((coupon) => (
            <button key={coupon.id}>
              <span>{couponDisplayName(coupon, text)}</span>
              <strong>
                {statusTitles[coupon.status || ""] || text.notSynced}
              </strong>
              <small>
                {coupon.terms_snapshot?.benefit_value || "-"} ·{" "}
                {coupon.expires_at
                  ? formatDateTime(coupon.expires_at, text)
                  : "-"}
              </small>
            </button>
          ))}
        </div>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountRecharge && playDistribution) {
    return (
      <AndroidDetailShell
        title={text.account.recharge}
        subtitle={text.account.playCommerceSubtitle}
        text={text}
        onRefresh={refreshAccountData}
      >
        <AccountDataNotice data={accountData} text={text} />
        <section className={styles["plan-detail-card"]}>
          <div>
            <span>{text.account.balance}</span>
            <strong>{formatMoney(workspace?.user?.balance)}</strong>
          </div>
          <div>
            <span>{text.account.currentGroup}</span>
            <strong>{accountGroupName}</strong>
          </div>
        </section>
        <AndroidPlayBillingPanel
          text={text}
          candidates={playRechargeCandidates}
          products={playBillingProducts}
          loading={playBillingLoading}
          busyProductId={playBillingBusyProductId}
          error={playBillingError}
          message={playBillingMessage}
          onBuy={purchasePlayBillingItem}
          onRedeem={() => navigate(Path.AccountRedeem)}
        />
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountRecharge) {
    return (
      <AndroidDetailShell
        title={text.account.recharge}
        subtitle={text.account.appInternalPayment}
        text={text}
        onRefresh={refreshCheckoutInfo}
      >
        <AccountDataNotice data={accountData} text={text} />
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.selectAmount}</h2>
            <span>{formatMoney(workspace?.user?.balance)}</span>
          </div>
          <div className={styles["amount-grid"]}>
            {[20, 50, 100, 200].map((amount) => (
              <button
                key={amount}
                className={clsx({
                  [styles["active"]]: Number(rechargeAmount) === amount,
                })}
                onClick={() => {
                  setRechargeAmount(String(amount));
                  setCouponQuote(null);
                }}
              >
                {formatMoney(amount)}
              </button>
            ))}
          </div>
          <label className={styles["field-card"]}>
            <span>{text.account.customAmount}</span>
            <input
              value={rechargeAmount}
              inputMode="decimal"
              onChange={(event) => {
                setRechargeAmount(event.currentTarget.value);
                setCouponQuote(null);
              }}
            />
          </label>
        </section>
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.chooseCoupon}</h2>
            <span>
              {couponLoading ? text.loading : text.shortCount(coupons.length)}
            </span>
          </div>
          <div className={styles["payment-method-list"]}>
            <button
              className={clsx({
                [styles["selected"]]: selectedCouponID === null,
              })}
              onClick={() => selectPaymentCoupon(null, "balance")}
            >
              <strong>{text.account.noCoupon}</strong>
            </button>
            {coupons
              .filter((coupon) => coupon.status === "available")
              .map((coupon) => (
                <button
                  key={coupon.id}
                  className={clsx({
                    [styles["selected"]]: selectedCouponID === coupon.id,
                  })}
                  onClick={() => selectPaymentCoupon(coupon.id, "balance")}
                >
                  <strong>{couponDisplayName(coupon, text)}</strong>
                  <small>
                    {coupon.terms_snapshot?.benefit_value || "-"} ·{" "}
                    {coupon.expires_at
                      ? formatDateTime(coupon.expires_at, text)
                      : "-"}
                  </small>
                </button>
              ))}
          </div>
          {couponQuote && (
            <div className={styles["meta-row"]}>
              <span>{text.account.couponDiscount}</span>
              <strong>
                -{formatMoney(couponQuote.discount_amount || 0)} ·{" "}
                {text.account.couponFinalAmount}{" "}
                {formatMoney(couponQuote.pay_amount || 0)}
              </strong>
            </div>
          )}
          {couponError && (
            <div className={styles["form-error"]}>{couponError}</div>
          )}
        </section>
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.paymentMethod}</h2>
            <span>
              {checkoutLoading
                ? text.loading
                : text.shortCount(visiblePaymentOptionCount)}
            </span>
          </div>
          <div className={styles["payment-method-list"]}>
            {replacedWechatPaymentAvailable && (
              <DirectWechatReplacementPaymentButton
                text={text}
                onOpen={openDirectRedeemCodeShop}
              />
            )}
            {!checkoutLoading && !visiblePaymentOptionCount && (
              <p className={styles["empty-copy"]}>
                {text.account.noPaymentMethodsHint}
              </p>
            )}
            {paymentMethods.map((method) => (
              <button
                key={method.payment_type}
                className={clsx({
                  [styles["selected"]]: method.payment_type === paymentMethod,
                })}
                onClick={() => {
                  setPaymentMethod(method.payment_type || "");
                  setCouponQuote(null);
                }}
              >
                <strong>{paymentMethodLabel(method, text)}</strong>
                <small>
                  {method.currency || "CNY"} ·{" "}
                  {formatMoney(
                    method.single_min || checkoutInfo?.global_min || 0,
                  )}
                </small>
              </button>
            ))}
          </div>
          <button
            className={styles["primary-action"]}
            onClick={() => createPaymentOrder("balance")}
            disabled={paymentBusy || !paymentMethods.length}
          >
            {paymentBusy
              ? text.account.creatingOrder
              : text.account.createOrder}
          </button>
        </section>
        <div ref={paymentFeedbackRef}>
          {paymentError && (
            <div className={styles["form-error"]}>{paymentError}</div>
          )}
          {createdOrder && (
            <AndroidPaymentOrderCard
              order={createdOrder}
              text={text}
              busy={paymentBusy}
              onVerify={verifyCreatedOrder}
              onCancel={cancelCreatedOrder}
              onCopy={copyPayUrl}
              onOpenPay={openCreatedOrderPay}
            />
          )}
        </div>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountPlans && playDistribution) {
    return (
      <AndroidDetailShell
        title={text.account.packages}
        subtitle={text.account.playCommerceSubtitle}
        text={text}
        onRefresh={refreshAccountData}
      >
        <AccountDataNotice data={accountData} text={text} />
        <section className={styles["plan-detail-card"]}>
          <div>
            <span>{text.account.balance}</span>
            <strong>{formatMoney(workspace?.user?.balance)}</strong>
          </div>
          <div>
            <span>{text.account.currentGroup}</span>
            <strong>{accountGroupName}</strong>
          </div>
          <div>
            <span>{text.account.subscriptions}</span>
            <strong>
              {accountData.subscriptions?.[0]?.expires_at
                ? text.account.activeUntil(
                    formatDateTime(
                      accountData.subscriptions[0].expires_at,
                      text,
                    ),
                  )
                : localizedSubscriptionStatus(
                    accountData.subscriptions?.[0]?.status || "",
                    text,
                  ) || text.account.noSubscriptions}
            </strong>
          </div>
        </section>
        <AndroidPlayBillingPanel
          text={text}
          candidates={playPlanCandidates}
          products={playBillingProducts}
          loading={playBillingLoading}
          busyProductId={playBillingBusyProductId}
          error={playBillingError}
          message={playBillingMessage}
          onBuy={purchasePlayBillingItem}
          onRedeem={() => navigate(Path.AccountRedeem)}
        />
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountPlans) {
    const plans = checkoutInfo?.plans?.length
      ? checkoutInfo.plans
      : accountData.plans || [];
    if (selectedPlan) {
      const usage = planUsageInfo(
        selectedPlan,
        accountData.subscriptions || [],
      );
      const progress =
        Number.isFinite(usage.total) && Number(usage.total) > 0
          ? Math.min(
              100,
              Math.max(
                0,
                Number.isFinite(usage.used)
                  ? (Number(usage.used) / Number(usage.total)) * 100
                  : Number.isFinite(usage.remaining)
                  ? ((Number(usage.total) - Number(usage.remaining)) /
                      Number(usage.total)) *
                    100
                  : 0,
              ),
            )
          : 0;
      return (
        <AndroidDetailShell
          title={planDisplayName(selectedPlan, text) || text.account.planDetail}
          subtitle={text.account.confirmPlanPurchase}
          text={text}
          fallback={Path.AccountPlans}
          onBack={() => {
            setSelectedPlan(null);
            setPaymentError("");
            setCreatedOrder(null);
          }}
          onRefresh={refreshCheckoutInfo}
        >
          <section className={styles["plan-detail-card"]}>
            <div>
              <span>{text.account.planPrice}</span>
              <strong>{formatMoney(selectedPlan.price)}</strong>
            </div>
            <div>
              <span>{text.account.planGroup}</span>
              <strong>{planDescription(selectedPlan, text) || "-"}</strong>
            </div>
            <div>
              <span>{text.account.planValidity}</span>
              <strong>{planValidityLabel(selectedPlan, text) || "-"}</strong>
            </div>
            {planDescription(selectedPlan, text) && (
              <p>{planDescription(selectedPlan, text)}</p>
            )}
            {usage.subscription ? (
              <div className={styles["plan-usage"]}>
                <span>{text.account.usageProgress}</span>
                <SubscriptionUsageRows
                  subscription={usage.subscription}
                  text={text}
                />
              </div>
            ) : (
              <>
                <div>
                  <span>{text.account.includedBalance}</span>
                  <strong>
                    {formatQuota(usage.total, usage.unit) ||
                      text.account.unavailableUsage}
                  </strong>
                </div>
                <div>
                  <span>{text.account.usageProgress}</span>
                  <strong>
                    {formatQuota(usage.remaining, usage.unit) ||
                      formatQuota(usage.used, usage.unit) ||
                      text.account.unavailableUsage}
                  </strong>
                </div>
                {progress > 0 && <progress value={progress} max={100} />}
              </>
            )}
            {Array.isArray(selectedPlan.features) &&
              selectedPlan.features.length > 0 && (
                <ul>
                  {selectedPlan.features
                    .map((feature: unknown) =>
                      localizedPlanFeature(feature, text),
                    )
                    .filter(Boolean)
                    .map((feature: string) => (
                      <li key={feature}>{feature}</li>
                    ))}
                </ul>
              )}
          </section>
          <section className={styles["section"]}>
            <div className={styles["section-head"]}>
              <h2>{text.account.paymentMethod}</h2>
              <span>{text.shortCount(visiblePaymentOptionCount)}</span>
            </div>
            <div className={styles["payment-method-list"]}>
              {replacedWechatPaymentAvailable && (
                <DirectWechatReplacementPaymentButton
                  text={text}
                  onOpen={openDirectRedeemCodeShop}
                />
              )}
              {!checkoutLoading && !visiblePaymentOptionCount && (
                <p className={styles["empty-copy"]}>
                  {text.account.noPaymentMethodsHint}
                </p>
              )}
              {paymentMethods.map((method) => (
                <button
                  key={method.payment_type}
                  className={clsx({
                    [styles["selected"]]: method.payment_type === paymentMethod,
                  })}
                  onClick={() => {
                    setPaymentMethod(method.payment_type || "");
                    setCouponQuote(null);
                  }}
                >
                  <strong>{paymentMethodLabel(method, text)}</strong>
                  <small>{method.currency || "CNY"}</small>
                </button>
              ))}
            </div>
            <div className={styles["section-head"]}>
              <h2>{text.account.chooseCoupon}</h2>
              <span>
                {couponLoading ? text.loading : text.shortCount(coupons.length)}
              </span>
            </div>
            <div className={styles["payment-method-list"]}>
              <button
                className={clsx({
                  [styles["selected"]]: selectedCouponID === null,
                })}
                onClick={() =>
                  selectPaymentCoupon(null, "subscription", selectedPlan)
                }
              >
                <strong>{text.account.noCoupon}</strong>
              </button>
              {coupons
                .filter((coupon) => coupon.status === "available")
                .map((coupon) => (
                  <button
                    key={coupon.id}
                    className={clsx({
                      [styles["selected"]]: selectedCouponID === coupon.id,
                    })}
                    onClick={() =>
                      selectPaymentCoupon(
                        coupon.id,
                        "subscription",
                        selectedPlan,
                      )
                    }
                  >
                    <strong>{couponDisplayName(coupon, text)}</strong>
                    <small>
                      {coupon.expires_at
                        ? formatDateTime(coupon.expires_at, text)
                        : "-"}
                    </small>
                  </button>
                ))}
            </div>
            {couponQuote && (
              <div className={styles["meta-row"]}>
                <span>{text.account.couponDiscount}</span>
                <strong>
                  -{formatMoney(couponQuote.discount_amount || 0)} ·{" "}
                  {text.account.couponFinalAmount}{" "}
                  {formatMoney(couponQuote.pay_amount || 0)}
                </strong>
              </div>
            )}
            {couponError && (
              <div className={styles["form-error"]}>{couponError}</div>
            )}
            <button
              className={styles["primary-action"]}
              onClick={() => createPaymentOrder("subscription", selectedPlan)}
              disabled={paymentBusy || !paymentMethods.length}
            >
              {paymentBusy
                ? text.account.creatingOrder
                : text.account.confirmBuyPackage}
            </button>
          </section>
          <div ref={paymentFeedbackRef}>
            {paymentError && (
              <div className={styles["form-error"]}>{paymentError}</div>
            )}
            {createdOrder && (
              <AndroidPaymentOrderCard
                order={createdOrder}
                text={text}
                busy={paymentBusy}
                onVerify={verifyCreatedOrder}
                onCancel={cancelCreatedOrder}
                onCopy={copyPayUrl}
                onOpenPay={openCreatedOrderPay}
              />
            )}
          </div>
        </AndroidDetailShell>
      );
    }
    return (
      <AndroidDetailShell
        title={text.account.packages}
        subtitle={text.account.packagePurchase}
        text={text}
        onRefresh={refreshCheckoutInfo}
      >
        <AccountDataNotice data={accountData} text={text} />
        <section className={styles["plan-detail-card"]}>
          <div>
            <span>{text.account.balance}</span>
            <strong>{formatMoney(workspace?.user?.balance)}</strong>
          </div>
          <div>
            <span>{text.account.frozenBalance}</span>
            <strong>{formatMoney(workspace?.user?.frozen_balance)}</strong>
          </div>
          <div>
            <span>{text.account.currentGroup}</span>
            <strong>{accountGroupName}</strong>
          </div>
          <div>
            <span>{text.account.subscriptions}</span>
            <strong>
              {accountData.subscriptions?.[0]?.expires_at
                ? text.account.activeUntil(
                    formatDateTime(
                      accountData.subscriptions[0].expires_at,
                      text,
                    ),
                  )
                : localizedSubscriptionStatus(
                    accountData.subscriptions?.[0]?.status || "",
                    text,
                  )}
            </strong>
          </div>
        </section>
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.paymentMethod}</h2>
            <span>{text.shortCount(visiblePaymentOptionCount)}</span>
          </div>
          <div className={styles["payment-method-list"]}>
            {replacedWechatPaymentAvailable && (
              <DirectWechatReplacementPaymentButton
                text={text}
                onOpen={openDirectRedeemCodeShop}
              />
            )}
            {!checkoutLoading && !visiblePaymentOptionCount && (
              <p className={styles["empty-copy"]}>
                {text.account.noPaymentMethodsHint}
              </p>
            )}
            {paymentMethods.map((method) => (
              <button
                key={method.payment_type}
                className={clsx({
                  [styles["selected"]]: method.payment_type === paymentMethod,
                })}
                onClick={() => setPaymentMethod(method.payment_type || "")}
              >
                <strong>{paymentMethodLabel(method, text)}</strong>
                <small>{method.currency || "CNY"}</small>
              </button>
            ))}
          </div>
        </section>
        <div className={styles["plan-list"]}>
          {!plans.length && (
            <p className={styles["empty-copy"]}>{text.account.noPackages}</p>
          )}
          {plans.map((plan: any) =>
            (() => {
              const usage = planUsageInfo(
                plan,
                accountData.subscriptions || [],
              );
              return (
                <button
                  key={plan.id}
                  className={styles["plan-buy-card"]}
                  onClick={() => {
                    setSelectedPlan(plan);
                    setPaymentError("");
                    setCreatedOrder(null);
                  }}
                >
                  <span>
                    {planDisplayName(plan, text) || text.account.planDetail}
                  </span>
                  <strong>{formatMoney(plan.price)}</strong>
                  <small>
                    {planDescription(plan, text) ||
                      planValidityLabel(plan, text) ||
                      "-"}
                  </small>
                  {formatQuota(usage.remaining, usage.unit) ||
                  formatQuota(usage.total, usage.unit) ? (
                    <em>
                      {[
                        formatQuota(usage.remaining, usage.unit)
                          ? `${text.account.remaining}: ${formatQuota(
                              usage.remaining,
                              usage.unit,
                            )}`
                          : "",
                        formatQuota(usage.total, usage.unit)
                          ? `${text.account.total}: ${formatQuota(
                              usage.total,
                              usage.unit,
                            )}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </em>
                  ) : Array.isArray(plan.features) &&
                    plan.features.length > 0 ? (
                    <em>
                      {plan.features
                        .slice(0, 3)
                        .map((feature: unknown) =>
                          localizedPlanFeature(feature, text),
                        )
                        .filter(Boolean)
                        .join(" · ")}
                    </em>
                  ) : (
                    <em>{text.account.actualUsageHint}</em>
                  )}
                  <b>{text.account.viewPlanDetail}</b>
                </button>
              );
            })(),
          )}
        </div>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountOrders) {
    if (selectedOrderID) {
      const detail =
        orderDetail ||
        accountData.orders?.find(
          (order: any) => orderPrimaryId(order) === selectedOrderID,
        );
      return (
        <AndroidDetailShell
          title={text.account.orderDetail}
          subtitle={selectedOrderID}
          text={text}
          onRefresh={() => fetchOrderDetail(selectedOrderID)}
        >
          <AccountDataNotice data={accountData} text={text} />
          {!detail ? (
            <p className={styles["empty-copy"]}>{text.loading}</p>
          ) : (
            <section className={styles["section"]}>
              <div className={styles["meta-row"]}>
                <span>{text.account.orderType}</span>
                <strong>{localizedOrderTitle(detail, text)}</strong>
              </div>
              <div className={styles["meta-row"]}>
                <span>{text.account.orderNo}</span>
                <strong>{detail.out_trade_no || detail.id}</strong>
              </div>
              <div className={styles["meta-row"]}>
                <span>{text.account.payAmount}</span>
                <strong>
                  {formatMoney(detail.pay_amount || detail.amount)}
                </strong>
              </div>
              <div className={styles["meta-row"]}>
                <span>{text.account.paymentMethod}</span>
                <strong>
                  {localizedPaymentType(detail.payment_type || "-", text)}
                </strong>
              </div>
              <div className={styles["meta-row"]}>
                <span>{text.account.createdAt}</span>
                <strong>{formatDateTime(detail.created_at, text)}</strong>
              </div>
              <div className={styles["meta-row"]}>
                <span>{text.account.expiresAt}</span>
                <strong>{formatDateTime(detail.expires_at, text)}</strong>
              </div>
              <div className={styles["meta-row"]}>
                <span>{text.account.orderStatusLabel}</span>
                <strong>
                  {localizedOrderStatus(detail.status || "-", text)}
                </strong>
              </div>
              {detail.failed_at && (
                <div className={styles["meta-row"]}>
                  <span>{text.account.failedAt}</span>
                  <strong>{formatDateTime(detail.failed_at, text)}</strong>
                </div>
              )}
              {paymentOrderFailureReason(detail) && (
                <div className={styles["form-error"]}>
                  {text.account.failedReason}:{" "}
                  {paymentOrderFailureReason(detail)}
                </div>
              )}
            </section>
          )}
        </AndroidDetailShell>
      );
    }
    return (
      <AndroidDetailShell
        title={text.account.orders}
        subtitle={text.account.latestOrders}
        text={text}
        onRefresh={refreshAccountData}
      >
        <AccountDataNotice data={accountData} text={text} />
        <div className={styles["compact-list"]}>
          {!accountData.orders?.length && (
            <p className={styles["empty-copy"]}>{text.account.noOrders}</p>
          )}
          {accountData.orders?.map((order: any) => (
            <button
              key={orderPrimaryId(order)}
              onClick={() =>
                navigate(`${Path.AccountOrders}?id=${orderPrimaryId(order)}`)
              }
            >
              <span>{localizedOrderTitle(order, text)}</span>
              <strong>{formatMoney(order.pay_amount || order.amount)}</strong>
              <small>
                {text.account.orderStatus(
                  localizedOrderStatus(order.status || "-", text),
                )}
              </small>
            </button>
          ))}
        </div>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountWallet) {
    if (selectedTransactionID) {
      const detail = accountData.transactions?.find(
        (item: any) => transactionPrimaryId(item) === selectedTransactionID,
      );
      return (
        <AndroidDetailShell
          title={text.account.transactionDetail}
          subtitle={selectedTransactionID}
          text={text}
          fallback={Path.AccountWallet}
          onRefresh={refreshAccountData}
        >
          <AccountDataNotice data={accountData} text={text} />
          {!detail ? (
            <p className={styles["empty-copy"]}>{text.loading}</p>
          ) : (
            <section className={styles["section"]}>
              <div className={styles["meta-row"]}>
                <span>{text.account.transactionReason}</span>
                <strong>{localizedTransactionReason(detail, text)}</strong>
              </div>
              <div className={styles["meta-row"]}>
                <span>{text.account.transactionChange}</span>
                <strong>
                  {formatTransactionAmount(
                    detail.balance_delta ||
                      detail.balanceDelta ||
                      detail.amount ||
                      0,
                  )}
                </strong>
              </div>
              <div className={styles["meta-row"]}>
                <span>{text.account.balanceAfter}</span>
                <strong>
                  {formatMoney(
                    detail.balance_after || detail.balanceAfter || 0,
                  )}
                </strong>
              </div>
              {(detail.balance_before || detail.balanceBefore) && (
                <div className={styles["meta-row"]}>
                  <span>{text.account.balanceBefore}</span>
                  <strong>
                    {formatMoney(detail.balance_before || detail.balanceBefore)}
                  </strong>
                </div>
              )}
              <div className={styles["meta-row"]}>
                <span>{text.account.createdAt}</span>
                <strong>
                  {formatDateTime(detail.created_at || detail.createdAt, text)}
                </strong>
              </div>
              {(detail.model ||
                detail.model_name ||
                detail.task_id ||
                detail.order_id) && (
                <div className={styles["meta-row"]}>
                  <span>{text.account.relatedInfo}</span>
                  <strong>
                    {[
                      detail.model || detail.model_name,
                      detail.task_id,
                      detail.order_id,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </strong>
                </div>
              )}
            </section>
          )}
        </AndroidDetailShell>
      );
    }
    return (
      <AndroidDetailShell
        title={text.account.balanceDetails}
        subtitle={formatMoney(workspace?.user?.balance)}
        text={text}
        onRefresh={refreshAccountData}
      >
        <AccountDataNotice data={accountData} text={text} />
        <div className={styles["compact-list"]}>
          {!accountData.transactions?.length && (
            <p className={styles["empty-copy"]}>
              {text.account.noTransactions}
            </p>
          )}
          {accountData.transactions?.map((item: any) => (
            <button
              key={transactionPrimaryId(item)}
              onClick={() =>
                navigate(
                  `${Path.AccountWallet}?tx=${transactionPrimaryId(item)}`,
                )
              }
            >
              <span>{localizedTransactionReason(item, text)}</span>
              <strong>
                {formatMoney(item.balance_after || item.balanceAfter || 0)}
              </strong>
              <small>
                {text.account.transactionAmount(
                  formatTransactionAmount(
                    item.balance_delta || item.balanceDelta || item.amount || 0,
                  ),
                )}
              </small>
            </button>
          ))}
        </div>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountSubscriptions) {
    return (
      <AndroidDetailShell
        title={text.account.subscriptions}
        subtitle={accountGroupName}
        text={text}
        onRefresh={refreshAccountData}
      >
        <AccountDataNotice data={accountData} text={text} />
        <div className={styles["compact-list"]}>
          {!accountData.subscriptions?.length && (
            <p className={styles["empty-copy"]}>
              {text.account.noSubscriptions}
            </p>
          )}
          {accountData.subscriptions?.map((item: any) => (
            <article
              key={item.id || item.group_name}
              className={styles["subscription-card"]}
            >
              <div>
                <span>
                  {item.group_name || item.group?.name || accountGroupName}
                </span>
                <strong>
                  {localizedSubscriptionStatus(item.status, text)}
                </strong>
                <small>
                  {item.expires_at
                    ? text.account.activeUntil(
                        formatDateTime(item.expires_at, text),
                      )
                    : accountGroupName}
                </small>
              </div>
              <SubscriptionUsageRows subscription={item} text={text} />
            </article>
          ))}
        </div>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountSupport) {
    return (
      <AndroidDetailShell
        title={text.account.support}
        subtitle={text.platform.supportTicketHint}
        text={text}
        onBack={supportTicket ? () => setSupportTicket(null) : undefined}
        onRefresh={refreshSupportTickets}
      >
        {supportError && (
          <div className={styles["form-error"]}>{supportError}</div>
        )}
        {supportTicket ? (
          <>
            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <div>
                  <h2>
                    {localizedMobileDisplay(supportTicket, {
                      fallback: `#${supportTicket.number || supportTicket.id}`,
                    })}
                  </h2>
                  <span>
                    {text.platform.supportStatuses[supportTicket.status] ||
                      text.notSynced}
                  </span>
                </div>
                {!(["closed", "resolved"] as string[]).includes(
                  supportTicket.status,
                ) && (
                  <button
                    onClick={closeSupportTicketRecord}
                    disabled={supportBusy}
                  >
                    {text.common.close}
                  </button>
                )}
              </div>
              <div className={styles["ticket-messages"]}>
                {(supportTicket.messages || []).map((message) => (
                  <article
                    key={message.id}
                    className={styles[message.sender_type]}
                  >
                    <strong>
                      {message.sender_type === "user"
                        ? text.platform.myMessage
                        : message.sender_type === "support"
                        ? text.platform.supportMessage
                        : text.platform.systemMessage}
                    </strong>
                    <p>
                      {localizedMobileDisplay(message as any, {
                        defaultFields: ["content"],
                      })}
                    </p>
                    <small>{formatDateTime(message.created_at, text)}</small>
                  </article>
                ))}
              </div>
            </section>
            {!(["closed", "resolved"] as string[]).includes(
              supportTicket.status,
            ) && (
              <section className={styles["support-reply-box"]}>
                <textarea
                  value={supportReply}
                  onChange={(event) =>
                    setSupportReply(event.currentTarget.value)
                  }
                  placeholder={text.platform.supportReplyPlaceholder}
                />
                <button
                  onClick={replySupportTicket}
                  disabled={supportBusy || !supportReply.trim()}
                >
                  <SendIcon />
                  <span>{text.login.submit}</span>
                </button>
              </section>
            )}
          </>
        ) : (
          <>
            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.platform.supportTickets}</h2>
                <span>
                  {supportBusy
                    ? text.account.refreshingData
                    : text.shortCount(supportTickets.length)}
                </span>
              </div>
              <div className={styles["ticket-list"]}>
                {!supportBusy && supportTickets.length === 0 && (
                  <p className={styles["empty-copy"]}>
                    {text.platform.supportTicketEmpty}
                  </p>
                )}
                {supportTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => openSupportTicket(ticket)}
                  >
                    <span>
                      <strong>
                        {localizedMobileDisplay(ticket, {
                          fallback: `#${ticket.number || ticket.id}`,
                        })}
                      </strong>
                      <small>
                        {formatDateTime(
                          ticket.updated_at || ticket.created_at,
                          text,
                        )}
                      </small>
                    </span>
                    <em>
                      {text.platform.supportStatuses[ticket.status] ||
                        text.notSynced}
                    </em>
                  </button>
                ))}
              </div>
            </section>
            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.supportOnline}</h2>
              </div>
              <div className={styles["support-box"]}>
                {supportLines.length ? (
                  supportLines.map((line) => (
                    <button
                      key={line}
                      onClick={() => {
                        const value = line.replace(/^[^:：]+[:：]\s*/, "");
                        if (/^https?:\/\//i.test(value)) {
                          openExternalUrl(value).catch(() => shareText(line));
                          return;
                        }
                        navigator.clipboard?.writeText(line).catch(() => {});
                        shareText(line).catch(() => {});
                      }}
                    >
                      {line}
                    </button>
                  ))
                ) : (
                  <p className={styles["empty-copy"]}>
                    {text.account.supportEmpty}
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountSystemSettings) {
    return <AndroidSystemSettings />;
  }

  if (route === Path.AccountAppearance) {
    return <AndroidAppearanceSettings />;
  }

  if (route === Path.AccountLanguage) {
    return <AndroidLanguageSettings />;
  }

  if (route === Path.AccountWebOpenMode) {
    return <AndroidWebOpenModeSettings />;
  }

  if (route === Path.AccountPermissions) {
    return (
      <AndroidDetailShell
        title={text.account.permissions}
        text={text}
        fallback={Path.AccountSystemSettings}
      >
        <div className={styles["permission-list"]}>
          <button
            onClick={async () => {
              const result = await requestGalleryPermissions();
              setGalleryGranted(Boolean(result.granted));
            }}
          >
            <strong>{text.account.galleryPermission}</strong>
            <span>
              {galleryGranted
                ? text.account.galleryReady
                : text.account.enableGallery}
            </span>
          </button>
          <button
            onClick={async () => {
              const result = await requestCameraPermission();
              setCameraGranted(Boolean(result.granted));
            }}
          >
            <strong>{text.account.cameraPermission}</strong>
            <span>
              {cameraGranted
                ? text.account.cameraReady
                : text.account.enableCamera}
            </span>
          </button>
          <button
            onClick={async () => {
              const result = await requestMicrophonePermission();
              setMicrophoneGranted(Boolean(result.granted));
            }}
          >
            <strong>{text.account.microphonePermission}</strong>
            <span>
              {microphoneGranted
                ? text.account.microphoneReady
                : text.account.enableMicrophone}
            </span>
          </button>
          <button
            onClick={async () => {
              const result = await requestNotificationPermission();
              setNotificationGranted(Boolean(result.granted));
              if (result.granted) {
                await showNativeNotification(
                  "JisudengChat",
                  text.account.notificationReady,
                );
              }
            }}
          >
            <strong>{text.account.notificationPermission}</strong>
            <span>
              {notificationGranted
                ? text.account.notificationReady
                : text.account.enableNotification}
            </span>
          </button>
          <button onClick={() => openAppSettings().catch(() => {})}>
            <strong>{text.account.openSystemSettings}</strong>
            <span>{text.account.openSystemSettingsHint}</span>
          </button>
        </div>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountUpdate) {
    if (playDistribution) {
      return (
        <AndroidDetailShell
          title={text.account.version}
          text={text}
          fallback={Path.AccountSystemSettings}
        >
          <div className={styles["version-card"]}>
            <div className={styles["meta-row"]}>
              <span>{text.account.installed}</span>
              <strong>{currentVersion}</strong>
            </div>
            <div className={styles["meta-row"]}>
              <span>{text.account.currentVersion}</span>
              <strong>{currentVersion}</strong>
            </div>
          </div>
        </AndroidDetailShell>
      );
    }
    return (
      <AndroidDetailShell
        title={text.account.version}
        subtitle={
          hasUpdate ? text.account.updateFound : text.account.currentVersion
        }
        text={text}
        fallback={Path.AccountSystemSettings}
        onRefresh={checkUpdate}
      >
        <div className={styles["version-card"]}>
          <div className={styles["meta-row"]}>
            <span>{text.account.installed}</span>
            <strong>{currentVersion}</strong>
          </div>
          <div className={styles["meta-row"]}>
            <span>{text.account.latestVersion}</span>
            <strong>{latestVersion || text.account.waitingCheck}</strong>
          </div>
          {updateState.manifest?.size && (
            <div className={styles["meta-row"]}>
              <span>{text.account.apkPackage}</span>
              <strong>{updateState.manifest.size}</strong>
            </div>
          )}
          {notes.length > 0 && (
            <ul>
              {notes.slice(0, 4).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          {downloadStatus && (
            <div className={styles["download-progress"]}>
              <progress value={downloadProgress} max={100} />
              <span>{downloadStatus}</span>
            </div>
          )}
          {updateState.error && (
            <div className={styles["form-error"]}>{updateState.error}</div>
          )}
          <div className={styles["inline-actions"]}>
            <button onClick={checkUpdate} disabled={updateState.loading}>
              <ReloadIcon />
              <span>
                {updateState.loading
                  ? text.account.checking
                  : text.account.checkUpdate}
              </span>
            </button>
            {apkUrl && (
              <button onClick={startApkDownload}>
                <DownloadIcon />
                <span>
                  {hasUpdate
                    ? text.account.downloadUpdate
                    : text.account.redownload}
                </span>
              </button>
            )}
          </div>
        </div>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountFeedbackNew) {
    return (
      <AndroidDetailShell
        title={text.account.feedbackNew}
        subtitle={currentVersion}
        text={text}
        fallback={Path.AccountFeedback}
      >
        <section className={styles["section"]}>
          <p className={styles["empty-copy"]}>{text.account.feedbackHint}</p>
          <label className={styles["field-card"]}>
            <span>{text.account.feedbackTitleLabel}</span>
            <input
              value={feedbackTitle}
              onChange={(event) => setFeedbackTitle(event.currentTarget.value)}
              placeholder={text.account.feedbackTitlePlaceholder}
              maxLength={120}
            />
          </label>
          <div className={styles["feedback-category-grid"]}>
            {MOBILE_FEEDBACK_CATEGORIES.map((category) => (
              <button
                key={category}
                className={clsx({
                  [styles["active"]]: feedbackCategory === category,
                })}
                onClick={() => setFeedbackCategory(category)}
              >
                {text.account.feedbackCategories[category]}
              </button>
            ))}
          </div>
          <label className={styles["field-card"]}>
            <span>{text.account.feedbackContentLabel}</span>
            <textarea
              value={feedbackContent}
              onChange={(event) =>
                setFeedbackContent(event.currentTarget.value)
              }
              placeholder={text.account.feedbackContentPlaceholder}
              maxLength={3000}
              rows={6}
            />
          </label>
          <div className={styles["feedback-screenshots"]}>
            {feedbackScreenshots.map((shot) => (
              <button
                key={shot.id}
                className={styles["feedback-shot"]}
                onClick={() => removeFeedbackScreenshot(shot.id)}
                title={text.account.feedbackRemoveScreenshot}
              >
                <img src={shot.dataUrl} alt={shot.fileName} />
                <CloseIcon />
              </button>
            ))}
          </div>
          <input
            ref={feedbackFileInputRef}
            hidden
            type="file"
            accept="image/*"
            multiple
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              if (event.currentTarget.files?.length) {
                addFeedbackScreenshotsFromFiles(event.currentTarget.files);
              }
              event.currentTarget.value = "";
            }}
          />
          <div className={styles["inline-actions"]}>
            <button
              onClick={() => feedbackFileInputRef.current?.click()}
              disabled={feedbackScreenshots.length >= 3}
            >
              <UploadIcon />
              <span>{text.account.feedbackAddGallery}</span>
            </button>
            <button
              onClick={addFeedbackCameraScreenshot}
              disabled={feedbackScreenshots.length >= 3}
            >
              <ImageIcon />
              <span>{text.account.feedbackAddCamera}</span>
            </button>
          </div>
          <small className={styles["hint-line"]}>
            {text.account.feedbackScreenshotLimit}
          </small>
          {feedbackError && (
            <div className={styles["form-error"]}>{feedbackError}</div>
          )}
          {feedbackMessage && (
            <div className={styles["form-success"]}>{feedbackMessage}</div>
          )}
          <button
            className={styles["primary-action"]}
            onClick={submitFeedback}
            disabled={feedbackSubmitting}
          >
            {feedbackSubmitting
              ? text.account.feedbackSubmitting
              : text.account.feedbackSubmit}
          </button>
          <button className={styles["wide-soft-action"]} onClick={copyFeedback}>
            {text.account.copyFeedback}
          </button>
        </section>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountFeedbackDetail) {
    return (
      <AndroidDetailShell
        title={text.account.feedbackDetail}
        text={text}
        fallback={Path.AccountFeedback}
        onRefresh={refreshSupportTickets}
      >
        <section className={styles["section"]}>
          {supportError && (
            <div className={styles["form-error"]}>{supportError}</div>
          )}
          {!supportTicket && !supportBusy && !supportError && (
            <p className={styles["empty-copy"]}>
              {text.platform.supportTicketEmpty}
            </p>
          )}
          {supportTicket && (
            <>
              <div className={styles["ticket-detail-head"]}>
                <strong>
                  {localizedMobileDisplay(supportTicket, {
                    fallback: `#${supportTicket.number || supportTicket.id}`,
                  })}
                </strong>
                <span>
                  {text.platform.supportStatuses[supportTicket.status] ||
                    text.notSynced}
                </span>
              </div>
              <div className={styles["ticket-messages"]}>
                {(supportTicket.messages || []).map((message) => (
                  <article
                    key={message.id}
                    className={styles[message.sender_type]}
                  >
                    <strong>
                      {message.sender_type === "user"
                        ? text.platform.myMessage
                        : text.platform.supportMessage}
                    </strong>
                    <p>
                      {localizedMobileDisplay(message as any, {
                        defaultFields: ["content"],
                      })}
                    </p>
                    <small>{formatDateTime(message.created_at, text)}</small>
                  </article>
                ))}
              </div>
              {!(["closed", "resolved"] as string[]).includes(
                supportTicket.status,
              ) && (
                <div className={styles["support-reply-box"]}>
                  <textarea
                    value={supportReply}
                    onChange={(event) =>
                      setSupportReply(event.currentTarget.value)
                    }
                    placeholder={text.platform.supportReplyPlaceholder}
                  />
                  <button
                    onClick={replySupportTicket}
                    disabled={supportBusy || !supportReply.trim()}
                  >
                    <SendIcon />
                    <span>{text.login.submit}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountFeedback) {
    return (
      <AndroidDetailShell
        title={text.account.feedbackRecords}
        subtitle={text.account.feedbackRecordsHint}
        text={text}
        fallback={Path.AccountSystemSettings}
        onRefresh={refreshSupportTickets}
      >
        <section className={styles["section"]}>
          <button
            className={styles["primary-action"]}
            onClick={() => navigate(Path.AccountFeedbackNew)}
          >
            {text.account.feedbackNew}
          </button>
          {feedbackMessage && (
            <div className={styles["form-success"]}>{feedbackMessage}</div>
          )}
          {supportError && (
            <div className={styles["form-error"]}>{supportError}</div>
          )}
          <div className={styles["section-head"]}>
            <h2>{text.account.feedbackProgress}</h2>
            <span>
              {supportBusy
                ? text.account.refreshingData
                : text.shortCount(supportTickets.length)}
            </span>
          </div>
          <div className={styles["ticket-list"]}>
            {!supportBusy && supportTickets.length === 0 && (
              <p className={styles["empty-copy"]}>
                {text.platform.supportTicketEmpty}
              </p>
            )}
            {supportTickets.map((ticket) => (
              <button key={ticket.id} onClick={() => openSupportTicket(ticket)}>
                <span>
                  <strong>
                    {localizedMobileDisplay(ticket, {
                      fallback: `#${ticket.number || ticket.id}`,
                    })}
                  </strong>
                  <small>
                    {formatDateTime(
                      ticket.updated_at || ticket.created_at,
                      text,
                    )}
                  </small>
                </span>
                <em>
                  {text.platform.supportStatuses[ticket.status] ||
                    text.notSynced}
                </em>
              </button>
            ))}
          </div>
        </section>
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountWelfare) {
    const growth = welfareData?.hub?.growth;
    const vip = growth?.vip;
    const vipTiers = [...(growth?.vip_tiers || [])].sort((left, right) =>
      left.min_recharge === right.min_recharge
        ? left.tier - right.tier
        : left.min_recharge - right.min_recharge,
    );
    const vipPerkLabels = text.account.vipPerkLabels as Record<string, string>;
    const publicTeamRows = welfareData?.teamPublicLeaderboard?.rows || [];
    const privateTeamRows = welfareData?.teamLeaderboard?.rows || [];
    const team = welfareData?.teamMe?.team;
    const myTeam = privateTeamRows.find((row) => row.is_mine);
    const teamAdmission = welfareData?.teamAdmission;
    const pendingTeamApplication = (welfareData?.teamMyApplications || []).find(
      (application) => application.status === "pending",
    );
    const pendingCaptainApplications = (
      welfareData?.teamCaptainApplications || []
    ).filter((application) => application.status === "pending");
    const isTeamCaptain = !!team?.is_captain && !!team.can_manage;
    const teamApplicationStatuses = text.account
      .welfareTeamApplicationStatuses as Record<string, string>;
    const arenaOverview = welfareData?.arenaMonthlyOverview;
    const arenaRows = arenaOverview?.rows || [];
    const latestArenaHistory = arenaOverview?.history?.[0];
    const arenaDailySummary = welfareData?.arenaDailyRewardSummary;
    const arenaDailyRows = arenaDailySummary?.current?.rows || [];
    const arenaDailyRecent = arenaDailySummary?.recent;
    const arenaDailyCurrent = welfareData?.arenaDailyCurrent;
    const inviteQualified = inviteCampaign?.qualified_count || 0;
    const inviteRank = inviteCampaign?.ranking?.rank;
    const checkinStatus = welfareData?.checkinStatus;
    const blindboxStatus = welfareData?.blindboxStatus;
    const quizToday = welfareData?.quizToday;
    const quizAnsweredCount =
      quizToday?.questions.filter((question) =>
        Number.isInteger(quizAnswers[question.id]),
      ).length || 0;

    return (
      <AndroidDetailShell
        title={text.account.welfare}
        subtitle={text.account.welfareHint}
        text={text}
        onRefresh={() => {
          void refreshWelfare();
          void refreshInviteGrowth(false);
        }}
      >
        {welfareError && (
          <div className={styles["form-error"]}>{welfareError}</div>
        )}
        {welfareLoading && !welfareData ? (
          <div className={styles["sync-notice"]}>
            {text.account.welfareLoading}
          </div>
        ) : (
          <>
            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfarePlayTitle}</h2>
                <span>{text.account.welfarePlayHint}</span>
              </div>
              {playActionError && (
                <div className={styles["form-error"]}>{playActionError}</div>
              )}
              {playActionMessage && (
                <div className={styles["form-success"]}>
                  {playActionMessage}
                </div>
              )}
              <div className={styles["welfare-play-grid"]}>
                <article className={styles["welfare-play-card"]}>
                  <h3>{text.account.welfareCheckinTitle}</h3>
                  {!checkinStatus ? (
                    <p className={styles["empty-copy"]}>
                      {text.account.welfareCheckinUnavailable}
                    </p>
                  ) : !checkinStatus.enabled ? (
                    <p className={styles["empty-copy"]}>
                      {text.account.welfareCheckinUnavailable}
                    </p>
                  ) : (
                    <>
                      <div className={styles["meta-list"]}>
                        <div className={styles["meta-row"]}>
                          <span>{text.account.welfareCheckinStreak}</span>
                          <strong>{checkinStatus.streak_count || 0}</strong>
                        </div>
                        <div className={styles["meta-row"]}>
                          <span>{text.account.welfareCheckinReward}</span>
                          <strong>
                            {formatMoney(checkinStatus.reward_amount)}
                          </strong>
                        </div>
                      </div>
                      {checkinStatus.checked_in_today ? (
                        <p className={styles["empty-copy"]}>
                          {text.account.welfareCheckinChecked}
                        </p>
                      ) : !checkinStatus.eligible ? (
                        <p className={styles["empty-copy"]}>
                          {text.account.welfareCheckinNotEligible}
                        </p>
                      ) : !checkinStatus.coupon_pool_ready ? (
                        <p className={styles["empty-copy"]}>
                          {text.account.welfareCheckinPoolUnavailable}
                        </p>
                      ) : (
                        <button
                          type="button"
                          className={styles["primary-action"]}
                          onClick={() => submitDailyCheckin()}
                          disabled={playActionBusy !== null}
                        >
                          {playActionBusy === "checkin"
                            ? text.loading
                            : text.account.welfareCheckinAction}
                        </button>
                      )}
                      {checkinStatus.can_makeup && checkinStatus.makeup_date ? (
                        <button
                          type="button"
                          className={styles["wide-soft-action"]}
                          onClick={() => submitDailyCheckin(true)}
                          disabled={playActionBusy !== null}
                        >
                          {playActionBusy === "checkin-makeup"
                            ? text.loading
                            : text.account.welfareCheckinMakeup(
                                checkinStatus.makeup_date,
                              )}
                        </button>
                      ) : null}
                    </>
                  )}
                </article>

                <article className={styles["welfare-play-card"]}>
                  <h3>{text.account.welfareBlindboxTitle}</h3>
                  {!blindboxStatus ? (
                    <p className={styles["empty-copy"]}>
                      {text.account.welfareBlindboxUnavailable}
                    </p>
                  ) : !blindboxStatus.enabled ? (
                    <p className={styles["empty-copy"]}>
                      {text.account.welfareBlindboxUnavailable}
                    </p>
                  ) : (
                    <>
                      <div className={styles["meta-list"]}>
                        <div className={styles["meta-row"]}>
                          <span>{text.account.welfareBlindboxCost}</span>
                          <strong>
                            {formatMoney(blindboxStatus.cost_amount)}
                          </strong>
                        </div>
                        <div className={styles["meta-row"]}>
                          <span>{text.account.welfareBlindboxExpected}</span>
                          <strong>
                            {typeof blindboxStatus.expected_reward === "number"
                              ? formatMoney(blindboxStatus.expected_reward)
                              : text.notSynced}
                          </strong>
                        </div>
                        <div className={styles["meta-row"]}>
                          <span>{text.account.welfareBlindboxCount}</span>
                          <strong>
                            {blindboxStatus.opens_today || 0}
                            {blindboxStatus.effective_limit ||
                            blindboxStatus.daily_limit
                              ? ` / ${
                                  blindboxStatus.effective_limit ||
                                  blindboxStatus.daily_limit
                                }`
                              : ""}
                          </strong>
                        </div>
                      </div>
                      {!blindboxStatus.coupon_pool_ready ? (
                        <p className={styles["empty-copy"]}>
                          {text.account.welfareBlindboxPoolUnavailable}
                        </p>
                      ) : !blindboxStatus.can_open ? (
                        <p className={styles["empty-copy"]}>
                          {text.account.welfareBlindboxLimit}
                        </p>
                      ) : (
                        <button
                          type="button"
                          className={styles["primary-action"]}
                          onClick={openDailyBlindbox}
                          disabled={playActionBusy !== null}
                        >
                          {playActionBusy === "blindbox"
                            ? text.loading
                            : text.account.welfareBlindboxAction}
                        </button>
                      )}
                    </>
                  )}
                </article>

                <article className={styles["welfare-play-card"]}>
                  <h3>{text.account.welfareQuizTitle}</h3>
                  {!quizToday ? (
                    <p className={styles["empty-copy"]}>
                      {text.account.welfareQuizUnavailable}
                    </p>
                  ) : !quizToday.enabled ? (
                    <p className={styles["empty-copy"]}>
                      {text.account.welfareQuizUnavailable}
                    </p>
                  ) : quizToday.already_submitted ? (
                    <>
                      <p className={styles["empty-copy"]}>
                        {text.account.welfareQuizSubmitted(
                          quizToday.previous_score || 0,
                          quizToday.previous_total ||
                            quizToday.questions.length,
                        )}
                      </p>
                      <small>
                        {text.account.welfareRewardMessage(
                          formatMoney(quizToday.previous_reward),
                        )}
                      </small>
                    </>
                  ) : !quizToday.coupon_pool_ready ? (
                    <p className={styles["empty-copy"]}>
                      {text.account.welfareQuizPoolUnavailable}
                    </p>
                  ) : !quizToday.questions.length ? (
                    <p className={styles["empty-copy"]}>
                      {text.account.welfareQuizNoQuestions}
                    </p>
                  ) : (
                    <>
                      <div className={styles["meta-row"]}>
                        <span>
                          {text.account.welfareQuizRewardPerCorrect(
                            formatMoney(quizToday.reward_per_correct),
                          )}
                        </span>
                        <strong>
                          {text.account.welfareQuizAnswerProgress(
                            quizAnsweredCount,
                            quizToday.questions.length,
                          )}
                        </strong>
                      </div>
                      <div className={styles["welfare-play-quiz"]}>
                        {quizToday.questions.map((question, questionIndex) => (
                          <div
                            key={question.id}
                            className={styles["welfare-play-question"]}
                          >
                            <strong>
                              {questionIndex + 1}. {question.prompt}
                            </strong>
                            <div className={styles["welfare-play-options"]}>
                              {question.options.map((option, optionIndex) => (
                                <button
                                  type="button"
                                  key={`${question.id}-${optionIndex}`}
                                  className={clsx(
                                    styles["welfare-play-option"],
                                    {
                                      [styles["active"]]:
                                        quizAnswers[question.id] ===
                                        optionIndex,
                                    },
                                  )}
                                  onClick={() =>
                                    setQuizAnswers((current) => ({
                                      ...current,
                                      [question.id]: optionIndex,
                                    }))
                                  }
                                  disabled={playActionBusy !== null}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles["primary-action"]}
                        onClick={submitDailyQuiz}
                        disabled={
                          playActionBusy !== null ||
                          quizAnsweredCount !== quizToday.questions.length
                        }
                      >
                        {playActionBusy === "quiz"
                          ? text.account.welfareQuizSubmitting
                          : text.account.welfareQuizSubmit}
                      </button>
                    </>
                  )}
                </article>
              </div>
            </section>

            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfareMemberBenefits}</h2>
                <span>{vip?.label || text.account.welfareNotMember}</span>
              </div>
              {growth ? (
                <>
                  <div className={styles["meta-list"]}>
                    <div className={styles["meta-row"]}>
                      <span>{text.account.welfareCurrentVIP}</span>
                      <strong>
                        {vip?.label || text.account.welfareNotMember}
                      </strong>
                    </div>
                    <div className={styles["meta-row"]}>
                      <span>{text.account.welfareMemberPaid}</span>
                      <strong>
                        {formatMoney(growth.membership_paid_amount)}
                      </strong>
                    </div>
                    <div className={styles["meta-row"]}>
                      <span>{text.account.welfareNextVIP}</span>
                      <strong>
                        {vip?.next_label
                          ? `${vip.next_label} ${formatMoney(
                              vip.amount_to_next,
                            )}`
                          : text.account.welfareTopVIP}
                      </strong>
                    </div>
                  </div>
                  {vip?.perks?.length ? (
                    <div className={styles["welfare-perk-list"]}>
                      <span>{text.account.welfarePerks}</span>
                      <div>
                        {vip.perks.map((perk) => (
                          <small key={perk}>
                            {vipPerkLabels[perk] ||
                              text.account.welfarePerkGeneric}
                          </small>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {vipTiers.length ? (
                    <div className={styles["welfare-vip-tier-list"]}>
                      <h3>{text.account.welfareVIPLevels}</h3>
                      {vipTiers.map((tier) => (
                        <div
                          key={tier.tier}
                          className={clsx({
                            [styles["active"]]: tier.tier === vip?.tier,
                          })}
                        >
                          <strong>{tier.label}</strong>
                          <span>
                            {text.account.welfareTierThreshold}{" "}
                            {formatMoney(tier.min_recharge)}
                          </span>
                          <small>
                            {text.account.welfareRechargeBonus(
                              tier.recharge_bonus_pct,
                            )}
                          </small>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.welfareUnavailable}
                </p>
              )}
            </section>

            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfareCampaigns}</h2>
                <span>
                  {welfareData?.hub
                    ? welfareData.hub.campaigns?.length || 0
                    : text.notSynced}
                </span>
              </div>
              {welfareData?.hub?.campaigns?.length ? (
                <div className={styles["welfare-activity-list"]}>
                  {welfareData.hub.campaigns.map((campaign) => (
                    <div key={campaign.id}>
                      <strong>{campaign.name}</strong>
                      <small>
                        {text.account.welfareCampaignWindow}:{" "}
                        {formatDateTime(campaign.start_at, text)}
                        {" - "}
                        {formatDateTime(campaign.end_at, text)}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.welfareNoCampaigns}
                </p>
              )}
            </section>

            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfareInviteSnapshot}</h2>
                <span>
                  {inviteRank
                    ? `#${inviteRank}`
                    : text.account.inviteGrowthNotRanked}
                </span>
              </div>
              {inviteLoading ? (
                <div className={styles["sync-notice"]}>{text.loading}</div>
              ) : inviteCampaign ? (
                <>
                  <div className={styles["meta-list"]}>
                    <div className={styles["meta-row"]}>
                      <span>{text.account.inviteGrowthInvited}</span>
                      <strong>{inviteCampaign.invited_count}</strong>
                    </div>
                    <div className={styles["meta-row"]}>
                      <span>{text.account.inviteGrowthQualified}</span>
                      <strong>{inviteQualified}</strong>
                    </div>
                    <div className={styles["meta-row"]}>
                      <span>{text.account.inviteGrowthMyRank}</span>
                      <strong>
                        {inviteRank
                          ? `#${inviteRank}`
                          : text.account.inviteGrowthNotRanked}
                      </strong>
                    </div>
                  </div>
                  <button
                    className={styles["wide-soft-action"]}
                    onClick={() => navigate(Path.AccountInvite)}
                  >
                    {text.account.welfareViewInvite}
                  </button>
                </>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.inviteGrowthNoCampaign}
                </p>
              )}
            </section>

            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfareTeamCompetition}</h2>
                <span>
                  {welfareData?.teamPublicLeaderboard
                    ? `${text.account.welfareTeamCount}: ${welfareData.teamPublicLeaderboard.total_teams}`
                    : text.notSynced}
                </span>
              </div>
              {team ? (
                <div className={styles["meta-list"]}>
                  <div className={styles["meta-row"]}>
                    <span>{text.account.welfareMyTeam}</span>
                    <strong>
                      {myTeam ? `#${myTeam.rank} ${team.name}` : team.name}
                    </strong>
                  </div>
                  <div className={styles["meta-row"]}>
                    <span>{text.account.welfareEstimatedPool}</span>
                    <strong>
                      {formatMoney(
                        myTeam?.estimated_pool || team.estimated_pool,
                      )}
                    </strong>
                  </div>
                  <div className={styles["meta-row"]}>
                    <span>{text.account.welfareGapToPrevious}</span>
                    <strong>
                      {myTeam && myTeam.rank > 1
                        ? formatMoney(myTeam.gap_to_previous)
                        : myTeam
                        ? text.account.welfareLeading
                        : text.account.inviteGrowthNotRanked}
                    </strong>
                  </div>
                  {team.next_threshold ? (
                    <div className={styles["meta-row"]}>
                      <span>{text.account.welfareTeamNextThreshold}</span>
                      <strong>{formatMoney(team.next_threshold)}</strong>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.welfareNoTeam}
                </p>
              )}
              <div className={styles["welfare-team-block-head"]}>
                <h3>{text.account.welfareTeamCurrentRanking}</h3>
                <span>{welfareData?.teamPublicLeaderboard?.month || ""}</span>
              </div>
              {publicTeamRows.length ? (
                <div className={styles["welfare-rank-list"]}>
                  {publicTeamRows.map((row) => (
                    <div
                      key={row.team_id}
                      className={clsx({
                        [styles["is-me"]]: row.team_id === team?.id,
                      })}
                    >
                      <strong>#{row.rank}</strong>
                      <span>
                        <b>{row.team_name}</b>
                        <small>
                          {text.account.welfareTeamMembers(row.member_count)} ·{" "}
                          {text.account.welfareTeamSpend}{" "}
                          {formatMoney(row.monthly_spend)}
                        </small>
                      </span>
                      <em>{formatMoney(row.estimated_pool)}</em>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.welfareNoLeaderboard}
                </p>
              )}
            </section>

            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfareTeamDirectory}</h2>
                <span>{welfareData?.teamDirectory?.month || ""}</span>
              </div>
              {teamActionError && (
                <div className={styles["form-error"]}>{teamActionError}</div>
              )}
              {teamActionMessage && (
                <div className={styles["form-success"]}>
                  {teamActionMessage}
                </div>
              )}
              {!team && pendingTeamApplication ? (
                <div className={styles["welfare-team-status"]}>
                  <strong>
                    {teamApplicationStatuses[pendingTeamApplication.status] ||
                      text.account.welfareTeamApplicationPending}
                  </strong>
                  <span>
                    {text.account.welfareTeamCaptainReplyWithin(
                      teamAdmission?.captain_sla_hours || 72,
                    )}
                  </span>
                  <small>
                    {text.account.welfareTeamApplicationExpires}:{" "}
                    {formatDateTime(pendingTeamApplication.expires_at, text)}
                  </small>
                </div>
              ) : !team &&
                (!teamAdmission ||
                  !teamAdmission.enabled ||
                  !teamAdmission.can_apply_or_join ||
                  teamAdmission.cooldown_active) ? (
                <div className={styles["welfare-team-status"]}>
                  <strong>
                    {text.account.welfareTeamAdmissionUnavailable}
                  </strong>
                  <span>
                    {text.account.welfareTeamCooldownUntil(
                      teamAdmission?.cooldown_ends_at
                        ? formatDateTime(teamAdmission.cooldown_ends_at, text)
                        : text.notSynced,
                    )}
                  </span>
                </div>
              ) : null}
              {teamApplicationTarget ? (
                <div className={styles["welfare-team-application"]}>
                  <strong>
                    {text.account.welfareTeamApplyTo(
                      teamApplicationTarget.team_name,
                    )}
                  </strong>
                  <label className={styles["field-card"]}>
                    <span>{text.account.welfareTeamApplicationMessage}</span>
                    <textarea
                      value={teamApplicationMessage}
                      onChange={(event) =>
                        setTeamApplicationMessage(event.currentTarget.value)
                      }
                      placeholder={
                        text.account.welfareTeamApplicationPlaceholder
                      }
                      maxLength={300}
                      rows={3}
                    />
                  </label>
                  <div className={styles["welfare-team-action-row"]}>
                    <button
                      className={styles["wide-soft-action"]}
                      onClick={() => setTeamApplicationTarget(null)}
                      disabled={teamActionBusy !== null}
                    >
                      {text.common.cancel}
                    </button>
                    <button
                      className={styles["primary-action"]}
                      onClick={submitTeamApplication}
                      disabled={teamActionBusy !== null}
                    >
                      {text.account.welfareTeamApply}
                    </button>
                  </div>
                </div>
              ) : null}
              {welfareData?.teamDirectory?.rows?.length ? (
                <div className={styles["welfare-team-directory"]}>
                  {welfareData.teamDirectory.rows.map((entry) => {
                    const teamFull =
                      entry.member_count >= entry.member_capacity;
                    const canApply =
                      !team &&
                      !!teamAdmission?.can_apply_or_join &&
                      !pendingTeamApplication &&
                      entry.accepting_applications &&
                      !teamFull;
                    const applicationLabel = !entry.accepting_applications
                      ? text.account.welfareTeamNotRecruiting
                      : teamFull
                      ? text.account.welfareTeamFull
                      : !teamAdmission?.can_apply_or_join
                      ? text.account.welfareTeamAdmissionUnavailable
                      : text.account.welfareTeamApply;
                    return (
                      <article key={entry.team_id}>
                        <div>
                          <strong>{entry.team_name}</strong>
                          <span>
                            {text.account.welfareTeamSlots(
                              Math.max(
                                0,
                                entry.member_capacity - entry.member_count,
                              ),
                              entry.member_capacity,
                            )}
                          </span>
                          <small>
                            {text.account.welfareEstimatedPool}{" "}
                            {formatMoney(entry.estimated_pool)}
                          </small>
                        </div>
                        {!team ? (
                          <button
                            onClick={() => setTeamApplicationTarget(entry)}
                            disabled={!canApply || teamActionBusy !== null}
                          >
                            {applicationLabel}
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.welfareNoLeaderboard}
                </p>
              )}
              {team && isTeamCaptain ? (
                <div className={styles["welfare-team-captain-controls"]}>
                  <div className={styles["welfare-team-block-head"]}>
                    <h3>{text.account.welfareTeamCaptainControls}</h3>
                    <span>
                      {team.is_recruiting
                        ? text.account.welfareTeamRecruitingOpen
                        : text.account.welfareTeamRecruitingPaused}
                    </span>
                  </div>
                  <div className={styles["welfare-team-action-row"]}>
                    <button
                      className={styles["wide-soft-action"]}
                      onClick={() => updateTeamRecruiting(!team.is_recruiting)}
                      disabled={teamActionBusy !== null}
                    >
                      {team.is_recruiting
                        ? text.account.welfareTeamStopRecruiting
                        : text.account.welfareTeamStartRecruiting}
                    </button>
                    <button
                      className={styles["wide-soft-action"]}
                      onClick={rotateTeamInvite}
                      disabled={teamActionBusy !== null}
                    >
                      {text.account.welfareTeamRotateInvite}
                    </button>
                  </div>
                  {team.invite_code ? (
                    <div className={styles["welfare-team-invite"]}>
                      <span>{text.account.welfareTeamInviteCode}</span>
                      <code>{team.invite_code}</code>
                      <button
                        className={styles["wide-soft-action"]}
                        onClick={shareTeamInvite}
                        disabled={teamActionBusy !== null}
                      >
                        {text.account.welfareTeamShareInvite}
                      </button>
                    </div>
                  ) : null}
                  <div className={styles["welfare-team-block-head"]}>
                    <h3>{text.account.welfareTeamCaptainQueue}</h3>
                    <span>
                      {text.shortCount(pendingCaptainApplications.length)}
                    </span>
                  </div>
                  {pendingCaptainApplications.length ? (
                    <div className={styles["welfare-team-captain-queue"]}>
                      {pendingCaptainApplications.map((application) => (
                        <article key={application.id}>
                          <div>
                            <strong>
                              {application.applicant_display_name ||
                                text.account.welfareTeamApplicant}
                            </strong>
                            <span>
                              {formatDateTime(application.requested_at, text)}
                            </span>
                            {application.message ? (
                              <small>{application.message}</small>
                            ) : null}
                          </div>
                          <div>
                            <button
                              onClick={() =>
                                decideTeamApplication(application.id, "approve")
                              }
                              disabled={teamActionBusy !== null}
                            >
                              {text.account.welfareTeamApprove}
                            </button>
                            <button
                              onClick={() =>
                                decideTeamApplication(application.id, "reject")
                              }
                              disabled={teamActionBusy !== null}
                            >
                              {text.account.welfareTeamReject}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className={styles["empty-copy"]}>
                      {text.account.welfareTeamNoApplications}
                    </p>
                  )}
                </div>
              ) : team?.is_captain ? (
                <div className={styles["welfare-team-status"]}>
                  {text.account.welfareTeamCaptainAccessUnavailable}
                </div>
              ) : null}
            </section>

            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfareTeamSeasonProof}</h2>
                <span>{teamHistoryMonth || text.notSynced}</span>
              </div>
              {welfareData?.teamSeasons?.length ? (
                <div className={styles["welfare-team-season-picker"]}>
                  {welfareData.teamSeasons.map((season) => (
                    <button
                      key={season.month}
                      className={clsx({
                        [styles["active"]]: season.month === teamHistoryMonth,
                      })}
                      onClick={() => setTeamHistoryMonth(season.month)}
                    >
                      {season.month}
                    </button>
                  ))}
                </div>
              ) : null}
              {teamSeasonError && (
                <div className={styles["form-error"]}>{teamSeasonError}</div>
              )}
              {teamSeasonLoading ? (
                <div className={styles["sync-notice"]}>
                  {text.account.welfareTeamSeasonLoading}
                </div>
              ) : teamSeasonDetail?.rows?.length ? (
                <>
                  <div className={styles["welfare-team-season-meta"]}>
                    <span>
                      {text.account.welfareTeamSettledAt}:{" "}
                      {teamSeasonDetail.season.settled_at
                        ? formatDateTime(
                            teamSeasonDetail.season.settled_at,
                            text,
                          )
                        : text.notSynced}
                    </span>
                    <span>
                      {text.account.welfareTeamCount}:{" "}
                      {teamSeasonDetail.total_teams}
                    </span>
                  </div>
                  <div className={styles["welfare-rank-list"]}>
                    {teamSeasonDetail.rows.map((row) => (
                      <div key={row.team_id}>
                        <strong>#{row.rank}</strong>
                        <span>
                          <b>{row.team_name}</b>
                          <small>
                            {text.account.welfareTeamMembers(row.member_count)}{" "}
                            · {text.account.welfareTeamSpend}{" "}
                            {formatMoney(row.team_spend)}
                          </small>
                        </span>
                        <em>
                          {text.account.welfareTeamPaidAmount}{" "}
                          {formatMoney(row.paid_amount)}
                        </em>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.welfareTeamSeasonNoRecords}
                </p>
              )}
            </section>

            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfareArenaLeaderboard}</h2>
                <span>{arenaOverview?.period?.name || ""}</span>
              </div>
              {arenaOverview?.current ? (
                <div className={styles["meta-list"]}>
                  <div className={styles["meta-row"]}>
                    <span>{text.account.welfareArenaCurrentRank}</span>
                    <strong>
                      {arenaOverview.current.rank
                        ? `#${arenaOverview.current.rank}`
                        : text.account.inviteGrowthNotRanked}
                    </strong>
                  </div>
                  <div className={styles["meta-row"]}>
                    <span>{text.account.welfareArenaTokensToPrev}</span>
                    <strong>
                      {arenaOverview.current.tokens_to_prev_rank || 0}
                    </strong>
                  </div>
                  <div className={styles["meta-row"]}>
                    <span>{text.account.welfareArenaEstimatedReward}</span>
                    <strong>
                      {formatMoney(arenaOverview.current.estimated_reward)}
                    </strong>
                  </div>
                </div>
              ) : null}
              {arenaRows.length ? (
                <div className={styles["welfare-rank-list"]}>
                  {arenaRows.map((row) => (
                    <div key={`${row.rank}-${row.display_name}`}>
                      <strong>#{row.rank}</strong>
                      <span>
                        <b>{row.display_name}</b>
                        <small>
                          {text.account.welfareScore}: {row.token_sum}
                        </small>
                      </span>
                      <em>{row.token_sum}</em>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.welfareNoLeaderboard}
                </p>
              )}
            </section>

            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfareArenaMonthlyRewards}</h2>
                <span>
                  {latestArenaHistory
                    ? `${text.account.welfareRewardsIssued}: ${formatMoney(
                        latestArenaHistory.total_amount,
                      )}`
                    : text.notSynced}
                </span>
              </div>
              {latestArenaHistory?.winners?.length ? (
                <div className={styles["welfare-rank-list"]}>
                  {latestArenaHistory.winners.slice(0, 10).map((winner) => (
                    <div key={`${winner.rank}-${winner.display_name}`}>
                      <strong>#{winner.rank}</strong>
                      <span>
                        <b>{winner.display_name}</b>
                        <small>{latestArenaHistory.period?.name || ""}</small>
                      </span>
                      <em>{formatMoney(winner.reward_amount)}</em>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.welfareNoRewards}
                </p>
              )}
            </section>

            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfareArenaDailyLeaderboard}</h2>
                <span>{arenaDailyCurrent?.period?.name || ""}</span>
              </div>
              {arenaDailyCurrent &&
              (arenaDailyCurrent.rank || arenaDailyCurrent.estimated_reward) ? (
                <div className={styles["meta-list"]}>
                  <div className={styles["meta-row"]}>
                    <span>{text.account.welfareArenaDailyCurrentRank}</span>
                    <strong>
                      {arenaDailyCurrent.rank
                        ? `#${arenaDailyCurrent.rank}`
                        : text.account.inviteGrowthNotRanked}
                    </strong>
                  </div>
                  <div className={styles["meta-row"]}>
                    <span>{text.account.welfareArenaTokensToPrev}</span>
                    <strong>
                      {arenaDailyCurrent.tokens_to_prev_rank || 0}
                    </strong>
                  </div>
                  <div className={styles["meta-row"]}>
                    <span>{text.account.welfareArenaDailyEstimatedReward}</span>
                    <strong>
                      {formatMoney(arenaDailyCurrent.estimated_reward)}
                    </strong>
                  </div>
                </div>
              ) : null}
              {arenaDailyRows.length ? (
                <div className={styles["welfare-rank-list"]}>
                  {arenaDailyRows.map((row) => (
                    <div key={`${row.rank}-${row.display_name}`}>
                      <strong>#{row.rank}</strong>
                      <span>
                        <b>{row.display_name}</b>
                        <small>
                          {text.account.welfareScore}: {row.token_sum}
                        </small>
                      </span>
                      <em>{formatMoney(row.estimated_reward)}</em>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.welfareNoLeaderboard}
                </p>
              )}
            </section>

            <section className={styles["section"]}>
              <div className={styles["section-head"]}>
                <h2>{text.account.welfareArenaDailyRewards}</h2>
                <span>
                  {arenaDailyRecent
                    ? `${text.account.welfareRewardsIssued}: ${formatMoney(
                        arenaDailyRecent.total_amount,
                      )} · ${
                        arenaDailyRecent.paid_today
                          ? text.account.welfareArenaDailyPaid
                          : text.account.welfareArenaDailyPayoutPending
                      }`
                    : text.notSynced}
                </span>
              </div>
              {arenaDailyRecent?.winners?.length ? (
                <div className={styles["welfare-rank-list"]}>
                  {arenaDailyRecent.winners.slice(0, 10).map((winner) => (
                    <div key={`${winner.rank}-${winner.display_name}`}>
                      <strong>#{winner.rank}</strong>
                      <span>
                        <b>{winner.display_name}</b>
                        <small>{arenaDailyRecent.period?.name || ""}</small>
                      </span>
                      <em>{formatMoney(winner.amount)}</em>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles["empty-copy"]}>
                  {text.account.welfareNoRewards}
                </p>
              )}
            </section>
          </>
        )}
      </AndroidDetailShell>
    );
  }

  if (route === Path.AccountInvite) {
    const tiers = [...(inviteCampaign?.tiers || [])].sort(
      (left, right) => left.required_invites - right.required_invites,
    );
    const required = tiers.at(-1)?.required_invites || 0;
    const qualified = inviteCampaign?.qualified_count || 0;
    const rewardByTier = new Map(
      (inviteCampaign?.rewards || []).map((reward) => [reward.tier, reward]),
    );
    const rewardStatuses = text.account.inviteGrowthRewardStatuses;
    const campaignStatuses = text.account.inviteGrowthCampaignStatuses;
    const rewardStatusLabel = (status: string) =>
      rewardStatuses[status as keyof typeof rewardStatuses] || status;
    const campaignStatusLabel = (status?: string) =>
      status
        ? campaignStatuses[status as keyof typeof campaignStatuses] || status
        : "";

    return (
      <AndroidDetailShell
        title={text.account.inviteGrowth}
        text={text}
        onRefresh={() => refreshInviteGrowth(true)}
      >
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>
              {inviteCampaign?.campaign?.name || text.account.inviteGrowth}
            </h2>
            <span>{campaignStatusLabel(inviteCampaign?.campaign?.status)}</span>
          </div>
          <p className={styles["empty-copy"]}>
            {text.account.inviteGrowthHint}
          </p>
          {inviteError && (
            <div className={styles["form-error"]}>{inviteError}</div>
          )}
          {inviteMessage && (
            <div className={styles["form-success"]}>{inviteMessage}</div>
          )}
          {!inviteLoading && (
            <div className={styles["invite-share-panel"]}>
              <div className={styles["invite-growth-block-head"]}>
                <h3>{text.account.inviteGrowthShare}</h3>
                <span>
                  {inviteSummary?.aff_code
                    ? `${text.account.inviteCode}: ${inviteSummary.aff_code}`
                    : text.account.inviteGrowthUnavailable}
                </span>
              </div>
              <div className={styles["invite-poster-themes"]}>
                {INVITE_POSTER_THEMES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    className={clsx({
                      [styles["active"]]: invitePosterTheme === theme,
                    })}
                    onClick={() => setInvitePosterTheme(theme)}
                  >
                    {text.account.invitePosterThemes[theme]}
                  </button>
                ))}
              </div>
              <div className={styles["inline-actions"]}>
                <button
                  onClick={shareInviteGrowth}
                  disabled={
                    inviteShareBusy || !inviteRegisterUrl || !inviteAppUrl
                  }
                >
                  <ShareIcon />
                  <span>
                    {inviteShareBusy
                      ? text.account.inviteGrowthSharing
                      : text.account.inviteGrowthShare}
                  </span>
                </button>
                <button
                  onClick={copyInviteGrowthLink}
                  disabled={!inviteRegisterUrl}
                >
                  <CopyIcon />
                  <span>{text.account.inviteGrowthCopy}</span>
                </button>
              </div>
            </div>
          )}
          {inviteLoading ? (
            <div className={styles["sync-notice"]}>{text.loading}</div>
          ) : !inviteCampaign ? (
            <p className={styles["empty-copy"]}>
              {text.account.inviteGrowthNoCampaign}
            </p>
          ) : (
            <>
              <div className={styles["invite-growth-stats"]}>
                <div>
                  <span>{text.account.inviteGrowthInvited}</span>
                  <strong>{inviteCampaign.invited_count}</strong>
                </div>
                <div>
                  <span>{text.account.inviteGrowthQualified}</span>
                  <strong>{qualified}</strong>
                </div>
                <div>
                  <span>{text.account.inviteGrowthMyRank}</span>
                  <strong>
                    {inviteCampaign.ranking?.rank
                      ? `#${inviteCampaign.ranking.rank}`
                      : text.account.inviteGrowthNotRanked}
                  </strong>
                </div>
              </div>
              <div className={styles["invite-growth-progress"]}>
                <div className={styles["meta-row"]}>
                  <span>{text.account.inviteGrowthProgress}</span>
                  <strong>
                    {qualified} / {required}
                  </strong>
                </div>
                <progress value={qualified} max={Math.max(required, 1)} />
              </div>
              <div className={styles["invite-growth-conditions"]}>
                <h3>{text.account.inviteGrowthConditions}</h3>
                <div>
                  <span>{text.account.inviteGrowthPayThreshold}</span>
                  <strong>
                    {formatMoney(inviteCampaign.campaign.pay_threshold)}
                  </strong>
                </div>
                <div>
                  <span>{text.account.inviteGrowthUsageThreshold}</span>
                  <strong>
                    {formatMoney(inviteCampaign.campaign.usage_threshold)}
                  </strong>
                </div>
                <div>
                  <span>{text.account.inviteGrowthClaimDeadline}</span>
                  <strong>
                    {formatDateTime(
                      inviteCampaign.campaign.claim_deadline,
                      text,
                    )}
                  </strong>
                </div>
              </div>
              {!inviteCampaign.enrollment ? (
                <button
                  className={styles["primary-action"]}
                  onClick={enrollInviteCampaign}
                >
                  {text.account.inviteGrowthEnroll}
                </button>
              ) : (
                <>
                  <div className={styles["invite-growth-block-head"]}>
                    <h3>{text.account.inviteGrowthMilestones}</h3>
                  </div>
                  <div className={styles["invite-tier-list"]}>
                    {tiers.map((tier) => {
                      const reward = rewardByTier.get(tier.tier);
                      const unlocked = qualified >= tier.required_invites;
                      return (
                        <article key={tier.tier}>
                          <div>
                            <strong>
                              {text.account.inviteGrowthMilestone(
                                tier.required_invites,
                              )}
                            </strong>
                            <span>{formatMoney(tier.reward_amount)}</span>
                          </div>
                          {reward?.status === "claimable" ? (
                            <button
                              type="button"
                              onClick={() => claimInviteReward(reward)}
                              disabled={inviteRewardBusy !== null}
                            >
                              {inviteRewardBusy === reward.id
                                ? text.account.inviteGrowthClaiming
                                : text.account.inviteGrowthClaim}
                            </button>
                          ) : (
                            <small>
                              {reward
                                ? rewardStatusLabel(reward.status)
                                : unlocked
                                ? text.account.inviteGrowthUnlocked
                                : text.account.inviteGrowthLocked}
                            </small>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </section>
        {inviteCampaign?.enrollment && (
          <section className={styles["section"]}>
            <div className={styles["section-head"]}>
              <h2>{text.account.inviteGrowthLeaderboard}</h2>
            </div>
            {inviteCampaign.leaderboard?.length ? (
              <div className={styles["invite-leaderboard"]}>
                {inviteCampaign.leaderboard.map((row) => (
                  <div
                    key={`${row.rank}-${row.email_masked}`}
                    className={clsx({ [styles["is-me"]]: row.is_me })}
                  >
                    <strong>#{row.rank}</strong>
                    <span>
                      {row.email_masked}
                      {row.is_me ? ` (${text.account.inviteGrowthMe})` : ""}
                    </span>
                    <small>
                      {text.account.inviteGrowthQualifiedLabel}:{" "}
                      {row.qualified_count}
                      {" / "}
                      {text.account.inviteGrowthRewardLabel}:{" "}
                      {formatMoney(row.reward_amount)}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles["empty-copy"]}>
                {text.account.inviteGrowthLeaderboardEmpty}
              </p>
            )}
          </section>
        )}
      </AndroidDetailShell>
    );
  }

  return (
    <AndroidAppShell active="account" text={text}>
      <header className={styles["app-header"]}>
        <div>
          <span>{workspace?.user?.email || workspace?.user?.username}</span>
          <h1>{text.account.title}</h1>
        </div>
        <IconButton
          label={text.common.refresh}
          onClick={() => {
            managed.bootstrap().catch(() => {});
            refreshAccountData().catch(() => {});
            refreshCheckoutInfo().catch(() => {});
          }}
        >
          <ReloadIcon />
        </IconButton>
      </header>

      <section className={styles["account-profile-card"]}>
        <div className={styles["profile-identity"]}>
          <i>
            {(workspace?.user?.username || workspace?.user?.email || "J")
              .slice(0, 1)
              .toUpperCase()}
          </i>
          <span>
            <strong>
              {workspace?.user?.username ||
                workspace?.user?.email ||
                "JisudengChat"}
            </strong>
            <small>
              {accountGroupName} ·{" "}
              {managed.session ? text.account.synced : text.account.waitingSync}
            </small>
          </span>
        </div>
        <div className={styles["profile-panel"]}>
          <div>
            <span>{text.account.balance}</span>
            <strong>{formatMoney(workspace?.user?.balance)}</strong>
          </div>
          <div>
            <span>{text.account.frozenBalance}</span>
            <strong>{formatMoney(workspace?.user?.frozen_balance)}</strong>
          </div>
        </div>
      </section>

      <section className={styles["account-quick-actions"]}>
        {!playDistribution && (
          <button onClick={() => navigate(Path.AccountRecharge)}>
            <DownloadIcon />
            <strong>{text.account.recharge}</strong>
            <span>{text.account.appInternalPayment}</span>
          </button>
        )}
        {!playDistribution && (
          <button onClick={() => navigate(Path.AccountPlans)}>
            <BotIcon />
            <strong>{text.account.packages}</strong>
            <span>
              {text.shortCount(
                (checkoutInfo?.plans || accountData.plans || []).length,
              )}
            </span>
          </button>
        )}
        <button onClick={() => navigate(Path.AccountRedeem)}>
          <FavoriteIcon />
          <strong>{text.account.redeemCenter}</strong>
          <span>{text.account.redeemShortHint}</span>
        </button>
      </section>

      <section className={styles["account-menu-group"]}>
        <div className={styles["section-head"]}>
          <h2>{text.account.accountHubs}</h2>
        </div>
        <div className={styles["account-menu-list"]}>
          <AccountMenuItem
            icon={<HistoryIcon />}
            title={text.account.notifications}
            detail={
              unreadPushCount
                ? text.account.notificationUnread(unreadPushCount)
                : text.account.notificationHint
            }
            onClick={() => navigate(Path.AccountNotifications)}
          />
          <AccountMenuItem
            icon={<SettingsIcon />}
            title={text.account.profile}
            detail={text.account.profileHint}
            onClick={() => navigate(Path.AccountProfile)}
          />
          <AccountMenuItem
            icon={<SettingsIcon />}
            title={text.account.systemSettings}
            detail={text.account.systemSettingsHint}
            onClick={() => navigate(Path.AccountSystemSettings)}
          />
          <AccountMenuItem
            icon={<FavoriteIcon />}
            title={text.account.accountHubPlay}
            detail={text.account.accountHubPlayHint}
            onClick={() => navigate(Path.AccountWelfare)}
          />
          <AccountMenuItem
            icon={<BotIcon />}
            title={
              playDistribution
                ? text.account.playCommerceBillingTitle
                : text.account.accountHubBilling
            }
            detail={
              playDistribution
                ? text.account.playCommerceBillingHint
                : text.account.accountHubBillingHint
            }
            onClick={() =>
              navigate(
                playDistribution ? Path.AccountRedeem : Path.AccountPlans,
              )
            }
          />
          <AccountMenuItem
            icon={<ShareIcon />}
            title={text.account.inviteGrowth}
            detail={text.account.inviteGrowthHint}
            onClick={() => navigate(Path.AccountInvite)}
          />
          {isAdmin && (
            <AccountMenuItem
              icon={<SettingsIcon />}
              title={text.account.adminCenter}
              detail={text.account.adminRecognized}
              onClick={() => navigate(Path.AccountAdmin)}
            />
          )}
        </div>
      </section>

      <details className={styles["account-more-services"]}>
        <summary>{text.account.moreServices}</summary>
        <section className={styles["account-menu-group"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.assetsAndRecords}</h2>
            <span>{text.account.actualUsageHint}</span>
          </div>
          <div className={styles["account-menu-list"]}>
            <AccountMenuItem
              icon={<HistoryIcon />}
              title={text.account.orders}
              detail={text.shortCount(accountData.orders?.length || 0)}
              onClick={() => navigate(Path.AccountOrders)}
            />
            <AccountMenuItem
              icon={<CopyIcon />}
              title={text.account.balanceDetails}
              detail={formatMoney(workspace?.user?.balance)}
              onClick={() => navigate(Path.AccountWallet)}
            />
            <AccountMenuItem
              icon={<FavoriteIcon />}
              title={text.account.coupons}
              detail={text.account.couponAvailable}
              onClick={() => {
                setCouponStatus("available");
                refreshCoupons("available").catch(() => {});
                navigate(Path.AccountCoupons);
              }}
            />
            <AccountMenuItem
              icon={<SettingsIcon />}
              title={text.account.subscriptions}
              detail={accountGroupName}
              onClick={() => navigate(Path.AccountSubscriptions)}
            />
          </div>
        </section>
      </details>

      {accountData.error && !accountData.updatedAt && (
        <div className={styles["form-error"]}>{accountData.error}</div>
      )}

      <button
        className={styles["danger-action"]}
        aria-label="account-logout"
        onClick={() => setShowLogoutConfirm(true)}
      >
        {text.account.logout}
      </button>

      {showLogoutConfirm && (
        <div className={styles["sheet-mask"]} role="dialog" aria-modal="true">
          <div className={styles["confirm-dialog"]}>
            <h2>{text.account.logoutConfirmTitle}</h2>
            <p>{text.account.logoutConfirmBody}</p>
            <p>{text.account.keepSavedAccount}</p>
            <div className={styles["inline-actions"]}>
              <button onClick={() => setShowLogoutConfirm(false)}>
                {text.account.logoutCancel}
              </button>
              <button
                aria-label="logout-keep-account"
                onClick={() => void signOut(false)}
              >
                {text.account.logoutKeepAccount}
              </button>
              <button
                aria-label="logout-clear-all"
                className={styles["danger-inline"]}
                onClick={() => void signOut(true)}
              >
                {text.account.logoutClearAll}
              </button>
            </div>
          </div>
        </div>
      )}
    </AndroidAppShell>
  );
}

function useMobileCrashLog() {
  useEffect(() => {
    function record(type: string, detail: unknown) {
      const error = detail instanceof Error ? detail : null;
      const message = error?.message || String(detail);
      const line = JSON.stringify({
        at: new Date().toISOString(),
        type,
        detail: message,
      });
      const key = accountStorageKey(CRASH_LOG_STORAGE_KEY);
      const previous = localStorage.getItem(key) || "";
      localStorage.setItem(
        key,
        [line, previous].filter(Boolean).join("\n").slice(0, 6000),
      );
      void recordNativeCrashlyticsException({
        category: type,
        message,
        stack: error?.stack,
      }).catch(() => undefined);
    }
    const onError = (event: ErrorEvent) =>
      record("error", event.error || event.message);
    const onRejection = (event: PromiseRejectionEvent) =>
      record("unhandledrejection", event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}

function AndroidGlobalUpdatePrompt() {
  const text = useMobileText();
  const clientConfig = useMemo(() => getClientConfig(), []);
  const installedRelease = useInstalledAndroidReleaseVersion();
  const [manifest, setManifest] = useState<AndroidUpdateManifest>();
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState("");
  const pollRef = useRef<number | null>(null);
  const currentVersion = formatAndroidReleaseVersion(
    installedRelease,
    text.account.unknownVersion,
  );
  const latestRelease = androidManifestReleaseVersion(manifest);
  const latestVersion = formatAndroidReleaseVersion(latestRelease);
  const updateDecision = evaluateAndroidUpdate(installedRelease, manifest);
  const required = updateDecision.required;
  const hasUpdate = updateDecision.hasUpdate;
  const playDistribution = isPlayDistribution(installedRelease);
  const apkUrl = resolveAndroidUrl(
    manifest?.apkUrl || manifest?.androidApkUrl || manifest?.url || "",
    clientConfig,
  );

  useEffect(() => {
    const check = async () => {
      const now = Date.now();
      const checkedAt = Number(
        localStorage.getItem(UPDATE_CHECKED_AT_STORAGE_KEY) || 0,
      );
      if (
        playDistribution ||
        !installedRelease.loaded ||
        now - checkedAt < UPDATE_CHECK_INTERVAL_MS
      )
        return;
      const url = getAndroidManifestUrl(clientConfig);
      if (!url || navigator.onLine === false) return;
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        window.clearTimeout(timeout);
        if (!response.ok) return;
        const nextManifest = (await response.json()) as AndroidUpdateManifest;
        localStorage.setItem(UPDATE_CHECKED_AT_STORAGE_KEY, String(now));
        const nextDecision = evaluateAndroidUpdate(
          installedRelease,
          nextManifest,
        );
        const nextVersion = formatAndroidReleaseVersion(nextDecision.latest);
        const mandatory = nextDecision.required;
        const available = nextDecision.hasUpdate;
        if (!available && !mandatory) return;
        setManifest(nextManifest);
        const dismissed = localStorage.getItem(
          UPDATE_DISMISSED_VERSION_STORAGE_KEY,
        );
        if (mandatory || dismissed !== nextVersion) {
          window.setTimeout(() => setVisible(true), 1200);
        }
      } catch {
        // A background update probe must never interrupt the current task.
      }
    };
    void check();
    const onResume = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("jisudeng-native-resume", onResume);
    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("jisudeng-native-resume", onResume);
    };
  }, [clientConfig, installedRelease, playDistribution]);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  async function downloadUpdate() {
    if (!apkUrl || downloading) return;
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError("");
    try {
      const result = await startNativeDownload(
        apkUrl,
        "jisudengchat-android.apk",
        "JisudengChat Android",
      );
      if (!result.id) {
        setDownloadProgress(100);
        await installDownloadedApk(undefined, result.path, manifest?.sha256);
        setDownloading(false);
        return;
      }
      pollRef.current = window.setInterval(async () => {
        const status = await getNativeDownloadStatus(String(result.id));
        setDownloadProgress(Math.round(status.progress || 0));
        if (status.status !== "success" && status.status !== "failed") return;
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setDownloading(false);
        if (status.status === "success") {
          await installDownloadedApk(
            String(result.id),
            status.localUri,
            manifest?.sha256,
          ).catch((error) => {
            setDownloadError(
              error instanceof Error && error.message
                ? error.message
                : text.errors.downloadFailed,
            );
          });
        } else {
          setDownloadError(text.errors.downloadFailed);
        }
      }, 1000);
    } catch (error) {
      setDownloading(false);
      setDownloadError(
        error instanceof Error && error.message
          ? error.message
          : text.errors.downloadFailed,
      );
    }
  }

  if (playDistribution || !visible || (!hasUpdate && !required)) return null;
  return (
    <div className={styles["sheet-mask"]} role="dialog" aria-modal="true">
      <div className={styles["confirm-dialog"]}>
        <h2>{text.account.updateFound}</h2>
        <p>{`${text.account.installed} ${currentVersion} · ${text.account.latestVersion} ${latestVersion}`}</p>
        {manifestNotes(manifest, text).length > 0 && (
          <ul>
            {manifestNotes(manifest, text)
              .slice(0, 4)
              .map((note) => (
                <li key={note}>{note}</li>
              ))}
          </ul>
        )}
        {downloadError && (
          <div className={styles["form-error"]} role="alert">
            {downloadError}
          </div>
        )}
        {downloading && (
          <div
            className={styles["download-progress"]}
            role="status"
            aria-live="polite"
          >
            <progress value={downloadProgress} max={100} />
            <span>{text.account.downloading(downloadProgress)}</span>
          </div>
        )}
        <div className={styles["inline-actions"]}>
          {!required && (
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(
                  UPDATE_DISMISSED_VERSION_STORAGE_KEY,
                  latestVersion,
                );
                setVisible(false);
              }}
            >
              {text.common.cancel}
            </button>
          )}
          <button
            type="button"
            onClick={() => void downloadUpdate()}
            disabled={!apkUrl || downloading}
          >
            <DownloadIcon />
            <span>
              {downloading
                ? text.account.downloading(downloadProgress)
                : text.account.downloadUpdate}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function AndroidManagedGate(props: { children: ReactNode }) {
  return (
    <AndroidReleaseVersionProvider>
      <AndroidManagedGateContent>{props.children}</AndroidManagedGateContent>
    </AndroidReleaseVersionProvider>
  );
}

function AndroidManagedGateContent(props: { children: ReactNode }) {
  const managed = useManagedNextChatStore();
  const mobileStore = useManagedMobileAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const text = useMobileText();
  const installedRelease = useInstalledAndroidReleaseVersion();
  const [secureRestoreDone, setSecureRestoreDone] = useState(false);
  const secureRestoreStartedRef = useRef(false);
  const billingRefreshRef = useRef(new Set<string>());
  const clientConfig = useMemo(() => getClientConfig(), []);
  const backendBaseUrl = useMemo(
    () => fixedManagedBackendBaseUrl(clientConfig),
    [clientConfig],
  );

  useMobileCrashLog();

  // Warm the account-scoped material cache when the app becomes active. The
  // sync endpoint returns only metadata deltas and a 304 when nothing changed;
  // binary files are therefore downloaded once per device/account and only
  // revalidated after an app restart or resume.
  useEffect(() => {
    const accountID = String(
      managed.user?.id || managed.session?.user_id || "",
    ).trim();
    // The domestic release owns the server material library. Keep the Play
    // distribution isolated until its separate asset/policy contract is
    // explicitly enabled; it must not silently start downloading domestic
    // library data after an account login.
    if (
      !accountID ||
      !managed.accessToken ||
      !backendBaseUrl ||
      isPlayDistribution(installedRelease)
    ) {
      return;
    }
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      void syncLocalMaterials(
        accountID,
        backendBaseUrl,
        useManagedNextChatStore.getState().accessToken,
      ).catch(() => undefined);
    };
    sync();
    window.addEventListener("jisudeng-native-resume", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("jisudeng-native-resume", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [
    backendBaseUrl,
    installedRelease,
    managed.accessToken,
    managed.session?.user_id,
    managed.user?.id,
  ]);

  // Prompt covers and text follow the same account-scoped local-cache policy
  // as user materials. Warm both catalogs after login; subsequent resumes only
  // perform the small manifest/ETag probe and fetch changed entries.
  useEffect(() => {
    const accountID = String(
      managed.user?.id || managed.session?.user_id || "",
    ).trim();
    if (
      !accountID ||
      !managed.accessToken ||
      !backendBaseUrl ||
      isPlayDistribution(installedRelease)
    ) {
      return;
    }
    const appLocale = mobileTextLocale(text);
    const locale =
      appLocale === "cn"
        ? "zh"
        : appLocale === "jp"
        ? "ja"
        : appLocale === "ko"
        ? "ko"
        : "en";
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      const token = useManagedNextChatStore.getState().accessToken;
      if (!token) return;
      void Promise.all(
        (["image", "video"] as const).map((kind) =>
          syncLocalPromptCatalog(
            accountID,
            locale,
            kind,
            backendBaseUrl,
            token,
            undefined,
            // Both creation modes share the published Creation Space prompt
            // mirror. Keep this warm-up source identical to the video page so
            // a first login downloads the actual video inspiration cards and
            // every later resume can use the same manifest/ETag delta.
            "canvas",
          ),
        ),
      ).catch(() => undefined);
    };
    sync();
    window.addEventListener("jisudeng-native-resume", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("jisudeng-native-resume", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [
    backendBaseUrl,
    installedRelease,
    managed.accessToken,
    managed.session?.user_id,
    managed.user?.id,
    text,
  ]);

  useEffect(() => {
    const userId = managed.user?.id || managed.session?.user_id;
    void configureNativeCrashlyticsUser(userId).catch(() => undefined);
  }, [managed.session?.user_id, managed.user?.id]);

  useEffect(() => {
    if (!backendBaseUrl || !installedRelease.name) return;
    const version = installedRelease.name;
    const referral = loadInviteReferral();
    if (referral?.token && managed.accessToken) {
      void attributeInviteCampaign(
        backendBaseUrl,
        managed.accessToken,
        referral.token,
      )
        .then(() => storeInviteReferral(null))
        .catch(() => undefined);
    }
    void reportInviteLifecycleEvent(
      backendBaseUrl,
      managed.accessToken,
      "first_launch",
      version,
      getInviteInstallationId(),
      {
        eventId: getStableInviteEventId("first_launch"),
        attributionToken: referral?.token,
      },
    ).catch(() => undefined);

    const reportActive = () => {
      if (document.visibilityState !== "visible") return;
      const day = new Date().toISOString().slice(0, 10);
      const currentReferral = loadInviteReferral();
      void reportInviteLifecycleEvent(
        backendBaseUrl,
        useManagedNextChatStore.getState().accessToken,
        "active",
        version,
        getInviteInstallationId(),
        {
          eventId: getStableInviteEventId(`active:${day}`),
          attributionToken: currentReferral?.token,
        },
      ).catch(() => undefined);
    };
    reportActive();
    document.addEventListener("visibilitychange", reportActive);
    window.addEventListener("jisudeng-native-resume", reportActive);
    return () => {
      document.removeEventListener("visibilitychange", reportActive);
      window.removeEventListener("jisudeng-native-resume", reportActive);
    };
  }, [backendBaseUrl, installedRelease.name, managed.accessToken]);

  useEffect(() => {
    const consumeInviteDeepLink = (detail: any) => {
      const url = String(detail?.url || "");
      const referral = captureInviteReferral(url);
      if (!referral) return;
      storeInviteReferral(referral);
      localStorage.removeItem("jisudeng-native-pending-invite");
      window.dispatchEvent(new Event("jisudeng-invite-referral-updated"));
      if (backendBaseUrl && installedRelease.name) {
        void reportInviteLifecycleEvent(
          backendBaseUrl,
          useManagedNextChatStore.getState().accessToken,
          "poster_scanned",
          installedRelease.name,
          getInviteInstallationId(),
          {
            eventId: getStableInviteEventId(
              `poster-scan:${referral.token || referral.aff_code}`,
            ),
            attributionToken: referral.token,
            metadata: { source: "app_link" },
          },
        ).catch(() => undefined);
      }
    };
    const onInviteDeepLink = (event: Event) =>
      consumeInviteDeepLink((event as CustomEvent).detail);
    try {
      const pending = localStorage.getItem("jisudeng-native-pending-invite");
      if (pending) consumeInviteDeepLink(JSON.parse(pending));
    } catch {
      // Keep malformed native state isolated from the application shell.
      localStorage.removeItem("jisudeng-native-pending-invite");
    }
    window.addEventListener("jisudeng-invite-deeplink", onInviteDeepLink);
    return () =>
      window.removeEventListener("jisudeng-invite-deeplink", onInviteDeepLink);
  }, [backendBaseUrl, installedRelease.name]);

  useEffect(() => {
    if (!managed.imageSession) return;
    const hydrate = async (
      projectId: string,
      assetId: string,
      requestId: string,
    ) => {
      try {
        const page = await managedAuthenticatedJsonRequest<ContentKitUsagePage>(
          `/api/v1/usage?page=1&page_size=1&client_request_id=${encodeURIComponent(
            requestId,
          )}`,
        );
        const record = page.items?.find(
          (item) => item.request_id === `client:${requestId}`,
        );
        if (!record) return;
        const project = useManagedMobileAppStore
          .getState()
          .contentKits.find((item) => item.id === projectId);
        if (!project) return;
        mobileStore.updateContentKit(projectId, {
          assets: project.assets.map((asset) =>
            asset.id === assetId
              ? {
                  ...asset,
                  actualCost: Number(record.actual_cost || 0),
                  billingRecordId: String(record.id),
                  billingStatus: "captured",
                  updatedAt: Date.now(),
                }
              : asset,
          ),
        });
      } catch {
        // Keep pending: a transient failed lookup must never be treated as a release.
      }
    };
    const refresh = () => {
      useManagedMobileAppStore.getState().contentKits.forEach((project) => {
        project.assets.forEach((asset) => {
          if (
            !asset.requestId ||
            asset.billingStatus !== "pending" ||
            (asset.status !== "completed" && asset.status !== "failed")
          ) {
            return;
          }
          const key = `${project.id}:${asset.id}`;
          if (billingRefreshRef.current.has(key)) return;
          billingRefreshRef.current.add(key);
          void hydrate(project.id, asset.id, asset.requestId).finally(() =>
            billingRefreshRef.current.delete(key),
          );
        });
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("online", refresh);
    window.addEventListener("jisudeng-network-restored", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("jisudeng-network-restored", refresh);
    };
    // The persisted account-specific project store is queried at refresh time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managed.imageSession, mobileStore.contentKits]);

  useEffect(() => {
    if (
      !managed._hasHydrated ||
      secureRestoreDone ||
      secureRestoreStartedRef.current
    )
      return;
    secureRestoreStartedRef.current = true;
    void (async () => {
      const restored = await managed.restoreSecureSession();
      if (!restored) return;
      const current = useManagedNextChatStore.getState();
      if (
        current.accessToken &&
        (!current.workspace ||
          shouldRefreshManagedSession(current.session) ||
          shouldRefreshManagedSession(current.imageSession))
      ) {
        await current
          .bootstrap({ silent: Boolean(current.workspace) })
          .catch(() => undefined);
      }
    })().finally(() => {
      setSecureRestoreDone(true);
    });
  }, [managed, managed._hasHydrated, secureRestoreDone]);

  useEffect(() => {
    function onNativeShare(event: Event) {
      const detail = (event as CustomEvent).detail || {};
      const files = Array.isArray(detail.files) ? detail.files : [];
      const parts = [
        detail.subject ? String(detail.subject) : "",
        detail.text ? String(detail.text) : "",
        files.length ? text.chat.sharedFilesReceived(files.length) : "",
      ].filter(Boolean);
      if (!parts.length) return;
      localStorage.setItem(
        NATIVE_SHARE_DRAFT_KEY,
        JSON.stringify({ text: parts.join("\n\n"), files, at: Date.now() }),
      );
      if (managed.isAuthenticated()) {
        navigate(Path.Chat);
      }
      window.dispatchEvent(new Event("jisudeng-share-draft-ready"));
    }
    window.addEventListener("jisudeng-native-share", onNativeShare);
    return () =>
      window.removeEventListener("jisudeng-native-share", onNativeShare);
  }, [managed, navigate, text]);

  useEffect(() => {
    function onPushOpen(event: Event) {
      const detail = ((event as CustomEvent).detail || {}) as {
        eventType?: string;
        sourceType?: string;
        sourceId?: string;
        kind?: string;
        status?: string;
      };
      const eventType = String(detail.eventType || "").toLowerCase();
      const sourceType = String(detail.sourceType || "").toLowerCase();
      const sourceId = String(detail.sourceId || "").trim();
      const kind = String(detail.kind || "").toLowerCase();
      if (sourceType === "mobile_feedback" || eventType.includes("support")) {
        navigate(
          sourceId
            ? `${Path.AccountFeedbackDetail}?ticket=${encodeURIComponent(
                sourceId,
              )}`
            : Path.AccountFeedback,
        );
        return;
      }
      if (sourceType === "mobile_task" || eventType.startsWith("task.")) {
        if (kind === "image") {
          navigate(Path.Sd);
          return;
        }
        if (kind === "chat") {
          navigate(Path.Chat);
          return;
        }
        navigate(Path.Activity, { state: { view: "tasks" } });
        return;
      }
      if (sourceType === "payment" || eventType.includes("payment")) {
        navigate(Path.AccountOrders);
        return;
      }
      navigate(Path.Activity, { state: { view: "notifications" } });
    }
    window.addEventListener("jisudeng:push-open", onPushOpen);
    return () => window.removeEventListener("jisudeng:push-open", onPushOpen);
  }, [navigate]);

  useEffect(() => {
    if (
      managed._hasHydrated &&
      backendBaseUrl &&
      managed.backendBaseUrl !== backendBaseUrl
    ) {
      managed.setBackendBaseUrl(backendBaseUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managed._hasHydrated, managed.backendBaseUrl, backendBaseUrl]);

  useEffect(() => {
    if (
      managed._hasHydrated &&
      backendBaseUrl &&
      managed.backendBaseUrl === backendBaseUrl &&
      managed.accessToken &&
      (!managed.workspace || shouldRefreshManagedSession(managed.session)) &&
      !managed.loading
    ) {
      managed.bootstrap().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managed._hasHydrated, managed.accessToken, managed.session]);

  useEffect(() => {
    if (
      !managed._hasHydrated ||
      !managed.accessToken ||
      !managed.backendBaseUrl
    )
      return;
    let disposed = false;
    let recovering = false;
    let lastRecoveredAt = 0;
    const recoverSession = async (force = false) => {
      if (disposed || recovering) return;
      const now = Date.now();
      if (!force && now - lastRecoveredAt < 60_000) return;
      recovering = true;
      lastRecoveredAt = now;
      try {
        const store = useManagedNextChatStore.getState();
        await store.ensureFreshAuthToken(force).catch(() => undefined);
        const latest = useManagedNextChatStore.getState();
        if (
          !latest.workspace ||
          shouldRefreshManagedSession(latest.session) ||
          shouldRefreshManagedSession(latest.imageSession)
        ) {
          await latest
            .bootstrap({ silent: Boolean(latest.workspace) })
            .catch(() => undefined);
        }
      } finally {
        recovering = false;
      }
    };
    const recoverAfterResume = () => {
      if (document.visibilityState === "visible") {
        void recoverSession(false);
      }
    };
    const recoverAfterOnline = () => {
      void recoverSession(true);
    };
    document.addEventListener("visibilitychange", recoverAfterResume);
    window.addEventListener("jisudeng-native-resume", recoverAfterOnline);
    window.addEventListener("online", recoverAfterOnline);
    const timer = window.setInterval(() => {
      void recoverSession(false);
    }, 5 * 60_000);
    void recoverSession(false);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", recoverAfterResume);
      window.removeEventListener("jisudeng-native-resume", recoverAfterOnline);
      window.removeEventListener("online", recoverAfterOnline);
      window.clearInterval(timer);
    };
  }, [managed._hasHydrated, managed.accessToken, managed.backendBaseUrl]);

  useEffect(() => {
    if (
      !managed.accessToken ||
      !managed.backendBaseUrl ||
      !installedRelease.name
    )
      return;
    const sentKey = accountStorageKey(DIAGNOSTICS_CURSOR_STORAGE_KEY);
    let disposed = false;
    const submitDiagnostics = async () => {
      const diagnostics = getManagedRequestDiagnostics(24)
        .filter((item) => item.category !== "recovered")
        .sort((left, right) => left.at - right.at);
      const lastSent = Number(localStorage.getItem(sentKey) || 0);
      const pending = diagnostics.filter((item) => item.at > lastSent);
      if (!pending.length || disposed) return;
      try {
        const client = await mobilePlatformClient();
        const connection = (navigator as any).connection;
        const rawNetwork = String(
          connection?.type || connection?.effectiveType || "",
        ).toLowerCase();
        const networkType =
          navigator.onLine === false
            ? "offline"
            : /cellular|2g|3g|4g|5g/.test(rawNetwork)
            ? "cellular"
            : /wifi/.test(rawNetwork)
            ? "wifi"
            : /ethernet/.test(rawNetwork)
            ? "ethernet"
            : "unknown";
        for (const item of pending) {
          const operation = /chat/.test(item.path)
            ? "chat"
            : /image/.test(item.path)
            ? "image"
            : /payment|order/.test(item.path)
            ? "payment"
            : /support|feedback/.test(item.path)
            ? "support"
            : /asset|file/.test(item.path)
            ? "file"
            : "sync";
          const category:
            | "network"
            | "timeout"
            | "http"
            | "cancelled"
            | "other" =
            item.category === "aborted"
              ? "cancelled"
              : item.category === "offline" || item.category === "network"
              ? "network"
              : item.category === "timeout"
              ? "timeout"
              : item.category === "http"
              ? "http"
              : "other";
          await client.diagnostics.submit({
            operation,
            category,
            path: item.path.split("?")[0],
            status_code: item.status,
            network_type: networkType,
            duration_ms:
              typeof (item as any).duration_ms === "number"
                ? (item as any).duration_ms
                : undefined,
          });
          localStorage.setItem(sentKey, String(item.at));
        }
      } catch {
        // Diagnostics are best effort and must never affect user requests.
      }
    };
    void submitDiagnostics();
    const timer = window.setInterval(submitDiagnostics, 30_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [installedRelease.name, managed.accessToken, managed.backendBaseUrl]);

  useEffect(() => {
    if (
      !managed.accessToken ||
      !managed.backendBaseUrl ||
      !installedRelease.name
    )
      return;
    let disposed = false;
    let removeListeners: (() => void) | undefined;
    void registerMobilePush(
      managed.backendBaseUrl,
      managed.accessToken,
      installedRelease.name,
    ).then((remove) => {
      if (disposed) {
        remove();
        return;
      }
      removeListeners = remove;
    });
    return () => {
      disposed = true;
      removeListeners?.();
    };
  }, [installedRelease.name, managed.accessToken, managed.backendBaseUrl]);

  if (!managed._hasHydrated || !secureRestoreDone) {
    return <MobileLoading />;
  }

  if (managed.accessToken && !managed.session && managed.loading) {
    return <MobileLoading />;
  }

  if (!backendBaseUrl) {
    return <AndroidLogin />;
  }

  if (!managed.isAuthenticated()) {
    return <AndroidLogin />;
  }

  if (location.pathname === Path.Home) {
    return (
      <>
        <AndroidDashboard />
        <AndroidGlobalUpdatePrompt />
      </>
    );
  }

  if (location.pathname === Path.Chat) {
    return (
      <>
        <AndroidChat />
        <AndroidGlobalUpdatePrompt />
      </>
    );
  }

  if (location.pathname === Path.Sd || location.pathname === Path.SdNew) {
    return (
      <>
        <AndroidCreationStudio />
        <AndroidGlobalUpdatePrompt />
      </>
    );
  }

  if (location.pathname === Path.Gallery) {
    return (
      <>
        <AndroidGallery />
        <AndroidGlobalUpdatePrompt />
      </>
    );
  }

  if (location.pathname === Path.Activity) {
    return (
      <>
        <AndroidActivityCenter />
        <AndroidGlobalUpdatePrompt />
      </>
    );
  }

  if (location.pathname === Path.Projects) {
    return (
      <>
        <AndroidProjects />
        <AndroidGlobalUpdatePrompt />
      </>
    );
  }

  if (location.pathname === Path.ContentKit) {
    return (
      <>
        <AndroidContentKit />
        <AndroidGlobalUpdatePrompt />
      </>
    );
  }

  if (
    location.pathname === Path.Settings ||
    location.pathname.startsWith("/account/")
  ) {
    return (
      <>
        <AndroidAccountSettings />
        <AndroidGlobalUpdatePrompt />
      </>
    );
  }

  return (
    <>
      {props.children}
      <AndroidGlobalUpdatePrompt />
    </>
  );
}
