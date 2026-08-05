// Pure model-kind classification for the mobile workspace model list.
//
// The managed workspace ships every model a group's key can reach in one flat
// list with no explicit `mode` field, so the client classifies by matching the
// model's id/name/display_name/use_case/channel text. Extracted from
// mobile-app.tsx as pure predicates so the classification (and its negative
// controls) can be unit tested without importing the whole component.

// Structural subset of ManagedWorkspaceModel — only the string fields that
// carry classification signal. Accepting a subset keeps this module free of
// the heavier component/store types.
export interface ModelKindInput {
  id?: string;
  name?: string;
  display_name?: string;
  use_case?: string;
  channel?: string;
}

function modelText(model: ModelKindInput) {
  return [model.id, model.name, model.display_name, model.use_case, model.channel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isImageModel(model: ModelKindInput) {
  const text = modelText(model);
  if (/(video|audio|embedding|rerank|speech|tts|stt)/.test(text)) return false;
  return /(gpt-image|image-preview|image|dall|flux|sdxl|stable-diffusion|imagen|recraft|midjourney|grok-imagine|绘图|生图|画图|图片|图像|海报)/.test(
    text,
  );
}

export function isVideoModel(model: ModelKindInput) {
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
  return (
    !isImageModel(model) &&
    !isVideoModel(model) &&
    !isTranscriptionModel(model) &&
    !isTtsModel(model)
  );
}
