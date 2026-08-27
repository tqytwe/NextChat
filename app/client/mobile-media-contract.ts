import type {
  ManagedImageCapabilities,
  ManagedSession,
  ManagedVideoCapabilities,
  ManagedWorkspaceModel,
  ManagedWorkspaceModels,
} from "./managed-nextchat";
import {
  isImageModel,
  isVideoModel,
  modelHasDeclaredModality,
} from "./mobile-model-kind";

export type ManagedMediaPurpose = "image" | "video";
export type ManagedImageOperation = "create" | "edit";
export type ManagedVideoOperation = "generate";

/** A missing or mislabelled image session must never borrow another media key. */
export function selectManagedImageSession(
  sessions?: { chat?: ManagedSession; image?: ManagedSession } | null,
): ManagedSession | null {
  const session = sessions?.image;
  if (!session) return null;
  return session.purpose === "image" &&
    session.api_key.trim() &&
    session.api_key_id > 0
    ? session
    : null;
}

/**
 * Image generation is authorized against one exact purpose/group key. A chat
 * key, an image key for another group, or an unscoped response must stop
 * before an Images API request is attempted.
 */
export function selectManagedImageSessionForGroup(
  sessions:
    | { chat?: ManagedSession; image?: ManagedSession }
    | null
    | undefined,
  groupID: number,
): ManagedSession | null {
  const session = selectManagedImageSession(sessions);
  return session && Number(session.group_id) === Number(groupID) && groupID > 0
    ? session
    : null;
}

export type ManagedImageRequestValidationCode =
  | "model_not_executable"
  | "operation_not_supported"
  | "size_not_supported"
  | "reference_not_supported";

export type ManagedImageRequestValidation =
  | { valid: true; strict: boolean }
  | {
      valid: false;
      strict: boolean;
      code: ManagedImageRequestValidationCode;
    };

export type ManagedVideoRequestValidation =
  | { valid: true; strict: boolean }
  | {
      valid: false;
      strict: boolean;
      code:
        | "model_not_executable"
        | "operation_not_supported"
        | "resolution_not_supported"
        | "ratio_not_supported"
        | "duration_not_supported"
        | "reference_not_supported";
    };

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedValues(values?: readonly unknown[]) {
  return (values || [])
    .map((value) => normalizedText(value).toLowerCase())
    .filter(Boolean);
}

function includesOperation(
  values: readonly unknown[] | undefined,
  operation: string,
) {
  return normalizedValues(values).includes(operation.toLowerCase());
}

function imageCapabilities(model: ManagedWorkspaceModel) {
  return model.image_capabilities;
}

function videoCapabilities(model: ManagedWorkspaceModel) {
  return model.video_capabilities;
}

function hasModelMediaDeclaration(model: ManagedWorkspaceModel) {
  return Boolean(
    Array.isArray(model.modalities) ||
      model.image_capabilities !== undefined ||
      model.video_capabilities !== undefined ||
      normalizedText(model.adapter) ||
      normalizedText(model.capability_version),
  );
}

/**
 * A managed workspace becomes strict as soon as the platform has emitted any
 * media-contract marker. Mixing a declared model with name-based inference
 * would allow stale aliases to bypass the platform's authorization decision.
 */
export function hasManagedMediaContract(
  models?: ManagedWorkspaceModels | null,
) {
  if (!models) return false;
  if (
    normalizedText(models.image_capabilities_version) ||
    normalizedText(models.video_capabilities_version)
  ) {
    return true;
  }
  return (models.groups || []).some((group) =>
    Boolean(
      Array.isArray(group.modalities) ||
        group.video_available !== undefined ||
        normalizedText(group.media_contract_version) ||
        group.video_capabilities !== undefined ||
        (group.models || []).some(hasModelMediaDeclaration),
    ),
  );
}

function hasRunnableDeclaredMediaCapability(
  model: ManagedWorkspaceModel,
  purpose: ManagedMediaPurpose,
  operation: string,
) {
  const capabilities =
    purpose === "image" ? imageCapabilities(model) : videoCapabilities(model);
  return Boolean(
    modelHasDeclaredModality(model, purpose) === true &&
      normalizedText(model.adapter) &&
      normalizedText(model.capability_version) &&
      capabilities &&
      includesOperation(capabilities.operations, operation),
  );
}

function canUseLegacyModel(
  model: ManagedWorkspaceModel,
  purpose: ManagedMediaPurpose,
) {
  return purpose === "image" ? isImageModel(model) : isVideoModel(model);
}

/**
 * Returns whether a model is selectable for one exact operation. Contract
 * responses fail closed when the modality, adapter, version, or operation is
 * missing. The name-based branch exists only for completely legacy payloads.
 */
export function isExecutableManagedMediaModel(
  model: ManagedWorkspaceModel,
  purpose: ManagedMediaPurpose,
  operation: ManagedImageOperation | ManagedVideoOperation,
  models?: ManagedWorkspaceModels | null,
) {
  const strict =
    hasManagedMediaContract(models) || hasModelMediaDeclaration(model);
  if (strict) {
    return hasRunnableDeclaredMediaCapability(model, purpose, operation);
  }
  return canUseLegacyModel(model, purpose);
}

export function isExecutableManagedImageModel(
  model: ManagedWorkspaceModel,
  operation: ManagedImageOperation = "create",
  models?: ManagedWorkspaceModels | null,
) {
  return isExecutableManagedMediaModel(model, "image", operation, models);
}

export function isExecutableManagedVideoModel(
  model: ManagedWorkspaceModel,
  models?: ManagedWorkspaceModels | null,
) {
  return isExecutableManagedMediaModel(model, "video", "generate", models);
}

export function managedImageReferenceLimit(model?: ManagedWorkspaceModel) {
  const value = Number(model?.image_capabilities?.max_reference_images || 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function parseImageSize(value: string) {
  const match = /^(\d{2,5})x(\d{2,5})$/i.exec(value.trim());
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

function normalizedRatio(width: number, height: number) {
  let left = Math.abs(width);
  let right = Math.abs(height);
  while (right) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  const divisor = left || 1;
  return `${width / divisor}:${height / divisor}`;
}

function matchesSupportedRatio(
  width: number,
  height: number,
  ratios?: readonly string[],
) {
  const supported = normalizedValues(ratios);
  if (!supported.length) return true;
  const actual = normalizedRatio(width, height).toLowerCase();
  return supported.some((ratio) => ratio.replace(/\s+/g, "") === actual);
}

/** Validate exactly the constraints advertised by a declared image model. */
export function isManagedImageSizeSupported(
  capabilities: ManagedImageCapabilities | undefined,
  size: string,
) {
  if (!capabilities) return false;
  const normalizedSize = normalizedText(size).toLowerCase();
  const fixedSizes = normalizedValues(capabilities.supported_sizes);
  if (fixedSizes.length && !fixedSizes.includes(normalizedSize)) return false;

  const dimensions = parseImageSize(size);
  if (!dimensions) return false;
  const { width, height } = dimensions;
  const sizingKind = normalizedText(capabilities.sizing_kind).toLowerCase();
  if (sizingKind === "fixed") return fixedSizes.length > 0;

  if (sizingKind === "custom_dimensions") {
    const min = Number(capabilities.min_dimension || 0);
    const max = Number(capabilities.max_dimension || 0);
    const step = Number(capabilities.dimension_step || 0);
    const maxAspectRatio = Number(capabilities.max_aspect_ratio || 0);
    if (
      (min > 0 && (width < min || height < min)) ||
      (max > 0 && (width > max || height > max))
    ) {
      return false;
    }
    if (step > 0 && (width % step !== 0 || height % step !== 0)) {
      return false;
    }
    if (
      maxAspectRatio > 0 &&
      Math.max(width, height) / Math.min(width, height) > maxAspectRatio
    ) {
      return false;
    }
  }
  return matchesSupportedRatio(width, height, capabilities.supported_ratios);
}

export function validateManagedImageRequest(input: {
  model?: ManagedWorkspaceModel;
  models?: ManagedWorkspaceModels | null;
  operation: ManagedImageOperation;
  size: string;
  referenceCount: number;
}): ManagedImageRequestValidation {
  const strict =
    hasManagedMediaContract(input.models) ||
    Boolean(input.model && hasModelMediaDeclaration(input.model));
  if (
    !input.model ||
    !isExecutableManagedImageModel(input.model, input.operation, input.models)
  ) {
    return { valid: false, strict, code: "model_not_executable" };
  }
  if (!strict) return { valid: true, strict: false };

  const capabilities = input.model.image_capabilities;
  if (
    !capabilities ||
    !includesOperation(capabilities.operations, input.operation)
  ) {
    return { valid: false, strict, code: "operation_not_supported" };
  }
  if (!isManagedImageSizeSupported(capabilities, input.size)) {
    return { valid: false, strict, code: "size_not_supported" };
  }
  if (
    input.referenceCount > 0 &&
    input.referenceCount > managedImageReferenceLimit(input.model)
  ) {
    return { valid: false, strict, code: "reference_not_supported" };
  }
  return { valid: true, strict };
}

function includesTextValue(
  values: readonly string[] | undefined,
  value: string,
) {
  return normalizedValues(values).includes(normalizedText(value).toLowerCase());
}

function includesNumberValue(
  values: readonly number[] | undefined,
  value: number,
) {
  return (values || []).some((candidate) => Number(candidate) === value);
}

export function validateManagedVideoRequest(input: {
  model?: ManagedWorkspaceModel;
  models?: ManagedWorkspaceModels | null;
  resolution: string;
  ratio: string;
  duration: number;
  referenceAssetCount?: number;
  referenceImageCount?: number;
  referenceVideoCount?: number;
  referenceAudioCount?: number;
}): ManagedVideoRequestValidation {
  const strict =
    hasManagedMediaContract(input.models) ||
    Boolean(input.model && hasModelMediaDeclaration(input.model));
  if (
    !input.model ||
    !isExecutableManagedVideoModel(input.model, input.models)
  ) {
    return { valid: false, strict, code: "model_not_executable" };
  }
  if (!strict) return { valid: true, strict: false };

  const capabilities: ManagedVideoCapabilities | undefined =
    input.model.video_capabilities;
  if (
    !capabilities ||
    !includesOperation(capabilities.operations, "generate")
  ) {
    return { valid: false, strict, code: "operation_not_supported" };
  }
  if (
    !includesTextValue(capabilities.supported_resolutions, input.resolution)
  ) {
    return { valid: false, strict, code: "resolution_not_supported" };
  }
  if (!includesTextValue(capabilities.supported_ratios, input.ratio)) {
    return { valid: false, strict, code: "ratio_not_supported" };
  }
  if (!includesNumberValue(capabilities.supported_durations, input.duration)) {
    return { valid: false, strict, code: "duration_not_supported" };
  }
  const references = {
    total: Number(input.referenceAssetCount || 0),
    image: Number(input.referenceImageCount || 0),
    video: Number(input.referenceVideoCount || 0),
    audio: Number(input.referenceAudioCount || 0),
  };
  if (
    (Number(capabilities.max_reference_assets || 0) > 0 &&
      references.total > Number(capabilities.max_reference_assets)) ||
    references.image > Number(capabilities.max_reference_images || 0) ||
    references.video > Number(capabilities.max_reference_videos || 0) ||
    references.audio > Number(capabilities.max_reference_audios || 0)
  ) {
    return { valid: false, strict, code: "reference_not_supported" };
  }
  return { valid: true, strict };
}
