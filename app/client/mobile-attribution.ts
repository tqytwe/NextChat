import { managedJsonRequest } from "./managed-nextchat";
import { mobileInstallationId } from "./mobile-push";

export type MobileAttributionEventType =
  | "open"
  | "register"
  | "login"
  | "active"
  | "share";

type MobileAttributionEventOptions = {
  baseUrl: string;
  eventType: MobileAttributionEventType;
  appVersion?: string;
  locale?: string;
  accessToken?: string;
  userScope?: string | number;
  metadata?: Record<string, string>;
};

const reportedKeys = new Set<string>();
const pendingReports = new Map<string, Promise<boolean>>();

function eventScope(options: MobileAttributionEventOptions): string {
  const date = new Date().toISOString().slice(0, 10);
  const userScope = String(options.userScope ?? "anonymous")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
  return `${date}:${userScope || "anonymous"}`;
}

export function mobileAttributionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const source = new URL(window.location.href);
    const token =
      source.searchParams.get("attribution_token") ||
      source.searchParams.get("invite_token") ||
      source.searchParams.get("token") ||
      "";
    return token.trim().slice(0, 4096);
  } catch {
    return "";
  }
}

export function mobileAttributionAffiliateCode(): string {
  if (typeof window === "undefined") return "";
  try {
    const source = new URL(window.location.href);
    return (
      source.searchParams.get("aff_code") ||
      source.searchParams.get("aff") ||
      source.searchParams.get("ref") ||
      ""
    )
      .trim()
      .slice(0, 64);
  } catch {
    return "";
  }
}

/**
 * Records at most one event of a given type per installation, day, and account.
 * The backend additionally hashes and enforces the idempotency key, so an app
 * restart or a transport retry cannot inflate funnel numbers.
 */
export function reportMobileAttributionEvent(
  options: MobileAttributionEventOptions,
): Promise<boolean> {
  const installationId = mobileInstallationId();
  const baseUrl = options.baseUrl.trim();
  if (!installationId || !baseUrl) return Promise.resolve(false);

  const scope = eventScope(options);
  const idempotencyKey = `nextchat:${options.eventType}:${installationId}:${scope}`;
  if (reportedKeys.has(idempotencyKey)) return Promise.resolve(true);
  const existing = pendingReports.get(idempotencyKey);
  if (existing) return existing;

  const request = managedJsonRequest<{ created?: boolean }>(
    baseUrl,
    "/api/v1/mobile/attribution/events",
    {
      method: "POST",
      body: JSON.stringify({
        installation_id: installationId,
        event_type: options.eventType,
        idempotency_key: idempotencyKey,
        platform: "android",
        app_version: (options.appVersion || "").slice(0, 64),
        locale: (options.locale || navigator.language || "").slice(0, 32),
        attribution_token: mobileAttributionToken(),
        metadata: options.metadata || {},
      }),
    },
    options.accessToken,
  )
    .then(() => {
      reportedKeys.add(idempotencyKey);
      return true;
    })
    .catch(() => false)
    .finally(() => pendingReports.delete(idempotencyKey));

  pendingReports.set(idempotencyKey, request);
  return request;
}

export function resetMobileAttributionReportsForTest() {
  reportedKeys.clear();
  pendingReports.clear();
}
