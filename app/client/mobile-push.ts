import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  PushNotifications,
  type ActionPerformed,
  type Token,
} from "@capacitor/push-notifications";
import { registerMobileDevice } from "./mobile-platform";

const INSTALLATION_KEY = "jisudeng-mobile-installation-id";

function installationId() {
  const stored = localStorage.getItem(INSTALLATION_KEY);
  if (stored) return stored;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  const id = `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  localStorage.setItem(INSTALLATION_KEY, id);
  return id;
}

function emitPushOpen(action: ActionPerformed) {
  const data = action.notification.data ?? {};
  window.dispatchEvent(
    new CustomEvent("jisudeng:push-open", {
      detail: {
        eventType: String(data.event_type ?? ""),
        sourceType: String(data.source_type ?? ""),
        sourceId: String(data.source_id ?? ""),
      },
    }),
  );
}

export async function registerMobilePush(
  baseUrl: string,
  accessToken: string,
  appVersion: string,
) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return () => undefined;
  }

  const handles: PluginListenerHandle[] = [];
  try {
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
          await registerMobileDevice(baseUrl, accessToken, installationId(), {
            fcm_token: token.value,
            platform: "android",
            app_version: appVersion,
            locale: navigator.language || "zh-CN",
          }).catch(() => undefined);
        },
      ),
      await PushNotifications.addListener("registrationError", () => undefined),
      await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        emitPushOpen,
      ),
    );
    await PushNotifications.register();
  } catch {
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
  return typeof window === "undefined" ? "" : installationId();
}
