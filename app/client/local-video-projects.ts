import { del, get, set } from "idb-keyval";

export type LocalVideoProjectTaskStatus =
  | "queued"
  | "submitting"
  | "running"
  | "reconciling"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export interface LocalVideoFact {
  id: string;
  name: string;
  description: string;
  notes?: string;
}

export interface LocalVideoShot {
  id: string;
  order: number;
  title: string;
  prompt: string;
  referenceMaterialIds: string[];
  /** Attachment paths only used inside an exported local project package. */
  referencePackagePaths?: string[];
  model?: string;
  groupId?: number;
  resolution?: string;
  ratio?: string;
  duration?: number;
  watermark?: boolean;
  /** Client idempotency key, distinct from the server's durable task ID. */
  clientRequestId?: string;
  taskId?: string;
  taskStatus: LocalVideoProjectTaskStatus;
  resultTaskId?: string;
  resultPackagePath?: string;
  error?: string;
  updatedAt: number;
}

export interface LocalVideoProject {
  id: string;
  ownerUserId: string;
  name: string;
  brief: string;
  script: string;
  characters: LocalVideoFact[];
  scenes: LocalVideoFact[];
  props: LocalVideoFact[];
  storyFacts: string[];
  shots: LocalVideoShot[];
  createdAt: number;
  updatedAt: number;
}

const INDEX_PREFIX = "jisudeng-local-video-projects:index:";
const MAX_PROJECTS = 40;
const MAX_SHOTS = 200;

function ownerKey(ownerUserId: string) {
  return String(ownerUserId || "").trim();
}

function indexKey(ownerUserId: string) {
  return `${INDEX_PREFIX}${ownerKey(ownerUserId)}`;
}

function id(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeFact(
  value: unknown,
  fallback = "fact",
): LocalVideoFact | null {
  const item = (
    value && typeof value === "object" ? value : {}
  ) as Partial<LocalVideoFact>;
  const factId = String(item?.id || id(fallback)).trim();
  const name = String(item?.name || "").trim();
  const description = String(item?.description || "").trim();
  if (!name && !description) return null;
  return {
    id: factId,
    name,
    description,
    notes: String(item?.notes || "").trim() || undefined,
  };
}

function normalizeShot(value: unknown, index: number): LocalVideoShot {
  const item = (
    value && typeof value === "object" ? value : {}
  ) as Partial<LocalVideoShot>;
  const now = Date.now();
  return {
    id: String(item?.id || id("video-shot")),
    order: Number.isFinite(Number(item?.order)) ? Number(item?.order) : index,
    title: String(item?.title || `Shot ${index + 1}`).trim(),
    prompt: String(item?.prompt || "").trim(),
    referenceMaterialIds: Array.isArray(item?.referenceMaterialIds)
      ? item.referenceMaterialIds.map(String).filter(Boolean)
      : [],
    referencePackagePaths: Array.isArray(item?.referencePackagePaths)
      ? item.referencePackagePaths.map(String).filter(Boolean)
      : undefined,
    model: String(item?.model || "").trim() || undefined,
    groupId: Number.isSafeInteger(Number(item?.groupId))
      ? Number(item?.groupId)
      : undefined,
    resolution: String(item?.resolution || "").trim() || undefined,
    ratio: String(item?.ratio || "").trim() || undefined,
    duration: Number.isFinite(Number(item?.duration))
      ? Number(item?.duration)
      : undefined,
    watermark:
      typeof item?.watermark === "boolean" ? item.watermark : undefined,
    clientRequestId: String(item?.clientRequestId || "").trim() || undefined,
    taskId: String(item?.taskId || "").trim() || undefined,
    taskStatus: [
      "queued",
      "submitting",
      "running",
      "reconciling",
      "blocked",
      "completed",
      "failed",
      "cancelled",
    ].includes(String(item?.taskStatus))
      ? (item?.taskStatus as LocalVideoProjectTaskStatus)
      : "queued",
    resultTaskId: String(item?.resultTaskId || "").trim() || undefined,
    resultPackagePath:
      String(item?.resultPackagePath || "").trim() || undefined,
    error: String(item?.error || "").trim() || undefined,
    updatedAt: Number(item?.updatedAt || now),
  };
}

export function normalizeLocalVideoProject(
  value: unknown,
  ownerUserId: string,
): LocalVideoProject | null {
  const item = (
    value && typeof value === "object" ? value : {}
  ) as Partial<LocalVideoProject>;
  const owner = ownerKey(ownerUserId);
  const projectId = String(item?.id || "").trim();
  if (!owner || !projectId) return null;
  const now = Date.now();
  return {
    id: projectId,
    ownerUserId: owner,
    name: String(item?.name || "Video project").trim(),
    brief: String(item?.brief || "").trim(),
    script: String(item?.script || "").trim(),
    characters: (Array.isArray(item?.characters) ? item.characters : [])
      .map((fact) => normalizeFact(fact, "character"))
      .filter((fact): fact is LocalVideoFact => Boolean(fact)),
    scenes: (Array.isArray(item?.scenes) ? item.scenes : [])
      .map((fact) => normalizeFact(fact, "scene"))
      .filter((fact): fact is LocalVideoFact => Boolean(fact)),
    props: (Array.isArray(item?.props) ? item.props : [])
      .map((fact) => normalizeFact(fact, "prop"))
      .filter((fact): fact is LocalVideoFact => Boolean(fact)),
    storyFacts: Array.isArray(item?.storyFacts)
      ? item.storyFacts
          .map(String)
          .map((fact) => fact.trim())
          .filter(Boolean)
      : [],
    shots: (Array.isArray(item?.shots) ? item.shots : [])
      .slice(0, MAX_SHOTS)
      .map(normalizeShot)
      .sort(
        (left, right) =>
          left.order - right.order || left.id.localeCompare(right.id),
      ),
    createdAt: Number(item?.createdAt || now),
    updatedAt: Number(item?.updatedAt || item?.createdAt || now),
  };
}

async function readProjects(ownerUserId: string) {
  const owner = ownerKey(ownerUserId);
  if (!owner) return [] as LocalVideoProject[];
  const raw = await get<unknown>(indexKey(owner));
  return (Array.isArray(raw) ? raw : [])
    .map((item) => normalizeLocalVideoProject(item, owner))
    .filter((item): item is LocalVideoProject => Boolean(item))
    .filter((item) => item.ownerUserId === owner)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_PROJECTS);
}

async function writeProjects(
  ownerUserId: string,
  projects: LocalVideoProject[],
) {
  const owner = ownerKey(ownerUserId);
  if (!owner) return;
  await set(indexKey(owner), projects.slice(0, MAX_PROJECTS));
}

export async function listLocalVideoProjects(ownerUserId: string) {
  return readProjects(ownerUserId);
}

export async function createLocalVideoProject(
  ownerUserId: string,
  input: Partial<
    Omit<LocalVideoProject, "id" | "ownerUserId" | "createdAt" | "updatedAt">
  > = {},
) {
  const owner = ownerKey(ownerUserId);
  if (!owner) throw new Error("A signed-in account is required.");
  const now = Date.now();
  const project = normalizeLocalVideoProject(
    { ...input, id: id("video-project"), createdAt: now, updatedAt: now },
    owner,
  )!;
  const projects = await readProjects(owner);
  await writeProjects(owner, [project, ...projects]);
  return project;
}

export async function updateLocalVideoProject(
  ownerUserId: string,
  projectId: string,
  patch: Partial<Omit<LocalVideoProject, "id" | "ownerUserId" | "createdAt">>,
) {
  const owner = ownerKey(ownerUserId);
  const projects = await readProjects(owner);
  const current = projects.find((project) => project.id === projectId);
  if (!current) throw new Error("Video project was not found.");
  const next = normalizeLocalVideoProject(
    { ...current, ...patch, id: current.id, updatedAt: Date.now() },
    owner,
  )!;
  await writeProjects(
    owner,
    projects.map((project) => (project.id === next.id ? next : project)),
  );
  return next;
}

export async function deleteLocalVideoProject(
  ownerUserId: string,
  projectId: string,
) {
  const owner = ownerKey(ownerUserId);
  const projects = await readProjects(owner);
  const next = projects.filter((project) => project.id !== projectId);
  await writeProjects(owner, next);
  return projects.length - next.length;
}

export async function clearLocalVideoProjects(ownerUserId: string) {
  const owner = ownerKey(ownerUserId);
  if (owner) await del(indexKey(owner));
}

export const localVideoProjectLimits = {
  maxProjects: MAX_PROJECTS,
  maxShots: MAX_SHOTS,
};
