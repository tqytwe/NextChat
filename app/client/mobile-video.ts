import type {
  ManagedModelModality,
  ManagedSession,
  ManagedVideoSuppressedModel,
  ManagedWorkspaceBootstrap,
  ManagedWorkspaceGroup,
  ManagedWorkspaceModel,
  ManagedWorkspaceModels,
} from "./managed-nextchat";
import {
  ManagedApiError,
  managedWorkspaceModelID,
  managedWorkspaceModelMatches,
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

export type MobileVideoServerCapabilities = NonNullable<
  ManagedWorkspaceModel["video_capabilities"]
>;

export type MobileVideoServerSuppressedModel = ManagedVideoSuppressedModel;

export type ManagedVideoUnavailableDiagnostic =
  MobileVideoServerSuppressedModel & {
    groupId: number;
    groupName: string;
  };

export type MobileVideoServerModel =
  | string
  | {
      id?: string;
      /** Exact provider model ID used by the mobile video bootstrap. */
      model?: string;
      name?: string;
      display_name?: string;
      platform?: string;
      modalities?: ManagedModelModality[];
      adapter?: string;
      capability_version?: string;
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
  /** Models the server inspected but intentionally did not expose as runnable. */
  suppressed?: MobileVideoServerSuppressedModel[];
};

export type MobileVideoServerBootstrap = {
  protocol_version?: number;
  capabilities_version?: string;
  groups?: MobileVideoServerGroup[];
};

/** The retry UI distinguishes a missing endpoint from an expired login. */
export type MobileVideoBootstrapFailure =
  | "not_found"
  | "unauthorized"
  | "request_failed";

export type ManagedVideoGroupSource =
  | "server"
  | "workspace"
  | "merged"
  | "unavailable";

export type ResolvedManagedVideoGroups = {
  source: ManagedVideoGroupSource;
  groups: ManagedWorkspaceGroup[];
  /** Raw server codes are preserved; callers must localize before display. */
  suppressed: ManagedVideoUnavailableDiagnostic[];
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

/**
 * The video workspace is already purpose-scoped by the platform. Its group
 * and model rows are display truth for the signed-in user, including newer
 * provider rows that have not yet gained optional capability annotations.
 */
export function filterManagedVideoGroups(
  groups?: ManagedWorkspaceGroup[],
): ManagedWorkspaceGroup[] {
  return (groups || []).filter((group) => (group.models || []).length > 0);
}

export function managedVideoGroups(
  workspace?: ManagedWorkspaceBootstrap | null,
): ManagedWorkspaceGroup[] {
  const groups = managedVideoWorkspaceModels(workspace)?.groups;
  return filterManagedVideoGroups(groups);
}

export function managedVideoModels(
  group?: ManagedWorkspaceGroup,
): ManagedWorkspaceModel[] {
  return group?.models || [];
}

function normalizeServerModalities(
  modalities?: ManagedModelModality[],
): ManagedModelModality[] | undefined {
  if (!Array.isArray(modalities)) return undefined;
  return modalities.filter((modality): modality is ManagedModelModality =>
    ["chat", "image", "video", "audio"].includes(modality),
  );
}

/**
 * Existing mobile-video bootstraps predate the typed `operations` field but
 * already carry a server-authorized per-model capability record. Normalize
 * that response here instead of making the app guess from a group name.
 */
function normalizeServerVideoCapabilities(
  value?: MobileVideoServerCapabilities,
): MobileVideoServerCapabilities | undefined {
  if (!value) return undefined;
  const capabilities = { ...value };
  if (!Array.isArray(capabilities.operations)) {
    const legacy = capabilities as MobileVideoServerCapabilities & {
      text_to_video?: boolean;
    };
    if (
      legacy.text_to_video === true ||
      (capabilities.resolutions || capabilities.supported_resolutions || [])
        .length > 0
    ) {
      capabilities.operations = ["generate"];
    }
  }
  return capabilities;
}

function normalizeServerVideoModel(
  model: MobileVideoServerModel,
  group: MobileVideoServerGroup,
  capabilitiesVersion?: string,
): ManagedWorkspaceModel | undefined {
  const modelID =
    typeof model === "string"
      ? model.trim()
      : String(model.model || model.id || model.name || "").trim();
  const legacyCapabilities = normalizeServerVideoCapabilities(
    typeof model === "string"
      ? group.model_capabilities?.[modelID] ||
          group.video_capabilities ||
          group.capabilities
      : model.video_capabilities ||
          model.capabilities ||
          group.model_capabilities?.[modelID] ||
          group.model_capabilities?.[String(model.name || "").trim()] ||
          group.video_capabilities ||
          group.capabilities,
  );
  const legacyAuthorized = Boolean(group.video_available && legacyCapabilities);
  if (typeof model === "string") {
    const name = modelID;
    if (!name) return undefined;
    return {
      id: name,
      name,
      ...(legacyAuthorized ? { modalities: ["video"] } : {}),
      platform: group.platform,
      ...(legacyAuthorized
        ? {
            adapter: "mobile-video-bootstrap",
            capability_version: capabilitiesVersion || "legacy-bootstrap",
          }
        : {}),
      video_capabilities: legacyCapabilities,
    };
  }

  const id = modelID;
  if (!id) return undefined;
  const legacyName = String(model.name || "").trim();
  const displayName = String(
    model.display_name || (legacyName && legacyName !== id ? legacyName : ""),
  ).trim();
  return {
    id,
    name: id,
    ...(displayName ? { display_name: displayName } : {}),
    platform: model.platform || group.platform,
    modalities:
      normalizeServerModalities(model.modalities) ||
      (legacyAuthorized ? ["video"] : undefined),
    adapter:
      model.adapter ||
      (legacyAuthorized ? "mobile-video-bootstrap" : undefined),
    capability_version:
      model.capability_version ||
      (legacyAuthorized
        ? capabilitiesVersion || "legacy-bootstrap"
        : undefined),
    video_capabilities: legacyCapabilities,
  };
}

function normalizeServerVideoSuppressed(
  suppressed?: MobileVideoServerSuppressedModel[],
): MobileVideoServerSuppressedModel[] {
  return (suppressed || []).flatMap((item) => {
    const model = String(item?.model || "").trim();
    const code = String(item?.code || "").trim();
    return model && code ? [{ model, code }] : [];
  });
}

/** Convert both the old string-list and new typed video bootstrap payloads. */
export function normalizeMobileVideoBootstrapGroups(
  groups?: MobileVideoServerGroup[],
  capabilitiesVersion?: string,
  strictMediaContract = false,
): ManagedWorkspaceGroup[] {
  const mediaContractVersion =
    String(capabilitiesVersion || "").trim() ||
    (strictMediaContract ? "mobile-video-contract" : "");
  return (groups || []).flatMap((group) => {
    const id = Number(group.id);
    if (!Number.isFinite(id)) return [];
    const sourceModels = group.models?.length
      ? group.models
      : Object.keys(group.model_capabilities || {});
    // A sibling capability map is supplementary metadata, not an allow-list.
    // The signed-in video workspace already describes the user's selectable
    // group. Dropping string rows here made newly added models disappear until
    // every optional capability row had been populated.
    const models = sourceModels;
    return [
      {
        id,
        name: String(group.name || group.id),
        platform: group.platform,
        modalities: normalizeServerModalities(group.modalities),
        video_available: group.video_available,
        video_unavailable_code: group.video_unavailable_code,
        media_contract_version: mediaContractVersion || undefined,
        video_suppressed: normalizeServerVideoSuppressed(group.suppressed),
        video_capabilities: group.video_capabilities || group.capabilities,
        models: models.flatMap((model) => {
          const normalized = normalizeServerVideoModel(
            model,
            group,
            capabilitiesVersion,
          );
          return normalized ? [normalized] : [];
        }),
      },
    ];
  });
}

function groupKey(group: ManagedWorkspaceGroup) {
  return String(Number(group.id));
}

function modelKey(model: ManagedWorkspaceModel) {
  return managedWorkspaceModelID(model);
}

function mergeManagedVideoModels(
  workspaceModels?: ManagedWorkspaceModel[],
  serverModels?: ManagedWorkspaceModel[],
): ManagedWorkspaceModel[] {
  const supplemental = new Map(
    (serverModels || [])
      .map((model) => [modelKey(model), model] as const)
      .filter(([id]) => Boolean(id)),
  );
  const merged: ManagedWorkspaceModel[] = [];

  for (const workspaceModel of workspaceModels || []) {
    const id = modelKey(workspaceModel);
    const serverModel = supplemental.get(id);
    if (!serverModel) {
      merged.push(workspaceModel);
      continue;
    }
    supplemental.delete(id);
    // The purpose-scoped workspace controls membership. The dedicated
    // bootstrap can only enrich the same model with newer presentation and
    // capability metadata; it must never remove a valid account-owned row.
    merged.push({
      ...workspaceModel,
      ...serverModel,
      id: workspaceModel.id || serverModel.id,
      name: workspaceModel.name || serverModel.name,
      display_name: serverModel.display_name || workspaceModel.display_name,
      modalities: serverModel.modalities || workspaceModel.modalities,
      video_capabilities:
        serverModel.video_capabilities || workspaceModel.video_capabilities,
    });
  }

  // A newer server bootstrap can expose an extra video model before the
  // workspace refresh reaches the device. It is already purpose-scoped, so it
  // is safe to append without looking at a model or group name.
  supplemental.forEach((model) => merged.push(model));
  return merged;
}

/**
 * Keep the signed-in video workspace as the complete account membership list.
 * The dedicated bootstrap is a metadata supplement, not an allow-list: it can
 * be partially populated while a user already has a newly added video group.
 */
export function mergeManagedVideoGroups(input: {
  workspaceGroups?: ManagedWorkspaceGroup[];
  serverGroups?: ManagedWorkspaceGroup[];
}): ManagedWorkspaceGroup[] {
  const serverById = new Map(
    filterManagedVideoGroups(input.serverGroups).map((group) => [
      groupKey(group),
      group,
    ]),
  );
  const merged: ManagedWorkspaceGroup[] = [];

  for (const workspaceGroup of filterManagedVideoGroups(
    input.workspaceGroups,
  )) {
    const serverGroup = serverById.get(groupKey(workspaceGroup));
    if (!serverGroup) {
      merged.push(workspaceGroup);
      continue;
    }
    serverById.delete(groupKey(workspaceGroup));
    merged.push({
      ...workspaceGroup,
      ...serverGroup,
      id: workspaceGroup.id,
      name: workspaceGroup.name || serverGroup.name,
      models: mergeManagedVideoModels(
        workspaceGroup.models,
        serverGroup.models,
      ),
      video_capabilities:
        serverGroup.video_capabilities || workspaceGroup.video_capabilities,
      video_suppressed:
        serverGroup.video_suppressed || workspaceGroup.video_suppressed,
    });
  }

  serverById.forEach((group) => merged.push(group));
  return filterManagedVideoGroups(merged);
}

export function resolveManagedVideoGroups(input: {
  serverBootstrapLoaded: boolean;
  serverGroups?: ManagedWorkspaceGroup[];
  workspace?: ManagedWorkspaceBootstrap | null;
}): ResolvedManagedVideoGroups {
  const workspaceGroups = managedVideoGroups(input.workspace);
  const serverGroups = filterManagedVideoGroups(input.serverGroups);
  if (!input.serverBootstrapLoaded) {
    return workspaceGroups.length
      ? { source: "workspace", groups: workspaceGroups, suppressed: [] }
      : { source: "unavailable", groups: [], suppressed: [] };
  }

  const groups = mergeManagedVideoGroups({ workspaceGroups, serverGroups });
  const source: ManagedVideoGroupSource =
    workspaceGroups.length && serverGroups.length
      ? "merged"
      : workspaceGroups.length
      ? "workspace"
      : serverGroups.length
      ? "server"
      : "server";
  return {
    source,
    groups,
    suppressed: collectManagedVideoUnavailableDiagnostics(input.serverGroups),
  };
}

/**
 * Preserve every server suppression reason even when its group has no
 * executable models and is therefore not selectable. A successful bootstrap
 * with only suppressions is different from a failed bootstrap.
 */
function collectManagedVideoUnavailableDiagnostics(
  groups?: ManagedWorkspaceGroup[],
): ManagedVideoUnavailableDiagnostic[] {
  const diagnostics: ManagedVideoUnavailableDiagnostic[] = [];
  for (const group of groups || []) {
    const groupId = Number(group.id);
    const groupName = String(group.name || group.id || "").trim();
    for (const item of group.video_suppressed || []) {
      const model = String(item?.model || "").trim();
      const code = String(item?.code || "").trim();
      if (model && code) diagnostics.push({ model, code, groupId, groupName });
    }
    // Older compatible servers can provide one group reason without the
    // per-model list. Retain it as a diagnostic rather than treating the
    // successful response as a transport failure.
    if (
      group.video_available === false &&
      group.video_unavailable_code &&
      !(group.video_suppressed || []).length
    ) {
      diagnostics.push({
        model: "",
        code: String(group.video_unavailable_code).trim(),
        groupId,
        groupName,
      });
    }
  }
  return diagnostics;
}

export function managedVideoCapabilities(
  model?: ManagedWorkspaceModel,
  group?: ManagedWorkspaceGroup,
) {
  if (model?.video_capabilities) return model.video_capabilities;
  return group?.video_capabilities;
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
  return managedWorkspaceModelID(model);
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
    const matchingModel = group?.models?.find((model) =>
      managedWorkspaceModelMatches(model, activeModel),
    );
    if (group && matchingModel && isChatModel(matchingModel)) {
      return {
        groupId: group.id,
        model: workspaceModelValue(matchingModel),
        source: "session",
      };
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
    modelMatches: managedWorkspaceModelMatches,
  });
  const group = groups.find((item) => item.id === resolved.groupId);
  const matchingModel = group?.models?.find((model) =>
    managedWorkspaceModelMatches(model, resolved.model),
  );
  if (!group || !matchingModel || !isChatModel(matchingModel)) {
    return {
      groupId: resolved.groupId,
      model: "",
      source: "unavailable",
    };
  }
  return {
    groupId: group.id,
    model: workspaceModelValue(matchingModel),
    source: "preference",
  };
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
  return session.purpose === "video" &&
    session.api_key.trim() &&
    session.api_key_id > 0
    ? session
    : null;
}

/**
 * Video jobs are authorized against one exact purpose/group key. A chat key,
 * a video key for another group, or an old unscoped response must all stop
 * before a job request is attempted.
 */
export function selectManagedVideoSessionForGroup(
  sessions:
    | { chat?: ManagedSession; video?: ManagedSession }
    | null
    | undefined,
  groupID: number,
): ManagedSession | null {
  const session = selectManagedVideoSession(sessions);
  return session && Number(session.group_id) === Number(groupID) && groupID > 0
    ? session
    : null;
}

export function classifyMobileVideoBootstrapFailure(
  error: unknown,
): MobileVideoBootstrapFailure {
  if (error instanceof ManagedApiError) {
    if (error.status === 404) return "not_found";
    if (error.status === 401 || error.status === 403) return "unauthorized";
  }
  return "request_failed";
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
