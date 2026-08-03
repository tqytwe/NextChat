import {
  ManagedApiError,
  ManagedTransportError,
  managedJsonRequest,
} from "./managed-nextchat";
import { resolveMobileAdminCapability } from "./mobile-capabilities";
import type { MobileProtocol } from "./mobile-platform";

const CANONICAL_ADMIN_API_BASE_PATH = "/api/v1/admin";
const CANONICAL_ADMIN_STEP_UP_PATH = "/api/v1/user/totp/step-up";

/**
 * Deliberately small allowlist for the mobile administrator overview. The
 * server remains the permission boundary; this prevents a future UI from
 * accidentally turning this client into an unrestricted admin proxy.
 */
export const MOBILE_ADMIN_READ_PATHS = {
  dashboardSnapshot: "/dashboard/snapshot-v2",
  users: "/users",
  paymentDashboard: "/payment/dashboard",
  orders: "/payment/orders",
  groups: "/groups",
  modelCatalog: "/model-catalog",
  usage: "/usage",
  cleanupTasks: "/usage/cleanup-tasks",
  withdrawals: "/withdrawals",
  refundRequests: "/funds/refund-requests",
  auditLogs: "/audit-logs",
} as const;

const MOBILE_ADMIN_USER_READ_PATHS = {
  walletHistory: "/balance-history",
  walletReconciliation: "/balance-reconciliation",
} as const;

export type MobileAdminReadEndpoint =
  (typeof MOBILE_ADMIN_READ_PATHS)[keyof typeof MOBILE_ADMIN_READ_PATHS];

export type MobileAdminQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined;
export type MobileAdminQuery = Record<string, MobileAdminQueryValue>;

export interface MobileAdminClient {
  baseUrl: string;
  accessToken: string;
  mobileProtocol?: Pick<MobileProtocol, "capabilities"> | null;
}

export interface MobileAdminRequestOptions {
  /**
   * Shared by X-Request-ID and X-Client-Request-ID so support can correlate
   * this request with server-side audit and Ops records.
   */
  requestId?: string;
  signal?: AbortSignal | null;
  locale?: string;
}

export interface MobileAdminRequestResult<T> {
  data: T;
  requestId: string;
}

export interface MobileAdminPage<T = Record<string, unknown>> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface MobileAdminStepUpResult {
  verified: boolean;
  expires_in: number;
}

export type MobileAdminErrorCategory =
  | "capability"
  | "input"
  | ManagedApiError["category"]
  | ManagedTransportError["category"]
  | "unknown";

/**
 * A local rejection is still traceable and distinguishable from a server or
 * network error. It is used before any potentially privileged request leaves
 * the device.
 */
export class MobileAdminClientError extends Error {
  readonly name = "MobileAdminClientError";

  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly code: string,
    readonly requestId: string,
    readonly category: "capability" | "input",
  ) {
    super(message);
  }
}

export type MobileAdminRequestError =
  | MobileAdminClientError
  | ManagedApiError
  | ManagedTransportError;

export function isMobileAdminClientError(
  error: unknown,
): error is MobileAdminClientError {
  return error instanceof MobileAdminClientError;
}

export function mobileAdminErrorCategory(
  error: unknown,
): MobileAdminErrorCategory {
  if (error instanceof MobileAdminClientError) return error.category;
  if (error instanceof ManagedApiError) return error.category;
  if (error instanceof ManagedTransportError) return error.category;
  return "unknown";
}

export function mobileAdminRequestId(error: unknown) {
  if (
    error instanceof MobileAdminClientError ||
    error instanceof ManagedApiError ||
    error instanceof ManagedTransportError
  ) {
    return error.requestId;
  }
  return "unknown";
}

function createMobileAdminRequestId() {
  return `mobile-admin-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function resolveRequestId(options?: MobileAdminRequestOptions) {
  return options?.requestId?.trim() || createMobileAdminRequestId();
}

function appendQuery(path: string, query?: MobileAdminQuery) {
  if (!query) return path;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

function encodeAdminUserID(
  userId: number | string,
  path: string,
  requestId: string,
) {
  const value = String(userId).trim();
  if (!/^[1-9]\d*$/.test(value)) {
    throw localAdminError(
      "A positive administrator user ID is required.",
      path,
      requestId,
      "ADMIN_USER_ID_INVALID",
      "input",
    );
  }
  return encodeURIComponent(value);
}

function requestInit(
  method: "GET" | "POST",
  requestId: string,
  options?: MobileAdminRequestOptions,
  body?: unknown,
): RequestInit {
  const headers = new Headers({
    "X-Request-ID": requestId,
    "X-Client-Request-ID": requestId,
  });
  if (options?.locale?.trim()) {
    headers.set("Accept-Language", options.locale.trim());
  }
  return {
    method,
    headers,
    signal: options?.signal ?? undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function localAdminError(
  message: string,
  path: string,
  requestId: string,
  code: string,
  category: "capability" | "input",
  status = category === "capability" ? 403 : 400,
) {
  return new MobileAdminClientError(
    message,
    status,
    path,
    code,
    requestId,
    category,
  );
}

function resolveAdminBasePath(
  client: MobileAdminClient,
  relativePath: string,
  requestId: string,
) {
  const fallbackPath = `${CANONICAL_ADMIN_API_BASE_PATH}${relativePath}`;
  const capability = resolveMobileAdminCapability(client.mobileProtocol);
  if (!capability.available) {
    throw localAdminError(
      "Administrator access is unavailable for this session.",
      fallbackPath,
      requestId,
      "ADMIN_CAPABILITY_UNAVAILABLE",
      "capability",
    );
  }
  if (capability.apiBasePath !== CANONICAL_ADMIN_API_BASE_PATH) {
    throw localAdminError(
      "The server did not provide a supported administrator API path.",
      fallbackPath,
      requestId,
      "ADMIN_CAPABILITY_INVALID",
      "capability",
    );
  }
  if (!client.accessToken.trim()) {
    throw localAdminError(
      "Administrator authentication is required.",
      fallbackPath,
      requestId,
      "ADMIN_AUTH_TOKEN_REQUIRED",
      "capability",
      401,
    );
  }
  return `${capability.apiBasePath}${relativePath}`;
}

function resolveStepUpPath(client: MobileAdminClient, requestId: string) {
  const capability = resolveMobileAdminCapability(client.mobileProtocol);
  if (!capability.available) {
    throw localAdminError(
      "Administrator access is unavailable for this session.",
      CANONICAL_ADMIN_STEP_UP_PATH,
      requestId,
      "ADMIN_CAPABILITY_UNAVAILABLE",
      "capability",
    );
  }
  if (capability.stepUpPath !== CANONICAL_ADMIN_STEP_UP_PATH) {
    throw localAdminError(
      "The server did not provide a supported administrator step-up path.",
      CANONICAL_ADMIN_STEP_UP_PATH,
      requestId,
      "ADMIN_STEP_UP_CAPABILITY_INVALID",
      "capability",
    );
  }
  if (!client.accessToken.trim()) {
    throw localAdminError(
      "Administrator authentication is required.",
      CANONICAL_ADMIN_STEP_UP_PATH,
      requestId,
      "ADMIN_AUTH_TOKEN_REQUIRED",
      "capability",
      401,
    );
  }
  return capability.stepUpPath;
}

/**
 * Sends one allowlisted, read-only canonical admin request. There is no
 * mutation escape hatch here; future write flows must receive their own
 * reviewed contract, idempotency policy, and step-up handling.
 */
export async function requestMobileAdminRead<T>(
  client: MobileAdminClient,
  endpoint: MobileAdminReadEndpoint,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
): Promise<MobileAdminRequestResult<T>> {
  const requestId = resolveRequestId(options);
  const path = appendQuery(
    resolveAdminBasePath(client, endpoint, requestId),
    query,
  );
  const data = await managedJsonRequest<T>(
    client.baseUrl,
    path,
    requestInit("GET", requestId, options),
    client.accessToken,
  );
  return { data, requestId };
}

export function getMobileAdminDashboardSnapshot<T = Record<string, unknown>>(
  client: MobileAdminClient,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<T>(
    client,
    MOBILE_ADMIN_READ_PATHS.dashboardSnapshot,
    undefined,
    options,
  );
}

export function listMobileAdminUsers<T = Record<string, unknown>>(
  client: MobileAdminClient,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<MobileAdminPage<T>>(
    client,
    MOBILE_ADMIN_READ_PATHS.users,
    query,
    options,
  );
}

/**
 * There is no global `/admin/wallet` route. This canonical payment dashboard
 * is the safe aggregate wallet/settlement overview exposed by the backend.
 */
export function getMobileAdminPaymentDashboard<T = Record<string, unknown>>(
  client: MobileAdminClient,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<T>(
    client,
    MOBILE_ADMIN_READ_PATHS.paymentDashboard,
    query,
    options,
  );
}

/**
 * Customer wallet history is a per-user administrator route. A global
 * `/admin/wallet` route does not exist, so the client intentionally exposes
 * this scoped, auditable view instead of inventing a second API surface.
 */
export async function getMobileAdminUserWalletHistory<
  T = Record<string, unknown>,
>(
  client: MobileAdminClient,
  userId: number | string,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
): Promise<MobileAdminRequestResult<T>> {
  const requestId = resolveRequestId(options);
  const userPath = `/users/${encodeAdminUserID(
    userId,
    `${CANONICAL_ADMIN_API_BASE_PATH}/users/:id${MOBILE_ADMIN_USER_READ_PATHS.walletHistory}`,
    requestId,
  )}${MOBILE_ADMIN_USER_READ_PATHS.walletHistory}`;
  const path = appendQuery(
    resolveAdminBasePath(client, userPath, requestId),
    query,
  );
  const data = await managedJsonRequest<T>(
    client.baseUrl,
    path,
    requestInit("GET", requestId, options),
    client.accessToken,
  );
  return { data, requestId };
}

export async function getMobileAdminUserWalletReconciliation<
  T = Record<string, unknown>,
>(
  client: MobileAdminClient,
  userId: number | string,
  options?: MobileAdminRequestOptions,
): Promise<MobileAdminRequestResult<T>> {
  const requestId = resolveRequestId(options);
  const userPath = `/users/${encodeAdminUserID(
    userId,
    `${CANONICAL_ADMIN_API_BASE_PATH}/users/:id${MOBILE_ADMIN_USER_READ_PATHS.walletReconciliation}`,
    requestId,
  )}${MOBILE_ADMIN_USER_READ_PATHS.walletReconciliation}`;
  const path = resolveAdminBasePath(client, userPath, requestId);
  const data = await managedJsonRequest<T>(
    client.baseUrl,
    path,
    requestInit("GET", requestId, options),
    client.accessToken,
  );
  return { data, requestId };
}

export function listMobileAdminOrders<T = Record<string, unknown>>(
  client: MobileAdminClient,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<MobileAdminPage<T>>(
    client,
    MOBILE_ADMIN_READ_PATHS.orders,
    query,
    options,
  );
}

export function listMobileAdminGroups<T = Record<string, unknown>>(
  client: MobileAdminClient,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<MobileAdminPage<T>>(
    client,
    MOBILE_ADMIN_READ_PATHS.groups,
    query,
    options,
  );
}

export function listMobileAdminModelCatalog<T = Record<string, unknown>>(
  client: MobileAdminClient,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<T[]>(
    client,
    MOBILE_ADMIN_READ_PATHS.modelCatalog,
    query,
    options,
  );
}

export function listMobileAdminUsage<T = Record<string, unknown>>(
  client: MobileAdminClient,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<MobileAdminPage<T>>(
    client,
    MOBILE_ADMIN_READ_PATHS.usage,
    query,
    options,
  );
}

/**
 * The backend's only generic task-list route is for usage cleanup tasks.
 * Image and chat tasks belong to each user's mobile task history and are not
 * exposed as a global administrator task API.
 */
export function listMobileAdminUsageCleanupTasks<T = Record<string, unknown>>(
  client: MobileAdminClient,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<MobileAdminPage<T>>(
    client,
    MOBILE_ADMIN_READ_PATHS.cleanupTasks,
    query,
    options,
  );
}

export function listMobileAdminWithdrawals<T = Record<string, unknown>>(
  client: MobileAdminClient,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<MobileAdminPage<T>>(
    client,
    MOBILE_ADMIN_READ_PATHS.withdrawals,
    query,
    options,
  );
}

export function listMobileAdminRefundRequests<T = Record<string, unknown>>(
  client: MobileAdminClient,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<MobileAdminPage<T>>(
    client,
    MOBILE_ADMIN_READ_PATHS.refundRequests,
    query,
    options,
  );
}

export function listMobileAdminAuditLogs<T = Record<string, unknown>>(
  client: MobileAdminClient,
  query?: MobileAdminQuery,
  options?: MobileAdminRequestOptions,
) {
  return requestMobileAdminRead<MobileAdminPage<T>>(
    client,
    MOBILE_ADMIN_READ_PATHS.auditLogs,
    query,
    options,
  );
}

/**
 * Verifies a TOTP code for the current JWT session. The backend grants a
 * 15-minute step-up window; this helper intentionally does not replay any
 * privileged write because those writes are outside this read-only client.
 */
export async function verifyMobileAdminStepUp(
  client: MobileAdminClient,
  code: string,
  options?: MobileAdminRequestOptions,
): Promise<MobileAdminRequestResult<MobileAdminStepUpResult>> {
  const requestId = resolveRequestId(options);
  const path = resolveStepUpPath(client, requestId);
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    throw localAdminError(
      "A TOTP code is required.",
      path,
      requestId,
      "TOTP_CODE_REQUIRED",
      "input",
    );
  }
  const data = await managedJsonRequest<MobileAdminStepUpResult>(
    client.baseUrl,
    path,
    requestInit("POST", requestId, options, { code: normalizedCode }),
    client.accessToken,
  );
  return { data, requestId };
}
