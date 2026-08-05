import { describe, expect, test } from "@jest/globals";

import {
  mobileLiveSessionPayload,
  mobileLiveTranscriptFromEvent,
} from "../app/client/mobile-live";

describe("managed mobile Live protocol", () => {
  test("builds a bounded server-owned Realtime session payload", () => {
    expect(
      mobileLiveSessionPayload({
        model: "gpt-4o-realtime-preview",
        locale: "zh-CN",
        instructions: "请简洁回答",
        voice: "alloy",
      }),
    ).toEqual({
      model: "gpt-4o-realtime-preview",
      modalities: ["audio", "text"],
      input_audio_transcription: {
        model: "gpt-4o-mini-transcribe",
        language: "zh",
      },
      turn_detection: { type: "server_vad" },
      instructions: "请简洁回答",
      voice: "alloy",
    });
  });

  test("uses a selected transcription model when provided", () => {
    const payload = mobileLiveSessionPayload({
      model: "gpt-4o-realtime-preview",
      locale: "en-US",
      transcriptionModel: "gpt-4o-transcribe",
      voice: "verse",
    });
    expect(payload.input_audio_transcription).toEqual({
      model: "gpt-4o-transcribe",
      language: "en",
    });
    expect(payload.voice).toBe("verse");
  });

  test("falls back to the default transcription model when unset or blank", () => {
    // Unset preference must reproduce the previous hardcoded behaviour exactly.
    expect(
      mobileLiveSessionPayload({ model: "m", locale: "zh-CN" })
        .input_audio_transcription.model,
    ).toBe("gpt-4o-mini-transcribe");
    // Whitespace-only is treated as unset, not passed through as an empty model.
    expect(
      mobileLiveSessionPayload({
        model: "m",
        locale: "zh-CN",
        transcriptionModel: "   ",
      }).input_audio_transcription.model,
    ).toBe("gpt-4o-mini-transcribe");
  });

  test("omits voice entirely when no voice is selected", () => {
    const payload = mobileLiveSessionPayload({ model: "m", locale: "en-US" });
    expect("voice" in payload).toBe(false);
  });

  test("accepts only recognized Realtime transcript events", () => {
    expect(
      mobileLiveTranscriptFromEvent({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "hello",
      }),
    ).toEqual({ role: "user", text: "hello", done: true });
    expect(
      mobileLiveTranscriptFromEvent({
        type: "response.audio_transcript.delta",
        delta: "Hi",
      }),
    ).toEqual({ role: "assistant", text: "Hi", done: false });
    expect(mobileLiveTranscriptFromEvent({ type: "unknown", text: "ignore" })).toBeNull();
  });
});
