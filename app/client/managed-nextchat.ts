import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { LLMModel } from "./api";
import { ServiceProvider } from "../constant";
import {
  formatManagedMobileError,
  getManagedMobileText,
} from "./managed-mobile-i18n";
import {
  isDirectNativeStreamAvailable,
  startDirectNativeStreamRequest,
} from "./android-native";

export const DEFAULT_MANAGED_BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_SUB2API_BASE_URL ?? "";

export interface ManagedEnvelope<T> {
  code: number | string;
  message: string;
  data?: T;
  /** Structured server context for recoverable error states. */
  metadata?: Record<string, unknown>;
}

export class ManagedApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly code?: number | string,
    readonly requestId = "unknown",
    readonly category: "http" | "api" = "http",
    readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ManagedApiError";
  }
}

export class ManagedTransportError extends Error {
  constructor(
    message: string,
    readonly category: ReturnType<typeof diagnosticCategory>,
    readonly path: string,
    readonly requestId: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ManagedTransportError";
  }
}

export function isManagedAuthError(error: unknown) {
  if (!(error instanceof ManagedApiError)) return false;
  const code = String(error.code ?? "").toUpperCase();
  return (
    error.status === 401 ||
    [
      "UNAUTHORIZED",
      "INVALID_AUTH_HEADER",
      "EMPTY_TOKEN",
      "TOKEN_EXPIRED",
      "INVALID_TOKEN",
      "TOKEN_REVOKED",
    ].includes(code)
  );
}

export function shouldRefreshManagedToken(
  expiresAt: string,
  now = Date.now(),
  skewMs = 60_000,
) {
  if (!expiresAt) return false;
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= now + skewMs;
}

export interface ManagedAuthUser {
  id: number;
  username?: string;
  email?: string;
  avatar_url?: string;
}

export interface ManagedAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user?: ManagedAuthUser;
}

export interface ManagedTotpLoginResponse {
  requires_2fa: boolean;
  temp_token: string;
  user_email_masked?: string;
}

export interface ManagedSession {
  user_id: number;
  api_key: string;
  api_key_id: number;
  expires_at?: string;
  purpose?: "chat" | "image" | "video";
  /** Present only on an immutable purpose/group replacement session. */
  group_id?: number;
  binding?: string;
}

export function shouldRefreshManagedSession(
  session?: ManagedSession | null,
  now = Date.now(),
) {
  if (!session?.api_key || !session.expires_at) return true;
  return shouldRefreshManagedToken(session.expires_at, now, 5 * 60_000);
}

export interface ManagedWorkspaceUser {
  id: number;
  username?: string;
  email?: string;
  avatar_url?: string;
  balance: number;
  frozen_balance?: number;
}

export interface ManagedWorkspaceAPIKey {
  id: number;
  name: string;
  group_id?: number;
  group_name?: string;
  group_platform?: string;
}

/**
 * Server-owned media classifications. A workspace model can intentionally
 * belong to more than one modality (for example, chat plus image input), so
 * callers must not infer an exclusive mode from its name.
 */
export type ManagedModelModality = "chat" | "image" | "video" | "audio";

/**
 * The public, server-owned image contract. Keep this aligned with
 * `ModelImageCapabilities` on the platform instead of deriving constraints
 * from a provider or model name in a managed client.
 */
export interface ManagedImageCapabilities {
  operations?: string[];
  sizing_kind?: string;
  supported_sizes?: string[];
  supported_ratios?: string[];
  supported_formats?: string[];
  min_dimension?: number;
  max_dimension?: number;
  dimension_step?: number;
  max_aspect_ratio?: number;
  max_reference_images?: number;
  max_outputs_per_job?: number;
  recommended_parallelism?: number;
  max_queued_outputs?: number;
}

/**
 * The public, server-owned video contract. The `resolutions`/`ratios`/
 * `durations` aliases are retained only while talking to a pre-contract
 * mobile endpoint; current platform responses use the supported_* fields.
 */
export interface ManagedVideoCapabilities {
  operations?: string[];
  text_to_video?: boolean;
  image_to_video?: boolean;
  video_reference?: boolean;
  audio_reference?: boolean;
  resolutions?: string[];
  ratios?: string[];
  durations?: number[];
  generate_audio?: boolean;
  watermark?: boolean;
  supported_resolutions?: string[];
  supported_ratios?: string[];
  supported_durations?: number[];
  max_reference_assets?: number;
  max_reference_images?: number;
  max_reference_videos?: number;
  max_reference_audios?: number;
}

/**
 * A server-owned reason why a model that is otherwise visible in a group is
 * not executable for a particular media purpose. The code is deliberately
 * kept opaque here: UI layers localize known codes while retaining unknown
 * future codes for diagnostics and safe fallback handling.
 */
export interface ManagedVideoSuppressedModel {
  model: string;
  code: string;
}

export interface ManagedWorkspaceModel {
  id: string;
  name: string;
  display_name?: string;
  platform?: string;
  channel?: string;
  use_case?: string;
  /** Authoritative model modality contract supplied by the platform. */
  modalities?: ManagedModelModality[];
  /** Execution adapter and schema revision required for a runnable media model. */
  adapter?: string;
  capability_version?: string;
  sort_order?: number;
  effective_input_price?: number;
  effective_output_price?: number;
  tool_capabilities?: {
    function_calling?: boolean;
    tool_choice?: boolean;
    web_search?: boolean;
    live?: boolean;
  };
  image_capabilities?: ManagedImageCapabilities;
  video_capabilities?: ManagedVideoCapabilities;
}

/**
 * Model IDs are the only values that may cross a managed gateway boundary.
 * `name` existed before the media contract and can be a human-facing label on
 * older responses, so callers use it only as a compatibility fallback.
 */
export function managedWorkspaceModelID(
  model?: Pick<ManagedWorkspaceModel, "id" | "name"> | null,
) {
  return String(model?.id || model?.name || "").trim();
}

/** Match old persisted model labels without ever sending them as a new request. */
export function managedWorkspaceModelMatches(
  model:
    | Pick<ManagedWorkspaceModel, "id" | "name" | "display_name">
    | null
    | undefined,
  value: string | null | undefined,
) {
  const candidate = String(value || "").trim();
  if (!candidate) return false;
  return [
    managedWorkspaceModelID(model),
    String(model?.name || "").trim(),
    String(model?.display_name || "").trim(),
  ].some((known) => known === candidate);
}

export interface ManagedWorkspaceGroup {
  id: number;
  name: string;
  name_zh?: string;
  name_en?: string;
  name_ja?: string;
  name_jp?: string;
  name_ko?: string;
  localized?: {
    name?: Record<string, string | undefined>;
    zh?: string;
    en?: string;
    ja?: string;
    jp?: string;
    ko?: string;
  };
  description?: string;
  platform?: string;
  /** Optional group-level capability summary for an empty or legacy model list. */
  modalities?: ManagedModelModality[];
  rate_multiplier?: number;
  sort_order?: number;
  is_current?: boolean;
  /** Server-declared group authorization for the managed /v1/live gateway. */
  live_available?: boolean;
  video_available?: boolean;
  video_unavailable_code?: string;
  /**
   * A root media-contract marker copied onto normalized mobile-video groups.
   * It prevents a caller that only retains a group from re-enabling legacy
   * model-name inference after the server has declared capabilities.
   */
  media_contract_version?: string;
  /** Diagnostics returned by the dedicated mobile-video bootstrap. */
  video_suppressed?: ManagedVideoSuppressedModel[];
  video_capabilities?: ManagedVideoCapabilities;
  /**
   * Compatibility shape used by early media workspaces. The mobile client
   * normalizes these exact server model IDs into ordinary model rows; it never
   * infers a video model from its display name.
   */
  model_capabilities?: Record<string, ManagedVideoCapabilities>;
  models?: ManagedWorkspaceModel[];
}

export interface ManagedWorkspaceModels {
  source?: string;
  default_model?: string;
  image_capabilities_version?: string;
  video_capabilities_version?: string;
  selected_group_id?: number;
  groups?: ManagedWorkspaceGroup[];
}

export interface ManagedWorkspaceBootstrap {
  user: ManagedWorkspaceUser;
  managed_api_key: ManagedWorkspaceAPIKey;
  brand?: {
    site_name?: string;
    site_logo?: string;
    workspace_name?: string;
  };
  features?: {
    chat?: boolean;
    image_studio?: boolean;
    video_studio?: boolean;
    prompts?: boolean;
    history_export?: boolean;
    cloud_sync?: boolean;
  };
  models?: ManagedWorkspaceModels;
  urls?: {
    return_url?: string;
    recharge_url?: string;
    profile_url?: string;
  };
  support_contact?: unknown;
  retention?: {
    text_session_days?: number;
    image_job_days?: number;
    image_asset_hours?: number;
    image_reference_hours?: number;
    server_chat_log?: boolean;
  };
  managed_api_keys?: {
    chat?: ManagedWorkspaceAPIKey;
    image?: ManagedWorkspaceAPIKey;
    video?: ManagedWorkspaceAPIKey;
  };
  workspaces?: {
    chat?: { models?: ManagedWorkspaceModels };
    image?: { models?: ManagedWorkspaceModels };
    video?: { models?: ManagedWorkspaceModels };
  };
}

export interface ManagedMobileBootstrap extends ManagedWorkspaceBootstrap {
  session: ManagedSession;
  /** Set only by a server that returned a purpose/group-pinned replacement. */
  session_binding?: string;
  sessions?: {
    chat?: ManagedSession;
    image?: ManagedSession;
    video?: ManagedSession;
  };
}

function normalizeManagedWorkspaceModel(
  model: ManagedWorkspaceModel,
): ManagedWorkspaceModel {
  const id = managedWorkspaceModelID(model);
  if (!id) return model;
  const legacyName = String(model.name || "").trim();
  const displayName = String(
    model.display_name || (legacyName && legacyName !== id ? legacyName : ""),
  ).trim();
  return {
    ...model,
    id,
    name: id,
    ...(displayName ? { display_name: displayName } : {}),
  };
}

function normalizeManagedWorkspaceModels(
  models?: ManagedWorkspaceModels,
): ManagedWorkspaceModels | undefined {
  if (!models) return undefined;
  const groups = (Array.isArray(models.groups) ? models.groups : []).map(
    (group) => {
      const rawGroup = group as ManagedWorkspaceGroup & {
        model_ids?: unknown;
        model_names?: unknown;
        available_models?: unknown;
        model_list?: unknown;
      };
      const declared = Array.isArray(rawGroup.models) ? rawGroup.models : [];
      const alternateRows = [
        rawGroup.model_ids,
        rawGroup.model_names,
        rawGroup.available_models,
        rawGroup.model_list,
      ].flatMap((value) => (Array.isArray(value) ? value : []));
      const capabilityModelIDs = Object.keys(group.model_capabilities || {});
      const known = new Set(
        declared.map((model) => managedWorkspaceModelID(model)).filter(Boolean),
      );
      // The server may publish video capability rows before it includes the
      // corresponding model in the generic group list. Preserve those stable
      // IDs as selectable rows; do not guess from group/model display names.
      const supplemental = capabilityModelIDs
        .filter((id) => id && !known.has(id))
        .map((id) => ({
          id,
          name: id,
          video_capabilities: group.model_capabilities?.[id],
        }));
      const normalizedAlternate = alternateRows.flatMap((value) => {
        if (value && typeof value === "object") {
          const row = value as Record<string, unknown>;
          const id = String(row.id || row.model || row.name || "").trim();
          return id && !known.has(id)
            ? [
                {
                  id,
                  name: id,
                  video_capabilities: group.model_capabilities?.[id],
                },
              ]
            : [];
        }
        const id = String(value || "").trim();
        return id && !known.has(id)
          ? [
              {
                id,
                name: id,
                video_capabilities: group.model_capabilities?.[id],
              },
            ]
          : [];
      });
      return {
        ...group,
        models: [...declared, ...supplemental, ...normalizedAlternate].map(
          normalizeManagedWorkspaceModel,
        ),
      };
    },
  );
  const defaultModel = String(models.default_model || "").trim();
  const canonicalDefault = groups
    .flatMap((group) => group.models || [])
    .find((model) => managedWorkspaceModelMatches(model, defaultModel));
  return {
    ...models,
    ...(canonicalDefault
      ? { default_model: managedWorkspaceModelID(canonicalDefault) }
      : {}),
    groups,
  };
}

/**
 * Normalize older managed payloads at the trust boundary. A provider ID stays
 * in `id`/`name`; a human label becomes `display_name` before any selector,
 * preference, or API request sees it.
 */
export function normalizeManagedMobileBootstrap(
  bootstrap: ManagedMobileBootstrap,
): ManagedMobileBootstrap {
  const models = normalizeManagedWorkspaceModels(bootstrap.models);
  const workspaces = bootstrap.workspaces
    ? {
        ...bootstrap.workspaces,
        chat: bootstrap.workspaces.chat
          ? {
              ...bootstrap.workspaces.chat,
              models: normalizeManagedWorkspaceModels(
                bootstrap.workspaces.chat.models,
              ),
            }
          : undefined,
        image: bootstrap.workspaces.image
          ? {
              ...bootstrap.workspaces.image,
              models: normalizeManagedWorkspaceModels(
                bootstrap.workspaces.image.models,
              ),
            }
          : undefined,
        video: bootstrap.workspaces.video
          ? {
              ...bootstrap.workspaces.video,
              models: normalizeManagedWorkspaceModels(
                bootstrap.workspaces.video.models,
              ),
            }
          : undefined,
      }
    : undefined;
  return {
    ...bootstrap,
    ...(models ? { models } : {}),
    ...(workspaces ? { workspaces } : {}),
  };
}

export function normalizeManagedBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function managedApiUrl(baseUrl: string, path: string) {
  const normalized = normalizeManagedBaseUrl(baseUrl);
  if (!normalized) {
    throw new Error(getManagedMobileText().errors.missingBackend);
  }
  return `${normalized}/${path.replace(/^\/+/, "")}`;
}

export function managedGatewayBaseUrl(baseUrl: string) {
  return managedApiUrl(baseUrl, "/v1").replace(/\/v1$/, "/v1");
}

export function isAndroidNativeHttpAvailable() {
  return (
    Capacitor.getPlatform() === "android" || isDirectNativeStreamAvailable()
  );
}

export type ManagedRequestTransport = "native" | "web";

export interface ManagedRequestDiagnostic {
  at: number;
  method: string;
  path: string;
  transport: ManagedRequestTransport;
  attempt: number;
  status?: number;
  category:
    | "aborted"
    | "http"
    | "network"
    | "offline"
    | "timeout"
    | "recovered";
  message: string;
}

const MANAGED_REQUEST_DIAGNOSTICS_KEY = "nextchat-managed-request-diagnostics";
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 502, 503, 504]);
const MAX_NATIVE_IDEMPOTENT_ATTEMPTS = 2;
const MAX_AUTOMATIC_RETRY_AFTER_MS = 6_000;
const RETRY_AFTER_SAFETY_MARGIN_MS = 250;

function sanitizedDiagnosticPath(path: string) {
  return path.replace(
    /([?&](?:access_token|api_key|authorization|code|key|token)=)[^&]*/gi,
    "$1[redacted]",
  );
}

export function diagnosticErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message.slice(0, 240)
    : String(error || "request failed").slice(0, 240);
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && /abort|cancel/i.test(error.message))
  );
}

export function diagnosticCategory(
  error: unknown,
): ManagedRequestDiagnostic["category"] {
  if (isAbortError(error)) return "aborted";
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "offline";
  }
  if (/timeout|timed out|超时/i.test(diagnosticErrorMessage(error))) {
    return "timeout";
  }
  return "network";
}

export function recordManagedRequestDiagnostic(
  diagnostic: ManagedRequestDiagnostic,
) {
  if (typeof window === "undefined") return;
  try {
    const current = JSON.parse(
      window.localStorage.getItem(MANAGED_REQUEST_DIAGNOSTICS_KEY) || "[]",
    );
    const items = Array.isArray(current) ? current : [];
    window.localStorage.setItem(
      MANAGED_REQUEST_DIAGNOSTICS_KEY,
      JSON.stringify([diagnostic, ...items].slice(0, 24)),
    );
  } catch {
    // Diagnostics must never interfere with the request itself.
  }
}

export function getManagedRequestDiagnostics(limit = 12) {
  if (typeof window === "undefined") return [] as ManagedRequestDiagnostic[];
  try {
    const current = JSON.parse(
      window.localStorage.getItem(MANAGED_REQUEST_DIAGNOSTICS_KEY) || "[]",
    );
    return (Array.isArray(current) ? current : []).slice(
      0,
      Math.max(0, limit),
    ) as ManagedRequestDiagnostic[];
  } catch {
    return [] as ManagedRequestDiagnostic[];
  }
}

function abortException() {
  return new DOMException("Aborted", "AbortError");
}

function waitForRetry(delay: number, signal?: AbortSignal | null) {
  if (signal?.aborted) return Promise.reject(abortException());
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, delay);
    if (!signal) return;
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(abortException());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function numericRetryAfterMilliseconds(value: unknown) {
  const seconds = Number(String(value ?? "").trim());
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds * 1000) + RETRY_AFTER_SAFETY_MARGIN_MS;
}

function retryAfterFromBody(bodyText: string) {
  if (!bodyText.trim()) return null;
  try {
    const payload = JSON.parse(bodyText) as {
      metadata?: { retry_after?: unknown };
      retry_after?: unknown;
    };
    return numericRetryAfterMilliseconds(
      payload.metadata?.retry_after ?? payload.retry_after,
    );
  } catch {
    return null;
  }
}

/**
 * Returns the bounded server-directed retry delay for an idempotent native
 * request. The body fallback is important for the direct Android stream
 * bridge, which intentionally exposes status and response text but not every
 * response header. A null value means the response should use normal retry
 * timing or be shown to the user.
 */
export function managedRetryAfterMilliseconds(
  responseHeaders: HeadersInit | undefined,
  bodyText: string,
) {
  const headerValue = responseHeaders
    ? new Headers(responseHeaders).get("Retry-After")
    : null;
  const delay =
    numericRetryAfterMilliseconds(headerValue) ?? retryAfterFromBody(bodyText);
  if (delay === null || delay > MAX_AUTOMATIC_RETRY_AFTER_MS) return null;
  return delay;
}

function isIdempotencyRetryBackoffResponse(
  status: number,
  bodyText: string,
  responseHeaders: HeadersInit | undefined,
) {
  return (
    status === 409 &&
    /IDEMPOTENCY_RETRY_BACKOFF/i.test(bodyText) &&
    managedRetryAfterMilliseconds(responseHeaders, bodyText) !== null
  );
}

function shouldRetryNativeResponse(
  status: number,
  bodyText: string,
  responseHeaders: HeadersInit | undefined,
) {
  return (
    RETRYABLE_HTTP_STATUS.has(status) ||
    isIdempotencyRetryBackoffResponse(status, bodyText, responseHeaders)
  );
}

function nativeRetryDelayMilliseconds(
  attempt: number,
  responseHeaders: HeadersInit | undefined,
  bodyText: string,
) {
  return (
    managedRetryAfterMilliseconds(responseHeaders, bodyText) ?? 250 * attempt
  );
}

function settleWithAbort<T>(promise: Promise<T>, signal?: AbortSignal | null) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortException());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortException());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function headersToRecord(headers: Headers) {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function initBodyAsNativeData(body?: BodyInit | null) {
  if (typeof body === "undefined" || body === null) return undefined;
  if (typeof body === "string") return body;
  return body;
}

function escapeMultipartValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r|\n/g, " ");
}

function concatUint8Arrays(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.byteLength;
  });
  return out;
}

function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

function encodeUTF8(value: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value);
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "utf8"));
  }
  const encoded = unescape(encodeURIComponent(value));
  const out = new Uint8Array(encoded.length);
  for (let index = 0; index < encoded.length; index += 1) {
    out[index] = encoded.charCodeAt(index);
  }
  return out;
}

function blobToUint8Array(blob: Blob) {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  if (typeof FileReader !== "undefined") {
    return new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () =>
        reject(reader.error || new Error("blob read failed"));
      reader.readAsArrayBuffer(blob);
    });
  }
  if (typeof Response !== "undefined") {
    return new Response(blob)
      .arrayBuffer()
      .then((buffer) => new Uint8Array(buffer));
  }
  return Promise.reject(new Error("blob read failed"));
}

async function formDataToMultipartBody(formData: FormData, headers: Headers) {
  const boundary = `----jisudengchat-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const parts: Uint8Array[] = [];
  const entries: Array<[string, FormDataEntryValue]> = [];

  formData.forEach((value, name) => {
    entries.push([name, value]);
  });

  for (const [name, value] of entries) {
    parts.push(encodeUTF8(`--${boundary}\r\n`));
    if (value instanceof Blob) {
      const fileName =
        "name" in value && typeof value.name === "string" && value.name.trim()
          ? value.name
          : "upload.bin";
      const contentType = value.type || "application/octet-stream";
      parts.push(
        encodeUTF8(
          `Content-Disposition: form-data; name="${escapeMultipartValue(
            name,
          )}"; filename="${escapeMultipartValue(fileName)}"\r\n` +
            `Content-Type: ${contentType}\r\n\r\n`,
        ),
      );
      parts.push(await blobToUint8Array(value));
      parts.push(encodeUTF8("\r\n"));
      continue;
    }
    parts.push(
      encodeUTF8(
        `Content-Disposition: form-data; name="${escapeMultipartValue(
          name,
        )}"\r\n\r\n${String(value)}\r\n`,
      ),
    );
  }
  parts.push(encodeUTF8(`--${boundary}--\r\n`));
  headers.set("Content-Type", `multipart/form-data; boundary=${boundary}`);
  return bytesToBase64(concatUint8Arrays(parts));
}

async function directNativeRequestText(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: BodyInit | null | undefined,
  signal?: AbortSignal | null,
) {
  let status = 0;
  const lines: string[] = [];
  let bodyBase64: string | undefined;
  if (
    typeof FormData !== "undefined" &&
    body &&
    typeof body !== "string" &&
    body instanceof FormData
  ) {
    const multipartHeaders = new Headers(headers);
    bodyBase64 = await formDataToMultipartBody(body, multipartHeaders);
    Object.assign(headers, headersToRecord(multipartHeaders));
  }
  const request = await startDirectNativeStreamRequest(
    {
      url,
      method,
      headers,
      body: typeof body === "string" ? body : undefined,
      bodyBase64,
      connectTimeout: 15_000,
      readTimeout: 120_000,
    },
    {
      onStatus: (nextStatus) => {
        status = nextStatus;
      },
      onLine: (line) => lines.push(line),
    },
  );
  const cancel = () => request.cancel().catch(() => {});
  if (signal?.aborted) {
    cancel();
    throw abortException();
  }
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    await request.done;
    return { status, text: lines.join("\n") };
  } catch (error) {
    if (signal?.aborted) throw abortException();
    if (status) {
      return {
        status,
        text: error instanceof Error ? error.message : String(error || ""),
      };
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

export async function managedRequestText(
  baseUrl: string,
  path: string,
  init: RequestInit,
  headers: Headers,
) {
  const url = managedApiUrl(baseUrl, path);
  const requestId =
    headers.get("X-Request-ID") ||
    `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  headers.set("X-Request-ID", requestId);
  const method = (init.method || "GET").toUpperCase();
  const signal = init.signal;
  const diagnosticPath = sanitizedDiagnosticPath(path);
  // Live creates carry an idempotency key for server-side audit and future
  // replay support, but the current upstream call allocation is not a
  // replayable operation. Retrying it here could create a second live call
  // after the first response was lost in transit.
  const nonReplayableCreate =
    method === "POST" && /(?:^|\/)v1\/live(?:\/|$)/.test(path);
  const idempotent =
    !nonReplayableCreate &&
    (method === "GET" || method === "HEAD" || headers.has("Idempotency-Key"));
  const native = isAndroidNativeHttpAvailable();
  const nativeAttempts = native
    ? idempotent
      ? MAX_NATIVE_IDEMPOTENT_ATTEMPTS
      : 1
    : 1;
  let lastError: unknown;

  if (native) {
    for (let attempt = 1; attempt <= nativeAttempts; attempt += 1) {
      try {
        const nativeHeaders = headersToRecord(headers);
        nativeHeaders.Connection = "close";
        if (attempt > 1) {
          nativeHeaders["Cache-Control"] = "no-cache";
        }
        if (idempotent && !nativeHeaders["Cache-Control"]) {
          nativeHeaders["Cache-Control"] = "no-cache";
        }
        const directNative = isDirectNativeStreamAvailable();
        const response = directNative
          ? await directNativeRequestText(
              url,
              method,
              nativeHeaders,
              init.body,
              signal,
            )
          : await settleWithAbort(
              CapacitorHttp.request({
                url,
                method,
                headers: nativeHeaders,
                data: initBodyAsNativeData(init.body),
                responseType: "text",
                connectTimeout: 15000,
                readTimeout: 120000,
              }),
              signal,
            );
        const data = "data" in response ? response.data : response.text;
        const result = {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          headers: "headers" in response ? response.headers : undefined,
          text:
            typeof data === "string"
              ? data
              : data === undefined || data === null
              ? ""
              : JSON.stringify(data),
        };
        if (
          idempotent &&
          attempt < nativeAttempts &&
          shouldRetryNativeResponse(
            response.status,
            result.text,
            result.headers,
          )
        ) {
          const retryDelay = nativeRetryDelayMilliseconds(
            attempt,
            result.headers,
            result.text,
          );
          recordManagedRequestDiagnostic({
            at: Date.now(),
            method,
            path: diagnosticPath,
            transport: "native",
            attempt,
            status: response.status,
            category: "http",
            message: `HTTP ${response.status}; retry in ${retryDelay}ms`,
          });
          await waitForRetry(retryDelay, signal);
          continue;
        }
        if (attempt > 1 && result.ok) {
          recordManagedRequestDiagnostic({
            at: Date.now(),
            method,
            path: diagnosticPath,
            transport: "native",
            attempt,
            status: response.status,
            category: "recovered",
            message: "request recovered after retry",
          });
        }
        return { ...result, requestId };
      } catch (error) {
        lastError = error;
        recordManagedRequestDiagnostic({
          at: Date.now(),
          method,
          path: diagnosticPath,
          transport: "native",
          attempt,
          category: diagnosticCategory(error),
          message: diagnosticErrorMessage(error),
        });
        if (isAbortError(error)) throw error;
        if (!idempotent || attempt >= nativeAttempts) break;
        await waitForRetry(250 * attempt, signal);
      }
    }

    // The patched WebView fetch follows a separate Capacitor code path and is
    // useful after the device switches between Wi-Fi and cellular networks.
    if (idempotent) {
      try {
        const res = await fetch(url, {
          ...init,
          headers,
          cache: "no-store",
        });
        recordManagedRequestDiagnostic({
          at: Date.now(),
          method,
          path: diagnosticPath,
          transport: "web",
          attempt: nativeAttempts + 1,
          status: res.status,
          category: res.ok ? "recovered" : "http",
          message: res.ok
            ? "request recovered with fallback transport"
            : `HTTP ${res.status}`,
        });
        return {
          ok: res.ok,
          status: res.status,
          text: await res.text().catch(() => ""),
          requestId,
        };
      } catch (error) {
        lastError = error;
        recordManagedRequestDiagnostic({
          at: Date.now(),
          method,
          path: diagnosticPath,
          transport: "web",
          attempt: nativeAttempts + 1,
          category: diagnosticCategory(error),
          message: diagnosticErrorMessage(error),
        });
        if (isAbortError(error)) throw error;
      }
    }
  } else {
    try {
      const res = await fetch(url, {
        ...init,
        headers,
        // The material/prompt sync callers use ETag themselves. Do not let a
        // WebView cache answer an activation without asking the server for
        // the current manifest; unchanged bytes still remain local in IDB.
        cache: "no-store",
      });
      return {
        ok: res.ok,
        status: res.status,
        text: await res.text().catch(() => ""),
        requestId,
      };
    } catch (error) {
      lastError = error;
      recordManagedRequestDiagnostic({
        at: Date.now(),
        method,
        path: diagnosticPath,
        transport: "web",
        attempt: 1,
        category: diagnosticCategory(error),
        message: diagnosticErrorMessage(error),
      });
      if (isAbortError(error)) throw error;
    }
  }

  if (native || lastError) {
    const category = diagnosticCategory(lastError);
    const label =
      category === "timeout"
        ? getManagedMobileText().errors.requestTimeout
        : category === "offline"
        ? getManagedMobileText().errors.offline
        : getManagedMobileText().errors.networkFailed;
    throw new ManagedTransportError(
      formatManagedMobileError({
        message: label,
        category,
        requestId,
      }),
      category,
      diagnosticPath,
      requestId,
      { cause: lastError },
    );
  }
  throw lastError;
}

export function isManagedTotpLogin(
  data: ManagedAuthResponse | ManagedTotpLoginResponse,
): data is ManagedTotpLoginResponse {
  return !!(data as ManagedTotpLoginResponse)?.requires_2fa;
}

export async function managedJsonRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  accessToken?: string,
) {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", getManagedMobileText().dateLocale);
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await managedRequestText(baseUrl, path, init, headers);
  const bodyText = res.text;
  const payload = bodyText
    ? (() => {
        try {
          return JSON.parse(bodyText) as ManagedEnvelope<T>;
        } catch {
          return null;
        }
      })()
    : null;
  if (!res.ok || !payload || payload.code !== 0) {
    const category = !res.ok ? "http" : "api";
    const errorCode = payload?.metadata?.error_code;
    throw new ManagedApiError(
      formatManagedMobileError({
        message: payload?.message || bodyText,
        status: res.status,
        path,
        code: payload?.code,
        errorCode,
        category,
        requestId: res.requestId,
      }),
      res.status,
      path,
      payload?.code,
      res.requestId,
      category,
      payload?.metadata,
    );
  }
  return payload.data as T;
}

/** Download an authenticated binary from the managed backend. This is used
 * for private mobile video results because a HTMLMediaElement cannot attach
 * the Bearer header itself. Callers own the returned object URL lifecycle. */
export async function managedDownloadBlob(
  baseUrl: string,
  path: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  const target = /^https?:\/\//i.test(path)
    ? path
    : managedApiUrl(baseUrl, path);
  const headers: Record<string, string> = {
    // The same authenticated helper is used for video results and the
    // account-scoped material library (images, audio, documents, and video).
    // Do not advertise only video here or a content-negotiating object store
    // may return the wrong representation for non-video materials.
    Accept: "*/*",
  };
  // Never forward the managed account token to a provider-owned host. Mobile
  // results are expected to use the authenticated relative content endpoint;
  // an absolute URL is only safe when it is already a same-origin backend URL.
  if (!/^https?:\/\//i.test(path)) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else {
    try {
      if (
        new URL(target).origin ===
        new URL(normalizeManagedBaseUrl(baseUrl)).origin
      ) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch {
      // Invalid external URLs will be rejected by fetch without credentials.
    }
  }
  const response = await fetch(target, {
    method: "GET",
    headers,
    signal,
  });
  if (!response.ok) {
    throw new ManagedApiError(
      `managed binary request failed: HTTP ${response.status}`,
      response.status,
      path,
      undefined,
      "unknown",
      "http",
    );
  }
  return response.blob();
}

export function loginManagedUser(
  baseUrl: string,
  email: string,
  password: string,
) {
  return managedJsonRequest<ManagedAuthResponse | ManagedTotpLoginResponse>(
    baseUrl,
    "/api/v1/auth/mobile/login",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );
}

export function loginManagedUser2FA(
  baseUrl: string,
  tempToken: string,
  totpCode: string,
) {
  return managedJsonRequest<ManagedAuthResponse>(
    baseUrl,
    "/api/v1/auth/login/2fa",
    {
      method: "POST",
      body: JSON.stringify({
        temp_token: tempToken,
        totp_code: totpCode,
      }),
    },
  );
}

export function refreshManagedToken(baseUrl: string, refreshToken: string) {
  return managedJsonRequest<ManagedAuthResponse>(
    baseUrl,
    "/api/v1/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    },
  );
}

export function logoutManagedUser(baseUrl: string, refreshToken?: string) {
  return managedJsonRequest<{ message: string }>(
    baseUrl,
    "/api/v1/auth/logout",
    {
      method: "POST",
      body: JSON.stringify({
        refresh_token: refreshToken || "",
      }),
    },
  );
}

export function getManagedMobileBootstrap(
  baseUrl: string,
  accessToken: string,
) {
  return managedJsonRequest<ManagedMobileBootstrap>(
    baseUrl,
    "/api/v1/nextchat/mobile/bootstrap",
    { method: "GET" },
    accessToken,
  ).then(normalizeManagedMobileBootstrap);
}

export function switchManagedMobileGroup(
  baseUrl: string,
  accessToken: string,
  groupID: number,
) {
  return managedJsonRequest<ManagedMobileBootstrap>(
    baseUrl,
    "/api/v1/nextchat/mobile/group",
    {
      method: "POST",
      body: JSON.stringify({
        group_id: groupID,
      }),
    },
    accessToken,
  ).then(normalizeManagedMobileBootstrap);
}

export function switchManagedMobileSessionGroup(
  baseUrl: string,
  accessToken: string,
  purpose: "chat" | "image" | "video",
  groupID: number,
) {
  return managedJsonRequest<ManagedMobileBootstrap>(
    baseUrl,
    `/api/v1/nextchat/mobile/sessions/${purpose}/group`,
    {
      method: "POST",
      body: JSON.stringify({ group_id: groupID }),
    },
    accessToken,
  ).then(normalizeManagedMobileBootstrap);
}

export function switchManagedMobileSessionGroupV1(
  baseUrl: string,
  accessToken: string,
  purpose: "chat" | "image" | "video",
  groupID: number,
) {
  return managedJsonRequest<ManagedMobileBootstrap>(
    baseUrl,
    `/api/v1/mobile/sessions/${purpose}/switch-group`,
    {
      method: "POST",
      body: JSON.stringify({ group_id: groupID }),
    },
    accessToken,
  ).then(normalizeManagedMobileBootstrap);
}

export async function switchManagedImageGroupCompatible(
  baseUrl: string,
  accessToken: string,
  groupID: number,
) {
  try {
    return await switchManagedMobileSessionGroupV1(
      baseUrl,
      accessToken,
      "image",
      groupID,
    );
  } catch (error) {
    if (!(error instanceof ManagedApiError) || error.status !== 404) {
      throw error;
    }
  }
  try {
    return await switchManagedMobileSessionGroup(
      baseUrl,
      accessToken,
      "image",
      groupID,
    );
  } catch (error) {
    if (!(error instanceof ManagedApiError) || error.status !== 404) {
      throw error;
    }
    return switchManagedMobileGroup(baseUrl, accessToken, groupID);
  }
}

export async function switchManagedChatGroupCompatible(
  baseUrl: string,
  accessToken: string,
  groupID: number,
) {
  try {
    return await switchManagedMobileSessionGroupV1(
      baseUrl,
      accessToken,
      "chat",
      groupID,
    );
  } catch (error) {
    if (!(error instanceof ManagedApiError) || error.status !== 404) {
      throw error;
    }
  }
  try {
    return await switchManagedMobileSessionGroup(
      baseUrl,
      accessToken,
      "chat",
      groupID,
    );
  } catch (error) {
    if (!(error instanceof ManagedApiError) || error.status !== 404) {
      throw error;
    }
    return switchManagedMobileGroup(baseUrl, accessToken, groupID);
  }
}

export async function switchManagedVideoGroupCompatible(
  baseUrl: string,
  accessToken: string,
  groupID: number,
) {
  try {
    return await switchManagedMobileSessionGroupV1(
      baseUrl,
      accessToken,
      "video",
      groupID,
    );
  } catch (error) {
    if (!(error instanceof ManagedApiError) || error.status !== 404)
      throw error;
  }
  return switchManagedMobileSessionGroup(
    baseUrl,
    accessToken,
    "video",
    groupID,
  );
}

/**
 * A response is eligible for immediate application only when the server has
 * proved that the target purpose now uses a replacement key pinned to the
 * requested group. Older command responses are deliberately re-bootstrapped
 * rather than allowed to overwrite the other media sessions.
 */
export function isGroupPinnedManagedSessionSwitch(
  bootstrap: ManagedMobileBootstrap | null | undefined,
  purpose: "chat" | "image" | "video",
  groupID: number,
) {
  const session = bootstrap?.sessions?.[purpose];
  return Boolean(
    bootstrap?.session_binding === "group-pinned-v1" &&
      session?.binding === "group-pinned-v1" &&
      session?.purpose === purpose &&
      session?.group_id === groupID &&
      session.api_key &&
      session.api_key_id > 0,
  );
}

export function flattenManagedModels(
  workspaceModels?: ManagedWorkspaceModels,
): LLMModel[] {
  const groups = workspaceModels?.groups ?? [];
  const models: LLMModel[] = [];
  groups.forEach((group, groupIndex) => {
    (group.models ?? []).forEach((model, modelIndex) => {
      models.push({
        name: managedWorkspaceModelID(model),
        displayName: model.display_name || model.name || model.id,
        available: true,
        sorted: model.sort_order ?? groupIndex * 100 + modelIndex,
        provider: {
          id: `managed-${group.id}`,
          providerName: ServiceProvider.OpenAI,
          providerType: "openai",
          sorted: group.sort_order ?? groupIndex,
        },
      });
    });
  });
  return models;
}

export function pickManagedDefaultModel(
  workspaceModels?: ManagedWorkspaceModels,
) {
  if (workspaceModels?.default_model) {
    return workspaceModels.default_model;
  }
  const currentGroup = (workspaceModels?.groups ?? []).find(
    (group) => group.is_current,
  );
  const firstModel =
    currentGroup?.models?.[0] ?? workspaceModels?.groups?.[0]?.models?.[0];
  return managedWorkspaceModelID(firstModel) || "gpt-4o-mini";
}
