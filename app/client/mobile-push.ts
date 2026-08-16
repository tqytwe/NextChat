import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  PushNotifications,
  type ActionPerformed,
  type Token,
} from "@capacitor/push-notifications";
import {
  getNativeFcmToken,
  isDirectNativeStreamAvailable,
  requestNotificationPermission,
} from "./android-native";
import {
  registerMobileDevice,
  submitMobileDiagnostic,
} from "./mobile-platform";
import { getInviteInstallationId } from "./invite-growth";
import { getManagedMobileLocale } from "./managed-mobile-i18n";

const PUSH_REFRESH_THROTTLE_MS = 30_000;

function pushLocale() {
  const locale = getManagedMobileLocale();
  if (locale === "jp") return "ja-JP";
  if (locale === "ko") return "ko-KR";
  if (locale === "en") return "en-US";
  return "zh-CN";
}

function pushLog(message: string, error?: unknown) {
  const detail = error instanceof Error ? error.message : String(error || "");
  if (detail) {
    console.warn(`[JisudengPush] ${message}: ${detail}`);
    return;
  }
  console.info(`[JisudengPush] ${message}`);
}

async function reportPushDiagnostic(
  baseUrl: string,
  accessToken: string,
  message: string,
) {
  const clippedMessage = message.slice(0, 500);
  await submitMobileDiagnostic(baseUrl, accessToken, {
    installation_id: getInviteInstallationId(),
    operation: "other",
    category: "client",
    path: "/push/fcm-registration",
    network_type: "unknown",
    metadata: {
      message: clippedMessage,
    },
  }).catch(() => undefined);
}

function emitPushOpen(action: ActionPerformed) {
  const data = action.notification.data ?? {};
  window.dispatchEvent(
    new CustomEvent("jisudeng:push-open", {
      detail: {
        eventType: String(data.event_type ?? ""),
        sourceType: String(data.source_type ?? ""),
        sourceId: String(data.source_id ?? ""),
        ticketId: String(data.ticket_id ?? ""),
        kind: String(data.kind ?? ""),
        status: String(data.status ?? ""),
        messageId: String(data.google_message_id ?? data.message_id ?? ""),
      },
    }),
  );
}

export async function registerMobilePush(
  baseUrl: string,
  accessToken: string,
  appVersion: string,
) {
  const directNative = isDirectNativeStreamAvailable();
  if (
    !directNative &&
    (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android")
  ) {
    return () => undefined;
  }

  const handles: PluginListenerHandle[] = [];
  try {
    if (directNative) {
      const permission = await requestNotificationPermission();
      if (!permission.granted) return () => undefined;
      let disposed = false;
      let syncing = false;
      let lastSyncedAt = 0;
      let lastToken = "";
      const syncNativeToken = async (force = false) => {
        if (disposed || syncing) return;
        const now = Date.now();
        if (!force && now - lastSyncedAt < PUSH_REFRESH_THROTTLE_MS) return;
        syncing = true;
        try {
          const token = (await getNativeFcmToken()).token.trim();
          if (!token) throw new Error("native FCM token is empty");
          if (!force && token === lastToken) {
            lastSyncedAt = now;
            return;
          }
          await registerMobileDevice(
            baseUrl,
            accessToken,
            getInviteInstallationId(),
            {
              fcm_token: token,
              platform: "android",
              app_version: appVersion,
              locale: pushLocale(),
            },
          );
          lastToken = token;
          lastSyncedAt = Date.now();
          pushLog("native FCM token registered");
        } catch (error) {
          pushLog("native FCM token registration failed", error);
          await reportPushDiagnostic(
            baseUrl,
            accessToken,
            `Native FCM device registration failed: ${
              error instanceof Error ? error.message : String(error || "")
            }`,
          );
        } finally {
          syncing = false;
        }
      };
      const refreshAfterResume = () => void syncNativeToken(false);
      const refreshAfterTokenRotation = () => void syncNativeToken(true);
      const refreshAfterVisibility = () => {
        if (document.visibilityState === "visible") refreshAfterResume();
      };
      window.addEventListener("jisudeng-native-resume", refreshAfterResume);
      window.addEventListener("online", refreshAfterResume);
      window.addEventListener(
        "jisudeng:fcm-token-refresh",
        refreshAfterTokenRotation,
      );
      window.addEventListener(
        "jisudeng:mobile-locale-change",
        refreshAfterResume,
      );
      document.addEventListener("visibilitychange", refreshAfterVisibility);
      await syncNativeToken(true);
      return () => {
        disposed = true;
        window.removeEventListener(
          "jisudeng-native-resume",
          refreshAfterResume,
        );
        window.removeEventListener("online", refreshAfterResume);
        window.removeEventListener(
          "jisudeng:fcm-token-refresh",
          refreshAfterTokenRotation,
        );
        window.removeEventListener(
          "jisudeng:mobile-locale-change",
          refreshAfterResume,
        );
        document.removeEventListener(
          "visibilitychange",
          refreshAfterVisibility,
        );
      };
    }

    const permission = await PushNotifications.checkPermissions();
    const result =
      permission.receive === "prompt"
        ? await PushNotifications.requestPermissions()
        : permission;
    if (result.receive !== "granted") return () => undefined;

    handles.push(
      await PushNotifications.addListener(
        "registration",
        async (token: Token) => {
          try {
            await registerMobileDevice(
              baseUrl,
              accessToken,
              getInviteInstallationId(),
              {
                fcm_token: token.value,
                platform: "android",
                app_version: appVersion,
                locale: pushLocale(),
              },
            );
            pushLog("Capacitor FCM token registered");
          } catch (error) {
            pushLog("Capacitor FCM token registration failed", error);
            await reportPushDiagnostic(
              baseUrl,
              accessToken,
              `Capacitor FCM device registration failed: ${
                error instanceof Error ? error.message : String(error || "")
              }`,
            );
          }
        },
      ),
      await PushNotifications.addListener(
        "registrationError",
        async (error) => {
          pushLog("Capacitor FCM token request failed", error?.error);
          await reportPushDiagnostic(
            baseUrl,
            accessToken,
            `Capacitor FCM token request failed: ${error?.error || "unknown"}`,
          );
        },
      ),
      await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        emitPushOpen,
      ),
    );
    await PushNotifications.register();
  } catch (error) {
    pushLog("mobile push registration failed", error);
    await reportPushDiagnostic(
      baseUrl,
      accessToken,
      `Mobile push registration failed: ${
        error instanceof Error ? error.message : String(error || "")
      }`,
    );
    await Promise.all(
      handles.map((handle) => handle.remove().catch(() => undefined)),
    );
    return () => undefined;
  }

  return () => {
    void Promise.all(
      handles.map((handle) => handle.remove().catch(() => undefined)),
    );
  };
}

export function mobileInstallationId() {
  return getInviteInstallationId();
}
