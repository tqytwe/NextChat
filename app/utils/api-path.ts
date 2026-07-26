import { getClientConfig } from "../config/client";

export function withBasePath(path: string): string {
  if (!path.startsWith("/")) return path;
  const basePath = getClientConfig()?.basePath ?? "";
  if (!basePath || path === basePath || path.startsWith(`${basePath}/`)) {
    return path;
  }
  return `${basePath}${path}`;
}
