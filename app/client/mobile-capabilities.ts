import type {
  MobileAdminCapabilities,
  MobileProtocol,
} from "./mobile-platform";

export const CANONICAL_MOBILE_ADMIN_API_BASE_PATH = "/api/v1/admin";
export const CANONICAL_MOBILE_ADMIN_STEP_UP_PATH = "/api/v1/user/totp/step-up";
export const CANONICAL_MOBILE_ADMIN_COMPLIANCE_PATH =
  "/api/v1/admin/compliance";

export type ResolvedMobileAdminCapability = {
  available: boolean;
  apiBasePath: string;
  stepUpPath: string;
  compliancePath: string;
  writeOperations: string[];
};

const NO_ADMIN_CAPABILITY: ResolvedMobileAdminCapability = {
  available: false,
  apiBasePath: "",
  stepUpPath: "",
  compliancePath: "",
  writeOperations: [],
};

/**
 * Resolves admin access only from the explicit server capability contract.
 * In particular, `session.role`, email addresses, and client-side defaults
 * are intentionally ignored so an older or incomplete server is fail-closed.
 */
export function resolveMobileAdminCapability(
  protocol?: Pick<MobileProtocol, "capabilities"> | null,
): ResolvedMobileAdminCapability {
  const admin = protocol?.capabilities?.admin as
    | MobileAdminCapabilities
    | undefined;
  if (admin?.available !== true) return NO_ADMIN_CAPABILITY;

  return {
    available: true,
    apiBasePath: cleanPath(admin.api_base_path),
    stepUpPath: cleanPath(admin.step_up_path),
    compliancePath: cleanPath(admin.compliance_path),
    writeOperations: Array.isArray(admin.write_operations)
      ? admin.write_operations.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };
}

function cleanPath(value: unknown) {
  const path = typeof value === "string" ? value.trim() : "";
  return path.startsWith("/api/v1/") ? path : "";
}

export function isMobileAdminAvailable(
  protocol?: Pick<MobileProtocol, "capabilities"> | null,
) {
  const capability = resolveMobileAdminCapability(protocol);
  return (
    capability.available &&
    capability.apiBasePath === CANONICAL_MOBILE_ADMIN_API_BASE_PATH &&
    capability.stepUpPath === CANONICAL_MOBILE_ADMIN_STEP_UP_PATH
  );
}

/**
 * Compliance is intentionally an opt-in extension to the admin capability.
 * A server that has not published this exact path must keep the historical
 * read-only admin experience working rather than receiving a speculative
 * `/admin/compliance` request from a newer APK.
 */
export function isMobileAdminComplianceAvailable(
  protocol?: Pick<MobileProtocol, "capabilities"> | null,
) {
  const capability = resolveMobileAdminCapability(protocol);
  return (
    isMobileAdminAvailable(protocol) &&
    capability.compliancePath === CANONICAL_MOBILE_ADMIN_COMPLIANCE_PATH
  );
}

/**
 * Web search is a server-owned model tool. The client only exposes it when
 * the protocol declares a canonical, enabled service; model-specific support
 * is checked separately from the workspace catalog at send time.
 */
export function isMobileWebSearchAvailable(
  protocol?: Pick<MobileProtocol, "capabilities"> | null,
) {
  const search = protocol?.capabilities?.search;
  return Boolean(
    search?.configured === true &&
      search.execution_state === "canonical" &&
      search.default_enabled === true &&
      search.model_tool_call_required === true,
  );
}
