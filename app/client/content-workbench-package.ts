import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { ManagedMobileContentKit } from "../store/mobile";

export const CONTENT_WORKBENCH_PACKAGE_VERSION = 1;
export const CONTENT_WORKBENCH_PACKAGE_MAX_BYTES = 128 * 1024 * 1024;
export const CONTENT_WORKBENCH_PACKAGE_MAX_FILE_BYTES = 32 * 1024 * 1024;

type PackageFile = { path: string; sha256: string; size: number };

export type ContentWorkbenchPackageManifest = {
  manifest_version: number;
  exported_at: string;
  project: ManagedMobileContentKit;
  files: PackageFile[];
};

export type ContentWorkbenchPackage = {
  project: ManagedMobileContentKit;
  files: Map<string, Blob>;
};

function safePath(value: string) {
  const path = String(value || "").replace(/\\/g, "/");
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("//")
  ) {
    throw new Error("Invalid project package path");
  }
  return path;
}

async function sha256(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

async function blobBytes(blob: Blob) {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

function packageFileName(path: string) {
  return path.split("/").pop() || "asset.bin";
}

/** Build a self-contained local project backup. Network data is never included. */
export async function exportContentWorkbenchPackage(input: {
  project: ManagedMobileContentKit;
  files?: Array<{ path: string; blob: Blob }>;
}): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  const files: PackageFile[] = [];
  for (const item of input.files || []) {
    const path = safePath(item.path);
    const bytes = await blobBytes(item.blob);
    if (bytes.byteLength > CONTENT_WORKBENCH_PACKAGE_MAX_FILE_BYTES) {
      throw new Error("Project package file is too large");
    }
    if (entries[path]) throw new Error("Duplicate project package path");
    entries[path] = bytes;
    files.push({ path, size: bytes.byteLength, sha256: await sha256(bytes) });
  }
  const manifest: ContentWorkbenchPackageManifest = {
    manifest_version: CONTENT_WORKBENCH_PACKAGE_VERSION,
    exported_at: new Date().toISOString(),
    project: input.project,
    files,
  };
  entries["manifest.json"] = strToU8(JSON.stringify(manifest));
  const archive = zipSync(entries, { level: 6 });
  if (archive.byteLength > CONTENT_WORKBENCH_PACKAGE_MAX_BYTES) {
    throw new Error("Project package is too large");
  }
  return new Blob([archive], { type: "application/zip" });
}

/** Reject traversal, duplicate entries and checksum mismatches before restoring anything. */
export async function importContentWorkbenchPackage(
  blob: Blob,
): Promise<ContentWorkbenchPackage> {
  if (
    !blob ||
    blob.size <= 0 ||
    blob.size > CONTENT_WORKBENCH_PACKAGE_MAX_BYTES
  ) {
    throw new Error("Project package is invalid or too large");
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(await blobBytes(blob));
  } catch {
    throw new Error("Project package is damaged");
  }
  const paths = Object.keys(entries);
  if (!paths.includes("manifest.json") || paths.length > 512) {
    throw new Error("Project package manifest is missing");
  }
  paths.forEach(safePath);
  let manifest: ContentWorkbenchPackageManifest;
  try {
    manifest = JSON.parse(
      strFromU8(entries["manifest.json"]),
    ) as ContentWorkbenchPackageManifest;
  } catch {
    throw new Error("Project package manifest is invalid");
  }
  if (
    manifest.manifest_version !== CONTENT_WORKBENCH_PACKAGE_VERSION ||
    !manifest.project ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error("Project package version is unsupported");
  }
  const files = new Map<string, Blob>();
  const expected = new Set<string>();
  for (const descriptor of manifest.files) {
    const path = safePath(descriptor.path);
    if (expected.has(path) || !entries[path])
      throw new Error("Project package is damaged");
    expected.add(path);
    const bytes = entries[path];
    if (
      bytes.byteLength !== descriptor.size ||
      bytes.byteLength > CONTENT_WORKBENCH_PACKAGE_MAX_FILE_BYTES ||
      (await sha256(bytes)) !== descriptor.sha256
    ) {
      throw new Error("Project package checksum failed");
    }
    files.set(path, new Blob([bytes]));
  }
  if (paths.some((path) => path !== "manifest.json" && !expected.has(path))) {
    throw new Error("Project package contains unexpected files");
  }
  return { project: manifest.project, files };
}

export function contentWorkbenchPackageFileName(
  project: ManagedMobileContentKit,
) {
  const safe =
    String(project.productName || "project")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";
  return `${safe}-${new Date()
    .toISOString()
    .slice(0, 10)}.jisudeng-project.zip`;
}

export function contentWorkbenchPackageAssetPath(
  kind: "assets" | "outputs",
  index: number,
  fileName?: string,
) {
  return `${kind}/${String(index + 1).padStart(3, "0")}-${packageFileName(
    fileName || "image.png",
  )}`;
}
