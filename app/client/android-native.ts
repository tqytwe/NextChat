import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NativePermissionResult {
  granted: boolean;
  status?: string;
  canAskAgain?: boolean;
}

export interface NativeDownloadResult {
  id?: string;
  path?: string;
  status?: string;
}

export interface NativeDownloadStatus {
  id?: string;
  status: "pending" | "running" | "success" | "failed" | "unknown";
  bytesDownloaded?: number;
  totalBytes?: number;
  progress?: number;
  reason?: string;
  localUri?: string;
}

export interface NativeCaptureImageResult {
  dataUrl?: string;
  uri?: string;
}

export interface NativeSpeechResult {
  text?: string;
  matches?: string[];
  cancelled?: boolean;
}

/**
 * Events emitted by the foreground push-to-talk bridge. A PTT session never
 * sends a chat message; consumers decide when (or whether) to use the final
 * transcript.
 */
export type NativeForegroundPttEventType =
  | "ready"
  | "partial"
  | "final"
  | "error"
  | "cancelled";

export interface NativeForegroundPttEvent {
  sessionId: string;
  type: NativeForegroundPttEventType;
  text?: string;
  matches?: string[];
  errorCode?: string;
  errorMessage?: string;
  recoverable?: boolean;
  reason?: string;
}

export interface NativeForegroundPttStartResult {
  sessionId: string;
  state: "listening";
}

export interface NativeForegroundPttSession {
  sessionId: string;
  stop(): Promise<void>;
  cancel(reason?: string): Promise<void>;
  unsubscribe(): void;
}

/**
 * Foreground-only wake-word events. The Android shell stops the recognizer
 * whenever its activity is backgrounded; this bridge must never be used for a
 * hidden microphone session.
 */
export type NativeWakeWordEventType =
  | "ready"
  | "partial"
  | "matched"
  | "error"
  | "stopped";

export interface NativeWakeWordEvent {
  sessionId: string;
  type: NativeWakeWordEventType;
  transcript?: string;
  phrase?: string;
  errorCode?: string;
  errorMessage?: string;
  recoverable?: boolean;
  reason?: string;
}

export interface NativeWakeWordSession {
  sessionId: string;
  stop(reason?: string): Promise<void>;
  unsubscribe(): void;
}

export type NativeSpeechEventType = "started" | "done" | "error" | "stopped";

export interface NativeSpeechEvent {
  utteranceId: string;
  type: NativeSpeechEventType;
  message?: string;
}

export interface NativeAppImage {
  id?: string;
  fileName: string;
  localUrl: string;
  mimeType?: string;
  prompt?: string;
  model?: string;
  size?: number;
  createdAt?: number;
  updatedAt?: number;
  ownerUserId?: string;
  /** Local content-workspace ownership metadata. Never sent to the API. */
  projectId?: string;
  runId?: string;
  shotId?: string;
  kind?: string;
  label?: string;
  collectionId?: string;
}

export interface NativeDeviceInfo {
  platform?: string;
  manufacturer?: string;
  brand?: string;
  model?: string;
  device?: string;
  product?: string;
  androidVersion?: string;
  sdkInt?: number;
  appVersionName?: string;
  appVersionCode?: number;
}

export interface NativeLoginCredentials {
  saved: boolean;
  email?: string;
  password?: string;
}

export interface NativeManagedSessionSecrets {
  saved?: boolean;
  backendBaseUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  accessTokenExpiresAt?: string;
  user?: object | null;
  session?: object | null;
  imageSession?: object | null;
}

export interface NativeE2EFixtureFlags {
  image502ThenSuccess?: boolean;
}

export interface NativeOpenUrlResult {
  opened: boolean;
  channel?: string;
  reason?: string;
}

export interface NativeSharedMaterial {
  id: string;
  name: string;
  fileName?: string;
  mimeType: string;
  size: number;
  kind?: "image" | "audio" | "video" | "text" | "pdf" | "file" | string;
  createdAt?: number;
}

export interface NativeRejectedSharedMaterial {
  reason: string;
  detail?: string;
}

export interface NativeSharedMaterialLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export interface NativeSharePayload {
  action?: string;
  type?: string;
  subject?: string;
  text?: string;
  files: NativeSharedMaterial[];
  rejected?: NativeRejectedSharedMaterial[];
  limits?: NativeSharedMaterialLimits;
}

export interface NativeSharedMaterialData extends NativeSharedMaterial {
  base64?: string;
  dataUrl?: string;
}

interface NextChatNativePlugin {
  finishApp?(): Promise<void>;
  showToast?(options: { message: string }): Promise<void>;
  requestGalleryPermissions(): Promise<NativePermissionResult>;
  requestCameraPermission(): Promise<NativePermissionResult>;
  requestMicrophonePermission(): Promise<NativePermissionResult>;
  requestNotificationPermission(): Promise<NativePermissionResult>;
  captureImage(options?: {
    fileName?: string;
  }): Promise<NativeCaptureImageResult>;
  recognizeSpeech(options?: {
    language?: string;
    prompt?: string;
  }): Promise<NativeSpeechResult>;
  startHoldSpeech?(options?: {
    language?: string;
    prompt?: string;
  }): Promise<NativeSpeechResult>;
  stopHoldSpeech?(): Promise<void>;
  cancelHoldSpeech?(): Promise<void>;
  startForegroundPtt?(options: {
    sessionId: string;
    language?: string;
    prompt?: string;
  }): Promise<NativeForegroundPttStartResult>;
  stopForegroundPtt?(options: { sessionId: string }): Promise<void>;
  cancelForegroundPtt?(options: {
    sessionId: string;
    reason?: string;
  }): Promise<void>;
  saveImageToGallery(options: {
    dataUrl: string;
    fileName?: string;
  }): Promise<{ uri?: string; fileName?: string }>;
  saveImageToAppStorage?(options: {
    dataUrl: string;
    fileName?: string;
    prompt?: string;
    model?: string;
    taskId?: string;
    ownerUserId?: string;
    projectId?: string;
    runId?: string;
    shotId?: string;
    kind?: string;
    label?: string;
    collectionId?: string;
  }): Promise<NativeAppImage>;
  listAppImages?(options?: {
    ownerUserId: string;
  }): Promise<{ items?: NativeAppImage[] }>;
  deleteAppImages?(options: {
    fileNames: string[];
    ownerUserId: string;
  }): Promise<{ deleted?: number }>;
  shareImage(options: {
    dataUrl: string;
    fileName?: string;
    title?: string;
    text?: string;
  }): Promise<void>;
  shareImages?(options: {
    items: Array<{ dataUrl: string; fileName?: string }>;
    title?: string;
    text?: string;
  }): Promise<void>;
  shareText(options: { title?: string; text: string }): Promise<void>;
  showNotification(options: { title: string; body: string }): Promise<void>;
  downloadFile(options: {
    url: string;
    fileName?: string;
    title?: string;
  }): Promise<NativeDownloadResult>;
  getDownloadStatus(options: { id: string }): Promise<NativeDownloadStatus>;
  installApk?(options: {
    id?: string;
    uri?: string;
    sha256?: string;
  }): Promise<void>;
  openUrl(options: { url: string }): Promise<NativeOpenUrlResult | void>;
  openAppSettings?(): Promise<void>;
  getDeviceInfo?(): Promise<NativeDeviceInfo>;
}

const NextChatNative = registerPlugin<NextChatNativePlugin>("NextChatNative");

declare global {
  interface Window {
    JisudengNativeBridge?: {
      request(payload: string): void;
    };
    __jisudengNativeResolve?: (id: string, payload: unknown) => void;
    __jisudengNativeReject?: (
      id: string,
      payload?: { message?: string },
    ) => void;
    __jisudengNativeStream?: (
      id: string,
      type: "status" | "data" | "done" | "error",
      payload?: {
        status?: number;
        line?: string;
        continued?: boolean;
        message?: string;
      },
    ) => void;
    __jisudengNativeBridgeToken?: string;
    __jisudengNativeForegroundPttEvent?: (
      sessionId: string,
      type: NativeForegroundPttEventType,
      payload?: Partial<NativeForegroundPttEvent>,
    ) => void;
    __jisudengNativeWakeWordEvent?: (
      sessionId: string,
      type: NativeWakeWordEventType,
      payload?: Partial<NativeWakeWordEvent>,
    ) => void;
    __jisudengNativeSpeechEvent?: (
      utteranceId: string,
      type: NativeSpeechEventType,
      payload?: Partial<NativeSpeechEvent>,
    ) => void;
  }
}

const pendingDirectNativeRequests = new Map<
  string,
  {
    resolve: (value: any) => void;
    reject: (reason?: unknown) => void;
  }
>();

const pendingNativeStreams = new Map<
  string,
  {
    onStatus?: (status: number) => void;
    onLine: (line: string) => void;
    partialLine: string;
    resolve: () => void;
    reject: (reason?: unknown) => void;
  }
>();

type ForegroundPttListener = (event: NativeForegroundPttEvent) => void;
type WakeWordListener = (event: NativeWakeWordEvent) => void;
type NativeSpeechListener = (event: NativeSpeechEvent) => void;

const foregroundPttListeners = new Map<string, Set<ForegroundPttListener>>();
const foregroundPttSessions = new Set<string>();
const wakeWordListeners = new Map<string, Set<WakeWordListener>>();
const wakeWordSessions = new Set<string>();
const nativeSpeechListeners = new Map<string, Set<NativeSpeechListener>>();
let foregroundPttLifecycleInstalled = false;

const foregroundPttTerminalEvents = new Set<NativeForegroundPttEventType>([
  "final",
  "error",
  "cancelled",
]);

function createForegroundPttSessionId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `ptt-${crypto.randomUUID()}`;
  }
  return `ptt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function removeForegroundPttLifecycleListenersIfIdle() {
  if (
    foregroundPttSessions.size ||
    wakeWordSessions.size ||
    !foregroundPttLifecycleInstalled
  ) {
    return;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("pagehide", handleForegroundPttPageHide);
    window.removeEventListener("popstate", handleForegroundPttRouteChange);
    window.removeEventListener("hashchange", handleForegroundPttRouteChange);
    window.removeEventListener(
      "jisudeng-native-route-change",
      handleForegroundPttRouteChange,
    );
  }
  if (typeof document !== "undefined") {
    document.removeEventListener(
      "visibilitychange",
      handleForegroundPttVisibilityChange,
    );
  }
  foregroundPttLifecycleInstalled = false;
}

function installForegroundPttLifecycleListeners() {
  if (foregroundPttLifecycleInstalled || typeof window === "undefined") return;
  window.addEventListener("pagehide", handleForegroundPttPageHide);
  window.addEventListener("popstate", handleForegroundPttRouteChange);
  window.addEventListener("hashchange", handleForegroundPttRouteChange);
  window.addEventListener(
    "jisudeng-native-route-change",
    handleForegroundPttRouteChange,
  );
  if (typeof document !== "undefined") {
    document.addEventListener(
      "visibilitychange",
      handleForegroundPttVisibilityChange,
    );
  }
  foregroundPttLifecycleInstalled = true;
}

function handleForegroundPttPageHide() {
  void cancelAllForegroundVoiceSessions("page_hidden");
}

function handleForegroundPttRouteChange() {
  void cancelAllForegroundVoiceSessions("route_changed");
}

function handleForegroundPttVisibilityChange() {
  if (
    typeof document === "undefined" ||
    document.visibilityState !== "hidden"
  ) {
    return;
  }
  void cancelAllForegroundVoiceSessions("app_backgrounded");
}

function getDirectNativeBridge() {
  if (typeof window === "undefined") return undefined;
  return window.JisudengNativeBridge;
}

function isDirectNativeBridgeAvailable() {
  return !!getDirectNativeBridge();
}

function ensureDirectNativeCallbacks() {
  if (typeof window === "undefined") return;
  window.__jisudengNativeResolve = (id, payload) => {
    const pending = pendingDirectNativeRequests.get(id);
    if (!pending) return;
    pendingDirectNativeRequests.delete(id);
    pending.resolve(payload);
  };
  window.__jisudengNativeReject = (id, payload) => {
    const pending = pendingDirectNativeRequests.get(id);
    if (!pending) return;
    pendingDirectNativeRequests.delete(id);
    pending.reject(new Error(payload?.message || "native request failed"));
  };
  window.__jisudengNativeStream = (id, type, payload) => {
    const pending = pendingNativeStreams.get(id);
    if (!pending) return;
    if (type === "status") {
      pending.onStatus?.(Number(payload?.status || 0));
      return;
    }
    if (type === "data") {
      pending.partialLine += String(payload?.line ?? "");
      if (!payload?.continued) {
        pending.onLine(pending.partialLine);
        pending.partialLine = "";
      }
      return;
    }
    pendingNativeStreams.delete(id);
    if (type === "done") {
      if (pending.partialLine) pending.onLine(pending.partialLine);
      pending.resolve();
      return;
    }
    pending.reject(
      new Error(
        payload?.message ||
          (payload?.status
            ? `HTTP ${payload.status}`
            : "stream request failed"),
      ),
    );
  };
  window.__jisudengNativeForegroundPttEvent = (sessionId, type, payload) => {
    const listeners = foregroundPttListeners.get(sessionId);
    const payloadMatches = payload?.matches;
    const matches = Array.isArray(payloadMatches)
      ? payloadMatches.filter(
          (match): match is string => typeof match === "string",
        )
      : undefined;
    const event: NativeForegroundPttEvent = {
      sessionId,
      type,
      text: typeof payload?.text === "string" ? payload.text : undefined,
      matches,
      errorCode:
        typeof payload?.errorCode === "string" ? payload.errorCode : undefined,
      errorMessage:
        typeof payload?.errorMessage === "string"
          ? payload.errorMessage
          : undefined,
      recoverable:
        typeof payload?.recoverable === "boolean"
          ? payload.recoverable
          : undefined,
      reason: typeof payload?.reason === "string" ? payload.reason : undefined,
    };
    for (const listener of listeners ? [...listeners] : []) {
      try {
        listener(event);
      } catch {
        // A screen-level callback must not prevent terminal native cleanup.
      }
    }
    if (!foregroundPttTerminalEvents.has(type)) return;
    foregroundPttListeners.delete(sessionId);
    foregroundPttSessions.delete(sessionId);
    removeForegroundPttLifecycleListenersIfIdle();
  };
  window.__jisudengNativeWakeWordEvent = (sessionId, type, payload) => {
    const listeners = wakeWordListeners.get(sessionId);
    const event: NativeWakeWordEvent = {
      sessionId,
      type,
      transcript:
        typeof payload?.transcript === "string"
          ? payload.transcript
          : undefined,
      phrase: typeof payload?.phrase === "string" ? payload.phrase : undefined,
      errorCode:
        typeof payload?.errorCode === "string" ? payload.errorCode : undefined,
      errorMessage:
        typeof payload?.errorMessage === "string"
          ? payload.errorMessage
          : undefined,
      recoverable:
        typeof payload?.recoverable === "boolean"
          ? payload.recoverable
          : undefined,
      reason: typeof payload?.reason === "string" ? payload.reason : undefined,
    };
    for (const listener of listeners ? [...listeners] : []) {
      try {
        listener(event);
      } catch {
        // A screen-level callback must not leave the native recognizer active.
      }
    }
    if (type !== "matched" && type !== "error" && type !== "stopped") return;
    wakeWordListeners.delete(sessionId);
    wakeWordSessions.delete(sessionId);
    removeForegroundPttLifecycleListenersIfIdle();
  };
  window.__jisudengNativeSpeechEvent = (utteranceId, type, payload) => {
    const listeners = nativeSpeechListeners.get(utteranceId);
    const event: NativeSpeechEvent = {
      utteranceId,
      type,
      message:
        typeof payload?.message === "string" ? payload.message : undefined,
    };
    for (const listener of listeners ? [...listeners] : []) {
      try {
        listener(event);
      } catch {
        // A visual callback must not retain a completed native utterance.
      }
    }
    if (type === "done" || type === "error" || type === "stopped") {
      nativeSpeechListeners.delete(utteranceId);
    }
  };
}

function callDirectNative<T>(method: string, options?: unknown) {
  const bridge = getDirectNativeBridge();
  if (!bridge) {
    return Promise.reject(new Error("native bridge is not available"));
  }
  ensureDirectNativeCallbacks();
  const explicitId =
    options &&
    typeof options === "object" &&
    "id" in options &&
    typeof (options as { id?: unknown }).id === "string"
      ? (options as { id: string }).id
      : "";
  const id =
    explicitId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bridgeToken =
    window.__jisudengNativeBridgeToken ||
    new URLSearchParams(window.location.search).get("nativeBridgeToken") ||
    "";
  window.__jisudengNativeBridgeToken = bridgeToken;
  return new Promise<T>((resolve, reject) => {
    pendingDirectNativeRequests.set(id, { resolve, reject });
    try {
      bridge.request(
        JSON.stringify({ id, method, options: options ?? {}, bridgeToken }),
      );
    } catch (error) {
      pendingDirectNativeRequests.delete(id);
      reject(error);
    }
  });
}

export function isDirectNativeStreamAvailable() {
  return isDirectNativeBridgeAvailable();
}

export async function getNativeE2EFixtureFlags() {
  if (!isDirectNativeBridgeAvailable()) {
    return {} as NativeE2EFixtureFlags;
  }
  return callDirectNative<NativeE2EFixtureFlags>("getE2EFixtureFlags");
}

export async function startDirectNativeStreamRequest(
  options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    bodyBase64?: string;
    connectTimeout?: number;
    readTimeout?: number;
  },
  callbacks: {
    onStatus?: (status: number) => void;
    onLine: (line: string) => void;
  },
) {
  ensureDirectNativeCallbacks();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const done = new Promise<void>((resolve, reject) => {
    pendingNativeStreams.set(id, {
      ...callbacks,
      partialLine: "",
      resolve,
      reject,
    });
  });
  try {
    await callDirectNative<{ id?: string }>("streamRequest", {
      ...options,
      id,
    });
  } catch (error) {
    pendingNativeStreams.delete(id);
    throw error;
  }
  return {
    id,
    done,
    cancel: async () => {
      const pending = pendingNativeStreams.get(id);
      pendingNativeStreams.delete(id);
      pending?.reject(new DOMException("Aborted", "AbortError"));
      try {
        await callDirectNative<void>("cancelStreamRequest", { id });
      } catch {
        // The UI has already been released locally; native cleanup is best effort.
      }
    },
  };
}

export function isNativeAndroid() {
  return (
    Capacitor.getPlatform() === "android" || isDirectNativeBridgeAvailable()
  );
}

export async function showNativeToast(message: string) {
  if (!message || !isNativeAndroid()) return;
  if (isDirectNativeBridgeAvailable()) {
    await callDirectNative<void>("showToast", { message });
    return;
  }
  await NextChatNative.showToast?.({ message });
}

export async function finishNativeApp() {
  if (!isNativeAndroid()) return;
  if (isDirectNativeBridgeAvailable()) {
    await callDirectNative<void>("finishApp");
    return;
  }
  await NextChatNative.finishApp?.();
}

export async function loadLoginCredentials(): Promise<NativeLoginCredentials> {
  if (!isDirectNativeBridgeAvailable()) return { saved: false };
  return callDirectNative<NativeLoginCredentials>("loadLoginCredentials");
}

export async function saveLoginCredentials(email: string, password: string) {
  if (!isDirectNativeBridgeAvailable()) return { saved: false };
  return callDirectNative<NativeLoginCredentials>("saveLoginCredentials", {
    email,
    password,
  });
}

export async function clearLoginCredentials() {
  if (!isDirectNativeBridgeAvailable()) return;
  await callDirectNative<void>("clearLoginCredentials");
}

export async function loadManagedSessionSecrets(): Promise<NativeManagedSessionSecrets> {
  if (!isDirectNativeBridgeAvailable()) return { saved: false };
  return callDirectNative<NativeManagedSessionSecrets>(
    "loadManagedSessionSecrets",
  );
}

export async function saveManagedSessionSecrets(
  secrets: NativeManagedSessionSecrets,
) {
  if (!isDirectNativeBridgeAvailable()) return { saved: false };
  return callDirectNative<{ saved?: boolean }>(
    "saveManagedSessionSecrets",
    secrets,
  );
}

export async function clearManagedSessionSecrets() {
  if (!isDirectNativeBridgeAvailable()) return;
  await callDirectNative<void>("clearManagedSessionSecrets");
}

export async function imageUrlToDataUrl(url: string) {
  if (url.startsWith("data:")) return url;
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadInBrowser(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.click();
}

export async function requestGalleryPermissions() {
  if (!isNativeAndroid()) return { granted: true };
  if (isDirectNativeBridgeAvailable()) {
    return callDirectNative<NativePermissionResult>(
      "requestGalleryPermissions",
    );
  }
  return NextChatNative.requestGalleryPermissions();
}

export async function requestNotificationPermission() {
  if (!isNativeAndroid()) return { granted: true };
  if (isDirectNativeBridgeAvailable()) {
    return callDirectNative<NativePermissionResult>(
      "requestNotificationPermission",
    );
  }
  return NextChatNative.requestNotificationPermission();
}

export async function requestCameraPermission() {
  if (!isNativeAndroid()) return { granted: true };
  if (isDirectNativeBridgeAvailable()) {
    return callDirectNative<NativePermissionResult>("requestCameraPermission");
  }
  return NextChatNative.requestCameraPermission();
}

export async function requestMicrophonePermission() {
  if (!isNativeAndroid()) return { granted: true };
  if (isDirectNativeBridgeAvailable()) {
    return callDirectNative<NativePermissionResult>(
      "requestMicrophonePermission",
    );
  }
  return NextChatNative.requestMicrophonePermission();
}

export async function captureImage(fileName = "jisudengchat-camera.jpg") {
  if (!isNativeAndroid()) {
    throw new Error("camera is only available in the Android app");
  }
  await requestCameraPermission();
  if (isDirectNativeBridgeAvailable()) {
    return callDirectNative<NativeCaptureImageResult>("captureImage", {
      fileName,
    });
  }
  return NextChatNative.captureImage({ fileName });
}

export async function recognizeSpeech(language?: string, prompt?: string) {
  if (!isNativeAndroid()) {
    throw new Error("speech recognition is only available in the Android app");
  }
  await requestMicrophonePermission();
  if (isDirectNativeBridgeAvailable()) {
    return callDirectNative<NativeSpeechResult>("recognizeSpeech", {
      language,
      prompt,
    });
  }
  return NextChatNative.recognizeSpeech({ language, prompt });
}

export async function startHoldSpeechRecognition(
  language?: string,
  prompt?: string,
) {
  if (!isNativeAndroid()) {
    throw new Error("speech recognition is only available in the Android app");
  }
  await requestMicrophonePermission();
  if (isDirectNativeBridgeAvailable()) {
    return callDirectNative<NativeSpeechResult>("startHoldSpeech", {
      language,
      prompt,
    });
  }
  if (NextChatNative.startHoldSpeech) {
    return NextChatNative.startHoldSpeech({ language, prompt });
  }
  return NextChatNative.recognizeSpeech({ language, prompt });
}

export async function stopHoldSpeechRecognition() {
  if (!isNativeAndroid()) return;
  if (isDirectNativeBridgeAvailable()) {
    await callDirectNative<void>("stopHoldSpeech");
    return;
  }
  if (NextChatNative.stopHoldSpeech) {
    await NextChatNative.stopHoldSpeech();
  }
}

export async function cancelHoldSpeechRecognition() {
  if (!isNativeAndroid()) return;
  if (isDirectNativeBridgeAvailable()) {
    await callDirectNative<void>("cancelHoldSpeech");
    return;
  }
  if (NextChatNative.cancelHoldSpeech) {
    await NextChatNative.cancelHoldSpeech();
  }
}

/**
 * Starts a foreground-only push-to-talk session. Transcripts are delivered to
 * `onEvent`; this bridge deliberately has no send-message or attachment API.
 */
export async function startForegroundPttSession(options: {
  sessionId?: string;
  language?: string;
  prompt?: string;
  onEvent: ForegroundPttListener;
}): Promise<NativeForegroundPttSession> {
  if (!isNativeAndroid()) {
    throw new Error("foreground PTT is only available in the Android app");
  }

  const sessionId = options.sessionId?.trim() || createForegroundPttSessionId();
  if (sessionId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(sessionId)) {
    throw new Error("foreground PTT session id is invalid");
  }

  await requestMicrophonePermission();
  await cancelAllForegroundPttSessions("replaced");
  ensureDirectNativeCallbacks();

  const listeners = new Set<ForegroundPttListener>([options.onEvent]);
  foregroundPttListeners.set(sessionId, listeners);
  foregroundPttSessions.add(sessionId);
  installForegroundPttLifecycleListeners();

  try {
    if (!isDirectNativeBridgeAvailable()) {
      throw new Error("foreground PTT is not available in this Android shell");
    }
    const result = await callDirectNative<NativeForegroundPttStartResult>(
      "startForegroundPtt",
      {
        sessionId,
        language: options.language,
        prompt: options.prompt,
      },
    );
    if (result.sessionId && result.sessionId !== sessionId) {
      throw new Error("foreground PTT returned an unexpected session id");
    }
  } catch (error) {
    foregroundPttListeners.delete(sessionId);
    foregroundPttSessions.delete(sessionId);
    removeForegroundPttLifecycleListenersIfIdle();
    throw error;
  }

  return {
    sessionId,
    stop: () => stopForegroundPttSession(sessionId),
    cancel: (reason?: string) => cancelForegroundPttSession(sessionId, reason),
    unsubscribe: () => {
      const current = foregroundPttListeners.get(sessionId);
      if (!current) return;
      current.delete(options.onEvent);
      if (!current.size) foregroundPttListeners.delete(sessionId);
    },
  };
}

export async function stopForegroundPttSession(sessionId: string) {
  if (!isNativeAndroid() || !sessionId) return;
  if (isDirectNativeBridgeAvailable()) {
    await callDirectNative<void>("stopForegroundPtt", { sessionId });
    return;
  }
  if (NextChatNative.stopForegroundPtt) {
    await NextChatNative.stopForegroundPtt({ sessionId });
  }
}

export async function cancelForegroundPttSession(
  sessionId: string,
  reason = "cancelled",
) {
  if (!isNativeAndroid() || !sessionId) return;
  try {
    if (isDirectNativeBridgeAvailable()) {
      await callDirectNative<void>("cancelForegroundPtt", {
        sessionId,
        reason,
      });
      return;
    }
    if (NextChatNative.cancelForegroundPtt) {
      await NextChatNative.cancelForegroundPtt({ sessionId, reason });
    }
  } finally {
    // Native normally emits `cancelled`. Clear stale local state even if its
    // WebView was already torn down during a lifecycle transition.
    foregroundPttListeners.delete(sessionId);
    foregroundPttSessions.delete(sessionId);
    removeForegroundPttLifecycleListenersIfIdle();
  }
}

export async function cancelAllForegroundPttSessions(reason = "cancelled") {
  const sessionIds = [...foregroundPttSessions];
  await Promise.all(
    sessionIds.map((sessionId) =>
      cancelForegroundPttSession(sessionId, reason).catch(() => {
        // Lifecycle cleanup must never hold navigation or backgrounding open.
      }),
    ),
  );
}

function createWakeWordSessionId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `wake-${crypto.randomUUID()}`;
  }
  return `wake-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createNativeSpeechUtteranceId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `tts-${crypto.randomUUID()}`;
  }
  return `tts-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Starts recognition only while the Android activity is foregrounded. A wake
 * match ends this session before the caller starts a normal PTT turn, so the
 * microphone is never owned by two recognizers at once.
 */
export async function startForegroundWakeWordSession(options: {
  sessionId?: string;
  phrase: string;
  language?: string;
  onEvent: WakeWordListener;
}): Promise<NativeWakeWordSession> {
  if (!isNativeAndroid()) {
    throw new Error("wake word is only available in the Android app");
  }
  const phrase = options.phrase.trim();
  if (!phrase || phrase.length > 64) {
    throw new Error("wake word must contain 1 to 64 characters");
  }
  const sessionId = options.sessionId?.trim() || createWakeWordSessionId();
  if (sessionId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(sessionId)) {
    throw new Error("wake word session id is invalid");
  }

  await requestMicrophonePermission();
  await cancelAllForegroundWakeWordSessions("replaced");
  await cancelAllForegroundPttSessions("replaced");
  ensureDirectNativeCallbacks();

  const listeners = new Set<WakeWordListener>([options.onEvent]);
  wakeWordListeners.set(sessionId, listeners);
  wakeWordSessions.add(sessionId);
  installForegroundPttLifecycleListeners();

  try {
    if (!isDirectNativeBridgeAvailable()) {
      throw new Error("wake word is not available in this Android shell");
    }
    const result = await callDirectNative<{ sessionId?: string }>(
      "startWakeWord",
      {
        sessionId,
        phrase,
        language: options.language,
      },
    );
    if (result.sessionId && result.sessionId !== sessionId) {
      throw new Error("wake word returned an unexpected session id");
    }
  } catch (error) {
    wakeWordListeners.delete(sessionId);
    wakeWordSessions.delete(sessionId);
    removeForegroundPttLifecycleListenersIfIdle();
    throw error;
  }

  return {
    sessionId,
    stop: (reason?: string) => stopForegroundWakeWordSession(sessionId, reason),
    unsubscribe: () => {
      const current = wakeWordListeners.get(sessionId);
      if (!current) return;
      current.delete(options.onEvent);
      if (!current.size) wakeWordListeners.delete(sessionId);
    },
  };
}

export async function stopForegroundWakeWordSession(
  sessionId: string,
  reason = "cancelled",
) {
  if (!isNativeAndroid() || !sessionId) return;
  try {
    if (isDirectNativeBridgeAvailable()) {
      await callDirectNative<void>("stopWakeWord", { sessionId, reason });
    }
  } finally {
    wakeWordListeners.delete(sessionId);
    wakeWordSessions.delete(sessionId);
    removeForegroundPttLifecycleListenersIfIdle();
  }
}

export async function cancelAllForegroundWakeWordSessions(
  reason = "cancelled",
) {
  const sessionIds = [...wakeWordSessions];
  await Promise.all(
    sessionIds.map((sessionId) =>
      stopForegroundWakeWordSession(sessionId, reason).catch(() => {
        // Route and background cleanup must never block the UI thread.
      }),
    ),
  );
}

export async function cancelAllForegroundVoiceSessions(reason = "cancelled") {
  await Promise.all([
    cancelAllForegroundPttSessions(reason),
    cancelAllForegroundWakeWordSessions(reason),
  ]);
}

export async function speakNativeText(options: {
  text: string;
  language?: string;
  rate?: number;
  onEvent?: NativeSpeechListener;
}) {
  const text = options.text.trim();
  if (!text || !isNativeAndroid()) return;
  if (!isDirectNativeBridgeAvailable()) {
    throw new Error("text to speech is not available in this Android shell");
  }
  // The listener has to exist before native TTS starts. Very short utterances
  // can finish before the request response reaches the WebView.
  const utteranceId = createNativeSpeechUtteranceId();
  if (options.onEvent) {
    nativeSpeechListeners.set(utteranceId, new Set([options.onEvent]));
  }
  try {
    const result = await callDirectNative<{ utteranceId?: string }>(
      "speakText",
      {
        text: text.slice(0, 3800),
        language: options.language,
        rate: Math.min(2, Math.max(0.5, Number(options.rate) || 1)),
        utteranceId,
      },
    );
    const returnedUtteranceId = String(result?.utteranceId || "");
    if (returnedUtteranceId && returnedUtteranceId !== utteranceId) {
      throw new Error("text to speech returned an unexpected utterance id");
    }
    return utteranceId;
  } catch (error) {
    nativeSpeechListeners.delete(utteranceId);
    throw error;
  }
}

export async function stopNativeSpeech() {
  if (!isNativeAndroid() || !isDirectNativeBridgeAvailable()) return;
  await callDirectNative<void>("stopSpeaking");
}

/**
 * Call this from a screen/router transition that does not update browser
 * history. Browser `popstate`, hash changes, page hide, and backgrounding are
 * already observed automatically.
 */
export function notifyForegroundPttRouteChange() {
  void cancelAllForegroundVoiceSessions("route_changed");
}

export async function saveImageToGallery(url: string, fileName: string) {
  const dataUrl = await imageUrlToDataUrl(url);
  if (isNativeAndroid()) {
    await requestGalleryPermissions();
    if (isDirectNativeBridgeAvailable()) {
      return callDirectNative<{ uri?: string; fileName?: string }>(
        "saveImageToGallery",
        { dataUrl, fileName },
      );
    }
    return NextChatNative.saveImageToGallery({ dataUrl, fileName });
  }
  downloadInBrowser(dataUrl, fileName);
  return { fileName };
}

export async function saveImageToAppStorage(
  url: string,
  fileName: string,
  metadata: {
    prompt?: string;
    model?: string;
    taskId?: string;
    ownerUserId?: string;
    projectId?: string;
    runId?: string;
    shotId?: string;
    kind?: string;
    label?: string;
    collectionId?: string;
  } = {},
) {
  const dataUrl = await imageUrlToDataUrl(url);
  if (isNativeAndroid()) {
    if (isDirectNativeBridgeAvailable()) {
      return callDirectNative<NativeAppImage>("saveImageToAppStorage", {
        dataUrl,
        fileName,
        ...metadata,
      });
    }
    if (NextChatNative.saveImageToAppStorage) {
      return NextChatNative.saveImageToAppStorage({
        dataUrl,
        fileName,
        ...metadata,
      });
    }
  }
  return {
    id: metadata.taskId || fileName,
    fileName,
    localUrl: dataUrl,
    mimeType: dataUrl.slice(5, dataUrl.indexOf(";")) || "image/png",
    prompt: metadata.prompt,
    model: metadata.model,
    ownerUserId: metadata.ownerUserId,
    projectId: metadata.projectId,
    runId: metadata.runId,
    shotId: metadata.shotId,
    kind: metadata.kind,
    label: metadata.label,
    collectionId: metadata.collectionId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function listAppImages(ownerUserId: string) {
  const owner = String(ownerUserId || "").trim();
  if (!owner) return [] as NativeAppImage[];
  if (!isNativeAndroid()) return [] as NativeAppImage[];
  if (isDirectNativeBridgeAvailable()) {
    const result = await callDirectNative<{ items?: NativeAppImage[] }>(
      "listAppImages",
      { ownerUserId: owner },
    );
    return result.items || [];
  }
  if (NextChatNative.listAppImages) {
    const result = await NextChatNative.listAppImages({ ownerUserId: owner });
    return result.items || [];
  }
  return [];
}

export async function deleteAppImages(
  fileNames: string[],
  ownerUserId: string,
) {
  const owner = String(ownerUserId || "").trim();
  if (!fileNames.length || !owner) return { deleted: 0 };
  if (isNativeAndroid()) {
    if (isDirectNativeBridgeAvailable()) {
      return callDirectNative<{ deleted?: number }>("deleteAppImages", {
        fileNames,
        ownerUserId: owner,
      });
    }
    if (NextChatNative.deleteAppImages) {
      return NextChatNative.deleteAppImages({ fileNames, ownerUserId: owner });
    }
  }
  return { deleted: 0 };
}

export async function shareImage(url: string, fileName: string, text?: string) {
  const dataUrl = await imageUrlToDataUrl(url);
  if (isNativeAndroid()) {
    if (isDirectNativeBridgeAvailable()) {
      return callDirectNative<void>("shareImage", {
        dataUrl,
        fileName,
        title: "JisudengChat",
        text,
      });
    }
    return NextChatNative.shareImage({
      dataUrl,
      fileName,
      title: "JisudengChat",
      text,
    });
  }
  if (navigator.share) {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], fileName, { type: blob.type || "image/png" });
    const payload: ShareData = {
      title: "JisudengChat",
      text,
      files: [file],
    };
    if (navigator.canShare?.(payload)) {
      await navigator.share(payload);
      return;
    }
  }
  downloadInBrowser(dataUrl, fileName);
}

export async function shareImages(
  items: Array<{ url: string; fileName: string }>,
  text?: string,
) {
  if (!items.length) return;
  const prepared = await Promise.all(
    items.map(async (item) => ({
      dataUrl: await imageUrlToDataUrl(item.url),
      fileName: item.fileName,
    })),
  );
  if (isNativeAndroid()) {
    if (isDirectNativeBridgeAvailable()) {
      return callDirectNative<void>("shareImages", {
        items: prepared,
        title: "JisudengChat",
        text,
      });
    }
    if (NextChatNative.shareImages) {
      return NextChatNative.shareImages({
        items: prepared,
        title: "JisudengChat",
        text,
      });
    }
  }
  if (navigator.share) {
    const files = await Promise.all(
      prepared.map(async (item) => {
        const blob = await (await fetch(item.dataUrl)).blob();
        return new File([blob], item.fileName, {
          type: blob.type || "image/png",
        });
      }),
    );
    const payload: ShareData = { title: "JisudengChat", text, files };
    if (navigator.canShare?.(payload)) {
      await navigator.share(payload);
      return;
    }
  }
  for (const item of prepared) downloadInBrowser(item.dataUrl, item.fileName);
}

export async function shareText(text: string, title = "JisudengChat") {
  if (isNativeAndroid()) {
    if (isDirectNativeBridgeAvailable()) {
      return callDirectNative<void>("shareText", { title, text });
    }
    return NextChatNative.shareText({ title, text });
  }
  if (navigator.share) {
    await navigator.share({ title, text });
    return;
  }
  await navigator.clipboard?.writeText(text);
}

export async function showNativeNotification(title: string, body: string) {
  if (!isNativeAndroid()) return;
  const permission = await requestNotificationPermission();
  if (!permission.granted) return;
  if (isDirectNativeBridgeAvailable()) {
    await callDirectNative<void>("showNotification", { title, body });
    return;
  }
  await NextChatNative.showNotification({ title, body });
}

function emptyNativeSharePayload(): NativeSharePayload {
  return {
    files: [],
    rejected: [],
    limits: {
      maxFiles: 0,
      maxFileBytes: 0,
      maxTotalBytes: 0,
    },
  };
}

function nativeOpenFailureMessage(result?: NativeOpenUrlResult | void) {
  return result && "reason" in result && result.reason
    ? result.reason
    : "open_url_failed";
}

export async function getPendingNativeShare(): Promise<NativeSharePayload> {
  if (!isNativeAndroid()) return emptyNativeSharePayload();
  if (isDirectNativeBridgeAvailable()) {
    const payload =
      await callDirectNative<NativeSharePayload>("getPendingShare");
    return {
      ...emptyNativeSharePayload(),
      ...payload,
      files: Array.isArray(payload.files) ? payload.files : [],
      rejected: Array.isArray(payload.rejected) ? payload.rejected : [],
    };
  }
  return emptyNativeSharePayload();
}

export async function readNativeSharedMaterial(
  id: string,
  encoding: "dataUrl" | "base64" | "metadata" | "none" = "dataUrl",
): Promise<NativeSharedMaterialData> {
  if (!id) throw new Error("shared material id is required");
  if (!isNativeAndroid() || !isDirectNativeBridgeAvailable()) {
    throw new Error(
      "native shared materials are only available in the Android app",
    );
  }
  return callDirectNative<NativeSharedMaterialData>("readSharedMaterial", {
    id,
    encoding,
  });
}

export async function openExternalUrl(
  url: string,
): Promise<NativeOpenUrlResult> {
  if (!url) {
    return { opened: false, reason: "open_url_empty" };
  }
  if (isNativeAndroid()) {
    if (isDirectNativeBridgeAvailable()) {
      const result = await callDirectNative<NativeOpenUrlResult>("openUrl", {
        url,
      });
      if (result && result.opened === false) {
        throw new Error(nativeOpenFailureMessage(result));
      }
      return result || { opened: true, channel: "native" };
    }
    const result = await NextChatNative.openUrl({ url });
    if (result && result.opened === false) {
      throw new Error(nativeOpenFailureMessage(result));
    }
    return result || { opened: true, channel: "capacitor" };
  }
  const handle = window.open(url, "_blank", "noopener,noreferrer");
  if (!handle) {
    throw new Error("open_url_popup_blocked");
  }
  return { opened: true, channel: "browser" };
}

export async function openAppSettings() {
  if (!isNativeAndroid()) return;
  if (isDirectNativeBridgeAvailable()) {
    await callDirectNative<void>("openAppSettings");
    return;
  }
  if (NextChatNative.openAppSettings) {
    await NextChatNative.openAppSettings();
  }
}

export async function getNativeDeviceInfo(): Promise<NativeDeviceInfo> {
  if (isNativeAndroid()) {
    if (isDirectNativeBridgeAvailable()) {
      return callDirectNative<NativeDeviceInfo>("getDeviceInfo");
    }
    if (NextChatNative.getDeviceInfo) {
      return NextChatNative.getDeviceInfo();
    }
  }
  return {
    platform: "web",
    model: typeof navigator !== "undefined" ? navigator.userAgent : "browser",
  } as NativeDeviceInfo;
}

export async function startNativeDownload(
  url: string,
  fileName: string,
  title = "JisudengChat",
) {
  if (isNativeAndroid()) {
    if (isDirectNativeBridgeAvailable()) {
      return callDirectNative<NativeDownloadResult>("downloadFile", {
        url,
        fileName,
        title,
      });
    }
    return NextChatNative.downloadFile({ url, fileName, title });
  }
  downloadInBrowser(url, fileName);
  return { status: "success", path: url };
}

export async function getNativeDownloadStatus(id: string) {
  if (!isNativeAndroid() || !id) {
    return { id, status: "success" as const, progress: 100 };
  }
  if (isDirectNativeBridgeAvailable()) {
    return callDirectNative<NativeDownloadStatus>("getDownloadStatus", { id });
  }
  return NextChatNative.getDownloadStatus({ id });
}

export async function installDownloadedApk(
  id?: string,
  uri?: string,
  sha256?: string,
) {
  if (!isNativeAndroid()) return;
  if (isDirectNativeBridgeAvailable()) {
    await callDirectNative<void>("installApk", { id, uri, sha256 });
    return;
  }
  if (NextChatNative.installApk) {
    await NextChatNative.installApk({ id, uri, sha256 });
  }
}
