import QRCode from "qrcode";
import { managedJsonRequest } from "./managed-nextchat";

export const INVITE_REFERRAL_STORAGE_KEY = "jisudeng-invite-referral-v1";
export const INVITE_INSTALLATION_STORAGE_KEY =
  "jisudeng-mobile-installation-id";
export const INVITE_EVENT_STORAGE_PREFIX = "jisudeng-mobile-attribution-event:";
export const INVITE_REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type InviteLifecycleEvent =
  | "first_launch"
  | "registered"
  | "login"
  | "active"
  | "poster_scanned"
  | "share_opened"
  | "share_completed";

export interface InviteReferral {
  aff_code?: string;
  campaign_id?: string;
  token?: string;
  expires_at: number;
}

function trimQueryValue(value: string | null | undefined, maxLength = 256) {
  return (value || "").trim().slice(0, maxLength);
}

function queryParams(input: string | URLSearchParams) {
  if (input instanceof URLSearchParams) return input;
  const query = input.includes("?")
    ? input.slice(input.indexOf("?") + 1)
    : input;
  return new URLSearchParams(query.replace(/^\?/, ""));
}

export function captureInviteReferral(
  input: string | URLSearchParams,
  now = Date.now(),
): InviteReferral | null {
  const params = queryParams(input);
  const affCode = trimQueryValue(
    params.get("aff_code") || params.get("aff") || params.get("ref"),
  );
  const campaignId = trimQueryValue(
    params.get("campaign_id") || params.get("campaign"),
  );
  const token = trimQueryValue(
    params.get("invite_token") || params.get("token"),
    4096,
  );
  if (!affCode && !token) return null;
  return {
    ...(affCode ? { aff_code: affCode } : {}),
    ...(campaignId ? { campaign_id: campaignId } : {}),
    ...(token ? { token } : {}),
    expires_at: now + INVITE_REFERRAL_TTL_MS,
  };
}

export function storeInviteReferral(referral: InviteReferral | null) {
  if (typeof window === "undefined") return;
  try {
    if (!referral) {
      window.localStorage.removeItem(INVITE_REFERRAL_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      INVITE_REFERRAL_STORAGE_KEY,
      JSON.stringify(referral),
    );
  } catch {
    // Storage can be disabled in private browsing; the URL still remains usable.
  }
}

export function loadInviteReferral(now = Date.now()): InviteReferral | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(INVITE_REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<InviteReferral>;
    const affCode = trimQueryValue(value.aff_code || "");
    const token = trimQueryValue(value.token, 4096);
    const expiresAt = Number(value.expires_at) || 0;
    if ((!affCode && !token) || expiresAt <= now) {
      storeInviteReferral(null);
      return null;
    }
    return {
      ...(affCode ? { aff_code: affCode } : {}),
      ...(value.campaign_id
        ? { campaign_id: trimQueryValue(value.campaign_id) }
        : {}),
      ...(token ? { token } : {}),
      expires_at: expiresAt,
    };
  } catch {
    storeInviteReferral(null);
    return null;
  }
}

export function resolveInviteReferral(
  locationSearch = typeof window === "undefined" ? "" : window.location.search,
  now = Date.now(),
) {
  const fromLocation = captureInviteReferral(locationSearch, now);
  if (fromLocation) {
    storeInviteReferral(fromLocation);
    return fromLocation;
  }
  return loadInviteReferral(now);
}

export function buildCanonicalRegistrationPayload(
  referral: InviteReferral | null,
) {
  if (!referral?.aff_code && !referral?.token) return {};
  return {
    ...(referral.aff_code ? { aff_code: referral.aff_code } : {}),
    ...(referral.campaign_id ? { campaign_id: referral.campaign_id } : {}),
    ...(referral.token ? { invite_token: referral.token } : {}),
  };
}

export interface MobileRegistrationPayloadInput {
  email: string;
  password: string;
  verifyCode: string;
  promoCode: string;
  invitationCode: string;
  referral?: InviteReferral | null;
}

// Keep the legacy invite aliases while always sending the backend-owned fields
// that establish affiliate and campaign attribution.
export function buildMobileRegistrationPayload(
  input: MobileRegistrationPayloadInput,
) {
  const promoCode = input.promoCode.trim();
  const invitationCode = input.invitationCode.trim();
  return {
    email: input.email.trim(),
    password: input.password,
    verify_code: input.verifyCode.trim(),
    promo_code: promoCode,
    coupon_code: promoCode,
    invitation_code: invitationCode,
    invite_code: invitationCode,
    referral_code: invitationCode,
    ...buildCanonicalRegistrationPayload(input.referral || null),
  };
}

function randomUuid() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function getInviteInstallationId() {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(INVITE_INSTALLATION_STORAGE_KEY);
    if (stored) return stored;
    const value = randomUuid();
    window.localStorage.setItem(INVITE_INSTALLATION_STORAGE_KEY, value);
    return value;
  } catch {
    return randomUuid();
  }
}

export function getStableInviteEventId(scope: string) {
  const normalized = scope.trim().slice(0, 96) || "event";
  if (typeof window === "undefined") return randomUuid();
  const key = `${INVITE_EVENT_STORAGE_PREFIX}${normalized}`;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored) return stored;
    const value = randomUuid();
    window.localStorage.setItem(key, value);
    return value;
  } catch {
    return randomUuid();
  }
}

export interface InviteAttributionEventOptions {
  eventId?: string;
  attributionToken?: string;
  occurredAt?: string;
  metadata?: Record<string, string>;
}

function attributionEventType(event: InviteLifecycleEvent) {
  if (event === "registered") return "register";
  if (event === "login") return "login";
  if (event === "active") return "active";
  if (event === "poster_scanned") return "click";
  if (event === "share_opened" || event === "share_completed") return "share";
  return "open";
}

export function buildInviteAttributionEvent(
  event: InviteLifecycleEvent,
  installationId: string,
  appVersion: string,
  options: InviteAttributionEventOptions = {},
) {
  return {
    installation_id: installationId,
    event_type: attributionEventType(event),
    idempotency_key: options.eventId || randomUuid(),
    platform: "android",
    app_version: appVersion,
    locale: typeof navigator === "undefined" ? "" : navigator.language,
    ...(options.attributionToken
      ? { attribution_token: options.attributionToken }
      : {}),
    occurred_at: options.occurredAt || new Date().toISOString(),
    metadata: { event_name: event, ...(options.metadata || {}) },
  };
}

export async function reportInviteLifecycleEvent(
  baseUrl: string,
  accessToken: string,
  event: InviteLifecycleEvent,
  appVersion: string,
  installationId = getInviteInstallationId(),
  options: InviteAttributionEventOptions = {},
) {
  if (!baseUrl || !installationId) return;
  return managedJsonRequest(
    baseUrl,
    "/api/v1/mobile/attribution/events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildInviteAttributionEvent(event, installationId, appVersion, options),
      ),
    },
    accessToken || undefined,
  );
}

export async function attributeInviteCampaign(
  baseUrl: string,
  accessToken: string,
  attributionToken: string,
) {
  if (!baseUrl || !accessToken || !attributionToken) return;
  return managedJsonRequest(
    baseUrl,
    "/api/v1/user/aff/campaigns/attribute",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: attributionToken }),
    },
    accessToken,
  );
}

export interface InvitePosterInput {
  registerUrl: string;
  appUrl: string;
  headline: string;
  body: string;
  locale?: string;
  theme?: InvitePosterTheme;
  mode?: "invite" | "app";
}

export const INVITE_POSTER_THEMES = [
  "midnight",
  "light",
  "celebration",
  "mint",
  "coral",
  "gold",
  "sky",
  "forest",
  "ink",
  "sun",
] as const;

export type InvitePosterTheme = (typeof INVITE_POSTER_THEMES)[number];

export interface InviteCampaignReward {
  id: number;
  campaign_id: number;
  tier: number;
  amount: number;
  currency: string;
  status: string;
  claim_deadline?: string;
  frozen_until?: string;
  version: number;
}

export interface InviteCampaignProgress {
  campaign: {
    id: number;
    key: string;
    name: string;
    status: string;
    version: number;
    starts_at: string;
    ends_at: string;
    qualification_to: string;
    claim_deadline: string;
    pay_threshold: number;
    usage_threshold: number;
  };
  enrollment?: {
    campaign_id: number;
    user_id: number;
    enrolled_at: string;
  };
  tiers: Array<{
    tier: number;
    required_invites: number;
    reward_amount: number;
    currency: string;
  }>;
  invited_count: number;
  qualified_count: number;
  rewards: InviteCampaignReward[];
  ranking?: InviteCampaignRanking;
  leaderboard: InviteCampaignRanking[];
}

export interface InviteCampaignRanking {
  rank: number;
  email_masked: string;
  qualified_count: number;
  reward_amount: number;
  is_me?: boolean;
}

export interface InvitePosterPayload extends InvitePosterInput {
  registerQrValue: string;
  appQrValue: string;
  shareText: string;
  registerLabel: string;
  appLabel: string;
}

function invitePosterCopy(locale?: string) {
  const value = String(locale || "").toLowerCase();
  if (value.startsWith("zh")) {
    return {
      download: "扫码下载 APP",
      join: "扫码参加网页活动",
      appFooter: "扫码下载 APP，开启创作",
      combinedFooter: "网页参与或下载 APP，选择适合你的方式",
    };
  }
  if (value.startsWith("ja") || value.startsWith("jp")) {
    return {
      download: "スキャンして APP をダウンロード",
      join: "スキャンしてウェブで参加",
      appFooter: "スキャンして APP をダウンロードし、創作を始めましょう",
      combinedFooter: "ウェブで参加するか APP をダウンロードしてください",
    };
  }
  if (value.startsWith("ko")) {
    return {
      download: "스캔하여 APP 다운로드",
      join: "스캔하여 웹에서 참여",
      appFooter: "스캔하여 APP을 다운로드하고 창작을 시작하세요",
      combinedFooter: "웹에서 참여하거나 APP을 다운로드하세요",
    };
  }
  return {
    download: "Download the APP",
    join: "Join on the web",
    appFooter: "Scan to download the APP and start creating",
    combinedFooter: "Join on the web or download the APP",
  };
}

export function buildInvitePosterPayload(
  input: InvitePosterInput,
): InvitePosterPayload {
  const copy = invitePosterCopy(input.locale);
  const appOnly = input.mode === "app";
  return {
    ...input,
    registerQrValue: appOnly ? input.appUrl : input.registerUrl,
    appQrValue: input.appUrl,
    shareText: `${input.headline}\n${input.body}\n${
      appOnly ? input.appUrl : input.registerUrl
    }`,
    registerLabel: appOnly ? copy.download : copy.join,
    appLabel: copy.download,
  };
}

export async function createInvitePosterDataUrl(
  input: InvitePosterInput,
  width = 1080,
) {
  if (typeof document === "undefined") {
    throw new Error("invite poster requires a browser");
  }
  const payload = buildInvitePosterPayload(input);
  const [registerQr, appQr] = await Promise.all([
    QRCode.toDataURL(payload.registerQrValue, { width: 360, margin: 2 }),
    QRCode.toDataURL(payload.appQrValue, { width: 360, margin: 2 }),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(width * 1.25);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("invite poster canvas unavailable");
  const palette = invitePosterPalette(payload.theme);
  drawInvitePosterBackground(
    context,
    canvas.width,
    canvas.height,
    payload.theme,
    palette,
  );
  context.fillStyle = palette.accent;
  context.font = "700 28px sans-serif";
  context.fillText("JisudengChat", 64, 72);
  context.fillStyle = palette.title;
  context.font = "700 58px sans-serif";
  drawPosterText(context, payload.headline, 64, 146, width - 128, 66, 2);
  context.fillStyle = palette.body;
  context.font = "32px sans-serif";
  drawPosterText(context, payload.body, 64, 294, width - 128, 42, 3);
  const registerImage = await loadImage(registerQr);
  const appImage = await loadImage(appQr);
  const appOnly = payload.mode === "app";
  const qrSize = Math.round(width * (appOnly ? 0.48 : 0.33));
  const panelY = 500;
  const panelHeight = qrSize + 112;
  context.fillStyle = palette.panel;
  if (appOnly) {
    const qrX = Math.round((width - qrSize) / 2);
    context.fillRect(qrX - 14, panelY, qrSize + 28, panelHeight);
    context.drawImage(appImage, qrX, panelY + 14, qrSize, qrSize);
    context.fillStyle = "#111318";
    drawCenteredPosterLabel(
      context,
      payload.appLabel,
      qrX,
      panelY + qrSize + 62,
      qrSize,
    );
  } else {
    context.fillRect(50, panelY, qrSize + 28, panelHeight);
    context.fillRect(width - qrSize - 78, panelY, qrSize + 28, panelHeight);
    context.drawImage(registerImage, 64, panelY + 14, qrSize, qrSize);
    context.drawImage(
      appImage,
      width - qrSize - 64,
      panelY + 14,
      qrSize,
      qrSize,
    );
    context.fillStyle = "#111318";
    drawCenteredPosterLabel(
      context,
      payload.registerLabel,
      64,
      panelY + qrSize + 62,
      qrSize,
    );
    drawCenteredPosterLabel(
      context,
      payload.appLabel,
      width - qrSize - 64,
      panelY + qrSize + 62,
      qrSize,
    );
  }
  context.fillStyle = palette.body;
  context.font = "26px sans-serif";
  const copy = invitePosterCopy(payload.locale);
  const footer = appOnly ? copy.appFooter : copy.combinedFooter;
  drawPosterText(context, footer, 64, canvas.height - 92, width - 128, 34, 2);
  return canvas.toDataURL("image/png");
}

type InvitePosterPalette = {
  background: string;
  title: string;
  body: string;
  accent: string;
  panel: string;
};

function invitePosterPalette(
  theme: InvitePosterTheme = "midnight",
): InvitePosterPalette {
  const palettes: Record<InvitePosterTheme, InvitePosterPalette> = {
    midnight: {
      background: "#101720",
      title: "#ffffff",
      body: "#d6d9e0",
      accent: "#66b3ff",
      panel: "#ffffff",
    },
    light: {
      background: "#f4f6f8",
      title: "#111318",
      body: "#374151",
      accent: "#0066cc",
      panel: "#ffffff",
    },
    celebration: {
      background: "#8b1e2d",
      title: "#ffffff",
      body: "#ffe4c7",
      accent: "#ffd166",
      panel: "#ffffff",
    },
    mint: {
      background: "#093b38",
      title: "#f3fffb",
      body: "#c5efe4",
      accent: "#6ee7cc",
      panel: "#ffffff",
    },
    coral: {
      background: "#f26e5e",
      title: "#382121",
      body: "#542e29",
      accent: "#ffffff",
      panel: "#ffffff",
    },
    gold: {
      background: "#16130e",
      title: "#fff8e7",
      body: "#e5d5b2",
      accent: "#e5bb65",
      panel: "#ffffff",
    },
    sky: {
      background: "#dff2ff",
      title: "#12364e",
      body: "#28536f",
      accent: "#1169a5",
      panel: "#ffffff",
    },
    forest: {
      background: "#247146",
      title: "#f6fff9",
      body: "#ccead8",
      accent: "#ffe58a",
      panel: "#ffffff",
    },
    ink: {
      background: "#24242a",
      title: "#f8f8fa",
      body: "#d5d5dc",
      accent: "#ff8c69",
      panel: "#ffffff",
    },
    sun: {
      background: "#ffd659",
      title: "#1f2840",
      body: "#35425c",
      accent: "#1f2840",
      panel: "#ffffff",
    },
  };
  return palettes[theme];
}

function drawInvitePosterBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: InvitePosterTheme | undefined,
  palette: InvitePosterPalette,
) {
  context.fillStyle = palette.background;
  context.fillRect(0, 0, width, height);
  context.save();
  context.strokeStyle = palette.accent;
  context.fillStyle = palette.accent;
  context.globalAlpha = 0.18;
  context.lineWidth = 3;

  switch (theme) {
    case "light":
    case "sky":
      for (let x = 30; x < width; x += 70) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 30; y < height; y += 70) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      break;
    case "celebration":
    case "sun":
      for (let index = 0; index < 30; index += 1) {
        context.fillRect(
          (index * 137) % width,
          50 + ((index * 97) % 560),
          9,
          28,
        );
      }
      break;
    case "mint":
    case "forest":
      for (let index = 0; index < 7; index += 1) {
        const x = 70 + index * 142;
        const y = 430 + (index % 2) * 78;
        context.beginPath();
        context.arc(x, y, 22, 0, Math.PI * 2);
        context.fill();
        if (index) {
          context.beginPath();
          context.moveTo(x - 112, 430 + ((index - 1) % 2) * 78);
          context.lineTo(x - 24, y);
          context.stroke();
        }
      }
      break;
    case "coral":
    case "ink":
      for (let index = 0; index < 5; index += 1) {
        const x = 70 + index * 210;
        const y = 390 + (index % 2) * 64;
        context.strokeRect(x, y, 150, 94);
        context.fillRect(x + 20, y + 22, 82, 8);
        context.fillRect(x + 20, y + 48, 112, 8);
      }
      break;
    case "gold":
      for (let y = 85; y < 480; y += 52) {
        for (let x = 60; x < width; x += 92) context.fillRect(x, y, 36, 13);
      }
      break;
    case "midnight":
    default:
      for (let index = 0; index < 9; index += 1) {
        const x = 70 + index * 120;
        const y = 440 + (index % 3) * 52;
        context.beginPath();
        context.arc(x, y, 16, 0, Math.PI * 2);
        context.fill();
        if (index < 8) {
          context.beginPath();
          context.moveTo(x + 16, y);
          context.lineTo(x + 104, 440 + ((index + 1) % 3) * 52);
          context.stroke();
        }
      }
  }
  context.restore();
}

function drawCenteredPosterLabel(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  let fontSize = 26;
  do {
    context.font = `700 ${fontSize}px sans-serif`;
    fontSize -= 1;
  } while (fontSize >= 18 && context.measureText(text).width > maxWidth);
  context.textAlign = "center";
  context.fillText(text, x + maxWidth / 2, y);
  context.textAlign = "left";
}

function drawPosterText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const units = /\s/.test(text) ? text.split(/\s+/) : Array.from(text);
  let line = "";
  let lineIndex = 0;
  for (const unit of units) {
    const separator = /\s/.test(text) && line ? " " : "";
    const candidate = line + separator + unit;
    if (line && context.measureText(candidate).width > maxWidth) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      lineIndex += 1;
      if (lineIndex >= maxLines) return;
      line = unit;
    } else {
      line = candidate;
    }
  }
  if (line && lineIndex < maxLines)
    context.fillText(line, x, y + lineIndex * lineHeight);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("invite poster QR unavailable"));
    image.src = src;
  });
}
