package com.jisudeng.chat;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class JisudengFirebaseMessagingService extends FirebaseMessagingService {
    private static final String LOG_TAG = "JisudengPushService";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        Map<String, String> data = message.getData();
        String eventType = data == null ? "" : safeData(data, "event_type");
        String sourceType = data == null ? "" : safeData(data, "source_type");
        String sourceId = data == null ? "" : safeData(data, "source_id");
        Log.i(
            LOG_TAG,
            "FCM message received event_type=" +
            eventType +
            " source_type=" +
            sourceType +
            " has_source_id=" +
            (!sourceId.isEmpty())
        );
        persistPushNotification(message, data);
        showPushNotification(message, data);
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        int length = token == null ? 0 : token.length();
        Log.i(LOG_TAG, "FCM token refreshed length=" + length);
        if (token == null || token.trim().isEmpty()) return;
        getSharedPreferences(MainActivity.PUSH_PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(MainActivity.PUSH_LAST_FCM_TOKEN, token.trim())
            .apply();
        Intent refreshIntent = new Intent(MainActivity.FCM_TOKEN_REFRESH_ACTION);
        refreshIntent.setPackage(getPackageName());
        sendBroadcast(refreshIntent);
    }

    private void persistPushNotification(RemoteMessage message, Map<String, String> data) {
        try {
            String messageId = message.getMessageId();
            String id = messageId == null || messageId.trim().isEmpty()
                ? "local-" + System.currentTimeMillis() + "-" + safeData(data, "event_type").hashCode()
                : messageId.trim();
            JSONObject item = new JSONObject();
            item.put("id", id);
            item.put("title", notificationTitle(message, data));
            item.put("body", notificationBody(message, data));
            item.put("eventType", safeData(data, "event_type"));
            item.put("sourceType", safeData(data, "source_type"));
            item.put("sourceId", safeData(data, "source_id"));
            item.put("ticketId", safeData(data, "ticket_id"));
            item.put("kind", safeData(data, "kind"));
            item.put("status", safeData(data, "status"));
            item.put("receivedAt", message.getSentTime() > 0 ? message.getSentTime() : System.currentTimeMillis());
            item.put("read", false);
            storePushInboxItem(this, item);
            Intent changedIntent = new Intent(MainActivity.PUSH_INBOX_CHANGED_ACTION);
            changedIntent.setPackage(getPackageName());
            sendBroadcast(changedIntent);
        } catch (JSONException error) {
            Log.w(LOG_TAG, "Unable to persist FCM inbox item", error);
        }
    }

    public static synchronized JSONArray readPushInbox(Context context) {
        String raw = context
            .getSharedPreferences(MainActivity.PUSH_PREFERENCES, Context.MODE_PRIVATE)
            .getString(MainActivity.PUSH_INBOX_KEY, "[]");
        try {
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (JSONException error) {
            return new JSONArray();
        }
    }

    private static synchronized void storePushInboxItem(Context context, JSONObject item) {
        JSONArray current = readPushInbox(context);
        JSONArray next = new JSONArray();
        String newId = item.optString("id", "");
        next.put(item);
        for (int index = 0; index < current.length() && next.length() < 100; index += 1) {
            JSONObject existing = current.optJSONObject(index);
            if (existing == null || newId.equals(existing.optString("id", ""))) continue;
            next.put(existing);
        }
        writePushInbox(context, next);
    }

    public static synchronized void markPushInboxRead(
        Context context,
        JSONArray requestedIds,
        boolean markAll
    ) {
        JSONArray current = readPushInbox(context);
        for (int index = 0; index < current.length(); index += 1) {
            JSONObject item = current.optJSONObject(index);
            if (item == null) continue;
            if (markAll || jsonArrayContains(requestedIds, item.optString("id", ""))) {
                try {
                    item.put("read", true);
                } catch (JSONException ignored) {
                }
            }
        }
        writePushInbox(context, current);
    }

    public static synchronized void clearPushInbox(Context context) {
        writePushInbox(context, new JSONArray());
    }

    private static boolean jsonArrayContains(JSONArray values, String expected) {
        if (values == null || expected == null || expected.isEmpty()) return false;
        for (int index = 0; index < values.length(); index += 1) {
            if (expected.equals(values.optString(index, ""))) return true;
        }
        return false;
    }

    private static void writePushInbox(Context context, JSONArray items) {
        context
            .getSharedPreferences(MainActivity.PUSH_PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(MainActivity.PUSH_INBOX_KEY, items.toString())
            .apply();
    }

    private void showPushNotification(RemoteMessage message, Map<String, String> data) {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            Log.w(LOG_TAG, "FCM notification skipped because notification permission is not granted");
            return;
        }
        NotificationManager manager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            Log.w(LOG_TAG, "FCM notification skipped because NotificationManager is unavailable");
            return;
        }
        MainActivity.ensurePushNotificationChannel(this);
        String title = notificationTitle(message, data);
        String body = notificationBody(message, data);
        Intent openIntent = MainActivity.createPushOpenIntent(this, data, message.getMessageId());
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            notificationRequestCode(message, data),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | immutablePendingIntentFlag()
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, MainActivity.PUSH_CHANNEL_ID)
            : new Notification.Builder(this);
        builder
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            builder.setStyle(new Notification.BigTextStyle().bigText(body));
        }
        manager.notify(notificationRequestCode(message, data), builder.build());
    }

    private String notificationTitle(RemoteMessage message, Map<String, String> data) {
        RemoteMessage.Notification notification = message.getNotification();
        if (notification != null && notification.getTitle() != null && !notification.getTitle().trim().isEmpty()) {
            return notification.getTitle().trim();
        }
        String title = safeData(data, "title");
        return title.isEmpty() ? getString(getApplicationInfo().labelRes) : title;
    }

    private String notificationBody(RemoteMessage message, Map<String, String> data) {
        RemoteMessage.Notification notification = message.getNotification();
        if (notification != null && notification.getBody() != null && !notification.getBody().trim().isEmpty()) {
            return notification.getBody().trim();
        }
        String body = safeData(data, "body");
        return body.isEmpty() ? getString(R.string.push_open_details) : body;
    }

    private static String safeData(Map<String, String> data, String key) {
        if (data == null || key == null) return "";
        String value = data.get(key);
        return value == null ? "" : value.trim();
    }

    private static int notificationRequestCode(RemoteMessage message, Map<String, String> data) {
        String seed = message.getMessageId();
        if (seed == null || seed.trim().isEmpty()) {
            seed = safeData(data, "event_type") +
                "|" +
                safeData(data, "source_type") +
                "|" +
                safeData(data, "source_id") +
                "|" +
                safeData(data, "ticket_id");
        }
        if (seed == null || seed.trim().isEmpty()) return (int) System.currentTimeMillis();
        return seed.hashCode();
    }

    private static int immutablePendingIntentFlag() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return PendingIntent.FLAG_IMMUTABLE;
        }
        return 0;
    }
}
