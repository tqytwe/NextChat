import { describe, expect, test } from "@jest/globals";

import {
  isChatModel,
  isImageModel,
  isTranscriptionModel,
  isTtsModel,
  isVideoModel,
  modelHasDeclaredModality,
} from "../app/client/mobile-model-kind";

// Real ids as registered in the platform pricing catalog
// (model_prices_and_context_window.json), grouped by their `mode`.
const ASR_MODELS = [
  "gpt-4o-mini-transcribe",
  "gpt-4o-mini-transcribe-2025-03-20",
  "gpt-4o-mini-transcribe-2025-12-15",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
  "whisper-1",
];

const TTS_MODELS = [
  "gpt-4o-mini-tts",
  "gpt-4o-mini-tts-2025-03-20",
  "gpt-4o-mini-tts-2025-12-15",
  "gemini-2.5-flash-preview-tts",
];

describe("mobile model-kind classification", () => {
  test("ASR (audio_transcription) models classify as transcription, never chat", () => {
    for (const id of ASR_MODELS) {
      expect(isTranscriptionModel({ id })).toBe(true);
      expect(isChatModel({ id })).toBe(false);
      // ASR is not image/video/tts
      expect(isImageModel({ id })).toBe(false);
      expect(isVideoModel({ id })).toBe(false);
      expect(isTtsModel({ id })).toBe(false);
    }
  });

  test("TTS (audio_speech) models classify as tts, never chat", () => {
    for (const id of TTS_MODELS) {
      expect(isTtsModel({ id })).toBe(true);
      expect(isChatModel({ id })).toBe(false);
      expect(isTranscriptionModel({ id })).toBe(false);
    }
  });

  test("negative control: realtime native-audio model stays a chat model", () => {
    // The one catalog entry with mode=realtime. Its id contains "audio", so a
    // bare /audio/ exclusion would wrongly drop it from the chat list. It must
    // remain chat and must not be mistaken for ASR or TTS.
    const realtime = {
      id: "gemini-live-2.5-flash-preview-native-audio-09-2025",
    };
    expect(isChatModel(realtime)).toBe(true);
    expect(isTranscriptionModel(realtime)).toBe(false);
    expect(isTtsModel(realtime)).toBe(false);
    expect(isImageModel(realtime)).toBe(false);
  });

  test("ordinary chat models are unaffected", () => {
    for (const id of [
      "gpt-4o",
      "claude-sonnet-5",
      "deepseek-chat",
      "qwen-max",
    ]) {
      expect(isChatModel({ id })).toBe(true);
      expect(isTranscriptionModel({ id })).toBe(false);
      expect(isTtsModel({ id })).toBe(false);
    }
  });

  test("image models still classify as image, not chat", () => {
    for (const id of ["gpt-image-1", "dall-e-3", "flux-pro", "imagen-3"]) {
      expect(isImageModel({ id })).toBe(true);
      expect(isChatModel({ id })).toBe(false);
    }
  });

  test("uses the server-declared modality for the exact SenseNova image IDs", () => {
    for (const id of ["sensenova-u1.5-lite", "sensenova-u1-fast"]) {
      // These IDs deliberately do not contain the legacy image keywords. The
      // platform declaration, not an alias convention, makes them selectable.
      expect(isImageModel({ id, modalities: ["image"] })).toBe(true);
      expect(isChatModel({ id, modalities: ["image"] })).toBe(false);
      expect(isVideoModel({ id, modalities: ["image"] })).toBe(false);
      expect(
        modelHasDeclaredModality({ id, modalities: ["image"] }, "image"),
      ).toBe(true);
      expect(isImageModel({ id })).toBe(false);
    }
  });

  test("uses declared image and video capabilities before falling back to names", () => {
    expect(
      isImageModel({
        id: "sensenova-u1.5-lite",
        image_capabilities: { operations: ["generate"] },
      }),
    ).toBe(true);
    expect(
      isVideoModel({
        id: "provider-opaque-video",
        video_capabilities: { supported_durations: [8] },
      }),
    ).toBe(true);
    expect(
      isChatModel({
        id: "sensenova-u1-fast",
        image_capabilities: { operations: ["generate"] },
      }),
    ).toBe(false);
  });

  test("treats a present server declaration as authoritative over model names", () => {
    const mislabeled = { id: "gpt-image-1-video", modalities: ["chat"] };
    expect(isChatModel(mislabeled)).toBe(true);
    expect(isImageModel(mislabeled)).toBe(false);
    expect(isVideoModel(mislabeled)).toBe(false);

    const declaredVideo = { id: "provider-opaque-7", modalities: ["video"] };
    expect(isVideoModel(declaredVideo)).toBe(true);
    expect(isChatModel(declaredVideo)).toBe(false);
  });

  test("classification reads display_name/use_case/channel too, not just id", () => {
    expect(
      isTranscriptionModel({ id: "custom-1", display_name: "Whisper Large" }),
    ).toBe(true);
    expect(isTtsModel({ id: "custom-2", use_case: "text-to-speech" })).toBe(
      true,
    );
  });
});
