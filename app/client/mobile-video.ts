import type {
  ManagedModelModality,
  ManagedSession,
  ManagedWorkspaceBootstrap,
  ManagedWorkspaceGroup,
  ManagedWorkspaceModel,
  ManagedWorkspaceModels,
} from "./managed-nextchat";
import { resolveMobileChatPreference } from "./mobile-chat-preference";
import type { MobileChatPreference } from "./mobile-chat-preference";
import {
  isChatModel,
  isVideoModel,
  modelHasDeclaredModality,
} from "./mobile-model-kind";

type JsonRecord = Record<string, unknown>;

// Keep the native workbench aligned with the verified Creation Space task
// lifecycle: durable server tasks may take up to 20 minutes and are queried
// at a steady five-second cadence. The task remains resumable server-side if
// the app is closed or the request is cancelled locally.
export const MOBILE_VIDEO_POLL_INTERVAL_MS = 5_000;
export const MOBILE_VIDEO_POLL_TIMEOUT_MS = 20 * 60 * 1_000;

export type MobileVideoServerCapabilities = NonNullable<
  ManagedWorkspaceModel["video_capabilities"]
>;

export type MobileVideoServerModel =
  | string
  | {
      id?: string;
      name?: string;
      display_name?: string;
      platform?: string;
      modalities?: ManagedModelModality[];
      video_capabilities?: MobileVideoServerCapabilities;
      /** Compatibility shape used by the original mobile endpoint. */
      capabilities?: MobileVideoServerCapabilities;
    };

export type MobileVideoServerGroup = {
  id: number;
  name: string;
  platform?: string;
  modalities?: ManagedModelModality[];
  video_available?: boolean;
  video_unavailable_code?: string;
  models?: MobileVideoServerModel[];
  /** Compatibility group field used before video_capabilities was named. */
  capabilities?: MobileVideoServerCapabilities;
  video_capabilities?: MobileVideoServerCapabilities;
  model_capabilities?: Record<string, MobileVideoServerCapabilities>;
};

export type MobileVideoServerBootstrap = {
  groups?: MobileVideoServerGroup[];
};

export type ManagedVideoGroupSource = "server" | "workspace" | "unavailable";

export type ResolvedManagedVideoGroups = {
  source: ManagedVideoGroupSource;
  groups: ManagedWorkspaceGroup[];
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function valueAt(root: unknown, path: string): unknown {
  let value = root;
  for (const segment of path.split(".")) {
    const current = record(value);
    if (!current) return undefined;
    value = current[segment];
  }
  return value;
}

function firstString(root: unknown, paths: string[]): string {
  for (const path of paths) {
    const value = valueAt(root, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** The video workspace is deliberately separate from the normalized chat workspace. */
export function managedVideoWorkspaceModels(
  workspace?: ManagedWorkspaceBootstrap | null,
): ManagedWorkspaceModels | undefined {
  return workspace?.workspaces?.video?.models;
}

function groupHasDeclaredVideoModality(group: ManagedWorkspaceGroup) {
  return modelHasDeclaredModality(group, "video") === true;
}

function isManagedVideoGroup(group: ManagedWorkspaceGroup) {
  if (group.video_available === false) return false;
  return Boolean(
    group.video_available ||
      groupHasDeclaredVideoModality(group) ||
      group.video_capabilities ||
      (group.models || []).some(
        (model) =>
          modelHasDeclaredModality(model, "video") === true ||
          Boolean(model.video_capabilities) ||
          isVideoModel(model),
      ),
  );
}

/** Return only groups explicitly or structurally declared as video-capable. */
export function filterManagedVideoGroups(
  groups?: ManagedWorkspaceGroup[],
): ManagedWorkspaceGroup[] {
  return (groups || []).filter(isManagedVideoGroup);
}

export function managedVideoGroups(
  workspace?: ManagedWorkspaceBootstrap | null,
): ManagedWorkspaceGroup[] {
  const groups = managedVideoWorkspaceModels(workspace)?.groups;
  return filterManagedVideoGroups(groups);
}

/**
 * A model belongs to the video workbench when the platform explicitly says so.
 * Older bootstraps that lack per-model modalities can still use the already
 * declared video workspace/group capability, but a contradictory declaration
 * always wins and is filtered out.
 */
export function managedVideoModels(
  group?: ManagedWorkspaceGroup,
): ManagedWorkspaceModel[] {
  if (!group || group.video_available === false) return [];
  return (group.models || []).filter((model) => {
    if (!managedVideoCapabilities(model, group)) return false;
    const declared = modelHasDeclaredModality(model, "video");
    if (declared !== undefined) return declared;
    return Boolean(
      group.video_available ||
        groupHasDeclaredVideoModality(group) ||
        group.video_capabilities ||
        isVideoModel(model),
    );
  });
}

function normalizeServerModalities(
  modalities?: ManagedModelModality[],
): ManagedModelModality[] | undefined {
  if (!Array.isArray(modalities)) return undefined;
  return modalities.filter((modality): modality is ManagedModelModality =>
    ["chat", "image", "video", "audio"].includes(modality),
  );
}

function normalizeServerVideoModel(
  model: MobileVideoServerModel,
  group: MobileVideoServerGroup,
): ManagedWorkspaceModel | undefined {
  if (typeof model === "string") {
    const name = model.trim();
    if (!name) return undefined;
    return {
      id: name,
      name,
      platform: group.platform,
      video_capabilities:
        group.model_capabilities?.[name] ||
        group.video_capabilities ||
        group.capabilities,
    };
  }

  const id = String(model.id || model.name || "").trim();
  if (!id) return undefined;
  const name = String(model.name || id).trim();
  return {
    id,
    name,
    display_name: model.display_name,
    platform: model.platform || group.platform,
    modalities: normalizeServerModalities(model.modalities),
    video_capabilities:
      model.video_capabilities ||
      model.capabilities ||
      group.model_capabilities?.[name] ||
      group.model_capabilities?.[id] ||
      group.video_capabilities ||
      group.capabilities,
  };
}

/** Convert both the old string-list and new typed video bootstrap payloads. */
export function normalizeMobileVideoBootstrapGroups(
  groups?: MobileVideoServerGroup[],
): ManagedWorkspaceGroup[] {
  return (groups || []).flatMap((group) => {
    const id = Number(group.id);
    if (!Number.isFinite(id)) return [];
    const sourceModels = group.models?.length
      ? group.models
      : Object.keys(group.model_capabilities || {});
    return [
      {
        id,
        name: String(group.name || group.id),
        platform: group.platform,
        modalities: normalizeServerModalities(group.modalities),
        video_available: group.video_available,
        video_unavailable_code: group.video_unavailable_code,
        video_capabilities: group.video_capabilities || group.capabilities,
        models: sourceModels.flatMap((model) => {
          const normalized = normalizeServerVideoModel(model, group);
          return normalized ? [normalized] : [];
        }),
      },
    ];
  });
}

/**
 * Server video bootstrap is authoritative when it succeeds, including an
 * intentionally empty group list. If that endpoint is unavailable, reuse only
 * the separately declared video workspace and never the chat workspace.
 */
export function resolveManagedVideoGroups(input: {
  serverBootstrapLoaded: boolean;
  serverGroups?: ManagedWorkspaceGroup[];
  workspace?: ManagedWorkspaceBootstrap | null;
}): ResolvedManagedVideoGroups {
  if (input.serverBootstrapLoaded) {
    return {
      source: "server",
      groups: filterManagedVideoGroups(input.serverGroups),
    };
  }
  const workspaceGroups = managedVideoGroups(input.workspace);
  return workspaceGroups.length
    ? { source: "workspace", groups: workspaceGroups }
    : { source: "unavailable", groups: [] };
}

export function managedVideoCapabilities(
  model?: ManagedWorkspaceModel,
  group?: ManagedWorkspaceGroup,
) {
  return model?.video_capabilities || group?.video_capabilities;
}

export type MobileVideoScriptChatSession = {
  id: string;
  groupId?: number;
  model?: string;
};

/**
 * The script helper is a chat feature, not a second video-model picker. It
 * follows the visible chat session first, then the saved chat preference when
 * the user is composing a new conversation. Video workspace data is never
 * considered here.
 */
export type MobileVideoScriptSelection = {
  groupId?: number;
  model: string;
  source: "session" | "preference" | "unavailable";
};

function workspaceModelValue(model?: ManagedWorkspaceModel) {
  return String(model?.name || model?.id || "").trim();
}

export function resolveMobileVideoScriptSelection(input: {
  workspace?: ManagedWorkspaceBootstrap | null;
  chatSessions?: MobileVideoScriptChatSession[] | null;
  currentChatId?: string | null;
  preference?: MobileChatPreference | null;
}): MobileVideoScriptSelection {
  const groups = input.workspace?.models?.groups || [];
  const activeSession = (input.chatSessions || []).find(
    (session) => session.id === input.currentChatId,
  );
  const activeModel = String(activeSession?.model || "").trim();
  const activeGroupId = Number(activeSession?.groupId || 0) || undefined;

  // A selected conversation is the user's explicit choice. If it has become
  // unavailable, fail closed instead of silently changing its model.
  if (activeSession && activeModel) {
    const group = groups.find((item) => item.id === activeGroupId);
    const matchingModel = group?.models?.find(
      (model) => workspaceModelValue(model) === activeModel,
    );
    if (group && matchingModel && isChatModel(matchingModel)) {
      return { groupId: group.id, model: activeModel, source: "session" };
    }
    return { groupId: activeGroupId, model: "", source: "unavailable" };
  }

  const resolved = resolveMobileChatPreference({
    groups,
    workspaceLoaded: Boolean(input.workspace),
    preference: input.preference || {},
    preferredGroupId: activeGroupId,
    isChatModel,
    modelValue: workspaceModelValue,
  });
  const group = groups.find((item) => item.id === resolved.groupId);
  const matchingModel = group?.models?.find(
    (model) => workspaceModelValue(model) === resolved.model,
  );
  if (!group || !matchingModel || !isChatModel(matchingModel)) {
    return {
      groupId: resolved.groupId,
      model: "",
      source: "unavailable",
    };
  }
  return { groupId: group.id, model: resolved.model, source: "preference" };
}

export function buildMobileVideoScriptPrompt(brief: string, locale = "") {
  const language = /^zh/i.test(locale)
    ? "Chinese unless the user writes in another language"
    : /^ja/i.test(locale)
    ? "Japanese unless the user writes in another language"
    : /^ko/i.test(locale)
    ? "Korean unless the user writes in another language"
    : "the same language as the user";
  return [
    "You are a video pre-production and generation-prompt assistant.",
    `Return one ready-to-run video-generation prompt in ${language}.`,
    "Keep the user's intent. Include the subject, setting, action or motion, camera/framing, lighting/style, pacing, and only the constraints the user supplied.",
    "Do not invent brands, people, factual claims, unsupported model parameters, or safety-sensitive details. Return prompt text only, without Markdown, headings, or explanation.",
    `User brief:\n${brief.trim()}`,
  ].join("\n\n");
}

/** A missing or mislabelled video session must never borrow the chat key. */
export function selectManagedVideoSession(
  sessions?: { chat?: ManagedSession; video?: ManagedSession } | null,
): ManagedSession | null {
  const session = sessions?.video;
  if (!session) return null;
  if (session.purpose && session.purpose !== "video") return null;
  return session;
}

export function parseMobileVideoID(payload: unknown): string {
  return firstString(payload, [
    "video_id",
    "task_id",
    "id",
    "data.video_id",
    "data.task_id",
    "data.id",
    "metadata.video_id",
    "metadata.task_id",
    "metadata.id",
    "data.metadata.video_id",
    "data.metadata.task_id",
    "data.metadata.id",
  ]);
}

export function parseMobileVideoStatus(payload: unknown): string {
  return firstString(payload, [
    "status",
    "state",
    "data.status",
    "data.state",
    "metadata.status",
    "metadata.state",
    "data.metadata.status",
    "data.metadata.state",
    "content.status",
    "data.content.status",
  ]).toLowerCase();
}

/** Agnes commonly returns the completed URL as metadata.url, not video.url. */
export function parseMobileVideoURL(payload: unknown): string {
  return firstString(payload, [
    "video.url",
    "video.video_url",
    "data.video.url",
    "data.video.video_url",
    "metadata.url",
    "metadata.video_url",
    "metadata.result_url",
    "metadata.download_url",
    "metadata.video.url",
    "metadata.video.video_url",
    "data.metadata.url",
    "data.metadata.video_url",
    "data.metadata.result_url",
    "data.metadata.download_url",
    "data.metadata.video.url",
    "data.metadata.video.video_url",
    "url",
    "video_url",
    "result_url",
    "download_url",
    "content_url",
    "data.url",
    "data.video_url",
    "data.result_url",
    "data.download_url",
    "data.content_url",
    "content.url",
    "content.video_url",
    "data.content.url",
    "data.content.video_url",
  ]);
}
