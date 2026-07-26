import {
  ManagedApiError,
  ManagedEnvelope,
  managedApiUrl,
  managedJsonRequest,
  managedRequestText,
} from "./managed-nextchat";

export const MOBILE_PLATFORM_API_PREFIX = "/api/v1/mobile";

export type MobileLocale = "zh-CN" | "en-US" | string;
export type MobileId = number | string;
export type MobileSortOrder = "asc" | "desc";

export interface MobileRequestOptions {
  signal?: AbortSignal | null;
  headers?: HeadersInit;
}

export interface MobilePageQuery {
  cursor?: string;
  limit?: number;
  query?: string;
  locale?: MobileLocale;
  sort?: string;
  order?: MobileSortOrder;
}

export interface MobilePage<T> {
  items: T[];
  total?: number;
  cursor?: string;
  next_cursor?: string;
  has_more?: boolean;
}

export interface MobileLocalizedText {
  zh?: string;
  en?: string;
  default?: string;
}

export interface MobileDisplayFields {
  title?: string;
  title_zh?: string;
  title_en?: string;
  name?: string;
  name_zh?: string;
  name_en?: string;
  description?: string;
  description_zh?: string;
  description_en?: string;
  icon_url?: string;
  cover_url?: string;
  labels?: string[];
  localized?: MobileLocalizedText;
}

export type MobileAssetKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "file";

export type MobileAssetStatus = "uploading" | "ready" | "failed" | "deleted";

export interface MobileAsset extends MobileDisplayFields {
  id: string;
  kind: MobileAssetKind;
  status: MobileAssetStatus;
  content_type?: string;
  byte_size?: number;
  content_url?: string;
  original_name?: string;
  sha256?: string;
  width?: number;
  height?: number;
  duration_ms?: number;
  preview_url?: string;
  thumbnail_url?: string;
  source?: "upload" | "share" | "image_result" | "chat_export" | "voice";
  folder_id?: string;
  created_at: string;
  updated_at?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

export interface MobileAssetListQuery extends MobilePageQuery {
  kind?: MobileAssetKind;
  status?: MobileAssetStatus;
  page?: number;
  page_size?: number;
  folder_id?: string;
  source?: MobileAsset["source"];
}

export interface MobileAssetDeleteResult {
  id: string;
  deleted: boolean;
  message?: string;
}

export type MobileSkillStatus =
  | "available"
  | "installed"
  | "installing"
  | "failed"
  | "disabled";

export interface MobileSkillParameter {
  key: string;
  label: string;
  label_zh?: string;
  type: "string" | "number" | "boolean" | "select" | "textarea" | "file";
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string; label_zh?: string }>;
  default_value?: unknown;
}

export interface MobileSkillVersion {
  version: number;
  prompt_id: number;
  prompt_version: number;
  system_prompt?: string;
  input_schema?: Record<string, unknown>;
  examples?: Array<Record<string, unknown>>;
  tool_config?: Record<string, unknown>;
  model_policy?: Record<string, unknown>;
  consumption_note_zh?: string;
  changelog_zh?: string;
}

export interface MobileSkill extends MobileDisplayFields {
  id: number;
  slug: string;
  version?: MobileSkillVersion;
  installed: boolean;
  installed_version?: number;
  pinned?: boolean;
  last_used_at?: string;
  published_version?: number;
  category?: string;
  author?: string;
  tags?: string[];
  installed_at?: string;
  updated_at?: string;
  parameters?: MobileSkillParameter[];
  permissions?: string[];
  examples?: string[];
}

export interface MobileSkillListQuery extends MobilePageQuery {
  category?: string;
  status?: MobileSkillStatus;
  installed?: boolean;
}

export interface MobileSkillInstallRequest {
  version?: string;
  config?: Record<string, unknown>;
}

export interface MobileSkillUseRequest {
  input?: Record<string, unknown>;
  asset_ids?: string[];
  task_id?: string;
  locale?: MobileLocale;
}

export type MobileTaskKind = "chat" | "image" | "file";

export type MobileTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export interface MobileTaskInputMessage {
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  asset_ids?: string[];
}

export interface MobileTaskCreateRequest {
  kind: MobileTaskKind;
  operation: string;
  client_request_id: string;
  resource?: Record<string, unknown>;
  model?: string;
  skill_id?: string;
  title?: string;
  title_zh?: string;
  parameters?: Record<string, unknown>;
  asset_ids?: string[];
  group_id?: number;
  locale?: MobileLocale;
}

export interface MobileTask extends MobileDisplayFields {
  id: string;
  kind: MobileTaskKind;
  operation?: string;
  client_request_id?: string;
  resource?: Record<string, unknown>;
  status: MobileTaskStatus;
  progress?: number;
  model?: string;
  skill_id?: string;
  group_id?: number;
  asset_ids?: string[];
  result_asset_ids?: string[];
  result_preview?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellable?: boolean;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MobileTaskListQuery extends MobilePageQuery {
  kind?: MobileTaskKind;
  operation?: string;
  status?: MobileTaskStatus;
  skill_id?: string;
  asset_id?: string;
}

export interface MobileTaskActionRequest {
  reason?: string;
  client_request_id?: string;
}

export interface MobileTaskStatusRequest {
  status: MobileTaskStatus;
  progress?: number;
  resource?: { type: string; id: string };
  artifacts?: Array<Record<string, unknown>>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export interface MobileTaskRetryRequest {
  client_request_id?: string;
  overrides?: Partial<MobileTaskCreateRequest>;
}

export type MobileSupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_user"
  | "resolved"
  | "closed";

export interface MobileSupportTicket extends MobileDisplayFields {
  id: string;
  number?: string;
  status: MobileSupportTicketStatus;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  unread_count?: number;
  last_message_at?: string;
  created_at: string;
  updated_at?: string;
  closed_at?: string;
}

export interface MobileSupportMessage {
  id: number;
  feedback_id: number;
  sender_type: "user" | "support";
  content?: string;
  content_zh?: string;
  asset_ids?: string[];
  created_at: string;
  read_at?: string;
}

export interface MobileSupportTicketDetail extends MobileSupportTicket {
  messages: MobileSupportMessage[];
}

export interface MobileSupportTicketListQuery extends MobilePageQuery {
  status?: MobileSupportTicketStatus;
  category?: string;
}

export interface MobileSupportMessageRequest {
  content: string;
  asset_ids?: string[];
  client_message_id?: string;
}

export interface MobileSupportCloseRequest {
  reason?: string;
}

export interface MobileDeviceRegisterRequest {
  fcm_token: string;
  platform: "android" | "ios" | "web";
  app_version?: string;
  locale?: MobileLocale;
}

export interface MobileDevice {
  id: string;
  installation_id: string;
  platform: "android" | "ios" | "web";
  token_fingerprint: string;
  app_version?: string;
  locale?: MobileLocale;
  timezone?: string;
  push_provider: "fcm";
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

export interface MobileDeviceDeleteResult {
  id: string;
  deleted: boolean;
}

export interface MobileDiagnosticInput {
  installation_id?: string;
  operation:
    | "sync"
    | "chat"
    | "image"
    | "file"
    | "payment"
    | "support"
    | "other";
  category:
    | "network"
    | "timeout"
    | "http"
    | "server"
    | "client"
    | "cancelled"
    | "other";
  path: string;
  status_code?: number;
  network_type: "wifi" | "cellular" | "ethernet" | "offline" | "unknown";
  duration_ms?: number;
  retry_count?: number;
  app_version?: string;
  occurred_at?: string;
  metadata?: Record<string, boolean | number | string>;
}

function mobileApiPath(path: string) {
  return `${MOBILE_PLATFORM_API_PREFIX}/${path.replace(/^\/+/, "")}`;
}

function encodePathId(id: MobileId) {
  return encodeURIComponent(String(id));
}

function appendQuery(path: string, query?: object) {
  if (!query) return path;
  const params = new URLSearchParams();
  Object.entries(query as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)));
      return;
    }
    params.set(key, String(value));
  });
  const queryText = params.toString();
  return queryText ? `${path}?${queryText}` : path;
}

function jsonInit(
  method: string,
  body?: unknown,
  options?: MobileRequestOptions,
): RequestInit {
  const init: RequestInit = {
    method,
    signal: options?.signal ?? undefined,
    headers: options?.headers,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return init;
}

export function mobilePlatformJsonRequest<T>(
  baseUrl: string,
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  return managedJsonRequest<T>(baseUrl, mobileApiPath(path), init, accessToken);
}

export function mobilePlatformRequestText(
  baseUrl: string,
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return managedRequestText(baseUrl, mobileApiPath(path), init, headers);
}

export function listMobileAssets(
  baseUrl: string,
  accessToken: string,
  query?: MobileAssetListQuery,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobilePage<MobileAsset>>(
    baseUrl,
    accessToken,
    appendQuery("/assets", query),
    jsonInit("GET", undefined, options),
  );
}

export function getMobileAsset(
  baseUrl: string,
  accessToken: string,
  assetId: MobileId,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileAsset>(
    baseUrl,
    accessToken,
    `/assets/${encodePathId(assetId)}`,
    jsonInit("GET", undefined, options),
  );
}

export function deleteMobileAsset(
  baseUrl: string,
  accessToken: string,
  assetId: MobileId,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileAssetDeleteResult>(
    baseUrl,
    accessToken,
    `/assets/${encodePathId(assetId)}`,
    jsonInit("DELETE", undefined, options),
  );
}

export async function uploadMobileAssetFormData(
  baseUrl: string,
  accessToken: string,
  formData: FormData,
  options?: MobileRequestOptions,
) {
  const path = mobileApiPath("/assets");
  const headers = new Headers(options?.headers);
  headers.set("Accept", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  const response = await fetch(managedApiUrl(baseUrl, path), {
    method: "POST",
    headers,
    body: formData,
    signal: options?.signal ?? undefined,
  });
  const bodyText = await response.text().catch(() => "");
  const payload = bodyText
    ? (() => {
        try {
          return JSON.parse(bodyText) as ManagedEnvelope<MobileAsset>;
        } catch {
          return null;
        }
      })()
    : null;
  if (!response.ok || !payload || payload.code !== 0) {
    throw new ManagedApiError(
      payload?.message || bodyText || `HTTP ${response.status}`,
      response.status,
      path,
      payload?.code,
    );
  }
  return payload.data as MobileAsset;
}

export function listMobileSkills(
  baseUrl: string,
  accessToken: string,
  query?: MobileSkillListQuery,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobilePage<MobileSkill>>(
    baseUrl,
    accessToken,
    appendQuery("/skills", query),
    jsonInit("GET", undefined, options),
  );
}

export function getMobileSkill(
  baseUrl: string,
  accessToken: string,
  skillSlug: MobileId,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileSkill>(
    baseUrl,
    accessToken,
    `/skills/${encodePathId(skillSlug)}`,
    jsonInit("GET", undefined, options),
  );
}

export function installMobileSkill(
  baseUrl: string,
  accessToken: string,
  skillSlug: MobileId,
  body: MobileSkillInstallRequest = {},
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileSkill>(
    baseUrl,
    accessToken,
    `/skills/${encodePathId(skillSlug)}/install`,
    jsonInit("POST", body, options),
  );
}

export function uninstallMobileSkill(
  baseUrl: string,
  accessToken: string,
  skillSlug: MobileId,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileSkill>(
    baseUrl,
    accessToken,
    `/skills/${encodePathId(skillSlug)}/install`,
    jsonInit("DELETE", undefined, options),
  );
}

export function invokeMobileSkill(
  baseUrl: string,
  accessToken: string,
  skillSlug: MobileId,
  body: MobileSkillUseRequest = {},
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileSkill>(
    baseUrl,
    accessToken,
    `/skills/${encodePathId(skillSlug)}/use`,
    jsonInit("POST", body, options),
  );
}

export function createMobileTask(
  baseUrl: string,
  accessToken: string,
  body: MobileTaskCreateRequest,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileTask>(
    baseUrl,
    accessToken,
    "/tasks",
    jsonInit("POST", body, options),
  );
}

export function listMobileTasks(
  baseUrl: string,
  accessToken: string,
  query?: MobileTaskListQuery,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobilePage<MobileTask>>(
    baseUrl,
    accessToken,
    appendQuery("/tasks", query),
    jsonInit("GET", undefined, options),
  );
}

export function getMobileTask(
  baseUrl: string,
  accessToken: string,
  taskId: MobileId,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileTask>(
    baseUrl,
    accessToken,
    `/tasks/${encodePathId(taskId)}`,
    jsonInit("GET", undefined, options),
  );
}

export function cancelMobileTask(
  baseUrl: string,
  accessToken: string,
  taskId: MobileId,
  body: MobileTaskActionRequest = {},
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileTask>(
    baseUrl,
    accessToken,
    `/tasks/${encodePathId(taskId)}/cancel`,
    jsonInit("POST", body, options),
  );
}

export function retryMobileTask(
  baseUrl: string,
  accessToken: string,
  taskId: MobileId,
  body: MobileTaskRetryRequest = {},
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileTask>(
    baseUrl,
    accessToken,
    `/tasks/${encodePathId(taskId)}/retry`,
    jsonInit("POST", body, options),
  );
}

export function updateMobileTaskStatus(
  baseUrl: string,
  accessToken: string,
  taskId: MobileId,
  body: MobileTaskStatusRequest,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileTask>(
    baseUrl,
    accessToken,
    `/tasks/${encodePathId(taskId)}/status`,
    jsonInit("POST", body, options),
  );
}

export function submitMobileDiagnostic(
  baseUrl: string,
  accessToken: string,
  body: MobileDiagnosticInput,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<{ accepted: boolean }>(
    baseUrl,
    accessToken,
    "/diagnostics",
    jsonInit("POST", body, options),
  );
}

export function listMobileSupportTickets(
  baseUrl: string,
  accessToken: string,
  query?: MobileSupportTicketListQuery,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobilePage<MobileSupportTicket>>(
    baseUrl,
    accessToken,
    appendQuery("/support/tickets", query),
    jsonInit("GET", undefined, options),
  );
}

export function getMobileSupportTicket(
  baseUrl: string,
  accessToken: string,
  ticketId: MobileId,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileSupportTicketDetail>(
    baseUrl,
    accessToken,
    `/support/tickets/${encodePathId(ticketId)}`,
    jsonInit("GET", undefined, options),
  );
}

export function messageMobileSupportTicket(
  baseUrl: string,
  accessToken: string,
  ticketId: MobileId,
  body: MobileSupportMessageRequest,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileSupportTicketDetail>(
    baseUrl,
    accessToken,
    `/support/tickets/${encodePathId(ticketId)}/messages`,
    jsonInit("POST", body, options),
  );
}

export function closeMobileSupportTicket(
  baseUrl: string,
  accessToken: string,
  ticketId: MobileId,
  body: MobileSupportCloseRequest = {},
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileSupportTicket>(
    baseUrl,
    accessToken,
    `/support/tickets/${encodePathId(ticketId)}/close`,
    jsonInit("POST", body, options),
  );
}

export function registerMobileDevice(
  baseUrl: string,
  accessToken: string,
  installationId: MobileId,
  body: MobileDeviceRegisterRequest,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileDevice>(
    baseUrl,
    accessToken,
    `/devices/${encodePathId(installationId)}`,
    jsonInit("PUT", body, options),
  );
}

export function deleteMobileDevice(
  baseUrl: string,
  accessToken: string,
  deviceId: MobileId,
  options?: MobileRequestOptions,
) {
  return mobilePlatformJsonRequest<MobileDeviceDeleteResult>(
    baseUrl,
    accessToken,
    `/devices/${encodePathId(deviceId)}`,
    jsonInit("DELETE", undefined, options),
  );
}

export function createMobilePlatformClient(
  baseUrl: string,
  accessToken: string,
) {
  return {
    assets: {
      list: (query?: MobileAssetListQuery, options?: MobileRequestOptions) =>
        listMobileAssets(baseUrl, accessToken, query, options),
      detail: (assetId: MobileId, options?: MobileRequestOptions) =>
        getMobileAsset(baseUrl, accessToken, assetId, options),
      delete: (assetId: MobileId, options?: MobileRequestOptions) =>
        deleteMobileAsset(baseUrl, accessToken, assetId, options),
      upload: (formData: FormData, options?: MobileRequestOptions) =>
        uploadMobileAssetFormData(baseUrl, accessToken, formData, options),
    },
    skills: {
      list: (query?: MobileSkillListQuery, options?: MobileRequestOptions) =>
        listMobileSkills(baseUrl, accessToken, query, options),
      detail: (skillSlug: MobileId, options?: MobileRequestOptions) =>
        getMobileSkill(baseUrl, accessToken, skillSlug, options),
      install: (
        skillSlug: MobileId,
        body?: MobileSkillInstallRequest,
        options?: MobileRequestOptions,
      ) => installMobileSkill(baseUrl, accessToken, skillSlug, body, options),
      uninstall: (skillSlug: MobileId, options?: MobileRequestOptions) =>
        uninstallMobileSkill(baseUrl, accessToken, skillSlug, options),
      use: (
        skillSlug: MobileId,
        body?: MobileSkillUseRequest,
        options?: MobileRequestOptions,
      ) => invokeMobileSkill(baseUrl, accessToken, skillSlug, body, options),
    },
    tasks: {
      create: (body: MobileTaskCreateRequest, options?: MobileRequestOptions) =>
        createMobileTask(baseUrl, accessToken, body, options),
      list: (query?: MobileTaskListQuery, options?: MobileRequestOptions) =>
        listMobileTasks(baseUrl, accessToken, query, options),
      detail: (taskId: MobileId, options?: MobileRequestOptions) =>
        getMobileTask(baseUrl, accessToken, taskId, options),
      cancel: (
        taskId: MobileId,
        body?: MobileTaskActionRequest,
        options?: MobileRequestOptions,
      ) => cancelMobileTask(baseUrl, accessToken, taskId, body, options),
      retry: (
        taskId: MobileId,
        body?: MobileTaskRetryRequest,
        options?: MobileRequestOptions,
      ) => retryMobileTask(baseUrl, accessToken, taskId, body, options),
      status: (
        taskId: MobileId,
        body: MobileTaskStatusRequest,
        options?: MobileRequestOptions,
      ) => updateMobileTaskStatus(baseUrl, accessToken, taskId, body, options),
    },
    support: {
      tickets: {
        list: (
          query?: MobileSupportTicketListQuery,
          options?: MobileRequestOptions,
        ) => listMobileSupportTickets(baseUrl, accessToken, query, options),
        detail: (ticketId: MobileId, options?: MobileRequestOptions) =>
          getMobileSupportTicket(baseUrl, accessToken, ticketId, options),
        message: (
          ticketId: MobileId,
          body: MobileSupportMessageRequest,
          options?: MobileRequestOptions,
        ) =>
          messageMobileSupportTicket(
            baseUrl,
            accessToken,
            ticketId,
            body,
            options,
          ),
        close: (
          ticketId: MobileId,
          body?: MobileSupportCloseRequest,
          options?: MobileRequestOptions,
        ) =>
          closeMobileSupportTicket(
            baseUrl,
            accessToken,
            ticketId,
            body,
            options,
          ),
      },
    },
    devices: {
      register: (
        installationId: MobileId,
        body: MobileDeviceRegisterRequest,
        options?: MobileRequestOptions,
      ) =>
        registerMobileDevice(
          baseUrl,
          accessToken,
          installationId,
          body,
          options,
        ),
      delete: (installationId: MobileId, options?: MobileRequestOptions) =>
        deleteMobileDevice(baseUrl, accessToken, installationId, options),
    },
    diagnostics: {
      submit: (body: MobileDiagnosticInput, options?: MobileRequestOptions) =>
        submitMobileDiagnostic(baseUrl, accessToken, body, options),
    },
  };
}
