export type MobileChatPreference = {
  groupId?: number;
  model?: string;
  modelsByGroup?: Record<string, string>;
};

export type MobileChatPreferenceGroup<Model> = {
  id: number;
  is_current?: boolean;
  models?: Model[];
};

export type ResolvedMobileChatPreference = {
  groupId?: number;
  model: string;
  reason:
    | "default"
    | "fallback"
    | "migrated"
    | "pending"
    | "saved"
    | "unavailable";
};

function validGroupId(value: unknown) {
  const groupId = Number(value);
  return Number.isFinite(groupId) && groupId > 0 ? groupId : undefined;
}

function cleanModel(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeMobileChatPreference(
  value: unknown,
): MobileChatPreference {
  const raw = value && typeof value === "object" ? (value as any) : {};
  const groupId = validGroupId(raw.groupId);
  const model = cleanModel(raw.model);
  const modelsByGroup: Record<string, string> = {};

  if (raw.modelsByGroup && typeof raw.modelsByGroup === "object") {
    Object.entries(raw.modelsByGroup).forEach(([key, candidate]) => {
      const scopedGroupId = validGroupId(key);
      const scopedModel = cleanModel(candidate);
      if (scopedGroupId && scopedModel) {
        modelsByGroup[String(scopedGroupId)] = scopedModel;
      }
    });
  }

  // Migrate the original single group/model preference without losing it.
  if (groupId && model && !modelsByGroup[String(groupId)]) {
    modelsByGroup[String(groupId)] = model;
  }

  return { groupId, model, modelsByGroup };
}

export function rememberedMobileChatModel(
  preference: MobileChatPreference,
  groupId?: number,
) {
  const normalized = normalizeMobileChatPreference(preference);
  const scopedGroupId = validGroupId(groupId);
  if (scopedGroupId) {
    return normalized.modelsByGroup?.[String(scopedGroupId)] || "";
  }
  return normalized.model || "";
}

export function updateMobileChatPreference(
  preference: MobileChatPreference,
  groupId?: number,
  model = "",
): MobileChatPreference {
  const normalized = normalizeMobileChatPreference(preference);
  const nextGroupId = validGroupId(groupId);
  const nextModel = cleanModel(model);
  if (!nextGroupId || !nextModel) return normalized;

  return {
    groupId: nextGroupId,
    model: nextModel,
    modelsByGroup: {
      ...normalized.modelsByGroup,
      [String(nextGroupId)]: nextModel,
    },
  };
}

export function resolveMobileChatPreference<Model>(input: {
  groups?: MobileChatPreferenceGroup<Model>[];
  workspaceLoaded?: boolean;
  preference: MobileChatPreference;
  preferredGroupId?: number;
  candidateModels?: string[];
  isChatModel: (model: Model) => boolean;
  modelValue: (model: Model) => string;
  /** Allows a current contract to migrate an old display-name preference. */
  modelMatches?: (model: Model, candidate: string) => boolean;
}): ResolvedMobileChatPreference {
  const preference = normalizeMobileChatPreference(input.preference);
  const candidateModels = Array.from(
    new Set((input.candidateModels || []).map(cleanModel).filter(Boolean)),
  );
  const modelMatches = (model: Model, candidate: string) =>
    input.modelMatches?.(model, candidate) ||
    input.modelValue(model).trim() === candidate;
  const requestedGroupId = validGroupId(input.preferredGroupId);
  const savedGroupId = preference.groupId;
  const groups = (input.groups || [])
    .map((group) => ({
      group,
      models: (group.models || []).filter(input.isChatModel),
    }))
    .filter((item) => item.models.length > 0);

  // Do not replace a saved choice while bootstrap has not delivered models.
  if (!groups.length) {
    const pendingGroupId = requestedGroupId || savedGroupId;
    if (input.workspaceLoaded) {
      return {
        groupId: pendingGroupId,
        model: "",
        reason: "unavailable",
      };
    }
    return {
      groupId: pendingGroupId,
      model:
        candidateModels[0] ||
        rememberedMobileChatModel(preference, pendingGroupId) ||
        preference.model ||
        "",
      reason: "pending",
    };
  }

  // Keep a valid requested/saved group. When it disappeared, follow a uniquely
  // matching saved model before using the server's current group or a fallback.
  let target =
    groups.find((item) => item.group.id === requestedGroupId) ||
    groups.find((item) => item.group.id === savedGroupId);
  let targetSource: "current" | "first" | "migrated" | "saved" = target
    ? "saved"
    : "current";
  const migrationCandidates = Array.from(
    new Set(
      [
        ...candidateModels,
        rememberedMobileChatModel(preference, savedGroupId),
        preference.model || "",
      ].filter(Boolean),
    ),
  );
  if (!target) {
    for (const candidate of migrationCandidates) {
      const matchingGroups = groups.filter((item) =>
        item.models.some((model) => modelMatches(model, candidate)),
      );
      if (matchingGroups.length === 1) {
        target = matchingGroups[0];
        targetSource = "migrated";
        break;
      }
    }
  }
  if (!target) {
    target = groups.find((item) => item.group.is_current);
    targetSource = target ? "current" : "first";
  }
  const resolvedTarget = target || groups[0]!;

  const candidates = Array.from(
    new Set(
      [
        ...candidateModels,
        rememberedMobileChatModel(preference, resolvedTarget.group.id),
        preference.model || "",
      ].filter(Boolean),
    ),
  );
  const matchingModel = candidates
    .map((candidate) =>
      resolvedTarget.models.find((item) => modelMatches(item, candidate)),
    )
    .find((model): model is Model => Boolean(model));
  if (matchingModel) {
    return {
      groupId: resolvedTarget.group.id,
      model: input.modelValue(matchingModel).trim(),
      reason: targetSource === "migrated" ? "migrated" : "saved",
    };
  }

  return {
    groupId: resolvedTarget.group.id,
    model: input.modelValue(resolvedTarget.models[0]).trim(),
    reason:
      candidates.length || targetSource === "migrated" ? "fallback" : "default",
  };
}
