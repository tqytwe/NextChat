import { Path } from "../constant";
import { withBasePath } from "./api-path";

export type ManagedImageSource = {
  id: string;
  preview: string;
  download?: string;
  filename?: string;
};

export class ManagedImageAssetError extends Error {
  status: number;
  code?: string;
  retryable: boolean;

  constructor(
    message: string,
    options: { status: number; code?: string; retryable?: boolean },
  ) {
    super(message);
    this.name = "ManagedImageAssetError";
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? options.status >= 500;
  }
}

export type ManagedImageAssetBlob = {
  blob: Blob;
  contentType: string;
  filename?: string;
};

export function getImageStudioBackPath(managedMode: boolean) {
  return managedMode ? Path.Chat : Path.Home;
}

export function getManagedImageSources(item: any): ManagedImageSource[] {
  const assets = (item.assets ?? []) as any[];
  const sources: ManagedImageSource[] = assets
    .map((asset, index) => ({
      id: asset.id || `${item.id}-${index}`,
      preview: asset.preview_url || asset.url || asset.download_url,
      download: asset.download_url || asset.url || asset.preview_url,
      filename: asset.filename,
    }))
    .filter((asset) => !!asset.preview);

  if (sources.length === 0 && item.img_data) {
    sources.push({
      id: `${item.id}-image`,
      preview: item.img_data,
      download: item.img_data,
    });
  }

  return sources;
}

export async function downloadManagedImage(
  item: any,
  onMultiDownload?: (count: number) => void,
) {
  const sources = getManagedImageSources(item).filter(
    (source) => !!source.download,
  );
  if (sources.length === 0) return;

  if (sources.length > 1 && item.job_id) {
    const zip = await fetchManagedImageAssetBlob(
      withBasePath(
        `/api/nextchat/image-studio/jobs/${encodeURIComponent(
          item.job_id,
        )}/download`,
      ),
      { kind: "zip" },
    );
    triggerManagedBlobDownload(
      zip.blob,
      zip.filename || `${safeManagedFilenamePart(item.job_id)}.zip`,
    );
    onMultiDownload?.(sources.length);
    return;
  }

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const image = await fetchManagedImageAssetBlob(source.download as string, {
      kind: "image",
    });
    triggerManagedBlobDownload(
      image.blob,
      image.filename ||
        source.filename ||
        `${safeManagedFilenamePart(item.job_id || item.id || "image")}${
          sources.length > 1 ? `-${index + 1}` : ""
        }.${extensionForManagedImage(image.contentType, source.download)}`,
    );
  }
}

export async function fetchManagedImageAssetBlob(
  url: string,
  options: { kind: "image" | "zip"; retries?: number },
): Promise<ManagedImageAssetBlob> {
  const retries = options.retries ?? 1;
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const contentType = res.headers.get("Content-Type") || "";
      if (!res.ok) {
        throw await managedAssetErrorFromResponse(res);
      }
      const blob = await res.blob();
      const resolvedType = contentType || blob.type || "";
      if (!isExpectedManagedAssetContentType(resolvedType, options.kind)) {
        throw new ManagedImageAssetError(
          `Unexpected asset content type: ${resolvedType || "unknown"}`,
          { status: res.status, retryable: false },
        );
      }
      return {
        blob,
        contentType: resolvedType,
        filename: filenameFromContentDisposition(
          res.headers.get("Content-Disposition") || "",
        ),
      };
    } catch (error: any) {
      lastError = error;
      const retryable =
        error instanceof ManagedImageAssetError ? error.retryable : true;
      if (!retryable || attempt >= retries) {
        throw error;
      }
    }
  }
  throw lastError;
}

async function managedAssetErrorFromResponse(res: Response) {
  const contentType = res.headers.get("Content-Type") || "";
  let message = `Image asset request failed: ${res.status}`;
  let code: string | undefined;
  if (contentType.includes("application/json")) {
    const payload = await res.json().catch(() => undefined);
    message = payload?.message || payload?.msg || message;
    code = payload?.code;
  }
  return new ManagedImageAssetError(message, {
    status: res.status,
    code,
    retryable: res.status >= 500,
  });
}

function isExpectedManagedAssetContentType(
  contentType: string,
  kind: "image" | "zip",
) {
  const normalized = contentType.toLowerCase();
  if (kind === "zip") return normalized.includes("application/zip");
  return normalized.startsWith("image/");
}

function triggerManagedBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(url);
    }
  }, 0);
}

function filenameFromContentDisposition(value: string) {
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded.replace(/"/g, ""));
  const quoted = value.match(/filename="?([^";]+)"?/i)?.[1];
  return quoted ? quoted.trim() : undefined;
}

function extensionForManagedImage(contentType: string, url?: string) {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("jpeg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  const fromURL = String(url || "")
    .split("?")[0]
    .match(/\.([a-z0-9]+)$/i)?.[1];
  return fromURL || "png";
}

function safeManagedFilenamePart(value: string) {
  return String(value || "image").replace(/[^a-z0-9_.-]+/gi, "-");
}
