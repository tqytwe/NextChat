import type {
  ManagedSession,
  ManagedWorkspaceBootstrap,
  ManagedWorkspaceGroup,
  ManagedWorkspaceModel,
  ManagedWorkspaceModels,
} from "./managed-nextchat";
import { resolveMobileChatPreference } from "./mobile-chat-preference";
import type { MobileChatPreference } from "./mobile-chat-preference";
import { isChatModel } from "./mobile-model-kind";

type JsonRecord = Record<string, unknown>;

// Keep the native workbench aligned with the verified Creation Space task
// lifecycle: durable server tasks may take up to 20 minutes and are queried
// at a steady five-second cadence. The task remains resumable server-side if
// the app is closed or the request is cancelled locally.
export const MOBILE_VIDEO_POLL_INTERVAL_MS = 5_000;
export const MOBILE_VIDEO_POLL_TIMEOUT_MS = 20 * 60 * 1_000;

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

/** Return only groups explicitly or structurally declared as video-capable. */
export function managedVideoGroups(
  workspace?: ManagedWorkspaceBootstrap | null,
): ManagedWorkspaceGroup[] {
  const groups = managedVideoWorkspaceModels(workspace)?.groups || [];
  return groups.filter((group) => {
    if (group.video_available === false) return false;
    return Boolean(
      group.video_available ||
        group.video_capabilities ||
        (group.models || []).some((model) => model.video_capabilities),
    );
  });
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
