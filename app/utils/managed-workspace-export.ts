import JSZip from "jszip";
import { StoreKey } from "../constant";
import {
  fetchManagedImageAssetBlob,
  ManagedImageAssetError,
} from "./managed-image-studio-ui";
import {
  AppState,
  getLocalAppState,
  mergeAppState,
  setLocalAppState,
} from "./sync";

export const MANAGED_WORKSPACE_EXPORT_VERSION = 2;
export const MANAGED_WORKSPACE_EXPORT_FILENAME = "workspace-export.zip";
export const MANAGED_IMAGE_EXPIRED_LABEL = "图片已过期";
export const MANAGED_IMAGE_UNAVAILABLE_LABEL = "图片不可用";

type ManagedImageExportEntry = {
  draw_id: string;
  job_id?: string;
  asset_id?: string;
  asset_index: number;
  prompt?: string;
  model?: string;
  status?: string;
  created_at?: string;
  expires_at?: string;
  expired: boolean;
  archived: boolean;
  unavailable?: boolean;
  file?: string;
  source_url?: string;
  error?: string;
};

export type ManagedWorkspaceExportMetadata = {
  version: number;
  exported_at: string;
  retention: {
    text_session_days: number;
    image_job_days?: number;
    image_asset_hours: number;
    image_reference_hours?: number;
  };
  files: {
    chat_json: "chat.json";
    chat_markdown: "chat.md";
    images_dir: "images/";
  };
  images: ManagedImageExportEntry[];
};

type ImportResult = {
  state: AppState;
  metadata?: ManagedWorkspaceExportMetadata;
};

export function isManagedImageExpired(item: any, now = Date.now()) {
  if (item?.image_asset_expired || item?.status === "expired") return true;
  const expiresAt = Date.parse(item?.expires_at || "");
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export async function buildManagedWorkspaceExportPackage(
  state: AppState = getLocalAppState(),
  now = new Date(),
) {
  const zip = new JSZip();
  const exportState = cloneAppState(state);
  const metadata: ManagedWorkspaceExportMetadata = {
    version: MANAGED_WORKSPACE_EXPORT_VERSION,
    exported_at: now.toISOString(),
    retention: {
      text_session_days: 7,
      image_job_days: 7,
      image_asset_hours: 24,
      image_reference_hours: 24,
    },
    files: {
      chat_json: "chat.json",
      chat_markdown: "chat.md",
      images_dir: "images/",
    },
    images: [],
  };

  await addImageAssets(zip, exportState, metadata, now.getTime());
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));
  zip.file("chat.json", JSON.stringify(exportState, null, 2));
  zip.file("chat.md", buildManagedWorkspaceMarkdown(exportState, metadata));

  return zip.generateAsync({ type: "blob" });
}

export async function exportManagedWorkspacePackage() {
  const blob = await buildManagedWorkspaceExportPackage();
  downloadBlob(blob, MANAGED_WORKSPACE_EXPORT_FILENAME);
}

export async function importManagedWorkspacePackage(file?: File) {
  const selectedFile = file ?? (await selectWorkspaceImportFile());
  const imported = await readManagedWorkspaceImport(selectedFile);
  const localState = getLocalAppState();
  const merged = mergeAppState(localState, imported.state);
  setLocalAppState(merged);
}

export async function readManagedWorkspaceImport(
  file: File,
): Promise<ImportResult> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".zip")) {
    return readManagedWorkspaceZip(file);
  }

  const text = await file.text();
  return {
    state: normalizeImportedState(JSON.parse(text) as AppState),
  };
}

export function normalizeImportedState(
  state: AppState,
  metadata?: ManagedWorkspaceExportMetadata,
  imageDataURLs: Record<string, string> = {},
) {
  const sdState = state[StoreKey.SdList] as any;
  const imagesByDraw = new Map<string, ManagedImageExportEntry[]>();
  (metadata?.images ?? []).forEach((image) => {
    const existing = imagesByDraw.get(image.draw_id) ?? [];
    existing.push(image);
    imagesByDraw.set(image.draw_id, existing);
  });

  sdState.draw = (sdState.draw ?? []).map((item: any) => {
    const imageEntries = imagesByDraw.get(item.id) ?? [];
    const archivedImages = imageEntries.filter(
      (image) => image.file && imageDataURLs[image.file],
    );
    const firstArchivedImage = archivedImages
      .slice()
      .sort((left, right) => left.asset_index - right.asset_index)[0];
    const expired =
      imageEntries.length > 0 &&
      archivedImages.length === 0 &&
      imageEntries.every((image) => image.expired);
    const unavailable =
      imageEntries.length > 0 &&
      archivedImages.length === 0 &&
      imageEntries.some((image) => image.unavailable);
    const partialUnavailable =
      archivedImages.length > 0 &&
      imageEntries.some(
        (image) => !image.archived && (image.unavailable || image.expired),
      );
    const nextItem = {
      ...item,
      image_asset_expired: !!(
        expired ||
        (archivedImages.length > 0 &&
          imageEntries.some((image) => image.expired)) ||
        item.image_asset_expired
      ),
      image_asset_unavailable: !!(
        unavailable ||
        partialUnavailable ||
        item.image_asset_unavailable
      ),
      image_asset_archived: !!(
        archivedImages.length > 0 || item.image_asset_archived
      ),
    };

    if (archivedImages.length > 0) {
      nextItem.status = item.status === "expired" ? "success" : item.status;
      nextItem.img_data =
        imageDataURLs[firstArchivedImage.file as string] || nextItem.img_data;
      nextItem.assets = mergeImportedImageAssets(
        item,
        imageEntries,
        imageDataURLs,
      );
    } else if (expired) {
      nextItem.status = "expired";
      nextItem.img_data = "";
      nextItem.error = MANAGED_IMAGE_EXPIRED_LABEL;
    } else if (unavailable) {
      nextItem.status = item.status === "success" ? "error" : item.status;
      nextItem.img_data = "";
      nextItem.error =
        imageEntries.find((image) => image.error)?.error ||
        MANAGED_IMAGE_UNAVAILABLE_LABEL;
    }

    return nextItem;
  });

  return state;
}

function mergeImportedImageAssets(
  item: any,
  imageEntries: ManagedImageExportEntry[],
  imageDataURLs: Record<string, string>,
) {
  const baseAssets =
    Array.isArray(item.assets) && item.assets.length > 0
      ? item.assets
      : imageEntries.map((image, index) => ({
          id: image.asset_id || `${item.id}-${index}`,
        }));
  return baseAssets.map((asset: any, index: number) => {
    const image = findImportedImageEntryForAsset(imageEntries, asset, index);
    if (!image) return asset;
    if (image.file && imageDataURLs[image.file]) {
      const dataURL = imageDataURLs[image.file];
      return {
        ...asset,
        id: asset?.id || image.asset_id || `${item.id}-${index}`,
        url: dataURL,
        preview_url: dataURL,
        thumbnail_url: dataURL,
        download_url: dataURL,
        availability: "archived",
      };
    }
    if (image.expired) {
      return {
        ...asset,
        availability: "expired",
        url: "",
        preview_url: "",
        thumbnail_url: "",
        download_url: "",
      };
    }
    if (image.unavailable) {
      return {
        ...asset,
        availability: "unavailable",
        url: "",
        preview_url: "",
        thumbnail_url: "",
        download_url: "",
      };
    }
    return asset;
  });
}

function findImportedImageEntryForAsset(
  imageEntries: ManagedImageExportEntry[],
  asset: any,
  index: number,
) {
  const assetID = String(asset?.id || "").trim();
  if (assetID) {
    const byID = imageEntries.find((image) => image.asset_id === assetID);
    if (byID) return byID;
  }
  return imageEntries.find((image) => image.asset_index === index);
}

async function readManagedWorkspaceZip(file: File): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);
  const chatFile = zip.file("chat.json");
  if (!chatFile) {
    throw new Error("workspace export is missing chat.json");
  }

  const metadataFile = zip.file("metadata.json");
  const metadata = metadataFile
    ? (JSON.parse(
        await metadataFile.async("text"),
      ) as ManagedWorkspaceExportMetadata)
    : undefined;
  const state = JSON.parse(await chatFile.async("text")) as AppState;
  const imageDataURLs: Record<string, string> = {};

  await Promise.all(
    (metadata?.images ?? []).map(async (image) => {
      if (!image.file) return;
      const imageFile = zip.file(image.file);
      if (!imageFile) return;
      const content = await imageFile.async("arraybuffer");
      const blob = new Blob([content], {
        type: contentTypeForFile(image.file),
      });
      imageDataURLs[image.file] = await blobToDataURL(blob);
    }),
  );

  return {
    state: normalizeImportedState(state, metadata, imageDataURLs),
    metadata,
  };
}

async function addImageAssets(
  zip: JSZip,
  state: AppState,
  metadata: ManagedWorkspaceExportMetadata,
  now: number,
) {
  const sdState = state[StoreKey.SdList] as any;
  const draw = (sdState.draw ?? []) as any[];

  for (const item of draw) {
    const imageSources = getImageSources(item);
    const expired = isManagedImageExpired(item, now);
    if (expired || imageSources.length === 0) {
      markExportedItemExpired(item);
      metadata.images.push(buildImageMetadata(item, 0, undefined, expired));
      continue;
    }

    const itemEntries: ManagedImageExportEntry[] = [];
    for (let index = 0; index < imageSources.length; index += 1) {
      const source = imageSources[index];
      const entry = buildImageMetadata(item, index, source, false);
      try {
        const asset = await fetchManagedImageAssetBlob(source.url, {
          kind: "image",
          retries: 1,
        });
        const blob = asset.blob;
        const file = `images/${safeFilePart(item.id)}-${safeFilePart(
          source.assetID || String(index + 1),
        )}.${extensionForImage(asset.contentType || blob.type, source.url)}`;
        zip.file(file, blob);
        entry.file = file;
        entry.archived = true;
        itemEntries.push(entry);
      } catch (error: any) {
        handleManagedWorkspaceExportAssetError(error, entry);
        itemEntries.push(entry);
      }
    }
    if (itemEntries.length > 0 && itemEntries.every((image) => image.expired)) {
      markExportedItemExpired(item);
    } else if (
      itemEntries.length > 0 &&
      itemEntries.every((image) => image.unavailable)
    ) {
      markExportedItemUnavailable(item, itemEntries[0].error);
    }
    metadata.images.push(...itemEntries);
  }
}

function handleManagedWorkspaceExportAssetError(
  error: any,
  entry: ManagedImageExportEntry,
) {
  const message = error?.message || "image asset unavailable";
  if (error instanceof ManagedImageAssetError) {
    if (error.status === 410 || error.code === "IMAGE_STUDIO_ASSET_EXPIRED") {
      entry.expired = true;
      entry.archived = false;
      entry.error = message || MANAGED_IMAGE_EXPIRED_LABEL;
      return;
    }
    if (error.status === 404) {
      entry.unavailable = true;
      entry.archived = false;
      entry.error = message || MANAGED_IMAGE_UNAVAILABLE_LABEL;
      return;
    }
    if (error.status === 401) {
      throw new Error("登录已失效，请重新进入 NextChat 后再导出。");
    }
  }
  throw new Error(`图片导出失败：${message}`);
}

function getImageSources(item: any) {
  const assets = (item.assets ?? []) as any[];
  const sources = assets
    .map((asset, index) => ({
      assetID: asset?.id || `${index + 1}`,
      url: String(
        asset?.download_url || asset?.url || asset?.preview_url || "",
      ).trim(),
    }))
    .filter((source) => !!source.url);

  const imgData = String(item?.img_data || "").trim();
  if (sources.length === 0 && imgData) {
    sources.push({ assetID: "image", url: imgData });
  }

  return sources;
}

function buildImageMetadata(
  item: any,
  assetIndex: number,
  source:
    | {
        assetID: string;
        url: string;
      }
    | undefined,
  expired: boolean,
): ManagedImageExportEntry {
  return {
    draw_id: String(item.id || ""),
    job_id: item.job_id,
    asset_id: source?.assetID,
    asset_index: assetIndex,
    prompt: item.params?.prompt,
    model: item.model_name || item.model,
    status: item.status,
    created_at: item.created_at,
    expires_at: item.expires_at,
    expired,
    archived: false,
    source_url: source?.url,
  };
}

function markExportedItemExpired(item: any) {
  item.image_asset_expired = true;
  item.status = item.status === "success" ? "expired" : item.status;
  item.error = item.error || MANAGED_IMAGE_EXPIRED_LABEL;
}

function markExportedItemUnavailable(item: any, message?: string) {
  item.image_asset_unavailable = true;
  item.status = item.status === "success" ? "error" : item.status;
  item.error = item.error || message || MANAGED_IMAGE_UNAVAILABLE_LABEL;
}

function buildManagedWorkspaceMarkdown(
  state: AppState,
  metadata: ManagedWorkspaceExportMetadata,
) {
  const chatState = state[StoreKey.Chat] as any;
  const sdState = state[StoreKey.SdList] as any;
  const lines: string[] = [
    "# 极速蹬 AI 工作台导出",
    "",
    `导出时间：${metadata.exported_at}`,
    "",
    "## 聊天记录",
    "",
  ];

  (chatState.sessions ?? []).forEach((session: any, index: number) => {
    lines.push(`### ${index + 1}. ${session.topic || "未命名会话"}`, "");
    (session.messages ?? []).forEach((message: any) => {
      lines.push(`**${message.role || "message"}**`);
      lines.push(String(message.content || ""));
      lines.push("");
    });
  });

  lines.push("## 图片创作", "");
  (sdState.draw ?? []).forEach((item: any, index: number) => {
    const images = metadata.images.filter((image) => image.draw_id === item.id);
    lines.push(`### ${index + 1}. ${item.params?.prompt || item.id}`);
    lines.push(`模型：${item.model_name || item.model || ""}`);
    lines.push(
      `状态：${
        item.image_asset_expired ? MANAGED_IMAGE_EXPIRED_LABEL : item.status
      }`,
    );
    if (item.expires_at) lines.push(`过期时间：${item.expires_at}`);
    images.forEach((image) => {
      lines.push(
        image.file ? `图片文件：${image.file}` : "图片文件：仅保留元数据",
      );
    });
    lines.push("");
  });

  return lines.join("\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const element = document.createElement("a");
  element.href = url;
  element.download = filename;
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(url);
}

function selectWorkspaceImportFile() {
  return new Promise<File>((resolve, reject) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".zip,application/zip,application/json,.json";
    fileInput.onchange = (event: any) => {
      const file = event.target.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      resolve(file);
    };
    fileInput.click();
  });
}

function blobToDataURL(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function extensionForImage(contentType: string, url: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  const match = new URL(url, window.location.origin).pathname.match(
    /\.([a-zA-Z0-9]+)$/,
  );
  return match?.[1]?.toLowerCase() || "png";
}

function contentTypeForFile(file: string) {
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  if (file.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function safeFilePart(value: string) {
  return (
    value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image"
  );
}

function cloneAppState(state: AppState) {
  return JSON.parse(JSON.stringify(state)) as AppState;
}
