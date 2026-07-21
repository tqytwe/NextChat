import type {
  ManagedImagePrompt,
  ManagedImagePromptUseResult,
} from "./managed-prompts";

export type ManagedImagePromptCompatibleModel = {
  id: string;
  supported_sizes?: string[];
};

type ManagedImagePromptCompatibilitySource =
  | ManagedImagePrompt
  | ManagedImagePromptUseResult;

export type ManagedImagePromptCompatibilityFailureReason =
  | "missing-model"
  | "missing-reference-model"
  | "missing-size";

export type ManagedImagePromptCompatibilityResult<
  T extends ManagedImagePromptCompatibleModel,
> =
  | {
      ok: true;
      model: T;
      size?: string;
    }
  | {
      ok: false;
      reason: ManagedImagePromptCompatibilityFailureReason;
    };

export type ManagedImagePromptUsePreparationResult<
  T extends ManagedImagePromptCompatibleModel,
> =
  | {
      ok: true;
      result: ManagedImagePromptUseResult;
      model: T;
      size?: string;
    }
  | {
      ok: false;
      reason: ManagedImagePromptCompatibilityFailureReason;
    };

export async function prepareManagedImagePromptUse<
  T extends ManagedImagePromptCompatibleModel,
>(
  prompt: ManagedImagePrompt,
  models: T[] = [],
  currentModelID: string | undefined,
  canUseReferences: (model: T) => boolean,
  recordUse: (id: number) => Promise<ManagedImagePromptUseResult>,
): Promise<ManagedImagePromptUsePreparationResult<T>> {
  const localCompatibility = resolveManagedImagePromptCompatibility(
    prompt,
    models,
    currentModelID,
    canUseReferences,
  );
  if (!localCompatibility.ok) return localCompatibility;

  const result = await recordUse(prompt.id);
  const serverCompatibility = resolveManagedImagePromptCompatibility(
    result,
    models,
    currentModelID,
    canUseReferences,
  );
  if (!serverCompatibility.ok) return serverCompatibility;

  return {
    ok: true,
    result,
    model: serverCompatibility.model,
    size: serverCompatibility.size,
  };
}

export function resolveManagedImagePromptCompatibility<
  T extends ManagedImagePromptCompatibleModel,
>(
  prompt: ManagedImagePromptCompatibilitySource,
  models: T[] = [],
  currentModelID: string | undefined,
  canUseReferences: (model: T) => boolean,
): ManagedImagePromptCompatibilityResult<T> {
  const recommended = normalizeManagedImagePromptList(prompt.models);
  const requiresReference = requiresManagedImagePromptReference(prompt);
  const candidates =
    recommended.length > 0
      ? models.filter((model) => recommended.includes(model.id))
      : orderedManagedImagePromptFallbackModels(models, currentModelID);

  if (recommended.length > 0 && candidates.length === 0) {
    return { ok: false, reason: "missing-model" };
  }
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: requiresReference ? "missing-reference-model" : "missing-model",
    };
  }

  for (const model of candidates) {
    if (requiresReference && !canUseReferences(model)) continue;
    const size = selectManagedImagePromptSize(prompt, model);
    if ((prompt.sizes?.length ?? 0) > 0 && !size) continue;
    return { ok: true, model, size };
  }

  if (requiresReference && !candidates.some(canUseReferences)) {
    return { ok: false, reason: "missing-reference-model" };
  }
  return { ok: false, reason: "missing-size" };
}

export function selectManagedImagePromptSize(
  prompt: ManagedImagePromptCompatibilitySource,
  model: ManagedImagePromptCompatibleModel,
) {
  const sizes = normalizeManagedImagePromptList(prompt.sizes);
  if (sizes.length === 0) return undefined;
  const supported = normalizeManagedImagePromptList(model.supported_sizes);
  return sizes.find(
    (size) => supported.length === 0 || supported.includes(size),
  );
}

export function requiresManagedImagePromptReference(
  prompt: ManagedImagePromptCompatibilitySource,
) {
  return (
    prompt.requiresReference ||
    String(prompt.referenceRequirement || "").toLowerCase() === "required"
  );
}

function orderedManagedImagePromptFallbackModels<
  T extends ManagedImagePromptCompatibleModel,
>(models: T[], currentModelID?: string) {
  const current = models.find((model) => model.id === currentModelID);
  if (!current) return models;
  return [current, ...models.filter((model) => model.id !== current.id)];
}

function normalizeManagedImagePromptList(values?: string[]) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}
