// Pure model-kind classification for the mobile workspace model list.
//
// The platform now declares model modalities. Model names remain a narrowly
// scoped compatibility fallback for an older server only; they must never
// override a present server declaration.

// Structural subset of ManagedWorkspaceModel — only the string fields that
// carry classification signal. Accepting a subset keeps this module free of
// the heavier component/store types.
export interface ModelKindInput {
  id?: string | number;
  name?: string;
  display_name?: string;
  use_case?: string;
  channel?: string;
  modalities?: readonly string[];
  image_capabilities?: unknown;
  video_capabilities?: unknown;
}

export type ModelModality = "chat" | "image" | "video" | "audio";

/**
 * Returns `undefined` only when the server did not supply a modality field.
 * An empty array is a valid declaration and deliberately suppresses legacy
 * name matching, so a bad alias cannot expose an unauthorized capability.
 */
export function modelHasDeclaredModality(
  model: ModelKindInput,
  modality: ModelModality,
): boolean | undefined {
  if (!Array.isArray(model.modalities)) return undefined;
  return model.modalities.some(
    (item) => String(item).trim().toLowerCase() === modality,
  );
}

function hasDeclaredCapability(
  model: ModelKindInput,
  capability: "image_capabilities" | "video_capabilities",
) {
  return model[capability] !== undefined && model[capability] !== null;
}

function modelText(model: ModelKindInput) {
  return [
    model.id,
    model.name,
    model.display_name,
    model.use_case,
    model.channel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isImageModel(model: ModelKindInput) {
  const declared = modelHasDeclaredModality(model, "image");
  if (declared !== undefined) return declared;
  if (hasDeclaredCapability(model, "image_capabilities")) return true;
  const text = modelText(model);
  if (/(video|audio|embedding|rerank|speech|tts|stt)/.test(text)) return false;
  return /(gpt-image|image-preview|image|dall|flux|sdxl|stable-diffusion|imagen|recraft|midjourney|grok-imagine|绘图|生图|画图|图片|图像|海报)/.test(
    text,
  );
}

export function isVideoModel(model: ModelKindInput) {
  const declared = modelHasDeclaredModality(model, "video");
  if (declared !== undefined) return declared;
  if (hasDeclaredCapability(model, "video_capabilities")) return true;
  return /(video|影片|视频)/.test(modelText(model));
}

// Realtime transcription (ASR) models the Live path can select. Matched by
// name so the "国产分组" audio_transcription entries surface for the picker.
export function isTranscriptionModel(model: ModelKindInput) {
  return /(transcribe|whisper)/.test(modelText(model));
}

// Dedicated text-to-speech (audio_speech) models. Kept precise: never use a
// bare "audio" token, or realtime chat models like "...native-audio" would be
// wrongly excluded from chat. Only "text-to-speech" / a standalone "tts" match.
export function isTtsModel(model: ModelKindInput) {
  return /(text-to-speech|\btts\b)/.test(modelText(model));
}

export function isChatModel(model: ModelKindInput) {
  const declared = modelHasDeclaredModality(model, "chat");
  if (declared !== undefined) return declared;
  if (
    hasDeclaredCapability(model, "image_capabilities") ||
    hasDeclaredCapability(model, "video_capabilities")
  ) {
    return false;
  }
  return (
    !isImageModel(model) &&
    !isVideoModel(model) &&
    !isTranscriptionModel(model) &&
    !isTtsModel(model)
  );
}
