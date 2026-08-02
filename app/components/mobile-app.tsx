"use client";

import {
  useCallback,
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
import { compressImage, removeImage } from "../utils/chat";
import { indexedDBStorage } from "../utils/indexedDB-storage";
import {
  ManagedApiError,
  ManagedTransportError,
  managedJsonRequest as managedApiJsonRequest,
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
import type { ManagedWorkspaceModel } from "../client/managed-nextchat";
import {
  formatManagedMobileError,
  getManagedMobileText,
  localizeManagedMobileError,
} from "../client/managed-mobile-i18n";
import {
  formatUsageUSD,
  mergeSubscriptionProgress,
  needsSubscriptionProgressRefresh,
  planUsageInfo,
  subscriptionUsagePeriods,
} from "../client/mobile-subscription";
import type { ManagedMobileText } from "../client/managed-mobile-i18n";
import {
  getNativeDownloadStatus,
  getNativeDeviceInfo,
  getNativeE2EFixtureFlags,
  installDownloadedApk,
  captureImage,
  deleteAppImages,
  listAppImages,
  openAppSettings,
  openExternalUrl,
  requestGalleryPermissions,
  requestCameraPermission,
  requestMicrophonePermission,
  requestNotificationPermission,
  cancelHoldSpeechRecognition,
  recognizeSpeech,
  saveImageToAppStorage,
  saveImageToGallery,
  shareImage,
  shareImages,
  shareText,
  showNativeNotification,
  isDirectNativeStreamAvailable,
  startDirectNativeStreamRequest,
  startHoldSpeechRecognition,
  startNativeDownload,
  stopHoldSpeechRecognition,
  readNativeSharedMaterial,
  loadLoginCredentials,
  saveLoginCredentials,
  clearLoginCredentials,
  finishNativeApp,
  showNativeToast,
} from "../client/android-native";
import type {
  NativeAppImage,
  NativeSharedMaterial,
} from "../client/android-native";
import {
  createMobilePlatformClient,
  uploadMobileAssetFormData,
} from "../client/mobile-platform";
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
  PLAY_WELFARE_TEAM_ENDPOINTS,
} from "../client/play-welfare";
import type {
  PlayWelfareData,
  PlayWelfareTeamDirectoryEntry,
  PlayWelfareTeamInvite,
  PlayWelfareTeamSeasonDetail,
} from "../client/play-welfare";
import {
  mobileAttributionAffiliateCode,
  mobileAttributionToken,
  reportMobileAttributionEvent,
} from "../client/mobile-attribution";
import type {
  MobileAsset,
  MobilePaymentOrder,
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
const CONTENT_KIT_MAX_OUTPUTS_PER_PROJECT = 48;
const activeContentKitOutputs = new Set<string>();

type ContentKitShotPlan = {
  id: string;
  kind: string;
  label: string;
  size: string;
  count: number;
};

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
  const zh = text.dateLocale.toLowerCase().startsWith("zh");
  const normalized = normalizedSkillCategory(category);
  const labels: Record<string, LocalizedString> = {
    document: { cn: "文档处理", en: "Document" },
    image: { cn: "图片与提示词", en: "Image" },
    marketing: { cn: "营销内容", en: "Marketing" },
    business: { cn: "商业经营", en: "Business" },
    code: { cn: "代码开发", en: "Code" },
    support: { cn: "客服售后", en: "Support" },
    legal: { cn: "合同法务", en: "Legal" },
    education: { cn: "学习教育", en: "Education" },
    office: { cn: "办公协作", en: "Office" },
    translation: { cn: "翻译本地化", en: "Translation" },
  };
  return localizedValue(
    labels[normalized] || {
      cn: category || "通用技能",
      en: category || "General",
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
    },
    image: {
      cn: "请提供图片、画面描述、用途、比例、风格偏好和需要避免的内容；有参考图时可一并加入素材。",
      en: "Provide images or scene description, use case, ratio, style preference, and constraints; attach references when available.",
    },
    marketing: {
      cn: "请提供产品/主题、目标用户、发布平台、语气、卖点和不能触碰的限制词。",
      en: "Provide product/topic, audience, platform, tone, selling points, and restricted wording.",
    },
    business: {
      cn: "请提供商品、服务、目标人群、平台规则、价格区间和已有素材。",
      en: "Provide product/service, audience, platform rules, price range, and existing materials.",
    },
    code: {
      cn: "请提供报错、相关代码、运行环境、复现步骤和最近改动；缺少日志时会先帮你列排查清单。",
      en: "Provide errors, code, environment, reproduction steps, and recent changes; missing logs will be requested.",
    },
    support: {
      cn: "请提供用户原话、订单/场景、已处理步骤、希望承诺的范围和不能承诺的内容。",
      en: "Provide the user's message, order/context, handled steps, allowed promises, and forbidden promises.",
    },
    legal: {
      cn: "请提供条款正文、签约场景、所在地区和你最担心的问题；输出仅供参考，不替代律师意见。",
      en: "Provide clause text, scenario, region, and concerns; output is informational, not legal advice.",
    },
    education: {
      cn: "请提供学习目标、当前基础、每天可用时间、截止日期和偏好的学习方式。",
      en: "Provide learning goal, baseline, available time, deadline, and preferred method.",
    },
    office: {
      cn: "请提供会议记录、参会角色、背景、希望产出的格式和重点事项。",
      en: "Provide meeting notes, roles, background, desired format, and key concerns.",
    },
    translation: {
      cn: "请提供原文、目标语言、使用场景、目标读者和语气要求；会保留变量、格式和专有名词。",
      en: "Provide source text, target language, context, audience, and tone; variables and terms are preserved.",
    },
  };
  return localizedValue(
    hints[normalizedSkillCategory(skill.category)] || {
      cn: "请提供任务目标、背景、素材和期望输出格式。",
      en: "Provide the goal, context, materials, and desired output format.",
    },
    text,
  );
}

function localSkillConsumptionHint(text: ManagedMobileText) {
  return text.dateLocale.toLowerCase().startsWith("zh")
    ? "技能本身不额外改变模型或分组，实际消耗按当前模型、套餐和生成内容计算。"
    : "The skill does not change model or group; actual usage follows the current model, plan, and output.";
}

function serverSkillConsumptionHint(
  skill: MobileSkill,
  text: ManagedMobileText,
) {
  const note = skill.version?.consumption_note_zh;
  if (text.dateLocale.toLowerCase().startsWith("zh") && note) return note;
  return localSkillConsumptionHint(text);
}

function serverSkillInputHint(skill: MobileSkill, text: ManagedMobileText) {
  const zh = text.dateLocale.toLowerCase().startsWith("zh");
  const params = skill.parameters || [];
  if (params.length > 0) {
    const labels = params
      .slice(0, 4)
      .map((param) => (zh && param.label_zh ? param.label_zh : param.label))
      .filter(Boolean)
      .join("、");
    if (labels) {
      return zh
        ? `建议提供：${labels}。缺少必要信息时，AI 会先追问补齐。`
        : `Recommended inputs: ${labels}. The AI will ask for missing required details.`;
    }
  }
  return zh
    ? "请提供任务目标、素材、背景和期望输出格式；有文件或图片时可先加入素材。"
    : "Provide the goal, materials, context, and desired output; attach files or images when needed.";
}

type AndroidUpdateManifest = {
  version?: string;
  latestVersion?: string;
  androidVersion?: string;
  minSupportedVersion?: string;
  minAndroidVersion?: string;
  severity?: "normal" | "recommended" | "required";
  apkUrl?: string;
  androidApkUrl?: string;
  url?: string;
  size?: string;
  sha256?: string;
  notes?: string[] | string;
  releaseNotes?: string[] | string;
};

const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const UPDATE_CHECKED_AT_STORAGE_KEY = "managed-mobile-update-checked-at";
const UPDATE_DISMISSED_VERSION_STORAGE_KEY = "managed-mobile-update-dismissed";

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
  | "bug"
  | "experience"
  | "image"
  | "chat"
  | "payment"
  | "account"
  | "request"
  | "other";

type MobileFeedbackScreenshotDraft = {
  id: string;
  dataUrl: string;
  fileName: string;
};

type GalleryFilter = "all" | "favorites" | "products" | "posters";

type GalleryCategory = "products" | "posters" | "";

type GalleryPreference = {
  favorite?: boolean;
  category?: GalleryCategory;
  updatedAt?: number;
};

type GalleryPreferences = Record<string, GalleryPreference>;

type LocalizedString = {
  cn: string;
  en: string;
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

type ImagePromptLanguageMode = "app" | "zh" | "en" | "both";

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

const PLACEHOLDER_BACKEND_RE =
  /^https?:\/\/api\.example\.com(?:[:/]|$)|^api\.example\.com(?:[:/]|$)/i;

const PAYMENT_RESULT_FALLBACK_URL = "https://www.jisudeng.com/payment/result";
const GALLERY_PREF_STORAGE_KEY = "jisudengchat-gallery-preferences-v1";
const IMAGE_PREF_STORAGE_KEY = "jisudengchat-image-preferences-v1";
const CHAT_PREF_STORAGE_KEY = "jisudengchat-chat-preferences-v1";
const NATIVE_SHARE_DRAFT_KEY = "jisudengchat-native-share-draft-v1";
const CRASH_LOG_STORAGE_KEY = "nextchat-mobile-crash-log";
const DIAGNOSTICS_CURSOR_STORAGE_KEY = "jisudengchat-diagnostics-last-sent-v1";

const IMAGE_PROMPT_TEMPLATES: ImagePromptTemplate[] = [
  {
    id: "portrait-clean",
    category: "portrait",
    title: { cn: "干净商业头像", en: "Clean business portrait" },
    description: {
      cn: "适合个人头像、简历、社媒形象。",
      en: "Good for profile, resume, and social avatar images.",
    },
    prompt: {
      cn: "一张高级商业头像，人物自然看向镜头，柔和自然光，干净浅色背景，真实摄影质感，皮肤细节自然，构图简洁，高级感，避免夸张滤镜和过度磨皮",
      en: "A refined business portrait, subject looking naturally at the camera, soft natural light, clean light background, realistic photographic texture, natural skin details, simple composition, premium feel, no heavy filters or over-smoothing",
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
    title: { cn: "电商产品主图", en: "E-commerce product hero" },
    description: {
      cn: "突出产品主体，适合商品首图。",
      en: "Highlights the product for marketplace hero images.",
    },
    prompt: {
      cn: "电商产品主图，产品居中展示，白色或浅灰背景，专业棚拍灯光，边缘清晰，材质真实，干净阴影，突出卖点，画面高级，适合网店首图",
      en: "E-commerce product hero image, product centered, white or light gray background, professional studio lighting, crisp edges, realistic material, clean shadow, clear selling point, premium look for an online store",
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
    title: { cn: "新品发布海报", en: "Launch poster" },
    description: {
      cn: "适合新品、活动、促销海报底图。",
      en: "A base visual for launches, campaigns, and promos.",
    },
    prompt: {
      cn: "新品发布海报视觉，中心留出标题区域，背景有层次但不杂乱，现代商业设计，高级光影，产品展示空间明确，适合添加中文标题和卖点文字",
      en: "New product launch poster visual, leave a clear central title area, layered but uncluttered background, modern commercial design, premium lighting, clear product display space, suitable for adding headline and selling points",
    },
    params: { size: "1024x1536", quality: "high", style: "vivid", count: 1 },
  },
  {
    id: "cover-short-video",
    category: "cover",
    title: { cn: "短视频封面", en: "Short video cover" },
    description: {
      cn: "适合小红书、抖音、视频号封面。",
      en: "For social short-video covers.",
    },
    prompt: {
      cn: "短视频封面视觉，竖版构图，主体清晰，强视觉焦点，背景简洁有冲击力，预留大标题空间，适合添加醒目的中文标题，高清商业设计",
      en: "Vertical short-video cover visual, clear subject, strong focal point, simple impactful background, large title space reserved, suitable for bold headline text, high-resolution commercial design",
    },
    params: { size: "1024x1792", quality: "high", style: "vivid", count: 1 },
  },
  {
    id: "interior-warm",
    category: "space",
    title: { cn: "温暖室内空间", en: "Warm interior space" },
    description: {
      cn: "适合装修、家居、民宿视觉。",
      en: "For interior, home, and hospitality visuals.",
    },
    prompt: {
      cn: "温暖现代室内空间，真实摄影风格，自然采光，木质与织物材质细腻，空间整洁舒适，生活气息，高级家居杂志质感",
      en: "Warm modern interior space, realistic photography, natural daylight, refined wood and fabric textures, tidy and comfortable, lived-in atmosphere, premium home magazine look",
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
    title: { cn: "国风插画", en: "Chinese-style illustration" },
    description: {
      cn: "适合头像、海报、节日视觉。",
      en: "For avatars, posters, and festival visuals.",
    },
    prompt: {
      cn: "精致国风插画，东方美学，细腻线条，柔和色彩，云纹与山水元素，画面有留白，高级插画质感，适合中文主题设计",
      en: "Refined Chinese-style illustration, eastern aesthetics, delicate linework, soft colors, cloud and landscape elements, elegant negative space, premium illustration quality for Chinese-themed design",
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
    title: { cn: "多专家协作", en: "Multi-expert collaboration" },
    description: {
      cn: "用产品、技术、运营、风控等多个视角共同拆解问题。",
      en: "Break down a task through product, engineering, operations, and risk perspectives.",
    },
    personality: {
      cn: "多视角、先分工、再汇总",
      en: "Multi-perspective, structured, decisive",
    },
    systemPrompt: {
      cn: "你是一个多专家协作组，但不要假装有后台多智能体编排。请在单次回答中模拟多个专业视角协同：产品专家负责用户场景和优先级，技术专家负责实现路径和风险，运营专家负责增长、留存和话术，风控/客服专家负责异常、投诉、合规和兜底。先用简短小节列出各专家判断，再汇总成可执行方案、优先级、验收标准和下一步。用户要求简单回答时保持简洁，不要为了展示协作而冗长。",
      en: "You are a multi-expert collaboration group, but do not pretend there is backend multi-agent orchestration. In one response, simulate coordinated expert perspectives: product for user scenarios and priority, engineering for implementation and risk, operations for growth and retention, and risk/support for edge cases, complaints, compliance, and fallback. Give brief expert judgments, then summarize an actionable plan, priority, acceptance criteria, and next steps. Stay concise when the user asks for a simple answer.",
    },
    starter: {
      cn: "请用多专家协作方式帮我分析：",
      en: "Analyze this with multi-expert collaboration:",
    },
  },
  {
    id: "writing-editor",
    category: "writing",
    title: { cn: "写作润色专家", en: "Writing editor" },
    description: {
      cn: "改写、润色、总结、标题优化。",
      en: "Rewrite, polish, summarize, and improve titles.",
    },
    personality: {
      cn: "清晰、克制、有表达力",
      en: "Clear, restrained, expressive",
    },
    systemPrompt: {
      cn: "你是写作润色专家。先判断用户要的是润色、改写、总结、扩写还是标题方案；保留原意和事实，去掉空话，增强结构、节奏和可读性。必要时给出 2-3 个不同风格版本，并说明差异。",
      en: "You are a writing editor. First infer whether the user needs polishing, rewriting, summarizing, expanding, or title ideas. Preserve intent and facts, remove filler, improve structure and readability, and offer 2-3 style variants when useful.",
    },
    starter: { cn: "把下面这段内容润色得更自然：", en: "Polish this text:" },
  },
  {
    id: "code-engineer",
    category: "code",
    title: { cn: "代码工程师", en: "Software engineer" },
    description: {
      cn: "排查报错、解释代码、生成实现方案。",
      en: "Debug errors, explain code, and plan implementations.",
    },
    personality: {
      cn: "严谨、直接、可执行",
      en: "Rigorous, direct, actionable",
    },
    systemPrompt: {
      cn: "你是资深软件工程师。先定位问题本质和风险，再给最小可行修复、排查命令、代码示例和验证方法。遇到信息不足时明确假设；不要编造不存在的接口、日志或环境。",
      en: "You are a senior software engineer. Identify the core issue and risk first, then provide the smallest viable fix, diagnostic commands, code examples, and verification steps. State assumptions when context is missing; do not invent APIs, logs, or environments.",
    },
    starter: { cn: "帮我排查这个问题：", en: "Help me debug this issue:" },
  },
  {
    id: "code-reviewer",
    category: "code",
    title: { cn: "代码审查专家", en: "Code reviewer" },
    description: {
      cn: "找缺陷、回归风险和测试缺口。",
      en: "Find defects, regressions, and test gaps.",
    },
    personality: { cn: "挑剔、证据优先", en: "Exacting, evidence-first" },
    systemPrompt: {
      cn: "你是代码审查专家。优先指出会导致线上故障、数据错误、安全风险、性能退化或兼容性问题的缺陷。结论要按严重程度排序，并给出具体修复建议和需要补充的测试。没有发现问题时明确说明残余风险。",
      en: "You are a code reviewer. Prioritize issues that can cause production failures, data bugs, security risk, performance regressions, or compatibility problems. Order findings by severity, give concrete fixes and missing tests, and state residual risk when no issue is found.",
    },
    starter: { cn: "帮我审查这段改动：", en: "Review this change:" },
  },
  {
    id: "ops-growth",
    category: "operation",
    title: { cn: "运营策划专家", en: "Growth operator" },
    description: {
      cn: "活动、公告、用户反馈和增长方案。",
      en: "Campaigns, announcements, feedback, and growth plans.",
    },
    personality: {
      cn: "目标导向、重执行",
      en: "Goal-oriented, execution-minded",
    },
    systemPrompt: {
      cn: "你是运营策划专家。围绕目标用户、触达场景、转化路径、内容话术、活动规则、数据指标和执行排期输出方案。方案要能直接交给团队执行，避免泛泛而谈。",
      en: "You are a growth operator. Build plans around audience, touchpoints, conversion path, copy, campaign rules, metrics, and rollout schedule. Make the result directly executable, not generic.",
    },
    starter: { cn: "帮我设计一个运营方案：", en: "Design a growth plan for:" },
  },
  {
    id: "support-agent",
    category: "support",
    title: { cn: "客服回复专家", en: "Support agent" },
    description: {
      cn: "生成耐心、清楚、能安抚用户的回复。",
      en: "Creates clear, calm support replies.",
    },
    personality: { cn: "耐心、负责、不推诿", en: "Patient, accountable, calm" },
    systemPrompt: {
      cn: "你是客服回复专家。先复述并确认用户问题，再给清楚步骤、预计处理时间、补偿或后续跟进方式。语气要真诚负责，不甩锅，不承诺无法保证的结果。",
      en: "You are a support agent. Acknowledge and restate the issue, then provide clear steps, expected handling time, compensation or follow-up when appropriate. Be sincere and accountable without overpromising.",
    },
    starter: {
      cn: "帮我回复这个用户反馈：",
      en: "Help me reply to this user:",
    },
  },
  {
    id: "product-manager",
    category: "product",
    title: { cn: "产品经理", en: "Product manager" },
    description: {
      cn: "需求拆解、优先级、原型流程。",
      en: "Requirement breakdown, priority, and flows.",
    },
    personality: { cn: "结构化、关注用户体验", en: "Structured, UX-aware" },
    systemPrompt: {
      cn: "你是产品经理。把用户想法拆成目标、目标用户、核心场景、功能范围、交互流程、异常状态、验收标准、数据指标和迭代路线。遇到体验冲突时优先保护核心用户体验。",
      en: "You are a product manager. Break ideas into goals, target users, core scenarios, scope, interaction flow, failure states, acceptance criteria, metrics, and iteration path. When tradeoffs conflict, protect the core user experience.",
    },
    starter: { cn: "帮我拆解这个需求：", en: "Break down this requirement:" },
  },
  {
    id: "prompt-architect",
    category: "ai",
    title: { cn: "提示词架构师", en: "Prompt architect" },
    description: {
      cn: "智能体、人设、工作流提示词。",
      en: "Agent, persona, and workflow prompts.",
    },
    personality: {
      cn: "精准、可复用、重边界",
      en: "Precise, reusable, boundary-aware",
    },
    systemPrompt: {
      cn: "你是提示词架构师。根据任务目标设计可复用提示词，包含角色、目标、输入要求、工作步骤、输出格式、边界约束和失败处理。提示词要简洁但完整，并给出测试样例。",
      en: "You are a prompt architect. Design reusable prompts with role, objective, input requirements, workflow, output format, boundaries, and failure handling. Keep prompts concise but complete, and include test examples.",
    },
    starter: {
      cn: "帮我设计一个智能体提示词：",
      en: "Design an agent prompt for:",
    },
  },
  {
    id: "image-director",
    category: "ai",
    title: { cn: "生图导演", en: "Image director" },
    description: {
      cn: "把想法变成高质量生图提示词。",
      en: "Turn ideas into high-quality image prompts.",
    },
    personality: {
      cn: "审美明确、细节丰富",
      en: "Visual, specific, taste-led",
    },
    systemPrompt: {
      cn: "你是生图导演。把用户想法转成可直接用于图像模型的提示词，明确主体、场景、构图、镜头、光线、材质、风格、色彩、比例和负面约束。默认输出中文提示词，可附英文版。",
      en: "You are an image director. Convert ideas into image-generation prompts with subject, scene, composition, camera, light, material, style, color, aspect ratio, and negative constraints. Default to the user's language and add English when helpful.",
    },
    starter: {
      cn: "帮我优化这个生图提示词：",
      en: "Improve this image prompt:",
    },
  },
  {
    id: "data-analyst",
    category: "analysis",
    title: { cn: "数据分析师", en: "Data analyst" },
    description: {
      cn: "指标拆解、表格分析、结论提炼。",
      en: "Metrics, tables, and insight extraction.",
    },
    personality: { cn: "客观、重证据", en: "Objective, evidence-led" },
    systemPrompt: {
      cn: "你是数据分析师。先明确指标口径和样本范围，再做趋势、结构、异常和原因假设分析。输出结论、证据、可能原因、验证办法和下一步动作。不要把相关性说成因果。",
      en: "You are a data analyst. Clarify metric definitions and sample scope, then analyze trends, composition, anomalies, and hypotheses. Output conclusions, evidence, possible causes, validation steps, and next actions. Do not present correlation as causation.",
    },
    starter: { cn: "帮我分析这些数据：", en: "Analyze this data:" },
  },
  {
    id: "sre-operator",
    category: "operation",
    title: { cn: "运维排障专家", en: "SRE troubleshooter" },
    description: {
      cn: "服务异常、日志、监控和容量方案。",
      en: "Incidents, logs, monitoring, and capacity.",
    },
    personality: { cn: "冷静、分层排查", en: "Calm, layered diagnosis" },
    systemPrompt: {
      cn: "你是运维排障专家。按现象、影响范围、最近变更、依赖链路、日志证据、临时止血、根因定位和长期改进来分析。优先保障可用性和数据安全。",
      en: "You are an SRE troubleshooter. Analyze symptoms, blast radius, recent changes, dependencies, logs, mitigation, root cause, and long-term improvements. Prioritize availability and data safety.",
    },
    starter: {
      cn: "帮我排查这个服务异常：",
      en: "Troubleshoot this incident:",
    },
  },
  {
    id: "finance-advisor",
    category: "business",
    title: { cn: "商业财务助手", en: "Business finance" },
    description: {
      cn: "定价、成本、毛利和套餐设计。",
      en: "Pricing, cost, margin, and plans.",
    },
    personality: { cn: "现实、算账清楚", en: "Practical, numbers-first" },
    systemPrompt: {
      cn: "你是商业财务助手。围绕成本结构、毛利、现金流、定价梯度、用户分层和风险假设做分析。输出可计算公式、示例表格和决策建议，提醒不确定参数。",
      en: "You are a business finance assistant. Analyze cost structure, margin, cash flow, pricing tiers, user segments, and risk assumptions. Provide formulas, example tables, decisions, and uncertain parameters.",
    },
    starter: {
      cn: "帮我算一下这个定价方案：",
      en: "Analyze this pricing plan:",
    },
  },
  {
    id: "translator",
    category: "translation",
    title: { cn: "中英翻译专家", en: "CN/EN translator" },
    description: {
      cn: "自然翻译、双语润色、跨境表达。",
      en: "Natural translation and bilingual polishing.",
    },
    personality: {
      cn: "自然、准确、懂语境",
      en: "Natural, accurate, contextual",
    },
    systemPrompt: {
      cn: "你是中英翻译专家。根据语境自然翻译，不逐字硬翻，保留专业术语、品牌名、变量名和格式。用户未指定时，中文翻英文、英文翻中文；必要时给正式版和口语版。",
      en: "You are a Chinese-English translator. Translate naturally based on context, avoid literal phrasing, and preserve domain terms, brand names, variable names, and formatting. If direction is unspecified, translate Chinese to English and English to Chinese; include formal and conversational variants when useful.",
    },
    starter: { cn: "帮我翻译：", en: "Translate this:" },
  },
  {
    id: "legal-reference",
    category: "legal",
    title: { cn: "法律参考助手", en: "Legal reference" },
    description: {
      cn: "合同、条款、风险点初步梳理。",
      en: "Initial review of contracts, terms, and risks.",
    },
    personality: { cn: "谨慎、边界清楚", en: "Careful, boundary-clear" },
    systemPrompt: {
      cn: "你是法律参考助手。帮助用户梳理条款含义、风险点、缺失条款、谈判建议和需要咨询律师的问题。必须说明内容仅供参考，不替代律师意见；不要给确定性法律结论。",
      en: "You are a legal reference assistant. Help identify clause meaning, risks, missing terms, negotiation points, and questions for a lawyer. Always state this is informational and not legal advice; avoid definitive legal conclusions.",
    },
    starter: { cn: "帮我看一下这段条款：", en: "Review this clause:" },
  },
];

const CHAT_SKILL_TEMPLATES: ChatSkillTemplate[] = [
  {
    id: "document-summary",
    category: "document",
    title: { cn: "文档总结", en: "Document summary" },
    description: {
      cn: "提炼长文、会议纪要、资料重点和待办。",
      en: "Extract key points, decisions, and todos from long text.",
    },
    instruction: {
      cn: "你正在使用“文档总结”技能。先识别文档主题、对象和上下文，再输出核心结论、关键证据、风险/疑问、待办事项和适合转发给团队的简短摘要。不要编造文档中不存在的信息。",
      en: "You are using the Document Summary skill. Identify topic, audience, and context, then output key conclusions, evidence, risks/questions, todos, and a concise team-ready summary. Do not invent facts absent from the document.",
    },
    examples: [
      {
        cn: "总结这份会议记录并列出待办",
        en: "Summarize this meeting note and list todos",
      },
    ],
    starter: { cn: "请总结下面这份文档：", en: "Summarize this document:" },
  },
  {
    id: "webpage-summary",
    category: "document",
    title: { cn: "网页总结", en: "Webpage summary" },
    description: {
      cn: "把链接、网页摘录整理成重点和行动建议。",
      en: "Turn links or webpage excerpts into key points and next actions.",
    },
    instruction: {
      cn: "你正在使用“网页总结”技能。根据用户提供的链接说明或网页摘录进行整理；无法访问外部网页时要明确说明需要用户粘贴正文。输出页面主题、关键信息、适合谁看、可执行建议和需要核实的点。",
      en: "You are using the Webpage Summary skill. Work from the user's link description or pasted excerpt. If you cannot access the page, ask for pasted content. Output topic, key information, target audience, actionable suggestions, and facts to verify.",
    },
    examples: [
      {
        cn: "总结这个网页适合我关注什么",
        en: "Summarize what matters from this webpage",
      },
    ],
    starter: {
      cn: "请总结这个网页/链接内容：",
      en: "Summarize this webpage/link:",
    },
  },
  {
    id: "image-to-prompt",
    category: "image",
    title: { cn: "图片转提示词", en: "Image to prompt" },
    description: {
      cn: "分析图片风格、主体、镜头和可复用生图 prompt。",
      en: "Analyze an image and produce reusable generation prompts.",
    },
    instruction: {
      cn: "你正在使用“图片转提示词”技能。根据用户上传或描述的图片，拆解主体、场景、构图、镜头、光线、色彩、材质、风格、负面约束，并给出中文完整 prompt 和英文完整 prompt。不要声称看到了未提供的图片细节。",
      en: "You are using the Image to Prompt skill. From the uploaded or described image, break down subject, scene, composition, camera, lighting, color, material, style, negative constraints, then provide full Chinese and English prompts. Do not claim unseen details.",
    },
    examples: [
      {
        cn: "把这张图转成可复用生图提示词",
        en: "Turn this image into a reusable prompt",
      },
    ],
    starter: {
      cn: "请把这张图/这个画面转成提示词：",
      en: "Turn this image/scene into a prompt:",
    },
  },
  {
    id: "prompt-polish",
    category: "image",
    title: { cn: "生图提示词优化", en: "Image prompt polish" },
    description: {
      cn: "把简单想法扩写成完整、高质量、通用的生图提示词。",
      en: "Expand rough ideas into complete model-agnostic image prompts.",
    },
    instruction: {
      cn: "你正在使用“生图提示词优化”技能。保留用户原意，不绑定特定模型；补全主体、场景、构图、镜头、光线、色彩、材质、风格、比例、负面约束和参考图建议。输出中文 prompt、英文 prompt、推荐参数和可选变体。",
      en: "You are using the Image Prompt Polish skill. Preserve user intent and avoid binding to one model. Add subject, scene, composition, camera, lighting, color, material, style, ratio, negative constraints, and reference-image advice. Output Chinese prompt, English prompt, suggested parameters, and optional variants.",
    },
    examples: [
      { cn: "优化这个生图提示词，让它更完整", en: "Polish this image prompt" },
    ],
    starter: { cn: "请优化这个生图提示词：", en: "Polish this image prompt:" },
  },
  {
    id: "ecommerce-copy",
    category: "business",
    title: { cn: "电商文案", en: "E-commerce copy" },
    description: {
      cn: "生成商品标题、卖点、详情页结构和投放文案。",
      en: "Generate titles, selling points, product pages, and ad copy.",
    },
    instruction: {
      cn: "你正在使用“电商文案”技能。先确认商品、目标人群、平台和核心卖点；输出搜索友好标题、3-5 个主卖点、详情页结构、短视频/信息流文案和风险词提醒。不要夸大功效，不要写无法证明的绝对化承诺。",
      en: "You are using the E-commerce Copy skill. Clarify product, audience, platform, and key value. Output search-friendly titles, 3-5 selling points, detail-page structure, short-video/feed copy, and risky wording warnings. Avoid exaggerated claims and unverifiable absolutes.",
    },
    examples: [
      {
        cn: "帮我写这个商品的主图和详情页文案",
        en: "Write listing copy for this product",
      },
    ],
    starter: {
      cn: "请为这个商品生成电商文案：",
      en: "Create e-commerce copy for this product:",
    },
  },
  {
    id: "xiaohongshu-note",
    category: "marketing",
    title: { cn: "小红书笔记", en: "Social note" },
    description: {
      cn: "生成种草笔记、标题、封面文字和评论引导。",
      en: "Create social note posts, titles, cover text, and engagement hooks.",
    },
    instruction: {
      cn: "你正在使用“小红书笔记”技能。根据用户目标输出 5 个标题、正文结构、口语化正文、封面文字建议、话题标签和评论区引导。语气自然可信，避免假体验、虚假背书和过度营销。",
      en: "You are using the Social Note skill. Output 5 titles, content structure, conversational body copy, cover-text ideas, hashtags, and comment prompts. Keep it natural and credible; avoid fake experience, false endorsement, and over-selling.",
    },
    examples: [
      {
        cn: "写一篇适合小红书的种草笔记",
        en: "Write a social recommendation note",
      },
    ],
    starter: { cn: "请写一篇小红书笔记：", en: "Write a social note:" },
  },
  {
    id: "contract-review",
    category: "legal",
    title: { cn: "合同风险初筛", en: "Contract risk scan" },
    description: {
      cn: "梳理合同重点、风险条款、缺失条款和谈判建议。",
      en: "Scan contract clauses, risks, missing terms, and negotiation points.",
    },
    instruction: {
      cn: "你正在使用“合同风险初筛”技能。内容仅供参考，不替代律师意见。按条款含义、风险等级、可能后果、建议修改、需补充信息输出；对无法判断的法律事实明确标注需专业确认。",
      en: "You are using the Contract Risk Scan skill. This is informational and not legal advice. Output clause meaning, risk level, possible consequence, suggested revision, and missing information. Mark legal uncertainties that require professional review.",
    },
    examples: [
      { cn: "帮我检查这份合同有哪些风险", en: "Scan this contract for risks" },
    ],
    starter: { cn: "请初步检查这份合同：", en: "Scan this contract:" },
  },
  {
    id: "customer-reply",
    category: "support",
    title: { cn: "客服回复", en: "Support reply" },
    description: {
      cn: "把用户投诉、问题和售后情况转成清楚负责的回复。",
      en: "Turn complaints or issues into clear support replies.",
    },
    instruction: {
      cn: "你正在使用“客服回复”技能。先共情并复述问题，再给处理步骤、预计时间、补充信息要求和后续跟进方式。语气负责，不甩锅，不承诺无法保证的结果。",
      en: "You are using the Support Reply skill. Acknowledge and restate the issue, then provide steps, expected timing, requested details, and follow-up. Be accountable without overpromising.",
    },
    examples: [
      { cn: "帮我回复这个用户投诉", en: "Help me reply to this complaint" },
    ],
    starter: { cn: "请帮我回复这个用户：", en: "Help me reply to this user:" },
  },
  {
    id: "code-debug",
    category: "code",
    title: { cn: "代码排错", en: "Code debugging" },
    description: {
      cn: "分析报错、定位原因、给修复步骤和验证命令。",
      en: "Analyze errors, locate causes, and provide fixes and verification.",
    },
    instruction: {
      cn: "你正在使用“代码排错”技能。先复述现象和环境，按最可能原因排序，给排查命令、最小修复、回归风险和验证步骤。缺少日志时明确需要哪些信息，不编造结果。",
      en: "You are using the Code Debugging skill. Restate symptoms and environment, rank likely causes, give diagnostic commands, minimal fix, regression risks, and verification. Ask for missing logs instead of inventing results.",
    },
    examples: [{ cn: "帮我排查这段报错", en: "Debug this error" }],
    starter: { cn: "请帮我排查这个报错：", en: "Debug this error:" },
  },
  {
    id: "study-plan",
    category: "education",
    title: { cn: "学习计划", en: "Study plan" },
    description: {
      cn: "根据目标、基础和时间制定学习路径。",
      en: "Create a learning path from goals, baseline, and schedule.",
    },
    instruction: {
      cn: "你正在使用“学习计划”技能。先判断用户目标、基础、可投入时间和截止日期；输出阶段目标、每日/每周安排、练习任务、检查点和调整建议。计划要可执行，不堆砌资源。",
      en: "You are using the Study Plan skill. Identify goal, baseline, available time, and deadline. Output stages, daily/weekly schedule, practice tasks, checkpoints, and adjustment advice. Keep it executable, not resource-heavy.",
    },
    examples: [
      { cn: "给我制定一个 30 天学习计划", en: "Create a 30-day study plan" },
    ],
    starter: { cn: "请给我制定学习计划：", en: "Create a study plan:" },
  },
  {
    id: "meeting-minutes",
    category: "office",
    title: { cn: "会议纪要", en: "Meeting minutes" },
    description: {
      cn: "把会议内容整理成决策、待办、负责人和时间点。",
      en: "Convert meeting text into decisions, todos, owners, and dates.",
    },
    instruction: {
      cn: "你正在使用“会议纪要”技能。输出会议主题、参会角色、关键讨论、已确认决策、待办事项、负责人、截止时间和未决问题。未知负责人或时间要标注待确认。",
      en: "You are using the Meeting Minutes skill. Output topic, attendees/roles, key discussion, decisions, action items, owners, deadlines, and open questions. Mark unknown owners or dates as to-be-confirmed.",
    },
    examples: [
      { cn: "整理这段会议录音转写", en: "Organize this meeting transcript" },
    ],
    starter: {
      cn: "请整理这段会议内容：",
      en: "Organize these meeting notes:",
    },
  },
  {
    id: "translation-localize",
    category: "translation",
    title: { cn: "翻译本地化", en: "Translation localization" },
    description: {
      cn: "中英互译、润色、适配平台语气和目标用户。",
      en: "Translate and localize tone for platform and audience.",
    },
    instruction: {
      cn: "你正在使用“翻译本地化”技能。保留专有名词、变量、格式和事实；根据目标地区和平台调整语气。默认给自然版，如有必要再给正式版和口语版，并说明关键取舍。",
      en: "You are using the Translation Localization skill. Preserve names, variables, formatting, and facts; adapt tone to region and platform. Provide a natural version by default, plus formal and casual variants when useful, with key tradeoffs.",
    },
    examples: [
      {
        cn: "把这段中文翻译成自然英文",
        en: "Translate this into natural English",
      },
    ],
    starter: { cn: "请翻译并本地化：", en: "Translate and localize:" },
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
  "bug",
  "experience",
  "image",
  "chat",
  "payment",
  "account",
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
  return `¥${Number.isFinite(numberValue) ? numberValue.toFixed(2) : "0.00"}`;
}

function isManagedAdminWorkspace(workspace?: { user?: unknown } | null) {
  const user = workspace?.user as any;
  const roles = [
    user?.role,
    user?.user_role,
    user?.account_role,
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.permissions) ? user.permissions : []),
  ]
    .filter(Boolean)
    .map((item) => String(item).toLowerCase());
  return Boolean(
    user?.is_admin ||
      user?.is_root ||
      user?.admin ||
      roles.some((role) => /admin|root|owner|super/.test(role)),
  );
}

function useMobileText() {
  return useMemo(() => getManagedMobileText(), []);
}

function localizedValue(value: LocalizedString, text: ManagedMobileText) {
  return text.dateLocale.toLowerCase().startsWith("zh") ? value.cn : value.en;
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
  if (mode === "both") return [zh, en].filter(Boolean).join("\n\n---\n\n");
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

function fallbackImagePromptCategories(text: ManagedMobileText) {
  const zh = text.dateLocale.toLowerCase().startsWith("zh");
  return [
    { id: "all", label: text.common.all },
    { id: "featured", label: zh ? "精选" : "Featured" },
    { id: "favorites", label: zh ? "收藏" : "Favorites" },
    { id: "recent", label: zh ? "最近" : "Recent" },
    { id: "profile-avatar", label: zh ? "头像" : "Profile" },
    { id: "portrait", label: zh ? "人像" : "Portrait" },
    { id: "product", label: zh ? "产品" : "Product" },
    { id: "ecommerce", label: zh ? "电商" : "E-commerce" },
    { id: "poster", label: zh ? "海报" : "Poster" },
    { id: "social-media", label: zh ? "社媒" : "Social" },
    { id: "education-infographic", label: zh ? "教育图解" : "Infographic" },
    { id: "ui-web", label: "UI/Web" },
    { id: "game-asset", label: zh ? "游戏资产" : "Game asset" },
    { id: "comic-storyboard", label: zh ? "漫画分镜" : "Storyboard" },
    { id: "photography", label: zh ? "摄影" : "Photography" },
    { id: "cinematic", label: zh ? "电影感" : "Cinematic" },
    { id: "illustration", label: zh ? "插画" : "Illustration" },
    { id: "chinese-style", label: zh ? "国风" : "Chinese style" },
    { id: "watercolor", label: zh ? "水彩" : "Watercolor" },
    { id: "pixel-art", label: zh ? "像素" : "Pixel art" },
    { id: "3d-render", label: "3D" },
    { id: "architecture-interior", label: zh ? "建筑空间" : "Architecture" },
    { id: "food-drink", label: zh ? "食物" : "Food" },
    { id: "fashion", label: zh ? "服装" : "Fashion" },
    { id: "typography", label: zh ? "字体排版" : "Typography" },
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

function normalizeVersion(version?: string) {
  return (version || "")
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareVersions(a?: string, b?: string) {
  const left = normalizeVersion(a);
  const right = normalizeVersion(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
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

function getAndroidManifestUrl(config?: ClientBuildConfig) {
  return resolveAndroidUrl(
    config?.androidManifestUrl || "/downloads/android-version.json",
    config,
  );
}

function manifestNotes(manifest?: AndroidUpdateManifest) {
  const raw = manifest?.notes || manifest?.releaseNotes || [];
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
  return (
    groupByID(workspace, groupID)?.name || currentGroupName(workspace, text)
  );
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

function isImageModel(model: ManagedWorkspaceModel) {
  const text = [
    model.id,
    model.name,
    model.display_name,
    model.use_case,
    model.channel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/(video|audio|embedding|rerank|speech|tts|stt)/.test(text)) return false;
  return /(gpt-image|image-preview|image|dall|flux|sdxl|stable-diffusion|imagen|recraft|midjourney|grok-imagine|绘图|生图|画图|图片|图像|海报)/.test(
    text,
  );
}

function isVideoModel(model: ManagedWorkspaceModel) {
  const text = [
    model.id,
    model.name,
    model.display_name,
    model.use_case,
    model.channel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(video|影片|视频)/.test(text);
}

function isChatModel(model: ManagedWorkspaceModel) {
  return !isImageModel(model) && !isVideoModel(model);
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
  allowLegacyFallback = true,
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

  if (!allowLegacyFallback) return false;

  // Compatibility only for older servers that do not expose capabilities.
  const normalized = (typeof model === "string" ? model : modelValue(model))
    .toLowerCase()
    .trim();
  return (
    /^gpt-image-/.test(normalized) ||
    /(?:gemini|imagen).*image/.test(normalized) ||
    /^grok-imagine/.test(normalized)
  );
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
  allowLegacyFallback = true,
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
  return workspace?.models?.groups?.find((group) =>
    (group.models || []).some(isChatModel),
  );
}

function preferredChatGroupID(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
  storedGroupID?: number,
) {
  const groups = workspace?.models?.groups ?? [];
  if (
    storedGroupID &&
    groups.some(
      (group) =>
        group.id === storedGroupID && (group.models || []).some(isChatModel),
    )
  ) {
    return storedGroupID;
  }
  return bestChatGroup(workspace)?.id;
}

function storedChatGroupID(
  workspace: ReturnType<typeof useManagedNextChatStore.getState>["workspace"],
) {
  const stored = storedChatPreferenceGroupID();
  return preferredChatGroupID(workspace, stored || undefined);
}

function storedChatPreferenceGroupID() {
  return Number(readStoredJSON(CHAT_PREF_STORAGE_KEY, { groupId: 0 }).groupId);
}

function storedChatPreferenceModel() {
  return String(readStoredJSON(CHAT_PREF_STORAGE_KEY, { model: "" }).model || "");
}

function persistChatPreference(groupId?: number, model = "") {
  writeStoredJSON(CHAT_PREF_STORAGE_KEY, {
    groupId: groupId || 0,
    model,
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
    state.workspace?.user?.id || state.user?.id || state.session?.user_id;
  return userId ? `${key}:user:${userId}` : key;
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

function galleryItemPreference(item: any, preferences: GalleryPreferences) {
  return preferences[galleryItemPreferenceKey(item)] || {};
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
  };
}

function localizedOrderStatus(status: string, text: ManagedMobileText) {
  const key = String(status || "")
    .toLowerCase()
    .trim();
  const zh = text.dateLocale.toLowerCase().startsWith("zh");
  const labels: Record<string, string> = zh
    ? {
        pending: "待支付",
        created: "待支付",
        unpaid: "待支付",
        waiting: "等待支付",
        processing: "处理中",
        paid: "已支付",
        success: "已支付",
        completed: "已完成",
        failed: "已失败",
        cancelled: "已取消",
        canceled: "已取消",
        expired: "已过期",
        refunded: "已退款",
        refunding: "退款中",
        refund_failed: "退款失败",
      }
    : {
        pending: "Pending",
        created: "Pending",
        unpaid: "Pending",
        waiting: "Waiting",
        processing: "Processing",
        paid: "Paid",
        success: "Paid",
        completed: "Completed",
        failed: "Failed",
        cancelled: "Cancelled",
        canceled: "Cancelled",
        expired: "Expired",
        refunded: "Refunded",
        refunding: "Refunding",
        refund_failed: "Refund failed",
      };
  if (labels[key]) return labels[key];
  if (!key) return "-";
  return zh ? "订单状态待同步" : "Order status unavailable";
}

function localizedPaymentType(type: string, text: ManagedMobileText) {
  return paymentMethodLabel({ payment_type: type }, text);
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
  const zh = text.dateLocale.toLowerCase().startsWith("zh");
  if (/reason|thinking|deep/.test(combined)) {
    return zh ? "深度思考扣除" : "Reasoning usage";
  }
  if (/image|draw|poster|batch_image/.test(combined)) {
    return zh ? "生图扣除" : "Image generation";
  }
  const labels: Record<string, string> = zh
    ? {
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
      }
    : {
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
      };
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
  nativeImages.forEach((image) => {
    if (seen.has(image.localUrl) || seen.has(image.fileName)) return;
    merged.push(nativeImageAsDrawItem(image));
  });
  return merged.sort((left, right) => {
    const leftTime = Number(left.updated_at || left.created_at || 0);
    const rightTime = Number(right.updated_at || right.created_at || 0);
    return rightTime - leftTime;
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

async function managedFormDataRequest<T>(
  path: string,
  body: FormData,
  text: ManagedMobileText,
) {
  return requestWithManagedAuth(async ({ baseUrl, accessToken }) => {
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
    let dataUrl: string;
    try {
      dataUrl = await compressImage(file, 1024 * 1024);
    } catch (error) {
      if (!file.type.startsWith("image/") || file.size > 768 * 1024) {
        throw error;
      }
      dataUrl = await blobToDataUrl(file);
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

type AndroidTab = "chat" | "image" | "gallery" | "account";

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
      id: "chat",
      label: props.text.chat.title,
      path: Path.Home,
      icon: <ChatIcon />,
    },
    {
      id: "image",
      label: props.text.image.title,
      path: Path.Sd,
      icon: <SDIcon />,
    },
    {
      id: "gallery",
      label: props.text.image.gallery,
      path: Path.Gallery,
      icon: <BotIcon />,
    },
    {
      id: "account",
      label: props.text.account.title,
      path: Path.Settings,
      icon: <SettingsIcon />,
    },
  ];

  return (
    <nav className={styles["bottom-tabs"]} aria-label="JisudengChat">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-label={`app-tab-${tab.id}`}
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const configError = backendBaseUrl ? "" : text.errors.missingBackend;
  const busy = managed.loading || localLoading;

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
      setError(err instanceof Error ? err.message : text.errors.networkFailed);
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
      setError(err instanceof Error ? err.message : text.errors.networkFailed);
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
            clientConfig?.androidVersion || clientConfig?.version || "",
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
          clientConfig?.androidVersion || clientConfig?.version || "",
          getInviteInstallationId(),
          {
            eventId: getStableInviteEventId("registered"),
            attributionToken: affiliateToken,
          },
        ).catch(() => undefined);
        if (referralAttributed) storeInviteReferral(null);
        void reportMobileAttributionEvent({
          baseUrl: backendBaseUrl,
          eventType: "register",
          appVersion: clientConfig?.androidVersion || clientConfig?.version,
          locale: text.dateLocale,
          accessToken: auth.access_token,
          userScope: auth.user?.id || "new-account",
          metadata: { surface: "android_register", event_name: "registered" },
        });
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
        err instanceof Error
          ? err.message
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
  const navigate = useNavigate();
  const workspace = managed.workspace;
  const [dashboardChatGroupId, setDashboardChatGroupId] = useState<
    number | undefined
  >(() => storedChatPreferenceGroupID() || undefined);
  const models = chatModelsForGroup(workspace, dashboardChatGroupId);
  const fallbackModel = modelValue(models[0]);
  const sessions = mobileStore.chatSessions;
  const [dashboardFilter, setDashboardFilter] = useState<
    "all" | "pinned" | "image" | "tasks"
  >("all");
  const [cloudTasks, setCloudTasks] = useState<MobileTask[]>([]);
  const [taskError, setTaskError] = useState("");
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
  const showingImages = dashboardFilter === "image";
  const showingTasks = dashboardFilter === "tasks";
  const isAdmin = isManagedAdminWorkspace(workspace);
  const [sessionActionTarget, setSessionActionTarget] =
    useState<ManagedMobileChatSession | null>(null);
  const [renameTarget, setRenameTarget] =
    useState<ManagedMobileChatSession | null>(null);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);

  useEffect(() => {
    const validGroupId = preferredChatGroupID(workspace, dashboardChatGroupId);
    if (validGroupId && validGroupId !== dashboardChatGroupId) {
      setDashboardChatGroupId(validGroupId);
      const rememberedModel = storedChatPreferenceModel();
      persistChatPreference(
        validGroupId,
        chatModelsForGroup(workspace, validGroupId).some(
          (model) => modelValue(model) === rememberedModel,
        )
          ? rememberedModel
          : modelValue(chatModelsForGroup(workspace, validGroupId)[0]),
      );
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
    if (showingTasks) void refreshCloudTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingTasks]);

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

  async function deleteDashboardImageTask(item: any) {
    if (!window.confirm(text.image.deleteTaskConfirm)) return;
    try {
      const localFileNames = imageLocalFileNames(item);
      if (localFileNames.length) {
        await deleteAppImages(localFileNames);
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

  function openChat() {
    mobileStore.setCurrentChatId("");
    navigate(Path.Chat);
  }

  function openSkillCenter() {
    mobileStore.setCurrentChatId("");
    navigate(Path.Chat, { state: { openSkillSheet: true } });
  }

  function openCollaborationChat() {
    mobileStore.setCurrentChatId("");
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
    <AndroidAppShell active="chat" text={text} documentScroll>
      <header className={styles["dashboard-header"]}>
        <div>
          <span>
            {workspace?.brand?.workspace_name || text.workspaceFallback}
          </span>
          <h1>{text.dashboard.title}</h1>
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
          <button
            aria-label="dashboard-new-chat"
            onClick={
              showingTasks
                ? refreshCloudTasks
                : showingImages
                ? () => navigate(Path.Sd)
                : openChat
            }
          >
            {showingTasks
              ? text.common.refresh
              : showingImages
              ? text.image.generate
              : text.chat.newSession}
          </button>
        </div>
        <div className={styles["conversation-list"]}>
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
                <article key={task.id} className={styles["cloud-task-item"]}>
                  <i>{task.kind === "image" ? <ImageIcon /> : <ChatIcon />}</i>
                  <span>
                    <strong>
                      {localizedMobileDisplay(task, {
                        defaultFields: ["operation"],
                        fallback: text.platform.tasks,
                      })}
                    </strong>
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
        <div className={styles["form-error"]}>{managed.lastError}</div>
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
          const nextModels = chatModelsForGroup(workspace, groupId);
          if (!Number.isFinite(groupId) || !nextModels.length) {
            setTaskError(text.errors.noModel);
            return;
          }
          const nextModel = modelValue(nextModels[0]);
          persistChatPreference(groupId, nextModel);
          setDashboardChatGroupId(groupId);
          setTaskError("");
          setGroupSheetOpen(false);
        }}
      />
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
    <div className={styles["sheet-mask"]} onClick={props.onClose}>
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
    <div className={styles["sheet-mask"]} onClick={props.onClose}>
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
    <div className={styles["sheet-mask"]} onClick={props.onClose}>
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

  useEffect(() => {
    if (!props.open) return;
    let alive = true;
    const locale = props.text.dateLocale.toLowerCase().startsWith("zh")
      ? "zh"
      : "en";
    async function loadLibrary() {
      try {
        const manifest = await fetch("/image-prompts/manifest.json").then(
          (res) => res.json(),
        );
        const categoryFile =
          manifest?.categoryFiles?.[locale] ||
          manifest?.categoryFiles?.zh ||
          "";
        const promptFiles: string[] =
          manifest?.promptFiles?.[locale] || manifest?.promptFiles?.zh || [];
        const [remoteCategories, promptParts] = await Promise.all([
          categoryFile
            ? fetch(categoryFile)
                .then((res) => res.json())
                .catch(() => [])
            : Promise.resolve([]),
          Promise.all(
            promptFiles.map((file) =>
              fetch(file)
                .then((res) => res.json())
                .catch(() => []),
            ),
          ),
        ]);
        if (!alive) return;
        const normalized = promptParts
          .flat()
          .filter((item: ImagePromptLibraryPayload) => item?.id)
          .map(normalizeImagePromptPayload);
        if (normalized.length > 0) {
          setLibraryItems(normalized);
        }
        if (Array.isArray(remoteCategories) && remoteCategories.length > 0) {
          const systemCategories = fallbackImagePromptCategories(
            props.text,
          ).filter((item) =>
            ["all", "featured", "favorites", "recent"].includes(item.id),
          );
          const remoteOnly = remoteCategories.filter(
            (item: ImagePromptCategory) =>
              item?.id &&
              !systemCategories.some((system) => system.id === item.id),
          );
          setLibraryCategories([...systemCategories, ...remoteOnly]);
        }
      } catch {
        if (alive) {
          setLibraryItems(IMAGE_PROMPT_TEMPLATES);
          setLibraryCategories(fallbackImagePromptCategories(props.text));
        }
      }
    }
    loadLibrary();
    return () => {
      alive = false;
    };
  }, [props.open, props.text]);

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
  const zhLocale = props.text.dateLocale.toLowerCase().startsWith("zh");
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
      item.prompt.cn,
      item.prompt.en,
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
            ["en", zhLocale ? "英文" : "English"],
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
  const zh = props.text.dateLocale.toLowerCase().startsWith("zh");
  const categories = [
    { id: "all", label: props.text.common.all },
    { id: "collaboration", label: zh ? "协作" : "Collab" },
    { id: "writing", label: zh ? "写作" : "Writing" },
    { id: "code", label: zh ? "代码" : "Code" },
    { id: "operation", label: zh ? "运营" : "Ops" },
    { id: "support", label: zh ? "客服" : "Support" },
    { id: "product", label: zh ? "产品" : "Product" },
    { id: "ai", label: zh ? "AI创作" : "AI" },
    { id: "analysis", label: zh ? "分析" : "Analysis" },
    { id: "business", label: zh ? "商业" : "Business" },
    { id: "translation", label: zh ? "翻译" : "Translation" },
    { id: "legal", label: zh ? "法律" : "Legal" },
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
  const zh = props.text.dateLocale.toLowerCase().startsWith("zh");
  const categories = [
    { id: "all", label: props.text.common.all },
    { id: "document", label: zh ? "文档" : "Docs" },
    { id: "image", label: zh ? "图片" : "Image" },
    { id: "business", label: zh ? "商业" : "Business" },
    { id: "marketing", label: zh ? "营销" : "Marketing" },
    { id: "code", label: zh ? "代码" : "Code" },
    { id: "support", label: zh ? "客服" : "Support" },
    { id: "legal", label: zh ? "合同" : "Legal" },
    { id: "education", label: zh ? "学习" : "Study" },
    { id: "office", label: zh ? "办公" : "Office" },
    { id: "translation", label: zh ? "翻译" : "Translation" },
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
            <em>{zh ? "普通对话" : "Normal chat"}</em>
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
                      {zh && param.label_zh ? param.label_zh : param.label}
                      {param.required ? ` · ${zh ? "必填" : "Required"}` : ""}
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
  onDelete: () => void;
}) {
  const message = props.target.message;
  const canRetry =
    message.role === "user" ||
    message.status === "error" ||
    message.status === "cancelled";
  return (
    <div className={styles["sheet-mask"]} onClick={props.onClose}>
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
    <div className={styles["sheet-mask"]} onClick={props.onClose}>
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
    <div className={styles["sheet-mask"]} onClick={props.onClose}>
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
  onDelete: () => void;
}) {
  if (!props.item) return null;
  const canRetry = !["running", "queued"].includes(String(props.item.status));
  return (
    <div className={styles["sheet-mask"]} onClick={props.onClose}>
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
  let paragraph: string[] = [];

  function flushParagraph(key: string) {
    if (!paragraph.length) return;
    nodes.push(
      <p key={key}>
        {paragraph
          .join("\n")
          .replace(/^\s{0,3}#{1,6}\s+/gm, "")
          .replace(/\*\*([^*]+)\*\*/g, "$1")}
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
  const [draftModel, setDraftModel] = useState("");
  const [draftAgentId, setDraftAgentId] = useState("");
  const [draftSkillSelection, setDraftSkillSelection] =
    useState<ServerSkillSelection | null>(null);
  const selectedModel = currentSession?.model || draftModel || fallbackModel;
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
  const platformTaskRef = useRef<MobileTask | null>(null);
  const nativeStreamCancelRef = useRef<(() => void) | null>(null);
  const voiceStartYRef = useRef(0);
  const voiceCancelledRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const autoFollowRef = useRef(true);
  const lastScrolledSessionRef = useRef("");
  const autoRetryKeyRef = useRef("");

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
              const isImage =
                file.kind === "image" || /^image\//i.test(file.mimeType || "");
              if (isImage) {
                setAttachments((items) => [...items, dataUrl].slice(0, 6));
              }
              await addMaterialDraft({
                blob: dataUrlToBlob(dataUrl),
                name: file.name || `shared-${Date.now()}`,
                kind: file.kind || (isImage ? "image" : "other"),
                previewUrl: isImage ? dataUrl : undefined,
                localOnly: isImage,
                unsupported: !isImage,
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
    if ((!dataUrl && !asset) || !currentSession?.id) return;
    if (dataUrl && (!asset || asset.kind === "image")) {
      setAttachments((items) => [...items, dataUrl].slice(0, 6));
    }
    if (asset) {
      setSharedMaterials((items) =>
        [
          ...items,
          {
            localId: clientRequestID("existing-material"),
            name: mobileAssetTitle(asset, text),
            kind: asset.kind,
            state: "ready" as const,
            previewUrl: asset.kind === "image" ? dataUrl : undefined,
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
    if (!currentSession && !draftGroupId && defaultChatGroupId) {
      setDraftGroupId(defaultChatGroupId);
    }
  }, [currentSession, defaultChatGroupId, draftGroupId]);

  useEffect(() => {
    if (!effectiveChatGroupId) return;
    persistChatPreference(effectiveChatGroupId, selectedModel || "");
  }, [effectiveChatGroupId, selectedModel]);

  useEffect(() => {
    if (
      currentSession &&
      fallbackModel &&
      !models.some((model) => modelValue(model) === currentSession.model)
    ) {
      mobileStore.updateChatSession(currentSession.id, {
        model: fallbackModel,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fallbackModel,
    currentSession?.id,
    currentSession?.groupId,
    models.length,
  ]);

  useEffect(() => {
    if (!currentSession || !effectiveChatGroupId) return;
    if (currentSession.groupId === effectiveChatGroupId) return;
    const sessionModelStillAvailable = chatModelsForGroup(
      workspace,
      effectiveChatGroupId,
    ).some((model) => modelValue(model) === currentSession.model);
    mobileStore.updateChatSession(currentSession.id, {
      groupId: effectiveChatGroupId,
      model: sessionModelStillAvailable
        ? currentSession.model
        : fallbackModel || currentSession.model,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSession?.id,
    currentSession?.groupId,
    effectiveChatGroupId,
    fallbackModel,
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
        .filter((file) => !/^image\//i.test(file.type) || ++imageCount <= 4);
      const imageFiles = selectedFiles.filter((file) =>
        /^image\//i.test(file.type),
      );
      const urls = await readImageFiles(imageFiles, 4);
      setAttachments((items) => [...items, ...urls].slice(0, 4));
      let imageIndex = 0;
      await Promise.allSettled(
        selectedFiles.map(async (file) => {
          const isImage = /^image\//i.test(file.type);
          const isPlainText =
            /^text\//i.test(file.type) ||
            /\.(txt|md|csv|json|log)$/i.test(file.name);
          const previewUrl = isImage ? urls[imageIndex++] : undefined;
          const localText = isPlainText
            ? (await blobToText(file)).slice(0, 120_000)
            : "";
          return addMaterialDraft({
            blob: file,
            name: file.name,
            kind: isImage
              ? "image"
              : /^audio\//i.test(file.type)
              ? "audio"
              : file.type === "application/pdf"
              ? "document"
              : "other",
            previewUrl,
            localText,
            localOnly: isImage || isPlainText,
            unsupported: !isImage && !isPlainText,
            source: "upload",
          });
        }),
      );
    } catch (err) {
      setChatError(err instanceof Error ? err.message : text.errors.saveFailed);
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

  async function beginVoiceHold(event: PointerEvent<HTMLButtonElement>) {
    if (listening) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    voiceStartYRef.current = event.clientY;
    voiceCancelledRef.current = false;
    setVoiceCancelling(false);
    setListening(true);
    setChatError("");
    try {
      const resultPromise = startHoldSpeechRecognition(
        text.dateLocale,
        text.chat.voicePrompt,
      );
      const result = await resultPromise;
      if (voiceCancelledRef.current || result.cancelled) return;
      const recognized = (result.text || "").trim();
      if (!recognized) {
        throw new Error(text.errors.emptySpeechResult);
      }
      await sendChat(recognized, attachments, true);
      setVoiceBarOpen(false);
    } catch (err) {
      if (!voiceCancelledRef.current) {
        setChatError(
          err instanceof Error && err.message
            ? localizeManagedMobileError({ message: err.message })
            : text.errors.permissionDenied,
        );
      }
    } finally {
      setListening(false);
      setVoiceCancelling(false);
      voiceCancelledRef.current = false;
    }
  }

  function moveVoiceHold(event: PointerEvent<HTMLButtonElement>) {
    if (!listening) return;
    const shouldCancel = voiceStartYRef.current - event.clientY > 52;
    voiceCancelledRef.current = shouldCancel;
    setVoiceCancelling(shouldCancel);
  }

  function endVoiceHold() {
    if (!listening) return;
    if (voiceCancelledRef.current) {
      cancelHoldSpeechRecognition().catch(() => {});
      return;
    }
    stopHoldSpeechRecognition().catch(() => {});
  }

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
    const model = selectedModel || fallbackModel;
    if (!model) {
      setChatError(text.errors.noModel);
      return;
    }
    const requestGroupId =
      currentSession?.groupId || draftChatGroupId || effectiveChatGroupId;
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
      const payload = JSON.stringify({
        model,
        stream: true,
        messages: makeGatewayMessages(sessionId, assistantId, skillForRequest),
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
      if (isDirectNativeStreamAvailable()) {
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
      mobileStore.updateChatMessage(sessionId, assistantId, {
        content: contentBuffer || text.chat.assistantThinking,
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
      await navigator.clipboard?.writeText(value);
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

  function changeModel(model: string) {
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
      const nextModels = chatModelsForGroup(workspace, groupID);
      const nextModel = modelValue(nextModels[0]);
      if (!nextModel) {
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
      const latestModels = chatModelsForGroup(latestWorkspace, groupID);
      const sessionModelStillAvailable = latestModels.some(
        (model) => modelValue(model) === selectedModel,
      );
      const confirmedModel =
        (sessionModelStillAvailable
          ? selectedModel
          : modelValue(latestModels[0])) || nextModel;
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
    const nextGroupId =
      preferredChatGroupId || defaultChatGroupId || chatGroup?.id;
    const nextModels = chatModelsForGroup(workspace, nextGroupId);
    const preferredModel = storedChatPreferenceModel();
    const inheritedModel =
      currentSession?.model || draftModel || selectedModel || preferredModel;
    const nextModel =
      (nextModels.some((item) => modelValue(item) === preferredModel)
        ? preferredModel
        : nextModels.some((item) => modelValue(item) === inheritedModel)
        ? inheritedModel
        : modelValue(nextModels[0])) || fallbackModel;
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
    setChatError("");
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
    navigate(Path.Home);
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
              ) : message.status === "streaming" ? (
                <p className={styles["muted"]}>{text.chat.assistantThinking}</p>
              ) : null}
              {message.error && (
                <div className={styles["inline-error"]}>{message.error}</div>
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
                  ...
                </button>
              </div>
            </article>
          ))}
        </div>

        {(chatError ||
          (currentSession?.messages.some((message) => message.role === "user")
            ? currentSession?.error
            : "")) && (
          <div className={styles["chat-error-bar"]}>
            <span>
              {chatError ||
                (currentSession?.messages.some(
                  (message) => message.role === "user",
                )
                  ? currentSession?.error
                  : "")}
            </span>
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
                  cancelHoldSpeechRecognition().catch(() => {});
                }}
              >
                {voiceCancelling
                  ? text.chat.voiceReleaseCancel
                  : listening
                  ? text.chat.voiceReleaseSend
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
            {running ? (
              <IconButton label={text.chat.stop} onClick={stopChat} danger>
                <CloseIcon />
              </IconButton>
            ) : (
              <IconButton
                label="chat-send"
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
            <IconButton
              label={text.chat.moreTools}
              onClick={() => setMoreToolsOpen((value) => !value)}
              active={moreToolsOpen}
            >
              <AddIcon />
            </IconButton>
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
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [presetId, setPresetId] = useState("ecommerce");
  const [customShots, setCustomShots] = useState<ContentKitShotPlan[]>(() => [
    {
      id: "main",
      kind: "main",
      label: text.platform.contentKit.main,
      size: "1024x1024",
      count: 2,
    },
    {
      id: "lifestyle",
      kind: "lifestyle",
      label: text.platform.contentKit.lifestyle,
      size: "1024x1536",
      count: 2,
    },
    {
      id: "vertical",
      kind: "vertical",
      label: text.platform.contentKit.vertical,
      size: "1024x1536",
      count: 2,
    },
  ]);
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

  const presetOptions = [
    {
      id: "custom",
      title: text.platform.contentKit.presetCustom,
      hint: text.platform.contentKit.presetCustomHint,
      shots: [] as const,
    },
    {
      id: "quick",
      title: text.platform.contentKit.presetQuick,
      hint: text.platform.contentKit.presetQuickHint,
      shots: [
        ["main", text.platform.contentKit.main, "1024x1024", 2],
        ["vertical", text.platform.contentKit.vertical, "1024x1536", 2],
        ["banner", text.platform.contentKit.banner, "1536x1024", 2],
      ],
    },
    {
      id: "ecommerce",
      title: text.platform.contentKit.presetEcommerce,
      hint: text.platform.contentKit.presetEcommerceHint,
      shots: [
        ["main", text.platform.contentKit.main, "1024x1024", 3],
        ["detail", text.platform.contentKit.detail, "1024x1024", 4],
        ["lifestyle", text.platform.contentKit.lifestyle, "1024x1536", 4],
        ["vertical", text.platform.contentKit.vertical, "1024x1536", 3],
        ["banner", text.platform.contentKit.banner, "1536x1024", 2],
      ],
    },
    {
      id: "campaign",
      title: text.platform.contentKit.presetCampaign,
      hint: text.platform.contentKit.presetCampaignHint,
      shots: [
        ["main", text.platform.contentKit.main, "1024x1024", 4],
        ["lifestyle", text.platform.contentKit.lifestyle, "1024x1536", 6],
        ["poster", text.platform.contentKit.poster, "1024x1536", 6],
        ["vertical", text.platform.contentKit.vertical, "1024x1536", 4],
        ["banner", text.platform.contentKit.banner, "1536x1024", 4],
      ],
    },
  ] as const;
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

  const selectedPlanShots: ContentKitShotPlan[] =
    presetId === "custom"
      ? customShots
      : selectedPreset.shots.map(([kind, label, size, count]) => ({
          id: kind,
          kind,
          label,
          size,
          count,
        }));
  const selectedPlanCount = selectedPlanShots.reduce(
    (total, shot) => total + shot.count,
    0,
  );
  const planSignature = selectedPlanShots
    .map((shot) => `${shot.id}:${shot.size}:${shot.count}`)
    .join("|");
  const customShotOptions: ContentKitShotPlan[] = [
    {
      id: "main",
      kind: "main",
      label: text.platform.contentKit.main,
      size: "1024x1024",
      count: 1,
    },
    {
      id: "detail",
      kind: "detail",
      label: text.platform.contentKit.detail,
      size: "1024x1024",
      count: 1,
    },
    {
      id: "lifestyle",
      kind: "lifestyle",
      label: text.platform.contentKit.lifestyle,
      size: "1024x1536",
      count: 1,
    },
    {
      id: "poster",
      kind: "poster",
      label: text.platform.contentKit.poster,
      size: "1024x1536",
      count: 1,
    },
    {
      id: "vertical",
      kind: "vertical",
      label: text.platform.contentKit.vertical,
      size: "1024x1536",
      count: 1,
    },
    {
      id: "banner",
      kind: "banner",
      label: text.platform.contentKit.banner,
      size: "1536x1024",
      count: 1,
    },
  ];

  function assetSpecs(
    runId: string,
    plan = selectedPlanShots,
  ): Omit<ManagedMobileContentKitAsset, "status" | "updatedAt">[] {
    const product = productName.trim();
    const details = [
      sellingPoints.trim(),
      audience.trim(),
      platform.trim(),
      tone.trim(),
    ]
      .filter(Boolean)
      .join("; ");
    const controls = [
      lockProduct && "keep the product shape and packaging consistent",
      lockColor && "keep the product colors consistent",
      lockLogo && "preserve visible product branding without invented text",
      `composition: ${composition}`,
      safeArea !== "none" &&
        `leave clean headline safe area on the ${safeArea}`,
      videoIntent &&
        "compose this as a clean source visual suitable for video motion editing",
    ]
      .filter(Boolean)
      .join("; ");
    const prompts: Record<string, string> = {
      main: `${product} product hero image, premium commercial product photography, centered composition, clean background`,
      detail: `${product} material and selling-point close-up, sharp product detail, clean e-commerce layout`,
      lifestyle: `${product} lifestyle scene for social media, product clearly visible, authentic commercial photography`,
      poster: `${product} promotional poster visual, clear product, leave clean space for later headline overlay`,
      vertical: `${product} vertical promotional visual for mobile social media, product clearly visible, room for headline`,
      banner: `${product} horizontal marketing banner, product and selling-point composition, clean commercial layout`,
    };
    return plan.flatMap((shot) =>
      Array.from({ length: shot.count }, (_, index) => ({
        id: `${runId}-${shot.id}-${index + 1}`,
        runId,
        shotId: shot.id,
        kind: shot.kind,
        label: shot.label,
        size: shot.size,
        variant: index + 1,
        requestId: clientRequestID("content-kit-output"),
        tags: [],
        prompt: `${
          prompts[shot.kind] || prompts.main
        }. ${details}. ${controls}`,
      })),
    );
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
      setError(err instanceof Error ? err.message : text.errors.saveFailed);
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
          asset: asset.shotId,
          output_id: asset.id,
          variant: asset.variant,
        },
        locale: text.dateLocale,
      });
      patchAsset(project.id, asset.id, { taskId: platformTask.id });
      await client.tasks.status(platformTask.id, { status: "running" });
    } catch {
      // The local project remains usable when optional task history is unavailable.
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
      const saved = await persistContentKitImageResult(image, {
        taskId: localTaskId,
        prompt: asset.prompt,
        model: project.model,
        ownerUserId: String(managed.user?.id || managed.session?.user_id || ""),
      });
      patchAsset(project.id, asset.id, {
        status: "completed",
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
      const message =
        err instanceof Error ? err.message : text.platform.contentKit.failed;
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
            content: `Create product promotion copy for ${
              project.productName
            }. Selling points: ${project.sellingPoints}. Audience: ${
              project.audience || "general"
            }. Platform: ${project.platform || "general"}. Tone: ${
              project.tone || "clear"
            }. Return a product title, 3-5 selling points, and one ready-to-publish post. Use the user's language.`,
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
        copyError:
          err instanceof Error ? err.message : text.platform.contentKit.failed,
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

  function retryFailedAssets(project: ManagedMobileContentKit) {
    const runId = project.activeRunId;
    if (!runId) return;
    mobileStore.updateContentKit(project.id, {
      assets: project.assets.map((asset) =>
        asset.runId === runId && asset.status === "failed"
          ? { ...asset, status: "queued", error: "", updatedAt: Date.now() }
          : asset,
      ),
    });
    updateRun(project.id, runId, "queued");
    void runProjectQueue(project.id);
  }

  function createNextRun(project: ManagedMobileContentKit) {
    const plan = project.shotPlan?.filter((shot) => shot.count > 0) || [];
    const outputCount = plan.reduce((total, shot) => total + shot.count, 0);
    if (
      !outputCount ||
      project.assets.length + outputCount > CONTENT_KIT_MAX_OUTPUTS_PER_PROJECT
    ) {
      setError(text.platform.contentKit.projectLimit);
      return;
    }
    const runId = clientRequestID("content-kit-run");
    const sourceByShot = new Map<string, ManagedMobileContentKitAsset>();
    project.assets.forEach((asset) => {
      if (!sourceByShot.has(asset.shotId))
        sourceByShot.set(asset.shotId, asset);
    });
    const assets = plan.flatMap((shot) =>
      Array.from({ length: shot.count }, (_, index) => {
        const source = sourceByShot.get(shot.id);
        return {
          id: `${runId}-${shot.id}-${index + 1}`,
          runId,
          shotId: shot.id,
          kind: shot.kind,
          label: shot.label,
          prompt:
            source?.prompt ||
            `${project.productName}. ${project.sellingPoints}`,
          size: shot.size,
          variant: index + 1,
          requestId: clientRequestID("content-kit-output"),
          tags: [],
          status: "queued" as const,
          updatedAt: Date.now(),
        };
      }),
    );
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
      productName: productName.trim(),
      sellingPoints: sellingPoints.trim(),
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
      shotPlan: selectedPlanShots,
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
      await deleteAppImages(localFileNames);
    } catch {
      setError(text.platform.contentKit.removeLocalFailed);
    }
    mobileStore.removeContentKit(project.id);
    setSelectedProjectId("");
  }

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
      <AndroidAppShell active="image" text={text}>
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
              onClick={() => retryFailedAssets(selectedProject)}
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
            {groupedAssets.map(([shotId, assets], groupIndex) => (
              <details
                key={shotId}
                open={groupIndex === 0}
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
                          onClick={() => {
                            patchAsset(selectedProject.id, asset.id, {
                              status: "queued",
                              error: "",
                            });
                            void runProjectQueue(selectedProject.id);
                          }}
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
            <span>{text.platform.contentKit.sellingPoints}</span>
            <p>{selectedProject.sellingPoints}</p>
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
    <AndroidAppShell active="image" text={text}>
      <header className={styles["detail-header"]}>
        <IconButton
          label={text.common.back}
          onClick={() => navigate(Path.Home)}
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
                const count = preset.shots.reduce(
                  (total, shot) => total + shot[3],
                  0,
                );
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-label={`content-kit-preset-${preset.id}`}
                    className={clsx({
                      [styles["active"]]: preset.id === selectedPreset.id,
                    })}
                    onClick={() => setPresetId(preset.id)}
                  >
                    <strong>{preset.title}</strong>
                    <small>{preset.hint}</small>
                    <em>{text.platform.contentKit.plannedImages(count)}</em>
                  </button>
                );
              })}
            </div>
          </div>
          {presetId === "custom" && (
            <div className={styles["content-kit-custom-plan"]}>
              {customShots.map((shot) => (
                <div key={shot.id}>
                  <span>
                    <strong>{shot.label}</strong>
                    <small>{shot.size}</small>
                  </span>
                  <div>
                    <button
                      type="button"
                      aria-label={`${shot.label} -`}
                      disabled={shot.count <= 1}
                      onClick={() =>
                        setCustomShots((items) =>
                          items.map((item) =>
                            item.id === shot.id
                              ? { ...item, count: Math.max(1, item.count - 1) }
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
                      disabled={shot.count >= 6 || selectedPlanCount >= 48}
                      onClick={() =>
                        setCustomShots((items) =>
                          items.map((item) =>
                            item.id === shot.id
                              ? { ...item, count: Math.min(6, item.count + 1) }
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
                      setCustomShots((items) =>
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
                      setCustomShots((items) =>
                        items.filter((item) => item.id !== shot.id),
                      )
                    }
                  >
                    <DeleteIcon />
                  </button>
                </div>
              ))}
              <div className={styles["content-kit-add-shots"]}>
                {customShotOptions
                  .filter(
                    (option) =>
                      !customShots.some((shot) => shot.id === option.id),
                  )
                  .map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setCustomShots((items) => [...items, option])
                      }
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

function AndroidImageStudio() {
  const managed = useManagedNextChatStore();
  const text = useMobileText();
  const sdStore = useSdStore();
  const navigate = useNavigate();
  const location = useLocation();
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
  const allowLegacyImageCapabilityFallback =
    !workspace?.models?.image_capabilities_version;
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
      setError(err instanceof Error ? err.message : text.errors.saveFailed);
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
          err instanceof Error && err.message
            ? err.message
            : text.errors.switchGroupFailed,
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
    const taskReferences = Array.isArray(overrides?.referenceImages || references)
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

    let projectedTask: MobileTask | null = null;
    if (!useLocalImageFixture) {
      try {
        const client = await mobilePlatformClient();
        projectedTask = await client.tasks.create({
          kind: "image",
          operation: imageOperation,
          client_request_id: clientRequestID("image"),
          title_zh: promptText.slice(0, 80),
          model,
          group_id: taskGroupId,
          parameters: {
            size: taskSize,
            quality: taskQuality,
            style: taskStyle,
            count: taskCount,
          },
          locale: text.dateLocale,
        });
        platformTaskRef.current = projectedTask;
        await client.tasks.status(projectedTask.id, { status: "running" });
      } catch {
        projectedTask = null;
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const cancellationTimer = projectedTask
      ? window.setInterval(() => {
          void mobilePlatformClient()
            .then((client) => client.tasks.detail(projectedTask!.id))
            .then((task) => {
              if (task.status === "cancelled") controller.abort();
            })
            .catch(() => undefined);
        }, 2500)
      : undefined;
    updateTask(id, { status: "running", progress: 12 });
    startProgress(id);

    const endpoint = imageOperation === "images.edits"
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
      if (projectedTask) {
        const client = await mobilePlatformClient().catch(() => null);
        await client?.tasks
          .status(projectedTask.id, {
            status: partialMessage ? "partial" : "completed",
            progress: 100,
          })
          .catch(() => {});
      }
      if (partialMessage) setError(partialMessage);
      setReferences([]);
      await showNativeNotification(text.image.title, text.image.savedToDevice);
      await managed.bootstrap({ silent: true }).catch(() => {});
    } catch (err) {
      const aborted = controller.signal.aborted;
      const message = aborted
        ? text.errors.requestCancelled
        : err instanceof ManagedTransportError
        ? err.message
        : err instanceof Error
        ? describeImageError(err.message, {
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
      if (abortRef.current === controller) setError(message);
      if (projectedTask) {
        const client = await mobilePlatformClient().catch(() => null);
        await client?.tasks
          .status(projectedTask.id, {
            status: aborted ? "cancelled" : "failed",
            error: aborted
              ? undefined
              : { code: "image_failed", message, retryable: true },
          })
          .catch(() => {});
      }
    } finally {
      if (cancellationTimer) window.clearInterval(cancellationTimer);
      if (abortRef.current === controller) {
        stopProgress();
        abortRef.current = null;
      }
      if (platformTaskRef.current?.id === projectedTask?.id) {
        platformTaskRef.current = null;
      }
    }
  }

  function cancelTask() {
    abortRef.current?.abort();
    const projectedTask = platformTaskRef.current;
    if (projectedTask) {
      void mobilePlatformClient()
        .then((client) =>
          client.tasks.cancel(projectedTask.id, { reason: "user_cancelled" }),
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
        await deleteAppImages(localFileNames);
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
      setError(err instanceof Error ? err.message : text.errors.saveFailed);
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
    const first = gallery.find((item: any) => ids.includes(item.id));
    const firstUrl = imageResults(first)[0];
    if (!first || !firstUrl) return;
    await shareImage(
      firstUrl,
      makeImageFileName(text.image.filePrefix, first.id, 0),
      first?.params?.prompt,
    );
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
    <AndroidAppShell active="image" text={text}>
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
  const [cloudAssets, setCloudAssets] = useState<MobileAsset[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const cloudFileRef = useRef<HTMLInputElement | null>(null);
  const [preferences, setPreferences] = useState<GalleryPreferences>(() =>
    readGalleryPreferences(),
  );
  const noticeTimerRef = useRef<number | null>(null);
  const drawGallery = sdStore.draw.filter(
    (item: any) => item.status === "success" && imageResults(item).length > 0,
  );
  const gallery = useMemo(
    () => mergeGalleryItems(drawGallery, nativeImages),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sdStore.currentId, sdStore.draw.length, nativeImages],
  );
  const filteredGallery = useMemo(
    () =>
      gallery.filter((item: any) =>
        galleryItemMatchesFilter(item, filter, preferences),
      ),
    [gallery, filter, preferences],
  );

  function showNotice(message: string) {
    setNotice(message);
    setError("");
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 2400);
  }

  async function refreshNativeImages() {
    try {
      setNativeImages(
        await listAppImages(
          String(managed.user?.id || managed.session?.user_id || ""),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : text.errors.syncFailed);
    }
  }

  async function refreshCloudAssets() {
    if (!managed.accessToken) return;
    setCloudLoading(true);
    try {
      const client = await mobilePlatformClient();
      const page = await client.assets.list({ limit: 60, order: "desc" });
      setCloudAssets(page.items || []);
      setError("");
    } catch {
      setError(text.platform.materialRefreshFailed);
    } finally {
      setCloudLoading(false);
    }
  }

  async function uploadCloudAssets(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []).slice(0, 8);
    if (!files.length) return;
    setCloudLoading(true);
    try {
      await Promise.all(
        files.map((file) => uploadMaterial(file, file.name, "upload")),
      );
      await refreshCloudAssets();
      showNotice(text.platform.uploadReady);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? localizeManagedMobileError({ message: uploadError.message })
          : text.platform.uploadFailedHint,
      );
    } finally {
      input.value = "";
      setCloudLoading(false);
    }
  }

  async function deleteCloudAsset(asset: MobileAsset) {
    if (!window.confirm(text.platform.deleteAssetConfirm)) return;
    try {
      const client = await mobilePlatformClient();
      await client.assets.delete(asset.id);
      setCloudAssets((items) => items.filter((item) => item.id !== asset.id));
      showNotice(text.platform.assetDeleted);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? localizeManagedMobileError({ message: deleteError.message })
          : text.platform.materialRefreshFailed,
      );
    }
  }

  async function cloudAssetDataUrl(asset: MobileAsset) {
    const path =
      asset.content_url ||
      `/api/v1/mobile/assets/${encodeURIComponent(asset.id)}/content`;
    const response = await requestWithManagedAuth(
      async ({ baseUrl, accessToken }) => {
        const res = await fetch(managedApiUrl(baseUrl, path), {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        if (!res.ok) {
          throw new ManagedApiError(
            text.platform.materialRefreshFailed,
            res.status,
            path,
          );
        }
        return res;
      },
    );
    const blob = await response.blob();
    return asset.kind === "image"
      ? compressImage(blob, 2 * 1024 * 1024)
      : blobToDataUrl(blob);
  }

  async function reuseCloudAsset(asset: MobileAsset, target: "chat" | "image") {
    try {
      if (asset.kind !== "image" && target === "image") {
        throw new Error(text.platform.materialRefreshFailed);
      }
      const materialDataUrl = await cloudAssetDataUrl(asset);
      navigate(target === "chat" ? Path.Chat : Path.Sd, {
        state: {
          materialDataUrl,
          materialName: mobileAssetTitle(asset, text),
          materialAsset: asset,
        },
      });
    } catch (reuseError) {
      setError(
        reuseError instanceof Error
          ? reuseError.message
          : text.platform.materialRefreshFailed,
      );
    }
  }

  useEffect(() => {
    refreshNativeImages().catch(() => {});
    refreshCloudAssets().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdStore.currentId]);

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

  async function deleteItems(ids: string[]) {
    if (!ids.length) return;
    if (!window.confirm(text.image.deleteConfirm)) return;
    setError("");
    try {
      const items = gallery.filter((item: any) => ids.includes(item.id));
      const removedUrls = items.flatMap(imageResults);
      const localFileNames = items.flatMap(imageLocalFileNames);
      if (localFileNames.length) {
        await deleteAppImages(localFileNames);
      }
      await Promise.allSettled(
        removedUrls
          .filter((url: string) => url.startsWith("/api/cache"))
          .map((url: string) => removeImage(url)),
      );
      sdStore.update((state) => {
        state.draw = state.draw.filter((item: any) => !ids.includes(item.id));
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
      setError(err instanceof Error ? err.message : text.errors.saveFailed);
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
    const first = gallery.find((item: any) => ids.includes(item.id));
    const firstUrl = imageResults(first)[0];
    if (!first || !firstUrl) return;
    await shareImage(
      firstUrl,
      makeImageFileName(text.image.filePrefix, first.id, 0),
      first?.params?.prompt,
    );
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
          const key = galleryItemPreferenceKey(item);
          if (!key) return;
          const updated = updater(next[key] || {});
          next[key] = { ...updated, updatedAt: Date.now() };
          if (!next[key].favorite && !next[key].category) {
            delete next[key];
          }
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
    <AndroidAppShell active="gallery" text={text}>
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
        <em>{text.shortCount(gallery.length + cloudAssets.length)}</em>
      </section>

      <section className={styles["section"]}>
        <div className={styles["section-head"]}>
          <div>
            <h2>{text.platform.materials}</h2>
            <span>{text.platform.materialHint}</span>
          </div>
          <button
            onClick={() => cloudFileRef.current?.click()}
            disabled={cloudLoading}
          >
            {text.platform.uploadMaterial}
          </button>
          <input
            ref={cloudFileRef}
            hidden
            multiple
            type="file"
            accept="image/*,audio/*,video/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={uploadCloudAssets}
          />
        </div>
        {!cloudLoading && cloudAssets.length === 0 && (
          <p className={styles["empty-copy"]}>{text.platform.materialEmpty}</p>
        )}
        <div className={styles["cloud-asset-list"]}>
          {cloudAssets.map((asset) => {
            const previewUrl =
              asset.thumbnail_url || asset.preview_url || asset.content_url;
            return (
              <article key={asset.id}>
                <i>
                  {asset.kind === "image" && previewUrl ? (
                    <img
                      src={managedApiUrl(managed.backendBaseUrl, previewUrl)}
                      alt={mobileAssetTitle(asset, text)}
                    />
                  ) : (
                    <UploadIcon />
                  )}
                </i>
                <span>
                  <strong>{mobileAssetTitle(asset, text)}</strong>
                  <small>{formatDateTime(asset.created_at, text)}</small>
                </span>
                <div>
                  <button onClick={() => reuseCloudAsset(asset, "chat")}>
                    {text.platform.addToChat}
                  </button>
                  {asset.kind === "image" && (
                    <button onClick={() => reuseCloudAsset(asset, "image")}>
                      {text.platform.addToImage}
                    </button>
                  )}
                  <button
                    className={styles["danger-inline"]}
                    onClick={() => deleteCloudAsset(asset)}
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
  const zh = text.dateLocale.toLowerCase().startsWith("zh");
  const labels: Record<string, string> = zh
    ? {
        active: "生效中",
        pending: "待生效",
        queued: "待生效",
        exhausted: "额度已用完",
        expired: "已过期",
        suspended: "已暂停",
        revoked: "已撤销",
        cancelled: "已取消",
        canceled: "已取消",
      }
    : {
        active: "Active",
        pending: "Pending activation",
        queued: "Queued",
        exhausted: "Quota exhausted",
        expired: "Expired",
        suspended: "Suspended",
        revoked: "Revoked",
        cancelled: "Cancelled",
        canceled: "Cancelled",
      };
  return labels[key] || (zh ? "状态未知" : "Status unavailable");
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

function paymentMethodLabel(method: CheckoutMethod, text: ManagedMobileText) {
  if (method.display_name) return method.display_name;
  const key = (method.payment_type || "").toLowerCase();
  const zh = text.dateLocale.toLowerCase().startsWith("zh");
  const labels: Record<string, string> = zh
    ? {
        alipay: "支付宝",
        wxpay: "微信支付",
        stripe: "银行卡",
        airwallex: "国际支付",
        easypay: "快捷支付",
      }
    : {
        alipay: "Alipay",
        wxpay: "WeChat Pay",
        stripe: "Card",
        airwallex: "Airwallex",
        easypay: "EasyPay",
      };
  return labels[key] || method.payment_type || text.account.paymentMethod;
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
          <header className={styles["app-header"]}>
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
              <span className={styles["header-spacer"]} />
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

function AndroidAccountSettings() {
  const managed = useManagedNextChatStore();
  const mobileStore = useManagedMobileAppStore();
  const sdStore = useSdStore();
  const text = useMobileText();
  const workspace = managed.workspace;
  const location = useLocation();
  const navigate = useNavigate();
  const clientConfig = useMemo(() => getClientConfig(), []);
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackCategory, setFeedbackCategory] =
    useState<MobileFeedbackCategory>("bug");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackScreenshots, setFeedbackScreenshots] = useState<
    MobileFeedbackScreenshotDraft[]
  >([]);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
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
      const localImages = await listAppImages().catch(() => []);
      const fileNames = localImages
        .map((item) => item.fileName || "")
        .filter(Boolean);
      if (fileNames.length) {
        await deleteAppImages(fileNames).catch(() => undefined);
      }
      localStorage.clear();
      await indexedDBStorage.clear().catch(() => undefined);
      mobileStore.clearAllAccounts();
      sdStore.clearAllAccounts();
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

  const currentVersion =
    clientConfig?.androidVersion ||
    clientConfig?.version ||
    text.account.unknownVersion;
  const latestVersion =
    updateState.manifest?.version ||
    updateState.manifest?.androidVersion ||
    updateState.manifest?.latestVersion ||
    "";
  const apkUrl = resolveAndroidUrl(
    updateState.manifest?.apkUrl ||
      updateState.manifest?.androidApkUrl ||
      updateState.manifest?.url ||
      clientConfig?.androidApkUrl ||
      "",
    clientConfig,
  );
  const hasUpdate =
    !!latestVersion && compareVersions(latestVersion, currentVersion) > 0;
  const notes = manifestNotes(updateState.manifest);
  const supportLines = extractSupportLines(workspace?.support_contact);
  const paymentMethods = paymentMethodsFromCheckout(checkoutInfo);
  const accountGroupID = storedChatGroupID(workspace);
  const accountGroupName = stableChatGroupName(workspace, text);
  const route = location.pathname;
  const isAdmin = isManagedAdminWorkspace(workspace);
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
          { method: "POST" },
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
        { method: "POST" },
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
            surface: "account_invite",
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
            surface: "account_invite",
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
            metadata: { surface: "account_invite_text_fallback" },
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
              surface: "account_invite_text_fallback",
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
      if (supportTicket) {
        setSupportTicket(await client.support.tickets.detail(supportTicket.id));
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
    setSupportBusy(true);
    try {
      const client = await mobilePlatformClient();
      setSupportTicket(await client.support.tickets.detail(ticket.id));
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
    const methods = paymentMethodsFromCheckout(info);
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
        error instanceof Error ? error.message : text.errors.syncFailed,
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
        error instanceof Error ? error.message : text.errors.syncFailed,
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
        error instanceof Error ? error.message : text.errors.syncFailed,
      );
    }
  }

  async function ensurePaymentMethod() {
    let methods = paymentMethods;
    if (!methods.length) {
      setCheckoutLoading(true);
      try {
        const info = await loadCheckoutInfo();
        applyCheckoutInfo(info);
        methods = paymentMethodsFromCheckout(info);
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
        error instanceof Error ? error.message : text.errors.permissionDenied,
      );
    }
  }

  function removeFeedbackScreenshot(id: string) {
    setFeedbackScreenshots((items) => items.filter((item) => item.id !== id));
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
      form.append("app_version", currentVersion);
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
      let result: any;
      try {
        result = await managedFormDataRequest<any>(
          "/api/v1/mobile/support/tickets",
          form,
          text,
        );
      } catch (error) {
        if (
          error instanceof ManagedApiError &&
          [404, 405, 501].includes(error.status || 0)
        ) {
          result = await managedFormDataRequest<any>(
            "/api/v1/play/mobile-feedback",
            form,
            text,
          );
        } else {
          throw error;
        }
      }
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
    } catch (error) {
      setFeedbackError(
        error instanceof Error ? error.message : text.errors.saveFailed,
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
          const message =
            error instanceof Error ? error.message : text.account.redeemFailed;
          firstError ||= message;
          if (!/404|not found|不存在|未找到|no route|路由/i.test(message)) {
            break;
          }
        }
      }
      throw new Error(firstError || text.account.redeemUnavailable);
    } catch (error) {
      setRedeemError(
        error instanceof Error && error.message
          ? error.message
          : text.account.redeemFailed,
      );
    } finally {
      setRedeemBusy(false);
    }
  }

  async function createPaymentOrder(
    orderType: "balance" | "subscription",
    plan?: any,
  ) {
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
            error instanceof Error && error.message
              ? localizeManagedMobileError({ message: error.message })
              : text.errors.paymentFailed,
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
        error instanceof Error ? error.message : text.errors.paymentFailed,
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
            error instanceof Error
              ? error.message
              : text.errors.orderVerifyFailed,
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
          error instanceof Error
            ? error.message
            : text.errors.orderVerifyFailed,
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
          error instanceof Error
            ? error.message
            : text.errors.orderVerifyFailed,
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
        error instanceof Error ? error.message : text.errors.orderVerifyFailed,
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
        error instanceof Error ? error.message : text.errors.requestCancelled,
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
          error instanceof Error ? error.message : text.errors.syncFailed,
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
          legacyError instanceof Error
            ? legacyError.message
            : text.errors.syncFailed,
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
        error instanceof Error && error.message
          ? localizeManagedMobileError({ message: error.message })
          : text.errors.paymentFailed,
      );
    }
  }

  useEffect(() => {
    refreshAccountData().catch((error) => {
      setAccountData({
        loading: false,
        error: error instanceof Error ? error.message : text.errors.syncFailed,
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
      !updateState.checked &&
      !updateState.loading
    ) {
      checkUpdate().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, updateState.checked, updateState.loading]);

  useEffect(() => {
    if (route === Path.AccountOrders && selectedOrderID) {
      fetchOrderDetail(selectedOrderID).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, selectedOrderID]);

  useEffect(() => {
    if (route === Path.AccountSupport) void refreshSupportTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

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
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.adminOverview}</h2>
            <span>
              {isAdmin ? text.account.synced : text.account.waitingSync}
            </span>
          </div>
          <div className={styles["meta-list"]}>
            <div className={styles["meta-row"]}>
              <span>{text.account.adminIdentity}</span>
              <strong>
                {workspace?.user?.username || workspace?.user?.email || "-"}
              </strong>
            </div>
            <div className={styles["meta-row"]}>
              <span>{text.account.currentGroup}</span>
              <strong>{accountGroupName}</strong>
            </div>
            <div className={styles["meta-row"]}>
              <span>{text.account.balance}</span>
              <strong>{formatMoney(workspace?.user?.balance)}</strong>
            </div>
          </div>
        </section>
        <section className={styles["account-menu-group"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.adminAvailable}</h2>
            <span>{text.account.adminReadonly}</span>
          </div>
          <div className={styles["account-menu-list"]}>
            <AccountMenuItem
              icon={<HistoryIcon />}
              title={text.account.orders}
              detail={text.account.adminCurrentAccountOnly}
              onClick={() => navigate(Path.AccountOrders)}
            />
            <AccountMenuItem
              icon={<ShareIcon />}
              title={text.account.support}
              detail={text.account.adminCurrentAccountOnly}
              onClick={() => navigate(Path.AccountSupport)}
            />
            <AccountMenuItem
              icon={<CopyIcon />}
              title={text.account.balanceDetails}
              detail={text.account.adminCurrentAccountOnly}
              onClick={() => navigate(Path.AccountWallet)}
            />
          </div>
        </section>
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.adminNeedsBackend}</h2>
          </div>
          <p className={styles["empty-copy"]}>
            {text.account.adminBackendHint}
          </p>
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
              <span>{coupon.template_name || `#${coupon.id}`}</span>
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
                  <strong>{coupon.template_name || `#${coupon.id}`}</strong>
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
                : text.shortCount(paymentMethods.length)}
            </span>
          </div>
          <div className={styles["payment-method-list"]}>
            {!checkoutLoading && !paymentMethods.length && (
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
            disabled={paymentBusy}
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
          title={
            selectedPlan.product_name ||
            selectedPlan.name ||
            text.account.planDetail
          }
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
              <strong>
                {selectedPlan.group_name ||
                  selectedPlan.target_group_name ||
                  selectedPlan.description ||
                  "-"}
              </strong>
            </div>
            <div>
              <span>{text.account.planValidity}</span>
              <strong>
                {selectedPlan.validity_days
                  ? text.account.validityDays(selectedPlan.validity_days)
                  : selectedPlan.duration || "-"}
              </strong>
            </div>
            {selectedPlan.description && <p>{selectedPlan.description}</p>}
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
                  {selectedPlan.features.map((feature: string) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              )}
          </section>
          <section className={styles["section"]}>
            <div className={styles["section-head"]}>
              <h2>{text.account.paymentMethod}</h2>
              <span>{text.shortCount(paymentMethods.length)}</span>
            </div>
            <div className={styles["payment-method-list"]}>
              {!checkoutLoading && !paymentMethods.length && (
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
                    <strong>{coupon.template_name || `#${coupon.id}`}</strong>
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
              disabled={paymentBusy}
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
            <span>{text.shortCount(paymentMethods.length)}</span>
          </div>
          <div className={styles["payment-method-list"]}>
            {!checkoutLoading && !paymentMethods.length && (
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
                  <span>{plan.product_name || plan.name}</span>
                  <strong>{formatMoney(plan.price)}</strong>
                  <small>
                    {plan.group_name || plan.description || plan.validity_days}
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
                    <em>{plan.features.slice(0, 3).join(" · ")}</em>
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
              <span>
                {order.product_name || order.order_type || order.payment_type}
              </span>
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

  if (route === Path.AccountPermissions) {
    return (
      <AndroidDetailShell title={text.account.permissions} text={text}>
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
    return (
      <AndroidDetailShell
        title={text.account.version}
        subtitle={
          hasUpdate ? text.account.updateFound : text.account.currentVersion
        }
        text={text}
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

  if (route === Path.AccountFeedback) {
    return (
      <AndroidDetailShell title={text.account.feedback} text={text}>
        <section className={styles["section"]}>
          <div className={styles["section-head"]}>
            <h2>{text.account.feedback}</h2>
            <span>{currentVersion}</span>
          </div>
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
    const inviteQualified = inviteCampaign?.qualified_count || 0;
    const inviteRank = inviteCampaign?.ranking?.rank;

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
                  <div className={styles["invite-growth-block-head"]}>
                    <h3>{text.account.inviteGrowthShare}</h3>
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
                        inviteShareBusy || !inviteSummary?.attribution_token
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
                      disabled={!inviteSummary?.attribution_token}
                    >
                      <CopyIcon />
                      <span>{text.account.inviteGrowthCopy}</span>
                    </button>
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

      <section className={styles["section"]}>
        <div className={styles["section-head"]}>
          <h2>{text.account.appearance}</h2>
          <span>{text.account.appearanceModes}</span>
        </div>
        <ThemeSwitch text={text} />
      </section>

      <section className={styles["account-quick-actions"]}>
        <button onClick={() => navigate(Path.AccountRecharge)}>
          <DownloadIcon />
          <strong>{text.account.recharge}</strong>
          <span>{text.account.appInternalPayment}</span>
        </button>
        <button onClick={() => navigate(Path.AccountPlans)}>
          <BotIcon />
          <strong>{text.account.packages}</strong>
          <span>
            {text.shortCount(
              (checkoutInfo?.plans || accountData.plans || []).length,
            )}
          </span>
        </button>
        <button onClick={() => navigate(Path.AccountRedeem)}>
          <FavoriteIcon />
          <strong>{text.account.redeemCenter}</strong>
          <span>{text.account.redeemShortHint}</span>
        </button>
      </section>

      <section className={styles["account-menu-group"]}>
        <div className={styles["section-head"]}>
          <h2>{text.account.assetsAndRecords}</h2>
          <span>{text.account.actualUsageHint}</span>
        </div>
        <div className={styles["account-menu-list"]}>
          <AccountMenuItem
            icon={<ShareIcon />}
            title={text.account.inviteGrowth}
            detail={text.account.inviteGrowthHint}
            onClick={() => navigate(Path.AccountInvite)}
          />
          <AccountMenuItem
            icon={<FavoriteIcon />}
            title={text.account.welfare}
            detail={text.account.welfareHint}
            onClick={() => navigate(Path.AccountWelfare)}
          />
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

      <section className={styles["account-menu-group"]}>
        <div className={styles["section-head"]}>
          <h2>{text.account.moreServices}</h2>
          <span>{text.account.platformConnection}</span>
        </div>
        <div className={styles["account-menu-list"]}>
          <AccountMenuItem
            icon={<UploadIcon />}
            title={text.account.permissions}
            detail={text.account.permissionDetail}
            onClick={() => navigate(Path.AccountPermissions)}
          />
          <AccountMenuItem
            icon={<ReloadIcon />}
            title={text.account.version}
            detail={`${text.account.currentVersion} ${currentVersion}`}
            onClick={() => navigate(Path.AccountUpdate)}
          />
          <AccountMenuItem
            icon={<CopyIcon />}
            title={text.account.feedback}
            detail={text.account.feedback}
            onClick={() => navigate(Path.AccountFeedback)}
          />
          <AccountMenuItem
            icon={<ShareIcon />}
            title={text.account.support}
            detail={
              supportLines.length
                ? text.account.synced
                : text.account.waitingSync
            }
            onClick={() => navigate(Path.AccountSupport)}
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
        <div className={styles["sheet-mask"]}>
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
      const line = JSON.stringify({
        at: new Date().toISOString(),
        type,
        detail: detail instanceof Error ? detail.message : String(detail),
      });
      const key = accountStorageKey(CRASH_LOG_STORAGE_KEY);
      const previous = localStorage.getItem(key) || "";
      localStorage.setItem(
        key,
        [line, previous].filter(Boolean).join("\n").slice(0, 6000),
      );
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
  const [manifest, setManifest] = useState<AndroidUpdateManifest>();
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const pollRef = useRef<number | null>(null);
  const currentVersion =
    clientConfig?.androidVersion || clientConfig?.version || "0.0.0";
  const latestVersion =
    manifest?.latestVersion ||
    manifest?.version ||
    manifest?.androidVersion ||
    "";
  const required = Boolean(
    manifest?.minSupportedVersion &&
      compareVersions(currentVersion, manifest.minSupportedVersion) < 0,
  );
  const hasUpdate = Boolean(
    latestVersion && compareVersions(latestVersion, currentVersion) > 0,
  );
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
      if (now - checkedAt < UPDATE_CHECK_INTERVAL_MS) return;
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
        const nextVersion =
          nextManifest.latestVersion ||
          nextManifest.version ||
          nextManifest.androidVersion ||
          "";
        const mandatory = Boolean(
          nextManifest.minSupportedVersion &&
            compareVersions(currentVersion, nextManifest.minSupportedVersion) <
              0,
        );
        const available = Boolean(
          nextVersion && compareVersions(nextVersion, currentVersion) > 0,
        );
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
  }, [clientConfig, currentVersion]);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  async function downloadUpdate() {
    if (!apkUrl || downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const result = await startNativeDownload(
        apkUrl,
        "jisudengchat-android.apk",
        "JisudengChat Android",
      );
      if (!result.id) {
        await installDownloadedApk(undefined, result.path, manifest?.sha256);
        setDownloading(false);
        return;
      }
      pollRef.current = window.setInterval(async () => {
        const status = await getNativeDownloadStatus(String(result.id));
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

  if (!visible || (!hasUpdate && !required)) return null;
  return (
    <div className={styles["sheet-mask"]} role="dialog" aria-modal="true">
      <div className={styles["confirm-dialog"]}>
        <h2>{text.account.updateFound}</h2>
        <p>{`${text.account.installed} ${currentVersion} · ${text.account.latestVersion} ${latestVersion}`}</p>
        {manifestNotes(manifest).length > 0 && (
          <ul>
            {manifestNotes(manifest)
              .slice(0, 4)
              .map((note) => (
                <li key={note}>{note}</li>
              ))}
          </ul>
        )}
        {downloadError && (
          <div className={styles["form-error"]}>{downloadError}</div>
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
                ? text.account.downloading(0)
                : text.account.downloadUpdate}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function AndroidManagedGate(props: { children: ReactNode }) {
  const managed = useManagedNextChatStore();
  const mobileStore = useManagedMobileAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const text = useMobileText();
  const [secureRestoreDone, setSecureRestoreDone] = useState(false);
  const secureRestoreStartedRef = useRef(false);
  const billingRefreshRef = useRef(new Set<string>());
  const clientConfig = useMemo(() => getClientConfig(), []);
  const backendBaseUrl = useMemo(
    () => fixedManagedBackendBaseUrl(clientConfig),
    [clientConfig],
  );

  useMobileCrashLog();

  useEffect(() => {
    if (!backendBaseUrl) return;
    const version = clientConfig?.androidVersion || clientConfig?.version || "";
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
  }, [backendBaseUrl, clientConfig, managed.accessToken]);

  useEffect(() => {
    const consumeInviteDeepLink = (detail: any) => {
      const url = String(detail?.url || "");
      const referral = captureInviteReferral(url);
      if (!referral) return;
      storeInviteReferral(referral);
      localStorage.removeItem("jisudeng-native-pending-invite");
      window.dispatchEvent(new Event("jisudeng-invite-referral-updated"));
      if (backendBaseUrl) {
        void reportInviteLifecycleEvent(
          backendBaseUrl,
          useManagedNextChatStore.getState().accessToken,
          "poster_scanned",
          clientConfig?.androidVersion || clientConfig?.version || "",
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
  }, [backendBaseUrl, clientConfig]);

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
    void managed.restoreSecureSession().finally(() => {
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
    if (!managed._hasHydrated || !backendBaseUrl) return;
    const appVersion = clientConfig?.androidVersion || clientConfig?.version;
    const reportOpen = () => {
      void reportMobileAttributionEvent({
        baseUrl: backendBaseUrl,
        eventType: "open",
        appVersion,
        locale: text.dateLocale,
        metadata: { surface: "android_app" },
      });
    };
    reportOpen();
    const onResume = () => {
      if (document.visibilityState === "visible") reportOpen();
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("jisudeng-native-resume", reportOpen);
    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("jisudeng-native-resume", reportOpen);
    };
  }, [managed._hasHydrated, backendBaseUrl, clientConfig, text.dateLocale]);

  useEffect(() => {
    if (!managed.accessToken || !managed.backendBaseUrl) return;
    const appVersion = clientConfig?.androidVersion || clientConfig?.version;
    const userScope = managed.user?.id || managed.session?.user_id;
    if (!userScope) return;
    void reportMobileAttributionEvent({
      baseUrl: managed.backendBaseUrl,
      eventType: "login",
      appVersion,
      locale: text.dateLocale,
      accessToken: managed.accessToken,
      userScope,
      metadata: { surface: "android_app", event_name: "login" },
    });
    void reportMobileAttributionEvent({
      baseUrl: managed.backendBaseUrl,
      eventType: "active",
      appVersion,
      locale: text.dateLocale,
      accessToken: managed.accessToken,
      userScope,
      metadata: { surface: "android_app", event_name: "active" },
    });
  }, [
    clientConfig,
    managed.accessToken,
    managed.backendBaseUrl,
    managed.session?.user_id,
    managed.user?.id,
    text.dateLocale,
  ]);

  useEffect(() => {
    if (
      managed._hasHydrated &&
      backendBaseUrl &&
      managed.backendBaseUrl === backendBaseUrl &&
      managed.accessToken &&
      shouldRefreshManagedSession(managed.session) &&
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
          shouldRefreshManagedSession(latest.session) ||
          shouldRefreshManagedSession(latest.imageSession)
        ) {
          await latest.bootstrap({ silent: true }).catch(() => undefined);
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
    if (!managed.accessToken || !managed.backendBaseUrl) return;
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
  }, [clientConfig, managed.accessToken, managed.backendBaseUrl]);

  useEffect(() => {
    if (!managed.accessToken || !managed.backendBaseUrl) return;
    let disposed = false;
    let removeListeners: (() => void) | undefined;
    void registerMobilePush(
      managed.backendBaseUrl,
      managed.accessToken,
      clientConfig?.androidVersion || clientConfig?.version || "",
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
  }, [clientConfig, managed.accessToken, managed.backendBaseUrl]);

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
        <AndroidImageStudio />
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
