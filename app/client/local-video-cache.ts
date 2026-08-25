import { del, get, set } from "idb-keyval";

/**
 * Completed mobile videos are private device data. Keep the binary in
 * IndexedDB and only retain the task metadata in the small index record. The
 * owner is part of every key so switching accounts cannot expose a previous
 * account's videos.
 */
export interface LocalVideoEntry {
  id: string;
  ownerUserId: string;
  taskId: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  mimeType: string;
  size: number;
}

export interface LocalVideoCachedEntry {
  entry: LocalVideoEntry;
  blob: Blob;
}

const INDEX_PREFIX = "jisudeng-local-videos:index:";
const BLOB_PREFIX = "jisudeng-local-videos:blob:";
const MAX_ENTRIES = 24;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_VIDEO_BYTES = 512 * 1024 * 1024;
const writeQueues = new Map<string, Promise<unknown>>();

function ownerKey(ownerUserId: string) {
  return String(ownerUserId || "").trim();
}

function indexKey(ownerUserId: string) {
  return `${INDEX_PREFIX}${ownerKey(ownerUserId)}`;
}

function blobKey(ownerUserId: string, id: string) {
  return `${BLOB_PREFIX}${ownerKey(ownerUserId)}:${id}`;
}

function normalizeEntry(
  ownerUserId: string,
  value: unknown,
): LocalVideoEntry | null {
  const item = value as Partial<LocalVideoEntry> | null;
  const owner = ownerKey(ownerUserId);
  const id = String(item?.id || "").trim();
  const taskId = String(item?.taskId || "").trim();
  if (!owner || !id || !taskId) return null;
  return {
    id,
    ownerUserId: owner,
    taskId,
    prompt: String(item?.prompt || "").trim(),
    createdAt: Number(item?.createdAt || Date.now()),
    updatedAt: Number(item?.updatedAt || item?.createdAt || Date.now()),
    mimeType: String(item?.mimeType || "video/mp4"),
    size: Math.max(0, Number(item?.size || 0)),
  };
}

async function readIndex(ownerUserId: string) {
  const owner = ownerKey(ownerUserId);
  if (!owner) return [] as LocalVideoEntry[];
  const raw = await get<unknown>(indexKey(owner));
  return (Array.isArray(raw) ? raw : [])
    .map((item) => normalizeEntry(owner, item))
    .filter((item): item is LocalVideoEntry => Boolean(item))
    .filter((item) => item.ownerUserId === owner)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

async function writeIndex(ownerUserId: string, entries: LocalVideoEntry[]) {
  const owner = ownerKey(ownerUserId);
  if (!owner) return;
  await set(indexKey(owner), entries.slice(0, MAX_ENTRIES));
}

/**
 * Keeps completed videos on the device without allowing the local history to
 * consume unbounded storage. Entries are ordered newest-first, so eviction
 * always removes the oldest local copy and never changes the server task.
 */
export function retainLocalVideoEntries(
  entries: LocalVideoEntry[],
  maxEntries = MAX_ENTRIES,
  maxBytes = MAX_TOTAL_VIDEO_BYTES,
) {
  const retained: LocalVideoEntry[] = [];
  const evicted: LocalVideoEntry[] = [];
  let totalBytes = 0;
  for (const entry of entries) {
    const size = Math.max(0, Number(entry.size || 0));
    if (retained.length < maxEntries && totalBytes + size <= maxBytes) {
      retained.push(entry);
      totalBytes += size;
    } else {
      evicted.push(entry);
    }
  }
  return { retained, evicted, totalBytes };
}

function withVideoWriteLock<T>(
  ownerUserId: string,
  operation: () => Promise<T>,
) {
  const owner = ownerKey(ownerUserId);
  const previous = writeQueues.get(owner) || Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  writeQueues.set(owner, next);
  void next.then(
    () => {
      if (writeQueues.get(owner) === next) writeQueues.delete(owner);
    },
    () => {
      if (writeQueues.get(owner) === next) writeQueues.delete(owner);
    },
  );
  return next;
}

export async function listLocalVideos(ownerUserId: string) {
  return readIndex(ownerUserId);
}

export async function readLocalVideoBlob(ownerUserId: string, id: string) {
  const owner = ownerKey(ownerUserId);
  if (!owner || !id) return null;
  const value = await get<unknown>(blobKey(owner, id));
  return value instanceof Blob ? value : null;
}

/**
 * Returns only index entries whose binary is still present. Mobile storage can
 * evict large IndexedDB values while leaving the small index behind; callers
 * that reconcile server history must treat those entries as cache misses.
 */
export async function listLocalVideosWithBlobs(ownerUserId: string) {
  const entries = await readIndex(ownerUserId);
  const cached: LocalVideoCachedEntry[] = [];
  for (const entry of entries) {
    const blob = await readLocalVideoBlob(ownerUserId, entry.id);
    if (blob) cached.push({ entry, blob });
  }
  return cached;
}

export async function saveLocalVideo(
  ownerUserId: string,
  taskId: string,
  blob: Blob,
  metadata: { prompt?: string; createdAt?: number } = {},
) {
  const owner = ownerKey(ownerUserId);
  const task = String(taskId || "").trim();
  if (!owner || !task) throw new Error("A signed-in account is required.");
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error("The video result is empty.");
  }
  if (blob.size > MAX_VIDEO_BYTES) {
    throw new Error("The video result is too large for local storage.");
  }
  return withVideoWriteLock(owner, async () => {
    const current = await readIndex(owner);
    const existing = current.find((entry) => entry.taskId === task);
    const id = existing?.id || `video-${task}`;
    const now = Date.now();
    const entry: LocalVideoEntry = {
      id,
      ownerUserId: owner,
      taskId: task,
      prompt: String(metadata.prompt || existing?.prompt || "").trim(),
      createdAt: existing?.createdAt || metadata.createdAt || now,
      updatedAt: now,
      mimeType: blob.type || existing?.mimeType || "video/mp4",
      size: blob.size,
    };
    const nextEntries = [entry, ...current.filter((item) => item.id !== id)];
    const { retained, evicted } = retainLocalVideoEntries(nextEntries);
    await set(blobKey(owner, id), blob);
    await writeIndex(owner, retained);
    await Promise.all(evicted.map((item) => del(blobKey(owner, item.id))));
    return entry;
  });
}

export async function deleteLocalVideos(ownerUserId: string, ids: string[]) {
  const owner = ownerKey(ownerUserId);
  const selected = new Set(ids.map(String).filter(Boolean));
  if (!owner || selected.size === 0) return 0;
  return withVideoWriteLock(owner, async () => {
    const current = await readIndex(owner);
    const removed = current.filter((entry) => selected.has(entry.id));
    await Promise.all(removed.map((entry) => del(blobKey(owner, entry.id))));
    await writeIndex(
      owner,
      current.filter((entry) => !selected.has(entry.id)),
    );
    return removed.length;
  });
}

export async function clearLocalVideos(ownerUserId: string) {
  const owner = ownerKey(ownerUserId);
  if (!owner) return;
  await withVideoWriteLock(owner, async () => {
    const current = await readIndex(owner);
    await Promise.all(current.map((entry) => del(blobKey(owner, entry.id))));
    await del(indexKey(owner));
  });
}

export const localVideoLimits = {
  maxEntries: MAX_ENTRIES,
  maxVideoBytes: MAX_VIDEO_BYTES,
  maxTotalBytes: MAX_TOTAL_VIDEO_BYTES,
};
