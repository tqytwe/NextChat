import { managedRequestText } from "./managed-nextchat";

export type MobileLiveState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export type MobileLiveTranscriptRole = "user" | "assistant";

export interface MobileLiveTranscriptEvent {
  role: MobileLiveTranscriptRole;
  text: string;
  done: boolean;
}

export interface MobileLiveSession {
  close(reason?: string): Promise<void>;
  readonly callRequestId: string;
}

export interface StartMobileLiveSessionInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  locale: string;
  requestId: string;
  instructions?: string;
  voice?: string;
  transcriptionModel?: string;
  signal?: AbortSignal;
  onState?: (state: MobileLiveState, detail?: string) => void;
  onTranscript?: (event: MobileLiveTranscriptEvent) => void;
}

type RealtimePayload = {
  type?: unknown;
  transcript?: unknown;
  delta?: unknown;
  item?: { role?: unknown; content?: Array<{ transcript?: unknown }> };
  response?: {
    output?: Array<{
      role?: unknown;
      content?: Array<{ transcript?: unknown; text?: unknown }>;
    }>;
  };
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isMobileLiveWebRTCAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof RTCPeerConnection !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

// Default Realtime transcription model. Kept as the fallback so an unset
// preference reproduces the previous hardcoded behaviour exactly.
export const DEFAULT_LIVE_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

export function mobileLiveSessionPayload(input: {
  model: string;
  locale: string;
  instructions?: string;
  voice?: string;
  transcriptionModel?: string;
}) {
  const language = input.locale.toLowerCase().startsWith("zh") ? "zh" : "en";
  const instructions = input.instructions?.trim();
  const voice = input.voice?.trim();
  const transcriptionModel =
    input.transcriptionModel?.trim() || DEFAULT_LIVE_TRANSCRIPTION_MODEL;
  return {
    model: input.model.trim(),
    modalities: ["audio", "text"],
    input_audio_transcription: { model: transcriptionModel, language },
    turn_detection: { type: "server_vad" },
    ...(instructions ? { instructions } : {}),
    ...(voice ? { voice } : {}),
  };
}

/**
 * Parses only published Realtime event shapes. Unknown frames stay opaque so
 * a provider-side event addition cannot be mistaken for a chat transcript.
 */
export function mobileLiveTranscriptFromEvent(
  payload: unknown,
): MobileLiveTranscriptEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const event = payload as RealtimePayload;
  const type = textValue(event.type);
  if (type === "conversation.item.input_audio_transcription.completed") {
    const text = textValue(event.transcript);
    return text ? { role: "user", text, done: true } : null;
  }
  if (type === "response.audio_transcript.delta") {
    const text = textValue(event.delta);
    return text ? { role: "assistant", text, done: false } : null;
  }
  if (type === "response.audio_transcript.done") {
    const text = textValue(event.transcript);
    return text ? { role: "assistant", text, done: true } : null;
  }
  if (type === "response.done") {
    const output = event.response?.output || [];
    for (const item of output) {
      if (textValue(item.role) !== "assistant") continue;
      for (const content of item.content || []) {
        const text = textValue(content.transcript) || textValue(content.text);
        if (text) return { role: "assistant", text, done: true };
      }
    }
  }
  return null;
}

function liveErrorMessage(body: string, status: number, requestId: string) {
  try {
    const payload = JSON.parse(body) as {
      error?: { message?: unknown };
      message?: unknown;
    };
    const message =
      textValue(payload.error?.message) || textValue(payload.message);
    if (message) return `${message} (HTTP ${status}, request ${requestId})`;
  } catch {
    // A non-JSON error cannot be trusted as a user-facing message.
  }
  return `Live session failed (HTTP ${status}, request ${requestId})`;
}

async function waitForIceGatheringComplete(
  peer: RTCPeerConnection,
  signal?: AbortSignal,
) {
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(), 6_000);
    const onChange = () => {
      if (peer.iceGatheringState === "complete") finish();
    };
    const onAbort = () => {
      finish();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const finish = () => {
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", onChange);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    peer.addEventListener("icegatheringstatechange", onChange);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function startMobileLiveSession(
  input: StartMobileLiveSessionInput,
): Promise<MobileLiveSession> {
  const requestId = input.requestId.trim();
  const model = input.model.trim();
  if (!requestId) throw new Error("A Live request ID is required.");
  if (!model) throw new Error("A Live model is required.");
  if (!input.apiKey.trim())
    throw new Error("A managed Live session is required.");
  if (!isMobileLiveWebRTCAvailable()) {
    throw new Error(
      "WebRTC microphone support is unavailable in this app shell.",
    );
  }
  if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  input.onState?.("connecting");
  const peer = new RTCPeerConnection();
  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");
  let localStream: MediaStream | null = null;
  let closed = false;
  let currentAssistantText = "";

  const close = async (reason = "closed") => {
    if (closed) return;
    closed = true;
    try {
      peer.close();
    } finally {
      localStream?.getTracks().forEach((track) => track.stop());
      remoteAudio.pause();
      remoteAudio.srcObject = null;
      input.onState?.("disconnected", reason);
    }
  };

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    localStream
      .getAudioTracks()
      .forEach((track) => peer.addTrack(track, localStream!));

    const events = peer.createDataChannel("oai-events");
    events.onmessage = (event) => {
      try {
        const transcript = mobileLiveTranscriptFromEvent(
          JSON.parse(String(event.data)),
        );
        if (!transcript) return;
        if (transcript.role === "assistant" && !transcript.done) {
          currentAssistantText += transcript.text;
          input.onTranscript?.({
            role: "assistant",
            text: currentAssistantText,
            done: false,
          });
          return;
        }
        if (transcript.role === "assistant") {
          const text = transcript.text || currentAssistantText;
          currentAssistantText = "";
          if (text)
            input.onTranscript?.({ role: "assistant", text, done: true });
          return;
        }
        input.onTranscript?.(transcript);
      } catch {
        // WebRTC data events are untrusted provider payloads. Ignore malformed frames.
      }
    };
    events.onopen = () => {
      const session = mobileLiveSessionPayload({
        model,
        locale: input.locale,
        instructions: input.instructions,
        voice: input.voice,
        transcriptionModel: input.transcriptionModel,
      });
      events.send(JSON.stringify({ type: "session.update", session }));
    };
    peer.ontrack = (event) => {
      remoteAudio.srcObject =
        event.streams[0] || new MediaStream([event.track]);
      void remoteAudio.play().catch(() => undefined);
    };
    peer.onconnectionstatechange = () => {
      if (closed) return;
      if (peer.connectionState === "connected") input.onState?.("connected");
      if (peer.connectionState === "failed") {
        input.onState?.("failed", "webrtc_connection_failed");
        void close("webrtc_connection_failed");
      }
    };

    const offer = await peer.createOffer({ offerToReceiveAudio: true });
    await peer.setLocalDescription(offer);
    await waitForIceGatheringComplete(peer, input.signal);
    const sdp = peer.localDescription?.sdp?.trim();
    if (!sdp) throw new Error("Live WebRTC offer is empty.");
    const response = await managedRequestText(
      input.baseUrl,
      "/v1/live",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/sdp, application/json",
          "X-Request-ID": requestId,
          "Idempotency-Key": requestId,
        },
        body: JSON.stringify({
          sdp,
          session: mobileLiveSessionPayload({
            model,
            locale: input.locale,
            instructions: input.instructions,
            voice: input.voice,
            transcriptionModel: input.transcriptionModel,
          }),
        }),
        signal: input.signal,
      },
      new Headers({
        Authorization: `Bearer ${input.apiKey}`,
        "Accept-Language": input.locale,
      }),
    );
    if (!response.ok) {
      throw new Error(
        liveErrorMessage(
          response.text,
          response.status,
          response.requestId || requestId,
        ),
      );
    }
    const answer = response.text.trim();
    if (!answer)
      throw new Error(
        `Live session returned an empty SDP (request ${
          response.requestId || requestId
        }).`,
      );
    await peer.setRemoteDescription({ type: "answer", sdp: answer });
    return { close, callRequestId: response.requestId || requestId };
  } catch (error) {
    await close(error instanceof Error ? error.message : "failed");
    input.onState?.(
      "failed",
      error instanceof Error ? error.message : "failed",
    );
    throw error;
  }
}
