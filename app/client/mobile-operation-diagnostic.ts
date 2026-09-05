export type MobileOperationDiagnostic = {
  operation: string;
  clientRequestId: string;
  requestId: string;
  status: number;
  code: string;
  groupId?: number;
  modelId?: string;
  purpose?: "chat" | "image" | "video";
  apiKeyId?: number;
  phase?: string;
  accepted?: boolean;
};

export type ParsedMobileOperationError = {
  message: string;
  code: string;
  requestId: string;
  retryAfterSeconds?: number;
};

const MOBILE_OPERATION_DIAGNOSTICS_KEY =
  "jisudeng-mobile-operation-diagnostics-v1";
const MAX_MOBILE_OPERATION_DIAGNOSTICS = 48;

function sanitizeDiagnostic(
  input: MobileOperationDiagnostic,
): MobileOperationDiagnostic {
  return {
    operation: String(input.operation || "unknown").slice(0, 80),
    clientRequestId: String(input.clientRequestId || "unknown").slice(0, 256),
    requestId: String(input.requestId || "unknown").slice(0, 256),
    status: Number.isFinite(Number(input.status)) ? Number(input.status) : 0,
    code: String(input.code || "").slice(0, 80),
    groupId: Number.isFinite(Number(input.groupId))
      ? Number(input.groupId)
      : undefined,
    modelId: input.modelId ? String(input.modelId).slice(0, 160) : undefined,
    purpose: input.purpose,
    apiKeyId: Number.isFinite(Number(input.apiKeyId))
      ? Number(input.apiKeyId)
      : undefined,
    phase: input.phase ? String(input.phase).slice(0, 80) : undefined,
    accepted:
      input.accepted === true
        ? true
        : input.accepted === false
        ? false
        : undefined,
  };
}

/**
 * Stores only the minimal correlation tuple needed by feedback/support. It
 * intentionally rejects request bodies, credentials and provider responses.
 */
export function recordMobileOperationDiagnostic(
  input: MobileOperationDiagnostic,
) {
  if (typeof window === "undefined") return;
  try {
    const current = JSON.parse(
      window.localStorage.getItem(MOBILE_OPERATION_DIAGNOSTICS_KEY) || "[]",
    );
    const items = Array.isArray(current) ? current : [];
    window.localStorage.setItem(
      MOBILE_OPERATION_DIAGNOSTICS_KEY,
      JSON.stringify(
        [sanitizeDiagnostic(input), ...items].slice(
          0,
          MAX_MOBILE_OPERATION_DIAGNOSTICS,
        ),
      ),
    );
  } catch {
    // Diagnostics are never allowed to break a creation request.
  }
}

export function getMobileOperationDiagnostics(limit = 24) {
  if (typeof window === "undefined") return [] as MobileOperationDiagnostic[];
  try {
    const current = JSON.parse(
      window.localStorage.getItem(MOBILE_OPERATION_DIAGNOSTICS_KEY) || "[]",
    );
    return (Array.isArray(current) ? current : [])
      .slice(0, Math.max(0, limit))
      .map((item) => sanitizeDiagnostic(item as MobileOperationDiagnostic));
  } catch {
    return [] as MobileOperationDiagnostic[];
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Normalizes gateway and OpenAI-compatible error envelopes without retaining
 * request content or credentials. UI policy must branch on `code`, not text.
 */
export function parseMobileOperationError(
  responseText: string,
  fallbackRequestId = "unknown",
): ParsedMobileOperationError {
  let message = String(responseText || "").trim();
  let code = "";
  let requestId = fallbackRequestId;
  let retryAfterSeconds: number | undefined;
  try {
    const payload = asRecord(JSON.parse(responseText));
    const error = asRecord(payload?.error);
    const metadata = asRecord(payload?.metadata);
    message =
      text(error?.message) ||
      text(payload?.message) ||
      text(payload?.error) ||
      message;
    code =
      text(error?.code) ||
      text(error?.type) ||
      text(payload?.code) ||
      text(metadata?.error_code);
    requestId =
      text(payload?.request_id) ||
      text(payload?.requestId) ||
      text(metadata?.request_id) ||
      text(payload?.instance) ||
      requestId;
    const retryAfter = Number(
      payload?.retry_after ?? metadata?.retry_after ?? error?.retry_after,
    );
    if (Number.isFinite(retryAfter) && retryAfter >= 0) {
      retryAfterSeconds = retryAfter;
    }
  } catch {
    // A plain upstream response still has the supplied platform request ID.
  }
  return { message, code, requestId, retryAfterSeconds };
}

export function mobileOperationErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const match = message.match(/(?:^|,\s*)([A-Z][A-Z0-9_.:-]{2,80})(?:,|\))/);
  return match?.[1] || "";
}
