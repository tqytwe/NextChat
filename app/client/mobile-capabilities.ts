import type { MobileAdminCapabilities, MobileProtocol } from "./mobile-platform";

export type ResolvedMobileAdminCapability = {
  available: boolean;
  apiBasePath: string;
  stepUpPath: string;
};

const NO_ADMIN_CAPABILITY: ResolvedMobileAdminCapability = {
  available: false,
  apiBasePath: "",
  stepUpPath: "",
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
  };
}

function cleanPath(value: unknown) {
  const path = typeof value === "string" ? value.trim() : "";
  return path.startsWith("/api/v1/") ? path : "";
}

export function isMobileAdminAvailable(
  protocol?: Pick<MobileProtocol, "capabilities"> | null,
) {
  return resolveMobileAdminCapability(protocol).available;
}
