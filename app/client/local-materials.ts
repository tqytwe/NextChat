import { del, get, set } from "idb-keyval";

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
}

const MATERIAL_INDEX_PREFIX = "jisudeng-local-materials:index:";
const MATERIAL_BLOB_PREFIX = "jisudeng-local-materials:blob:";
const MAX_LOCAL_FILES_PER_IMPORT = 8;
const MAX_LOCAL_FILE_BYTES = 20 * 1024 * 1024;
const MAX_LOCAL_IMPORT_BYTES = 60 * 1024 * 1024;

function normalizedOwnerUserId(ownerUserId?: string) {
  return String(ownerUserId || "").trim();
}

function indexKey(ownerUserId: string) {
  return `${MATERIAL_INDEX_PREFIX}${normalizedOwnerUserId(ownerUserId)}`;
}

function blobKey(ownerUserId: string, id: string) {
  return `${MATERIAL_BLOB_PREFIX}${normalizedOwnerUserId(ownerUserId)}:${id}`;
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
  };
}

async function readIndex(ownerUserId: string) {
  const owner = normalizedOwnerUserId(ownerUserId);
  if (!owner) return [] as LocalMaterial[];
  const raw = await get<unknown>(indexKey(owner));
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map(asMaterial)
    .filter((item): item is LocalMaterial => Boolean(item))
    .filter((item) => item.ownerUserId === owner)
    .sort((left, right) => right.updatedAt - left.updatedAt);
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
  if (selected.some((file) => file.size > MAX_LOCAL_FILE_BYTES)) {
    throw new Error("A local material is larger than 20 MB.");
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
}

export const localMaterialLimits = {
  maxFiles: MAX_LOCAL_FILES_PER_IMPORT,
  maxFileBytes: MAX_LOCAL_FILE_BYTES,
  maxTotalBytes: MAX_LOCAL_IMPORT_BYTES,
};
