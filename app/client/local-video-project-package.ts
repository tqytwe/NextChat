import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { LocalVideoProject } from "./local-video-projects";

export const LOCAL_VIDEO_PROJECT_PACKAGE_VERSION = 1;
export const LOCAL_VIDEO_PROJECT_PACKAGE_MAX_BYTES = 256 * 1024 * 1024;
export const LOCAL_VIDEO_PROJECT_PACKAGE_MAX_FILE_BYTES = 64 * 1024 * 1024;

type Descriptor = { path: string; size: number; sha256: string };

export type LocalVideoProjectPackageManifest = {
  manifest_version: number;
  exported_at: string;
  project: LocalVideoProject;
  files: Descriptor[];
};

export type LocalVideoProjectPackage = {
  project: LocalVideoProject;
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
    throw new Error("Invalid video project package path");
  }
  return path;
}

async function bytes(blob: Blob) {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () =>
      reject(
        reader.error || new Error("Unable to read video project package."),
      );
    reader.readAsArrayBuffer(blob);
  });
}

async function sha256(data: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function exportLocalVideoProjectPackage(input: {
  project: LocalVideoProject;
  files?: Array<{ path: string; blob: Blob }>;
}) {
  const entries: Record<string, Uint8Array> = {};
  const descriptors: Descriptor[] = [];
  for (const file of input.files || []) {
    const path = safePath(file.path);
    if (entries[path]) throw new Error("Duplicate video project package path");
    const data = await bytes(file.blob);
    if (data.byteLength > LOCAL_VIDEO_PROJECT_PACKAGE_MAX_FILE_BYTES) {
      throw new Error("Video project package file is too large");
    }
    entries[path] = data;
    descriptors.push({
      path,
      size: data.byteLength,
      sha256: await sha256(data),
    });
  }
  const manifest: LocalVideoProjectPackageManifest = {
    manifest_version: LOCAL_VIDEO_PROJECT_PACKAGE_VERSION,
    exported_at: new Date().toISOString(),
    project: input.project,
    files: descriptors,
  };
  entries["manifest.json"] = strToU8(JSON.stringify(manifest));
  const archive = zipSync(entries, { level: 6 });
  if (archive.byteLength > LOCAL_VIDEO_PROJECT_PACKAGE_MAX_BYTES) {
    throw new Error("Video project package is too large");
  }
  return new Blob([archive], { type: "application/zip" });
}

export async function importLocalVideoProjectPackage(
  blob: Blob,
): Promise<LocalVideoProjectPackage> {
  if (
    !blob ||
    blob.size <= 0 ||
    blob.size > LOCAL_VIDEO_PROJECT_PACKAGE_MAX_BYTES
  ) {
    throw new Error("Video project package is invalid or too large");
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(await bytes(blob));
  } catch {
    throw new Error("Video project package is damaged");
  }
  if (!entries["manifest.json"] || Object.keys(entries).length > 512) {
    throw new Error("Video project package manifest is missing");
  }
  Object.keys(entries).forEach(safePath);
  let manifest: LocalVideoProjectPackageManifest;
  try {
    manifest = JSON.parse(
      strFromU8(entries["manifest.json"]),
    ) as LocalVideoProjectPackageManifest;
  } catch {
    throw new Error("Video project package manifest is invalid");
  }
  if (
    manifest.manifest_version !== LOCAL_VIDEO_PROJECT_PACKAGE_VERSION ||
    !manifest.project ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error("Video project package version is unsupported");
  }
  const files = new Map<string, Blob>();
  const expected = new Set<string>();
  for (const descriptor of manifest.files) {
    const path = safePath(descriptor.path);
    if (expected.has(path) || !entries[path])
      throw new Error("Video project package is damaged");
    expected.add(path);
    const data = entries[path];
    if (
      data.byteLength !== Number(descriptor.size) ||
      data.byteLength > LOCAL_VIDEO_PROJECT_PACKAGE_MAX_FILE_BYTES ||
      (await sha256(data)) !== descriptor.sha256
    ) {
      throw new Error("Video project package checksum failed");
    }
    files.set(path, new Blob([data]));
  }
  if (
    Object.keys(entries).some(
      (path) => path !== "manifest.json" && !expected.has(path),
    )
  ) {
    throw new Error("Video project package contains unexpected files");
  }
  return { project: manifest.project, files };
}

export function localVideoProjectPackagePath(
  kind: "references" | "results",
  index: number,
  fileName = "asset.bin",
) {
  const safeName =
    String(fileName).replace(/[^a-zA-Z0-9._-]+/g, "-") || "asset.bin";
  return `${kind}/${String(index + 1).padStart(3, "0")}-${safeName}`;
}
