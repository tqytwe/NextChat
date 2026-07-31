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
}

export type InvitePosterTheme = "midnight" | "light" | "celebration";

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

export function buildInvitePosterPayload(
  input: InvitePosterInput,
): InvitePosterPayload {
  const isChinese = /^zh(?:-|$)/i.test(input.locale || "");
  return {
    ...input,
    registerQrValue: input.registerUrl,
    appQrValue: input.appUrl,
    shareText: `${input.headline}\n${input.body}\n${input.registerUrl}`,
    registerLabel: isChinese ? "扫码参加网页活动" : "Join on the web",
    appLabel: isChinese ? "扫码下载 APP" : "Download the APP",
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
  const palette =
    payload.theme === "light"
      ? {
          background: "#f4f6f8",
          title: "#111318",
          body: "#374151",
          accent: "#0066cc",
          panel: "#ffffff",
        }
      : payload.theme === "celebration"
      ? {
          background: "#8b1e2d",
          title: "#ffffff",
          body: "#ffe4c7",
          accent: "#ffd166",
          panel: "#ffffff",
        }
      : {
          background: "#111318",
          title: "#ffffff",
          body: "#d6d9e0",
          accent: "#66b3ff",
          panel: "#ffffff",
        };
  context.fillStyle = palette.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
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
  const qrSize = Math.round(width * 0.33);
  const panelY = 500;
  const panelHeight = qrSize + 112;
  context.fillStyle = palette.panel;
  context.fillRect(50, panelY, qrSize + 28, panelHeight);
  context.fillRect(width - qrSize - 78, panelY, qrSize + 28, panelHeight);
  context.drawImage(registerImage, 64, panelY + 14, qrSize, qrSize);
  context.drawImage(appImage, width - qrSize - 64, panelY + 14, qrSize, qrSize);
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
  context.fillStyle = palette.body;
  context.font = "26px sans-serif";
  const footer = /^zh(?:-|$)/i.test(payload.locale || "")
    ? "网页参与或下载 APP，选择适合你的方式"
    : "Join on the web or download the APP";
  drawPosterText(context, footer, 64, canvas.height - 92, width - 128, 34, 2);
  return canvas.toDataURL("image/png");
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
