import { del, get, set } from "idb-keyval";
import {
  managedDownloadBlob,
  managedApiUrl,
  managedRequestText,
} from "./managed-nextchat";

export type LocalMaterialKind =
  | "image"
  | "audio"
  | "video"
  | "text"
  | "pdf"
  | "file";

export interface LocalMaterial {
  id: string;
  ownerUserId: string;
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: LocalMaterialKind;
  createdAt: number;
  updatedAt: number;
  remoteId?: string;
  remoteUpdatedAt?: string;
  remoteSha256?: string;
  remoteStatus?: string;
  contentUrl?: string;
  // These fields describe the bytes that have actually been committed to
  // IndexedDB. They intentionally differ from remote* during a failed
  // replacement download, so a stale Blob can never be accepted as current.
  cachedRemoteUpdatedAt?: string;
  cachedRemoteSha256?: string;
}

export interface MobileMaterialSyncItem {
  id: string;
  kind: LocalMaterialKind;
  source?: string;
  status?: string;
  content_type?: string;
  byte_size?: number;
  original_name?: string;
  sha256?: string;
  content_url?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface MobileMaterialSyncDelta {
  version: string;
  etag: string;
  updated_at?: string;
  items: MobileMaterialSyncItem[];
  deleted_ids: string[];
}

export interface LocalMaterialSyncState {
  version: string;
  etag: string;
  syncedAt: number;
  /** Number of remote records represented in the local metadata index. */
  remoteCount?: number;
}

const MATERIAL_INDEX_PREFIX = "jisudeng-local-materials:index:";
const MATERIAL_BLOB_PREFIX = "jisudeng-local-materials:blob:";
const MATERIAL_SYNC_PREFIX = "jisudeng-local-materials:sync:";
// Seedance accepts up to 9 image, 3 video and 3 audio references in one
// generation. Keep the local picker capable of selecting that declared
// server limit; the server still enforces each model's per-kind allowance.
const MAX_LOCAL_FILES_PER_IMPORT = 15;
const MAX_LOCAL_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_LOCAL_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_LOCAL_AUDIO_BYTES = 15 * 1024 * 1024;
const MAX_LOCAL_IMPORT_BYTES = 645 * 1024 * 1024;

function maxLocalMaterialBytes(file: File) {
  switch (localMaterialKind(file)) {
    case "video":
      return MAX_LOCAL_VIDEO_BYTES;
    case "audio":
      return MAX_LOCAL_AUDIO_BYTES;
    default:
      return MAX_LOCAL_IMAGE_BYTES;
  }
}

function normalizedOwnerUserId(ownerUserId?: string) {
  return String(ownerUserId || "").trim();
}

function normalizedMaterialKind(value: unknown): LocalMaterialKind {
  const kind = String(value || "")
    .trim()
    .toLowerCase();
  if (kind === "document") return "text";
  if (["image", "audio", "video", "text", "pdf", "file"].includes(kind)) {
    return kind as LocalMaterialKind;
  }
  return "file";
}

function indexKey(ownerUserId: string) {
  return `${MATERIAL_INDEX_PREFIX}${normalizedOwnerUserId(ownerUserId)}`;
}

function blobKey(ownerUserId: string, id: string) {
  return `${MATERIAL_BLOB_PREFIX}${normalizedOwnerUserId(ownerUserId)}:${id}`;
}

function syncKey(ownerUserId: string) {
  return `${MATERIAL_SYNC_PREFIX}${normalizedOwnerUserId(ownerUserId)}`;
}

function materialId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function localMaterialKind(
  file: Pick<File, "type" | "name">,
): LocalMaterialKind {
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("text/") || /\.(txt|md|csv|json|xml|html?)$/.test(name)) {
    return "text";
  }
  return "file";
}

function asMaterial(value: unknown): LocalMaterial | null {
  const item = value as Partial<LocalMaterial> | null;
  const id = String(item?.id || "").trim();
  const ownerUserId = normalizedOwnerUserId(item?.ownerUserId);
  const fileName = String(item?.fileName || item?.name || "").trim();
  if (!id || !ownerUserId || !fileName) return null;
  return {
    id,
    ownerUserId,
    name: String(item?.name || fileName).trim() || fileName,
    fileName,
    mimeType: String(item?.mimeType || "application/octet-stream"),
    size: Math.max(0, Number(item?.size || 0)),
    kind: localMaterialKind({
      name: fileName,
      type: String(item?.mimeType || ""),
    } as File),
    createdAt: Number(item?.createdAt || Date.now()),
    updatedAt: Number(item?.updatedAt || item?.createdAt || Date.now()),
    remoteId: String(item?.remoteId || "").trim() || undefined,
    remoteUpdatedAt: String(item?.remoteUpdatedAt || "").trim() || undefined,
    remoteSha256: String(item?.remoteSha256 || "").trim() || undefined,
    remoteStatus: String(item?.remoteStatus || "").trim() || undefined,
    contentUrl: String(item?.contentUrl || "").trim() || undefined,
    cachedRemoteUpdatedAt:
      String(item?.cachedRemoteUpdatedAt || "").trim() || undefined,
    cachedRemoteSha256:
      String(item?.cachedRemoteSha256 || "").trim() || undefined,
  };
}

async function readIndexStorage(ownerUserId: string) {
  const owner = normalizedOwnerUserId(ownerUserId);
  if (!owner) return { exists: false, materials: [] as LocalMaterial[] };
  const raw = await get<unknown>(indexKey(owner));
  const exists = Array.isArray(raw);
  const values = Array.isArray(raw) ? raw : [];
  const materials = values
    .map(asMaterial)
    .filter((item): item is LocalMaterial => Boolean(item))
    .filter((item) => item.ownerUserId === owner)
    .sort((left, right) => right.updatedAt - left.updatedAt);
  return { exists, materials };
}

async function readIndex(ownerUserId: string) {
  return (await readIndexStorage(ownerUserId)).materials;
}

async function writeIndex(ownerUserId: string, materials: LocalMaterial[]) {
  const owner = normalizedOwnerUserId(ownerUserId);
  if (!owner) return;
  await set(indexKey(owner), materials);
}

export async function listLocalMaterials(ownerUserId: string) {
  return readIndex(ownerUserId);
}

export async function importLocalMaterials(ownerUserId: string, files: File[]) {
  const owner = normalizedOwnerUserId(ownerUserId);
  if (!owner) throw new Error("A signed-in account is required.");
  const selected = files.slice(0, MAX_LOCAL_FILES_PER_IMPORT);
  const totalBytes = selected.reduce((total, file) => total + file.size, 0);
  if (selected.some((file) => file.size > maxLocalMaterialBytes(file))) {
    throw new Error("A local material exceeds its supported media size.");
  }
  if (totalBytes > MAX_LOCAL_IMPORT_BYTES) {
    throw new Error("Selected local materials exceed 60 MB.");
  }
  const current = await readIndex(owner);
  const now = Date.now();
  const imported: LocalMaterial[] = [];
  for (const file of selected) {
    const id = materialId();
    const material: LocalMaterial = {
      id,
      ownerUserId: owner,
      name: file.name || "local-material",
      fileName: file.name || "local-material",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      kind: localMaterialKind(file),
      createdAt: now,
      updatedAt: now,
    };
    await set(blobKey(owner, id), file);
    imported.push(material);
  }
  await writeIndex(owner, [...imported, ...current]);
  return imported;
}

export async function readLocalMaterialBlob(ownerUserId: string, id: string) {
  const owner = normalizedOwnerUserId(ownerUserId);
  if (!owner || !id) return null;
  const value = await get<unknown>(blobKey(owner, id));
  return value instanceof Blob ? value : null;
}

export async function blobToLocalMaterialDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read local material."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

export async function readLocalMaterialDataUrl(
  ownerUserId: string,
  id: string,
) {
  const blob = await readLocalMaterialBlob(ownerUserId, id);
  if (!blob) throw new Error("The local material is no longer available.");
  return blobToLocalMaterialDataUrl(blob);
}

export async function deleteLocalMaterials(ownerUserId: string, ids: string[]) {
  const owner = normalizedOwnerUserId(ownerUserId);
  if (!owner || !ids.length) return 0;
  const selected = new Set(ids.filter(Boolean));
  const current = await readIndex(owner);
  const removed = current.filter((item) => selected.has(item.id));
  await Promise.all(removed.map((item) => del(blobKey(owner, item.id))));
  await writeIndex(
    owner,
    current.filter((item) => !selected.has(item.id)),
  );
  return removed.length;
}

export async function clearLocalMaterials(ownerUserId: string) {
  const owner = normalizedOwnerUserId(ownerUserId);
  if (!owner) return;
  const current = await readIndex(owner);
  await Promise.all(current.map((item) => del(blobKey(owner, item.id))));
  await del(indexKey(owner));
  await del(syncKey(owner));
}

export async function getLocalMaterialSyncState(ownerUserId: string) {
  const owner = normalizedOwnerUserId(ownerUserId);
  if (!owner) return null;
  const value = await get<unknown>(syncKey(owner));
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<LocalMaterialSyncState>;
  if (!String(state.version || "").trim() || !String(state.etag || "").trim()) {
    return null;
  }
  return {
    version: String(state.version),
    etag: String(state.etag),
    syncedAt: Number(state.syncedAt || 0),
    remoteCount:
      Number.isFinite(Number(state.remoteCount)) &&
      Number(state.remoteCount) >= 0
        ? Math.floor(Number(state.remoteCount))
        : undefined,
  } satisfies LocalMaterialSyncState;
}

export function mergeLocalMaterialSyncDelta(
  ownerUserId: string,
  current: LocalMaterial[],
  delta: MobileMaterialSyncDelta,
  now = Date.now(),
) {
  const owner = normalizedOwnerUserId(ownerUserId);
  const byRemoteID = new Map(
    current
      .filter((item) => item.ownerUserId === owner && item.remoteId)
      .map((item) => [String(item.remoteId), item]),
  );
  const deleted = new Set((delta.deleted_ids || []).map(String));
  const next = current.filter(
    (item) => !item.remoteId || !deleted.has(String(item.remoteId)),
  );
  for (const item of delta.items || []) {
    const remoteID = String(item.id || "").trim();
    if (!remoteID || item.status === "deleted" || deleted.has(remoteID))
      continue;
    const previous = byRemoteID.get(remoteID);
    const normalized: LocalMaterial = {
      id: previous?.id || `remote-${remoteID}`,
      ownerUserId: owner,
      name: String(item.original_name || previous?.name || "material"),
      fileName: String(item.original_name || previous?.fileName || "material"),
      mimeType: String(
        item.content_type || previous?.mimeType || "application/octet-stream",
      ),
      size: Math.max(0, Number(item.byte_size || previous?.size || 0)),
      kind: normalizedMaterialKind(item.kind || previous?.kind),
      createdAt:
        previous?.createdAt || Date.parse(String(item.created_at || "")) || now,
      updatedAt: Date.parse(String(item.updated_at || "")) || now,
      remoteId: remoteID,
      remoteUpdatedAt: item.updated_at || previous?.remoteUpdatedAt,
      remoteSha256: item.sha256 || previous?.remoteSha256,
      remoteStatus:
        String(item.status || previous?.remoteStatus || "").trim() || undefined,
      contentUrl: item.content_url || previous?.contentUrl,
      cachedRemoteUpdatedAt: previous?.cachedRemoteUpdatedAt,
      cachedRemoteSha256: previous?.cachedRemoteSha256,
    };
    const existingIndex = next.findIndex(
      (candidate) => candidate.id === normalized.id,
    );
    if (existingIndex >= 0) next[existingIndex] = normalized;
    else next.push(normalized);
  }
  return next.sort((left, right) => right.updatedAt - left.updatedAt);
}

export interface SyncLocalMaterialsOptions {
  signal?: AbortSignal;
  downloadBlob?: (
    url: string,
    accessToken: string,
    signal?: AbortSignal,
  ) => Promise<Blob>;
  requestText?: (
    baseUrl: string,
    path: string,
    init: RequestInit,
    headers: Headers,
  ) => Promise<{ ok: boolean; status: number; text: string }>;
}

export interface LocalMaterialSyncResult {
  changed: boolean;
  downloaded: number;
  deleted: number;
  materials: LocalMaterial[];
  state: LocalMaterialSyncState | null;
}

const syncInFlight = new Map<string, Promise<LocalMaterialSyncResult>>();

function expectedByteSize(item: MobileMaterialSyncItem) {
  const value = Number(item.byte_size);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

async function sha256Hex(blob: Blob) {
  if (!globalThis.crypto?.subtle) return null;
  const data = await blobToArrayBuffer(blob);
  if (!data) return null;
  // Copy into this realm before passing it to Web Crypto. FileReader can
  // produce an ArrayBuffer from a different WebView realm during restoration.
  const digestInput = new Uint8Array(new Uint8Array(data));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function blobToArrayBuffer(blob: Blob) {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  if (typeof FileReader === "undefined") return null;
  return new Promise<ArrayBuffer | null>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read local material."));
    reader.onload = () =>
      resolve(reader.result instanceof ArrayBuffer ? reader.result : null);
    reader.readAsArrayBuffer(blob);
  });
}

async function verifyRemoteMaterialBlob(
  blob: Blob,
  item: MobileMaterialSyncItem,
) {
  const expectedSize = expectedByteSize(item);
  if (expectedSize !== null && blob.size !== expectedSize) {
    throw new Error("material download size does not match the server record");
  }
  const expectedSHA256 = String(item.sha256 || "")
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedSHA256)) return;
  const actualSHA256 = await sha256Hex(blob);
  // Some legacy Android WebView releases lack Web Crypto. The server still
  // provides authenticated transport and byte-size validation in that case;
  // modern releases additionally bind the cached Blob to the server hash.
  if (actualSHA256 && actualSHA256 !== expectedSHA256) {
    throw new Error("material download hash does not match the server record");
  }
}

/**
 * Reconciles the server material manifest with IndexedDB. The manifest is
 * cheap metadata; binary content is fetched only for new or hash/mtime
 * changed records. A 304 response leaves the local cache untouched.
 */
async function syncLocalMaterialsInternal(
  ownerUserId: string,
  baseUrl: string,
  accessToken: string,
  options: SyncLocalMaterialsOptions = {},
): Promise<LocalMaterialSyncResult> {
  const owner = normalizedOwnerUserId(ownerUserId);
  if (!owner || !accessToken)
    throw new Error("A signed-in account is required.");
  let state = await getLocalMaterialSyncState(owner);
  if (state) {
    const cached = await readIndexStorage(owner);
    // IndexedDB can evict the index key independently of the sync-state key.
    // In that case a stale ETag/since pair may produce 304 with no items,
    // leaving the device permanently empty. Rebuild the cursor from scratch.
    const remoteCount = state.remoteCount;
    // A state written by an older client has no remoteCount. Force one full
    // reconciliation so an index that was partially evicted cannot be
    // mistaken for a valid empty delta. Thereafter, compare the count on each
    // activation; a mismatch means the metadata index was truncated or
    // replaced while the sync cursor survived.
    if (
      !cached.exists ||
      !Number.isFinite(remoteCount) ||
      cached.materials.filter((item) => item.remoteId).length !== remoteCount
    ) {
      state = null;
    } else {
      const remoteMaterials = cached.materials.filter((item) => item.remoteId);
      const missingFlags = await Promise.all(
        remoteMaterials.map(async (item) => {
          const status = item.remoteStatus || "ready";
          if (status !== "ready") return false;
          // A ready entry without a content URL is incomplete metadata. Force a
          // manifest refresh so a later server response can repair it.
          if (!item.contentUrl) return true;
          return !(await readLocalMaterialBlob(owner, item.id));
        }),
      );
      if (missingFlags.some(Boolean)) state = null;
    }
  }
  const headers = new Headers({ Accept: "application/json" });
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (state?.etag) headers.set("If-None-Match", state.etag);
  const since = state?.version
    ? `?since=${encodeURIComponent(state.version)}`
    : "";
  const requestText = options.requestText || managedRequestText;
  const response = await requestText(
    baseUrl,
    `/api/v1/mobile/assets/sync${since}`,
    { method: "GET", signal: options.signal },
    headers,
  );
  if (response.status === 304) {
    return {
      changed: false,
      downloaded: 0,
      deleted: 0,
      materials: await readIndex(owner),
      state,
    };
  }
  if (!response.ok)
    throw new Error(`material sync failed: HTTP ${response.status}`);
  const envelope = JSON.parse(response.text) as {
    code?: number;
    message?: string;
    data?: MobileMaterialSyncDelta;
  };
  if (envelope.code !== 0 || !envelope.data)
    throw new Error(envelope.message || "material sync failed");
  const delta = envelope.data;
  const current = await readIndex(owner);
  const next = mergeLocalMaterialSyncDelta(owner, current, delta);
  const previousByRemote = new Map(
    current
      .filter((item) => item.remoteId)
      .map((item) => [String(item.remoteId), item]),
  );
  const downloader =
    options.downloadBlob ||
    ((url: string, token: string, signal?: AbortSignal) =>
      managedDownloadBlob(baseUrl, url, token, signal));
  let downloaded = 0;
  // Apply tombstones before any potentially failing byte downloads. If a
  // later item loses its connection, the deleted material must not become an
  // unreachable Blob after the metadata index has already dropped its row.
  await Promise.all(
    (delta.deleted_ids || []).map(async (remoteID) => {
      const previous = previousByRemote.get(String(remoteID));
      if (previous) await del(blobKey(owner, previous.id));
    }),
  );
  // Persist the metadata before fetching bytes. A failed first-install
  // download can then resume from the same manifest and only repair missing
  // blobs on the next open.
  await writeIndex(owner, next);
  for (const item of delta.items || []) {
    const remoteID = String(item.id || "").trim();
    const local = next.find((candidate) => candidate.remoteId === remoteID);
    // The sync feed can include an asset while its server-side upload is
    // still incomplete. It has no stable bytes to cache until it is ready;
    // leave its metadata in the local index and pick it up after the next
    // delta check reports the ready state.
    if (
      !local ||
      !item.content_url ||
      item.status === "deleted" ||
      (item.status && item.status !== "ready")
    ) {
      continue;
    }
    const previous = previousByRemote.get(remoteID);
    const unchanged =
      previous && previous.cachedRemoteSha256 && item.sha256
        ? previous.cachedRemoteSha256 === item.sha256
        : previous && previous.cachedRemoteUpdatedAt && item.updated_at
        ? previous.cachedRemoteUpdatedAt === item.updated_at
        : false;
    if (unchanged && (await readLocalMaterialBlob(owner, local.id))) continue;
    const url = /^https?:\/\//i.test(item.content_url)
      ? item.content_url
      : managedApiUrl(baseUrl, item.content_url);
    const blob = await downloader(url, accessToken, options.signal);
    if (!(blob instanceof Blob) || blob.size <= 0) {
      throw new Error("material download returned no data");
    }
    await verifyRemoteMaterialBlob(blob, item);
    await set(blobKey(owner, local.id), blob);
    local.cachedRemoteSha256 = String(item.sha256 || "").trim() || undefined;
    local.cachedRemoteUpdatedAt =
      String(item.updated_at || "").trim() || undefined;
    // Persist the byte-version marker with each successful blob. A later
    // download in the same response may still fail; completed earlier files
    // must not be fetched again, while a failed replacement stays retryable.
    await writeIndex(owner, next);
    downloaded += 1;
  }
  const nextState: LocalMaterialSyncState = {
    version: delta.version,
    etag: delta.etag,
    syncedAt: Date.now(),
    remoteCount: next.filter((item) => item.remoteId).length,
  };
  await set(syncKey(owner), nextState);
  return {
    changed: true,
    downloaded,
    deleted: delta.deleted_ids?.length || 0,
    materials: next,
    state: nextState,
  };
}

/**
 * Coalesces concurrent app-start/gallery refreshes for one account. Without
 * this guard both callers could observe an empty cache and download the same
 * first-install blobs twice.
 */
export function syncLocalMaterials(
  ownerUserId: string,
  baseUrl: string,
  accessToken: string,
  options: SyncLocalMaterialsOptions = {},
): Promise<LocalMaterialSyncResult> {
  const owner = normalizedOwnerUserId(ownerUserId);
  const existing = syncInFlight.get(owner);
  if (existing) return existing;
  const request = syncLocalMaterialsInternal(
    owner,
    baseUrl,
    accessToken,
    options,
  );
  syncInFlight.set(owner, request);
  const release = () => {
    if (syncInFlight.get(owner) === request) syncInFlight.delete(owner);
  };
  void request.then(release, release);
  return request;
}

export const localMaterialLimits = {
  maxFiles: MAX_LOCAL_FILES_PER_IMPORT,
  maxFileBytes: MAX_LOCAL_VIDEO_BYTES,
  maxTotalBytes: MAX_LOCAL_IMPORT_BYTES,
};
