import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  PushNotifications,
  type ActionPerformed,
  type Token,
} from "@capacitor/push-notifications";
import { registerMobileDevice } from "./mobile-platform";
import { getInviteInstallationId } from "./invite-growth";

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
          await registerMobileDevice(
            baseUrl,
            accessToken,
            getInviteInstallationId(),
            {
              fcm_token: token.value,
              platform: "android",
              app_version: appVersion,
              locale: navigator.language || "zh-CN",
            },
          ).catch(() => undefined);
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
  return getInviteInstallationId();
}
