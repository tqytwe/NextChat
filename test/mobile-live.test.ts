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
