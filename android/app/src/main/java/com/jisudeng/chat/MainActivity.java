package com.jisudeng.chat;

import android.annotation.SuppressLint;
import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ApplicationInfo;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;
import android.provider.OpenableColumns;
import android.provider.MediaStore;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.AtomicFile;
import android.util.Base64;
import android.util.Log;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.crashlytics.FirebaseCrashlytics;
import com.google.firebase.perf.FirebasePerformance;
import com.google.firebase.perf.metrics.Trace;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String LOG_TAG = "JisudengNative";
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int PERMISSION_REQUEST_BASE = 5200;
    private static final int CAMERA_REQUEST = 6200;
    private static final int SPEECH_REQUEST = 6201;
    private static final String CHANNEL_ID = "jisudengchat_status";
    public static final String PUSH_CHANNEL_ID = "jisudengchat_push";
    public static final String PUSH_ACTION_OPEN = "com.jisudeng.chat.PUSH_OPEN";
    public static final String FCM_TOKEN_REFRESH_ACTION = "com.jisudeng.chat.FCM_TOKEN_REFRESH";
    public static final String PUSH_INBOX_CHANGED_ACTION = "com.jisudeng.chat.PUSH_INBOX_CHANGED";
    public static final String PUSH_PREFERENCES = "jisudengchat_push";
    public static final String PUSH_LAST_FCM_TOKEN = "last_fcm_token";
    public static final String PUSH_INBOX_KEY = "notification_inbox_v1";
    public static final String PUSH_EXTRA_EVENT_TYPE = "jisudeng_push_event_type";
    public static final String PUSH_EXTRA_SOURCE_TYPE = "jisudeng_push_source_type";
    public static final String PUSH_EXTRA_SOURCE_ID = "jisudeng_push_source_id";
    public static final String PUSH_EXTRA_TICKET_ID = "jisudeng_push_ticket_id";
    public static final String PUSH_EXTRA_MESSAGE_ID = "jisudeng_push_message_id";
    public static final String PUSH_EXTRA_KIND = "jisudeng_push_kind";
    public static final String PUSH_EXTRA_STATUS = "jisudeng_push_status";
    private static final long PUSH_DUPLICATE_WINDOW_MS = 2_000L;
    private static final String LOCAL_ORIGIN = "https://localhost";
    private static final String APP_IMAGE_ROUTE = "/__jisudeng_app_images/";
    private static final String APP_IMAGE_FOLDER = "generated-images";
    private static final String SHARED_MATERIAL_FOLDER = "shared-materials";
    private static final long MAX_SHARED_FILE_BYTES = 25L * 1024L * 1024L;
    private static final long MAX_SHARED_TOTAL_BYTES = 50L * 1024L * 1024L;
    private static final int MAX_SHARED_FILE_COUNT = 8;
    private static final int COPY_BUFFER_BYTES = 32 * 1024;
    private static final int STREAM_EVENT_CHUNK_CHARS = 32 * 1024;
    private static final long FCM_TOKEN_TIMEOUT_MS = 20_000L;
    private static final String CREDENTIAL_KEY_ALIAS = "jisudengchat_login_credentials_v1";
    private static final String CREDENTIAL_PREFS = "jisudengchat_secure_credentials";
    private static final String CREDENTIAL_PAYLOAD = "encrypted_payload";
    private static final String CREDENTIAL_IV = "encrypted_iv";
    private static final String SESSION_KEY_ALIAS = "jisudengchat_managed_session_v1";
    private static final String SESSION_PREFS = "jisudengchat_secure_managed_session";
    private static final String SESSION_PAYLOAD = "encrypted_payload";
    private static final String SESSION_IV = "encrypted_iv";
    private final String bridgeToken = UUID.randomUUID().toString();
    private ValueCallback<Uri[]> filePathCallback;
    private WebView webView;
    private int nextPermissionRequestCode = PERMISSION_REQUEST_BASE;
    private final Map<Integer, PendingPermission> pendingPermissions = new HashMap<>();
    private PermissionRequest pendingWebMicrophoneRequest;
    private int pendingWebMicrophoneRequestCode = -1;
    private BillingClient billingClient;
    private String pendingBillingPurchaseRequestId;
    private String pendingCameraRequestId;
    private Uri pendingCameraUri;
    private ContentValues pendingCameraValues;
    private String pendingSpeechRequestId;
    private SpeechRecognizer holdSpeechRecognizer;
    private String holdSpeechRequestId;
    private ArrayList<String> holdSpeechMatches = new ArrayList<>();
    private SpeechRecognizer foregroundPttRecognizer;
    private String foregroundPttSessionId;
    private ArrayList<String> foregroundPttMatches = new ArrayList<>();
    private boolean foregroundPttStopRequested;
    private SpeechRecognizer wakeWordRecognizer;
    private String wakeWordSessionId;
    private String wakeWordPhrase;
    private String wakeWordLanguage;
    private TextToSpeech textToSpeech;
    private boolean textToSpeechReady;
    private boolean textToSpeechInitializing;
    private final List<PendingTextToSpeechRequest> pendingTextToSpeechRequests = new ArrayList<>();
    private final Map<String, Boolean> activeSpeechUtterances = new ConcurrentHashMap<>();
    private final Map<String, HttpURLConnection> streamConnections = new ConcurrentHashMap<>();
    private final Map<String, Boolean> cancelledStreamRequests = new ConcurrentHashMap<>();
    private boolean e2eFirstImage502Fixture;
    private int e2eImageFixtureAttempt;
    private boolean e2eFirstBootstrap401Fixture;
    private boolean e2eBootstrap401Used;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private JSONObject lastSharePayload;
    private boolean hasResumedOnce = false;
    private boolean initialIntentsDispatched = false;
    private String lastPushIntentSignature = "";
    private long lastPushIntentDispatchedAtMs = 0L;
    private boolean fcmTokenRefreshReceiverRegistered = false;
    private boolean postFirstPaintServicesStarted = false;
    private int crashlyticsConsoleLogCount = 0;
    private Trace nativeToWebViewVisibleTrace;
    private Trace webViewFirstInteractiveTrace;
    private final Map<String, Trace> activePerformanceTraces = new ConcurrentHashMap<>();
    private final BroadcastReceiver fcmTokenRefreshReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null) return;
            if (FCM_TOKEN_REFRESH_ACTION.equals(intent.getAction())) {
                dispatchSimpleWindowEvent("jisudeng:fcm-token-refresh");
            } else if (PUSH_INBOX_CHANGED_ACTION.equals(intent.getAction())) {
                dispatchSimpleWindowEvent("jisudeng:push-inbox-change");
            }
        }
    };

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        configureCrashlytics();
        startStartupPerformanceTraces();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(245, 245, 247));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        boolean debuggable =
            (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        Intent launchIntent = getIntent();
        e2eFirstImage502Fixture = debuggable && launchIntent != null && (
            launchIntent.getBooleanExtra("e2eFirstImage502", false) ||
            "true".equalsIgnoreCase(launchIntent.getStringExtra("e2eFirstImage502"))
        );
        e2eFirstBootstrap401Fixture = debuggable && launchIntent != null && (
            launchIntent.getBooleanExtra("e2eFirstBootstrap401", false) ||
            "true".equalsIgnoreCase(launchIntent.getStringExtra("e2eFirstBootstrap401"))
        );
        WebView.setWebContentsDebuggingEnabled(debuggable);
        webView.setWebViewClient(new LocalAssetWebViewClient(getAssets(), getAppImageDir()));
        webView.setWebChromeClient(new AppWebChromeClient());
        webView.addJavascriptInterface(new NativeBridge(), "JisudengNativeBridge");

        setContentView(webView);
        webView.loadUrl(
            LOCAL_ORIGIN + "/?nativeBridgeToken=" + Uri.encode(bridgeToken)
        );
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchIncomingShare(intent);
        dispatchPaymentReturn(intent);
        dispatchIncomingDeepLink(intent);
        dispatchPushOpen(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (hasResumedOnce && webView != null) {
            webView.post(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new Event('jisudeng-native-resume'));",
                null
            ));
        }
        hasResumedOnce = true;
    }

    @Override
    protected void onPause() {
        // PTT is intentionally foreground-only. Do not leave the microphone
        // open while the user switches apps, locks the device, or answers a call.
        cancelActiveSpeechSessions("app_backgrounded");
        super.onPause();
    }

    @Override
    protected void onStop() {
        // onPause normally handles this; retaining the guard covers OEMs that
        // stop an activity without a useful WebView lifecycle callback.
        cancelActiveSpeechSessions("app_backgrounded");
        super.onStop();
    }

    private void dispatchPaymentReturn(Intent intent) {
        if (intent == null || webView == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return;
        String host = uri.getHost() == null ? "" : uri.getHost();
        if (!("jisudeng.com".equalsIgnoreCase(host)
            || "www.jisudeng.com".equalsIgnoreCase(host)
            || "api.jisudeng.com".equalsIgnoreCase(host))) return;
        if (!"/payment/result".equals(uri.getPath())) return;
        try {
            JSONObject detail = new JSONObject();
            detail.put("url", uri.toString());
            String script = "window.dispatchEvent(new CustomEvent('jisudeng-payment-return',{detail:" + detail.toString() + "}));";
            webView.post(() -> webView.evaluateJavascript(script, null));
        } catch (JSONException ignored) {
        }
    }

    private void dispatchIncomingDeepLink(Intent intent) {
        if (intent == null || webView == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return;
        String host = uri.getHost() == null ? "" : uri.getHost();
        if (!("jisudeng.com".equalsIgnoreCase(host)
            || "www.jisudeng.com".equalsIgnoreCase(host)
            || "api.jisudeng.com".equalsIgnoreCase(host))) return;
        String path = uri.getPath() == null ? "" : uri.getPath();
        boolean isOAuthCallbackPath = path.equals("/auth/oauth/callback")
            || path.equals("/auth/callback");
        if (isOAuthCallbackPath) {
            try {
                JSONObject detail = new JSONObject();
                detail.put("url", uri.toString());
                detail.put("path", path);
                String script = "localStorage.setItem('jisudeng-native-pending-oauth',JSON.stringify(" + detail.toString() + "));window.dispatchEvent(new CustomEvent('jisudeng-oauth-callback',{detail:" + detail.toString() + "}));";
                webView.post(() -> webView.evaluateJavascript(script, null));
            } catch (JSONException ignored) {
            }
            return;
        }
        boolean isInvitePath = path.equals("/register")
            || path.equals("/affiliate")
            || path.startsWith("/invite")
            || path.startsWith("/r/")
            || path.equals("/download/android")
            || path.startsWith("/download/android/");
        if (!isInvitePath) return;
        try {
            JSONObject detail = new JSONObject();
            detail.put("url", uri.toString());
            detail.put("path", path);
            String script = "localStorage.setItem('jisudeng-native-pending-invite',JSON.stringify(" + detail.toString() + "));window.dispatchEvent(new CustomEvent('jisudeng-invite-deeplink',{detail:" + detail.toString() + "}));";
            webView.post(() -> webView.evaluateJavascript(script, null));
        } catch (JSONException ignored) {
        }
    }

    public static Intent createPushOpenIntent(
        Context context,
        Map<String, String> data,
        String messageId
    ) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(PUSH_ACTION_OPEN);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        copyPushExtra(intent, data, "event_type", PUSH_EXTRA_EVENT_TYPE);
        copyPushExtra(intent, data, "source_type", PUSH_EXTRA_SOURCE_TYPE);
        copyPushExtra(intent, data, "source_id", PUSH_EXTRA_SOURCE_ID);
        copyPushExtra(intent, data, "ticket_id", PUSH_EXTRA_TICKET_ID);
        copyPushExtra(intent, data, "kind", PUSH_EXTRA_KIND);
        copyPushExtra(intent, data, "status", PUSH_EXTRA_STATUS);
        if (messageId != null && !messageId.trim().isEmpty()) {
            intent.putExtra(PUSH_EXTRA_MESSAGE_ID, messageId.trim());
        }
        return intent;
    }

    public static void ensurePushNotificationChannel(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            PUSH_CHANNEL_ID,
            "Jisudeng push",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Jisudeng account, support, and payment updates");
        manager.createNotificationChannel(channel);
    }

    private static void copyPushExtra(
        Intent intent,
        Map<String, String> data,
        String dataKey,
        String extraKey
    ) {
        if (intent == null || data == null) return;
        String value = data.get(dataKey);
        if (value != null && !value.trim().isEmpty()) {
            intent.putExtra(dataKey, value.trim());
            intent.putExtra(extraKey, value.trim());
        }
    }

    private void dispatchPushOpen(Intent intent) {
        if (intent == null || webView == null) return;
        JSONObject detail = pushDetailFromIntent(intent);
        if (detail.length() == 0) return;
        String signature = pushIntentSignature(detail);
        long now = System.currentTimeMillis();
        if (
            signature.equals(lastPushIntentSignature) &&
            now - lastPushIntentDispatchedAtMs < PUSH_DUPLICATE_WINDOW_MS
        ) {
            return;
        }
        lastPushIntentSignature = signature;
        lastPushIntentDispatchedAtMs = now;
        String openedMessageId = detail.optString("messageId", "");
        if (!openedMessageId.isEmpty()) {
            JSONArray openedIds = new JSONArray();
            openedIds.put(openedMessageId);
            JisudengFirebaseMessagingService.markPushInboxRead(this, openedIds, false);
        }
        Log.i(
            LOG_TAG,
            "push open dispatched event_type=" +
            detail.optString("eventType", "") +
            " source_type=" +
            detail.optString("sourceType", "") +
            " source_id=" +
            detail.optString("sourceId", "")
        );
        String script =
            "window.dispatchEvent(new CustomEvent('jisudeng:push-open',{detail:" +
            detail.toString() +
            "}));";
        webView.post(() -> webView.evaluateJavascript(script, null));
        clearPushIntent();
    }

    private JSONObject pushDetailFromIntent(Intent intent) {
        JSONObject detail = new JSONObject();
        String eventType = pushIntentString(intent, PUSH_EXTRA_EVENT_TYPE, "event_type");
        String sourceType = pushIntentString(intent, PUSH_EXTRA_SOURCE_TYPE, "source_type");
        String sourceId = pushIntentString(intent, PUSH_EXTRA_SOURCE_ID, "source_id");
        String ticketId = pushIntentString(intent, PUSH_EXTRA_TICKET_ID, "ticket_id");
        String kind = pushIntentString(intent, PUSH_EXTRA_KIND, "kind");
        String status = pushIntentString(intent, PUSH_EXTRA_STATUS, "status");
        String messageId = pushIntentString(
            intent,
            PUSH_EXTRA_MESSAGE_ID,
            "google.message_id",
            "gcm.message_id"
        );
        if (
            eventType.isEmpty() &&
            sourceType.isEmpty() &&
            sourceId.isEmpty() &&
            ticketId.isEmpty() &&
            kind.isEmpty() &&
            status.isEmpty() &&
            messageId.isEmpty() &&
            !PUSH_ACTION_OPEN.equals(intent.getAction())
        ) {
            return detail;
        }
        try {
            detail.put("eventType", eventType);
            detail.put("sourceType", sourceType);
            detail.put("sourceId", sourceId);
            detail.put("ticketId", ticketId);
            detail.put("kind", kind);
            detail.put("status", status);
            detail.put("messageId", messageId);
        } catch (JSONException ignored) {
        }
        return detail;
    }

    private void clearPushIntent() {
        Intent current = getIntent();
        if (current == null || !PUSH_ACTION_OPEN.equals(current.getAction())) return;
        Intent cleanIntent = new Intent(Intent.ACTION_MAIN);
        cleanIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        cleanIntent.setClass(this, MainActivity.class);
        setIntent(cleanIntent);
    }

    private String pushIntentString(Intent intent, String... keys) {
        if (intent == null || keys == null) return "";
        Bundle extras = intent.getExtras();
        if (extras == null) return "";
        for (String key : keys) {
            if (key == null) continue;
            Object raw = extras.get(key);
            if (raw == null) continue;
            String value = String.valueOf(raw).trim();
            if (!value.isEmpty()) return value;
        }
        return "";
    }

    private String pushIntentSignature(JSONObject detail) {
        String messageId = detail.optString("messageId", "");
        if (!messageId.isEmpty()) return "message:" + messageId;
        return detail.optString("eventType", "") +
            "|" +
            detail.optString("sourceType", "") +
            "|" +
            detail.optString("sourceId", "") +
            "|" +
            detail.optString("ticketId", "");
    }

    @Override
    public void onBackPressed() {
        cancelActiveSpeechSessions("route_changed");
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
            "(function(){try{var event=new Event('jisudeng-native-back',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}catch(error){return false;}})();",
            handled -> {
                if ("true".equals(handled)) {
                    return;
                }
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                MainActivity.super.onBackPressed();
            }
        );
    }

    @Override
    protected void onDestroy() {
        cancelActiveSpeechSessions("activity_destroyed");
        stopStartupPerformanceTraces();
        for (Trace trace : activePerformanceTraces.values()) {
            try {
                trace.putAttribute("outcome", "activity_destroyed");
                trace.stop();
            } catch (Exception ignored) {
            }
        }
        activePerformanceTraces.clear();
        if (fcmTokenRefreshReceiverRegistered) {
            try {
                unregisterReceiver(fcmTokenRefreshReceiver);
            } catch (Exception ignored) {
            }
            fcmTokenRefreshReceiverRegistered = false;
        }
        if (textToSpeech != null) {
            try {
                textToSpeech.stop();
                textToSpeech.shutdown();
            } catch (Exception ignored) {
            }
            textToSpeech = null;
            textToSpeechReady = false;
        }
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
            }
        }
        for (HttpURLConnection connection : streamConnections.values()) {
            try {
                connection.disconnect();
            } catch (Exception ignored) {
            }
        }
        streamConnections.clear();
        super.onDestroy();
    }

    private void registerNetworkRecoveryCallback() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                if (webView == null) return;
                webView.post(() -> webView.evaluateJavascript(
                    "window.dispatchEvent(new Event('jisudeng-network-restored'));",
                    null
                ));
            }
        };
        connectivityManager.registerDefaultNetworkCallback(networkCallback);
    }

    private void configureCrashlytics() {
        FirebaseCrashlytics crashlytics = FirebaseCrashlytics.getInstance();
        crashlytics.setCustomKey("distribution_channel", BuildConfig.DISTRIBUTION_CHANNEL);
        crashlytics.setCustomKey("android_sdk", Build.VERSION.SDK_INT);
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            crashlytics.setCustomKey("app_version", info.versionName == null ? "" : info.versionName);
            crashlytics.setCustomKey(
                "app_version_code",
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode
            );
        } catch (Exception error) {
            crashlytics.log("Unable to resolve Android package version: " + error.getClass().getSimpleName());
        }
    }

    private void startStartupPerformanceTraces() {
        try {
            nativeToWebViewVisibleTrace = FirebasePerformance.getInstance()
                .newTrace("native_start_to_webview_visible");
            nativeToWebViewVisibleTrace.putAttribute("distribution", BuildConfig.DISTRIBUTION_CHANNEL);
            nativeToWebViewVisibleTrace.start();
            webViewFirstInteractiveTrace = FirebasePerformance.getInstance()
                .newTrace("webview_first_interactive");
            webViewFirstInteractiveTrace.putAttribute("distribution", BuildConfig.DISTRIBUTION_CHANNEL);
            webViewFirstInteractiveTrace.start();
        } catch (Exception error) {
            FirebaseCrashlytics.getInstance().log(
                "Unable to start startup performance traces: " + error.getClass().getSimpleName()
            );
            nativeToWebViewVisibleTrace = null;
            webViewFirstInteractiveTrace = null;
        }
    }

    private void markWebViewFirstVisible() {
        if (nativeToWebViewVisibleTrace != null) {
            try {
                nativeToWebViewVisibleTrace.stop();
            } catch (Exception ignored) {
            }
            nativeToWebViewVisibleTrace = null;
        }
    }

    private void markWebViewFirstInteractive() {
        if (webViewFirstInteractiveTrace != null) {
            try {
                webViewFirstInteractiveTrace.stop();
            } catch (Exception ignored) {
            }
            webViewFirstInteractiveTrace = null;
        }
    }

    private void stopStartupPerformanceTraces() {
        markWebViewFirstVisible();
        markWebViewFirstInteractive();
    }

    private void startPostFirstPaintServices() {
        if (postFirstPaintServicesStarted) return;
        postFirstPaintServicesStarted = true;
        ensurePushNotificationChannel(this);
        registerFcmTokenRefreshReceiver();
        registerNetworkRecoveryCallback();
    }

    private static final class PendingTextToSpeechRequest {
        final String requestId;
        final String text;
        final String language;
        final double rate;
        final String utteranceId;

        PendingTextToSpeechRequest(
            String requestId,
            String text,
            String language,
            double rate,
            String utteranceId
        ) {
            this.requestId = requestId;
            this.text = text;
            this.language = language;
            this.rate = rate;
            this.utteranceId = utteranceId;
        }
    }

    private void startPerformanceTrace(String requestId, JSONObject options) {
        String name = safePerformanceValue(options.optString("name", "app_operation"), 80)
            .replaceAll("[^A-Za-z0-9_]", "_");
        if (name.isEmpty()) name = "app_operation";
        if (activePerformanceTraces.size() >= 24) {
            reject(requestId, "too many active performance traces");
            return;
        }
        try {
            Trace trace = FirebasePerformance.getInstance().newTrace(name);
            trace.putAttribute("distribution", BuildConfig.DISTRIBUTION_CHANNEL);
            JSONObject attributes = options.optJSONObject("attributes");
            if (attributes != null) {
                int added = 0;
                Iterator<String> keys = attributes.keys();
                while (keys.hasNext() && added < 3) {
                    String rawKey = keys.next();
                    String key = safePerformanceValue(rawKey, 40)
                        .replaceAll("[^A-Za-z0-9_]", "_");
                    String value = safePerformanceValue(attributes.optString(rawKey, ""), 100);
                    if (
                        key.isEmpty() ||
                        value.isEmpty() ||
                        "distribution".equals(key) ||
                        "outcome".equals(key)
                    ) {
                        continue;
                    }
                    trace.putAttribute(key, value);
                    added += 1;
                }
            }
            String traceId = UUID.randomUUID().toString();
            trace.start();
            activePerformanceTraces.put(traceId, trace);
            JSONObject payload = new JSONObject();
            payload.put("traceId", traceId);
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, "performance trace start failed");
        }
    }

    private void stopPerformanceTrace(String requestId, JSONObject options) {
        String traceId = options.optString("traceId", "").trim();
        Trace trace = activePerformanceTraces.remove(traceId);
        if (trace != null) {
            try {
                String outcome = safePerformanceValue(options.optString("outcome", "unknown"), 80);
                trace.putAttribute("outcome", outcome.isEmpty() ? "unknown" : outcome);
                trace.stop();
            } catch (Exception ignored) {
            }
        }
        resolve(requestId, new JSONObject());
    }

    private String safePerformanceValue(String value, int maxLength) {
        String normalized = value == null ? "" : value.replaceAll("[\\r\\n]+", " ").trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private void registerFcmTokenRefreshReceiver() {
        if (fcmTokenRefreshReceiverRegistered) return;
        IntentFilter filter = new IntentFilter(FCM_TOKEN_REFRESH_ACTION);
        filter.addAction(PUSH_INBOX_CHANGED_ACTION);
        ContextCompat.registerReceiver(
            this,
            fcmTokenRefreshReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
        fcmTokenRefreshReceiverRegistered = true;
    }

    private void dispatchSimpleWindowEvent(String eventName) {
        if (webView == null || eventName == null || eventName.trim().isEmpty()) return;
        String script = "window.dispatchEvent(new Event(" + JSONObject.quote(eventName.trim()) + "));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void configureCrashlyticsUser(String requestId, String userId) {
        FirebaseCrashlytics.getInstance().setUserId(userId == null ? "" : userId.trim());
        resolve(requestId, new JSONObject());
    }

    private void recordCrashlyticsException(String requestId, JSONObject options) {
        String category = clippedCrashValue(options.optString("category", "javascript"), 80);
        String message = clippedCrashValue(options.optString("message", "client error"), 1000);
        String stack = clippedCrashValue(options.optString("stack", ""), 4000);
        FirebaseCrashlytics crashlytics = FirebaseCrashlytics.getInstance();
        crashlytics.setCustomKey("last_js_error_category", category);
        crashlytics.recordException(new RuntimeException(category + ": " + message + (stack.isEmpty() ? "" : "\n" + stack)));
        resolve(requestId, new JSONObject());
    }

    private void getPushInbox(String requestId) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("items", JisudengFirebaseMessagingService.readPushInbox(this));
        } catch (JSONException ignored) {
        }
        resolve(requestId, payload);
    }

    private void markPushInboxRead(String requestId, JSONObject options) {
        JisudengFirebaseMessagingService.markPushInboxRead(
            this,
            options.optJSONArray("ids"),
            options.optBoolean("all", false)
        );
        getPushInbox(requestId);
    }

    private void clearPushInbox(String requestId) {
        JisudengFirebaseMessagingService.clearPushInbox(this);
        getPushInbox(requestId);
    }

    private String clippedCrashValue(String value, int maxLength) {
        String normalized = value == null ? "" : value.replaceAll("[\\r\\n]+", " ").trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private void dispatchIncomingShare(Intent intent) {
        if (intent == null || webView == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) &&
            !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return;
        }
        try {
            cleanupSharedMaterialCache();
            JSONObject payload = new JSONObject();
            payload.put("action", action);
            payload.put("type", intent.getType() == null ? "" : intent.getType());
            payload.put("subject", redactSensitiveText(intent.getStringExtra(Intent.EXTRA_SUBJECT)));
            payload.put("text", redactSensitiveText(intent.getStringExtra(Intent.EXTRA_TEXT)));
            JSONArray files = new JSONArray();
            JSONArray rejected = new JSONArray();
            ArrayList<Uri> uris = sharedUrisFromIntent(intent);
            long totalBytes = 0;
            for (int i = 0; i < uris.size(); i += 1) {
                Uri uri = uris.get(i);
                if (i >= MAX_SHARED_FILE_COUNT) {
                    rejected.put(rejectedShare("too_many_files", "Only the first " + MAX_SHARED_FILE_COUNT + " files were accepted."));
                    break;
                }
                try {
                    SharedMaterial material = inspectSharedMaterial(uri);
                    if (!isAcceptedSharedMime(material.mimeType, material.name)) {
                        rejected.put(rejectedShare("unsupported_type", material.name));
                        continue;
                    }
                    if (material.size > MAX_SHARED_FILE_BYTES) {
                        rejected.put(rejectedShare("file_too_large", material.name));
                        continue;
                    }
                    if (material.size > 0 && totalBytes + material.size > MAX_SHARED_TOTAL_BYTES) {
                        rejected.put(rejectedShare("total_too_large", material.name));
                        continue;
                    }
                    JSONObject cached = cacheSharedMaterial(uri, material, MAX_SHARED_TOTAL_BYTES - totalBytes);
                    totalBytes += cached.optLong("size", 0);
                    files.put(cached);
                } catch (Exception error) {
                    rejected.put(rejectedShare("read_failed", safeErrorMessage(error)));
                }
            }
            payload.put("files", files);
            payload.put("rejected", rejected);
            payload.put("limits", sharedMaterialLimitsPayload());
            lastSharePayload = new JSONObject(payload.toString());
            String script =
                "(function(){window.dispatchEvent(new CustomEvent('jisudeng-native-share',{detail:" +
                payload.toString() +
                "}));})();";
            runOnUiThread(() -> webView.evaluateJavascript(script, null));
        } catch (Exception ignored) {
        }
    }

    private ArrayList<Uri> sharedUrisFromIntent(Intent intent) {
        ArrayList<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
            ArrayList<Uri> streams = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (streams != null) {
                for (Uri uri : streams) addSharedUri(uris, uri);
            }
        } else {
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            addSharedUri(uris, uri);
        }
        ClipData clipData = intent.getClipData();
        if (clipData != null) {
            for (int i = 0; i < clipData.getItemCount(); i += 1) {
                addSharedUri(uris, clipData.getItemAt(i).getUri());
            }
        }
        return uris;
    }

    private void addSharedUri(ArrayList<Uri> uris, Uri uri) {
        if (uri == null) return;
        String raw = uri.toString();
        for (Uri existing : uris) {
            if (raw.equals(existing.toString())) return;
        }
        uris.add(uri);
    }

    private SharedMaterial inspectSharedMaterial(Uri uri) throws IOException {
        if (uri == null) throw new IOException("missing shared file");
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.US);
        if (!"content".equals(scheme) && !"file".equals(scheme)) {
            throw new IOException("unsupported shared uri");
        }
        String displayName = displayNameForUri(uri);
        String mimeType = getContentResolver().getType(uri);
        long size = sizeForUri(uri);
        if (mimeType == null || mimeType.trim().isEmpty()) {
            mimeType = mimeTypeForName(displayName);
        }
        return new SharedMaterial(
            safeSharedFileName(displayName, mimeType),
            normalizeMimeType(mimeType),
            size
        );
    }

    private JSONObject cacheSharedMaterial(Uri uri, SharedMaterial material, long remainingBytes)
        throws IOException, JSONException {
        if (remainingBytes <= 0) throw new IOException("shared files are too large");
        File dir = getSharedMaterialDir();
        String id = UUID.randomUUID().toString();
        File file = safeSharedMaterialFile(dir, id, material.name, material.mimeType);
        long copied = copyUriToFile(uri, file, Math.min(MAX_SHARED_FILE_BYTES, remainingBytes));
        JSONObject metadata = new JSONObject();
        metadata.put("id", id);
        metadata.put("name", material.name);
        metadata.put("fileName", file.getName());
        metadata.put("mimeType", material.mimeType);
        metadata.put("size", copied);
        metadata.put("kind", sharedMaterialKind(material.mimeType));
        metadata.put("createdAt", System.currentTimeMillis());
        writeJson(new File(dir, id + ".json"), metadata);
        return safeSharedMaterialPayload(metadata);
    }

    private JSONObject rejectedShare(String reason, String detail) throws JSONException {
        JSONObject payload = new JSONObject();
        payload.put("reason", reason);
        payload.put("detail", detail == null ? "" : detail);
        return payload;
    }

    private JSONObject sharedMaterialLimitsPayload() throws JSONException {
        JSONObject payload = new JSONObject();
        payload.put("maxFiles", MAX_SHARED_FILE_COUNT);
        payload.put("maxFileBytes", MAX_SHARED_FILE_BYTES);
        payload.put("maxTotalBytes", MAX_SHARED_TOTAL_BYTES);
        return payload;
    }

    private JSONObject safeSharedMaterialPayload(JSONObject metadata) throws JSONException {
        JSONObject payload = new JSONObject();
        payload.put("id", metadata.optString("id"));
        payload.put("name", metadata.optString("name"));
        payload.put("fileName", metadata.optString("fileName"));
        payload.put("mimeType", metadata.optString("mimeType"));
        payload.put("size", metadata.optLong("size", 0));
        payload.put("kind", metadata.optString("kind"));
        payload.put("createdAt", metadata.optLong("createdAt", 0));
        return payload;
    }

    private String displayNameForUri(Uri uri) {
        if (uri == null) return "";
        String name = "";
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(
                uri,
                new String[] { OpenableColumns.DISPLAY_NAME },
                null,
                null,
                null
            );
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    name = cursor.getString(index);
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
        if (name == null || name.trim().isEmpty()) {
            name = uri.getLastPathSegment();
        }
        return name == null ? "" : name;
    }

    private long sizeForUri(Uri uri) {
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(
                uri,
                new String[] { OpenableColumns.SIZE },
                null,
                null,
                null
            );
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (index >= 0 && !cursor.isNull(index)) {
                    return Math.max(0, cursor.getLong(index));
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
        try {
            if ("file".equalsIgnoreCase(uri.getScheme())) {
                File file = new File(uri.getPath() == null ? "" : uri.getPath());
                return file.exists() ? Math.max(0, file.length()) : 0;
            }
        } catch (Exception ignored) {
        }
        return 0;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == CAMERA_REQUEST) {
            handleCameraResult(resultCode);
            return;
        }
        if (requestCode == SPEECH_REQUEST) {
            handleSpeechResult(resultCode, data);
            return;
        }
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) {
            return;
        }

        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int i = 0; i < count; i++) {
                    result[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                result = new Uri[] { data.getData() };
            }
        }
        filePathCallback.onReceiveValue(result);
        filePathCallback = null;
    }

    private void handleCameraResult(int resultCode) {
        String requestId = pendingCameraRequestId;
        Uri uri = pendingCameraUri;
        pendingCameraRequestId = null;
        pendingCameraUri = null;
        pendingCameraValues = null;
        if (requestId == null || uri == null) {
            return;
        }
        if (resultCode != RESULT_OK) {
            getContentResolver().delete(uri, null, null);
            reject(requestId, "camera cancelled");
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                getContentResolver().update(uri, values, null, null);
            }
            byte[] data = readBytes(uri);
            JSONObject payload = new JSONObject();
            payload.put(
                "dataUrl",
                "data:image/jpeg;base64," + Base64.encodeToString(data, Base64.NO_WRAP)
            );
            payload.put("uri", uri.toString());
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void handleSpeechResult(int resultCode, Intent data) {
        String requestId = pendingSpeechRequestId;
        pendingSpeechRequestId = null;
        if (requestId == null) {
            return;
        }
        if (resultCode != RESULT_OK || data == null) {
            reject(requestId, "speech recognition cancelled");
            return;
        }
        try {
            ArrayList<String> matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            JSONObject payload = new JSONObject();
            JSONArray list = new JSONArray();
            if (matches != null) {
                for (String match : matches) {
                    list.put(match);
                }
            }
            payload.put("matches", list);
            payload.put("text", matches != null && !matches.isEmpty() ? matches.get(0) : "");
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == pendingWebMicrophoneRequestCode) {
            PermissionRequest pendingWebRequest = pendingWebMicrophoneRequest;
            pendingWebMicrophoneRequest = null;
            pendingWebMicrophoneRequestCode = -1;
            boolean granted = grantResults.length > 0 &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (pendingWebRequest != null) {
                if (granted) {
                    pendingWebRequest.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
                } else {
                    pendingWebRequest.deny();
                }
            }
            return;
        }
        PendingPermission pending = pendingPermissions.remove(requestCode);
        if (pending == null) {
            return;
        }
        boolean granted = grantResults.length > 0 &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED;
        boolean canAskAgain = granted || shouldShowRequestPermissionRationale(pending.permission);
        resolve(
            pending.requestId,
            permissionPayload(granted, granted ? "granted" : canAskAgain ? "denied" : "blocked", canAskAgain)
        );
    }

    private class NativeBridge {
        @JavascriptInterface
        public void request(String requestJson) {
            runOnUiThread(() -> handleNativeRequest(requestJson));
        }
    }

    private void handleNativeRequest(String requestJson) {
        String requestId = "";
        try {
            JSONObject request = new JSONObject(requestJson);
            requestId = request.optString("id");
            if (!bridgeToken.equals(request.optString("bridgeToken"))) {
                reject(requestId, "untrusted native bridge request");
                return;
            }
            String method = request.optString("method");
            JSONObject options = request.optJSONObject("options");
            if (options == null) options = new JSONObject();

            switch (method) {
                case "requestGalleryPermissions":
                    requestGalleryPermission(requestId);
                    break;
                case "requestCameraPermission":
                    requestPermission(requestId, Manifest.permission.CAMERA);
                    break;
                case "requestMicrophonePermission":
                    requestPermission(requestId, Manifest.permission.RECORD_AUDIO);
                    break;
                case "requestNotificationPermission":
                    requestNotificationPermission(requestId);
                    break;
                case "captureImage":
                    captureImage(requestId, options.optString("fileName", "jisudengchat-camera.jpg"));
                    break;
                case "recognizeSpeech":
                    recognizeSpeech(
                        requestId,
                        options.optString("language", Locale.getDefault().toLanguageTag()),
                        options.optString("prompt", "JisudengChat")
                    );
                    break;
                case "startHoldSpeech":
                    startHoldSpeech(
                        requestId,
                        options.optString("language", Locale.getDefault().toLanguageTag()),
                        options.optString("prompt", "JisudengChat")
                    );
                    break;
                case "stopHoldSpeech":
                    stopHoldSpeech(requestId);
                    break;
                case "cancelHoldSpeech":
                    cancelHoldSpeech(requestId);
                    break;
                case "startForegroundPtt":
                    startForegroundPtt(
                        requestId,
                        options.optString("sessionId"),
                        options.optString("language", Locale.getDefault().toLanguageTag()),
                        options.optString("prompt", "JisudengChat")
                    );
                    break;
                case "stopForegroundPtt":
                    stopForegroundPtt(requestId, options.optString("sessionId"));
                    break;
                case "cancelForegroundPtt":
                    cancelForegroundPtt(
                        requestId,
                        options.optString("sessionId"),
                        options.optString("reason", "cancelled")
                    );
                    break;
                case "startWakeWord":
                    startWakeWord(
                        requestId,
                        options.optString("sessionId"),
                        options.optString("phrase"),
                        options.optString("language", Locale.getDefault().toLanguageTag())
                    );
                    break;
                case "stopWakeWord":
                    stopWakeWord(
                        requestId,
                        options.optString("sessionId"),
                        options.optString("reason", "cancelled")
                    );
                    break;
                case "speakText":
                    speakText(
                        requestId,
                        options.optString("text"),
                        options.optString("language", Locale.getDefault().toLanguageTag()),
                        options.optDouble("rate", 1.0),
                        options.optString("utteranceId")
                    );
                    break;
                case "stopSpeaking":
                    stopSpeaking();
                    resolve(requestId, new JSONObject());
                    break;
                case "saveImageToGallery":
                    saveImageToGallery(
                        requestId,
                        options.optString("dataUrl"),
                        options.optString("fileName", "jisudengchat-image.png")
                    );
                    break;
                case "saveImageToAppStorage":
                    saveImageToAppStorage(
                        requestId,
                        options.optString("dataUrl"),
                        options.optString("fileName", "jisudengchat-image.png"),
                        options.optString("prompt", ""),
                        options.optString("model", ""),
                        options.optString("taskId", ""),
                        options.optString("ownerUserId", ""),
                        options.optString("projectId", ""),
                        options.optString("runId", ""),
                        options.optString("shotId", ""),
                        options.optString("kind", ""),
                        options.optString("label", ""),
                        options.optString("collectionId", "")
                    );
                    break;
                case "listAppImages":
                    listAppImages(requestId, options.optString("ownerUserId", ""));
                    break;
                case "listUnassignedAppImages":
                    listUnassignedAppImages(
                        requestId,
                        options.optString("ownerUserId", "")
                    );
                    break;
                case "claimUnassignedAppImages":
                    claimUnassignedAppImages(
                        requestId,
                        options.optString("ownerUserId", ""),
                        options.optJSONArray("fileNames")
                    );
                    break;
                case "deleteAppImages":
                    deleteAppImages(
                        requestId,
                        options.optString("ownerUserId", ""),
                        options.optJSONArray("fileNames")
                    );
                    break;
                case "shareImage":
                    shareImage(
                        requestId,
                        options.optString("dataUrl"),
                        options.optString("fileName", "jisudengchat-image.png"),
                        options.optString("title", "JisudengChat"),
                        options.optString("text", "")
                    );
                    break;
                case "shareImages":
                    shareImages(
                        requestId,
                        options.optJSONArray("items"),
                        options.optString("title", "JisudengChat"),
                        options.optString("text", "")
                    );
                    break;
                case "shareFile":
                    shareFile(
                        requestId,
                        options.optString("dataUrl"),
                        options.optString("fileName", "jisudeng-project.zip"),
                        options.optString("mimeType", "application/octet-stream"),
                        options.optString("title", "JisudengChat"),
                        options.optString("text", "")
                    );
                    break;
                case "shareText":
                    shareText(
                        requestId,
                        options.optString("title", "JisudengChat"),
                        options.optString("text", "")
                    );
                    break;
                case "copyText":
                    copyText(requestId, options.optString("text", ""));
                    break;
                case "showNotification":
                    showNotification(
                        requestId,
                        options.optString("title", "JisudengChat"),
                        options.optString("body", "")
                    );
                    break;
                case "downloadFile":
                    downloadFile(
                        requestId,
                        options.optString("url"),
                        options.optString("fileName", "jisudengchat-download"),
                        options.optString("title", "JisudengChat"),
                        options.optString("authorization")
                    );
                    break;
                case "getDownloadStatus":
                    getDownloadStatus(requestId, options.optString("id"));
                    break;
                case "installApk":
                    installApk(
                        requestId,
                        options.optString("id"),
                        options.optString("uri"),
                        options.optString("sha256")
                    );
                    break;
                case "openUrl":
                    openUrl(requestId, options.optString("url"));
                    break;
                case "openAppSettings":
                    openAppSettings(requestId);
                    break;
                case "getDeviceInfo":
                    resolve(requestId, getDeviceInfoPayload());
                    break;
                case "getFcmToken":
                    getFcmToken(requestId);
                    break;
                case "configureCrashlyticsUser":
                    configureCrashlyticsUser(requestId, options.optString("userId", ""));
                    break;
                case "recordCrashlyticsException":
                    recordCrashlyticsException(requestId, options);
                    break;
                case "startPerformanceTrace":
                    startPerformanceTrace(requestId, options);
                    break;
                case "stopPerformanceTrace":
                    stopPerformanceTrace(requestId, options);
                    break;
                case "reportStartupInteractive":
                    markWebViewFirstInteractive();
                    resolve(requestId, new JSONObject());
                    break;
                case "getPushInbox":
                    getPushInbox(requestId);
                    break;
                case "markPushInboxRead":
                    markPushInboxRead(requestId, options);
                    break;
                case "clearPushInbox":
                    clearPushInbox(requestId);
                    break;
                case "getPlayBillingStatus":
                    getPlayBillingStatus(requestId);
                    break;
                case "queryPlayBillingProducts":
                    queryPlayBillingProducts(
                        requestId,
                        options.optJSONArray("productIds"),
                        options.optString("productType", BillingClient.ProductType.INAPP)
                    );
                    break;
                case "launchPlayBillingPurchase":
                    launchPlayBillingPurchase(requestId, options);
                    break;
                case "queryPlayBillingPurchases":
                    queryPlayBillingPurchases(
                        requestId,
                        options.optString("productType", BillingClient.ProductType.INAPP)
                    );
                    break;
                case "consumePlayBillingPurchase":
                    consumePlayBillingPurchase(
                        requestId,
                        options.optString("purchaseToken", "")
                    );
                    break;
                case "acknowledgePlayBillingPurchase":
                    acknowledgePlayBillingPurchase(
                        requestId,
                        options.optString("purchaseToken", "")
                    );
                    break;
                case "showToast":
                    Toast.makeText(
                        MainActivity.this,
                        options.optString("message"),
                        Toast.LENGTH_SHORT
                    ).show();
                    resolve(requestId, new JSONObject());
                    break;
                case "finishApp":
                    resolve(requestId, new JSONObject());
                    finishAndRemoveTask();
                    break;
                case "getE2EFixtureFlags":
                    resolve(
                        requestId,
                        new JSONObject().put(
                            "image502ThenSuccess",
                            e2eFirstImage502Fixture
                        )
                    );
                    break;
                case "saveLoginCredentials":
                    saveLoginCredentials(
                        requestId,
                        options.optString("email", ""),
                        options.optString("password", "")
                    );
                    break;
                case "loadLoginCredentials":
                    loadLoginCredentials(requestId);
                    break;
                case "clearLoginCredentials":
                    clearLoginCredentials(requestId);
                    break;
                case "saveManagedSessionSecrets":
                    saveManagedSessionSecrets(requestId, options);
                    break;
                case "loadManagedSessionSecrets":
                    loadManagedSessionSecrets(requestId);
                    break;
                case "clearManagedSessionSecrets":
                    clearManagedSessionSecrets(requestId);
                    break;
                case "getPendingShare":
                    resolve(requestId, pendingSharePayload());
                    break;
                case "readSharedMaterial":
                    readSharedMaterial(
                        requestId,
                        options.optString("id"),
                        options.optString("encoding", "dataUrl")
                    );
                    break;
                case "streamRequest":
                    streamRequest(requestId, options);
                    break;
                case "cancelStreamRequest":
                    cancelStreamRequest(options.optString("id"));
                    resolve(requestId, new JSONObject());
                    break;
                default:
                    reject(requestId, "unknown native method: " + method);
                    break;
            }
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private SecretKey loginCredentialKey() throws Exception {
        return secretKey(CREDENTIAL_KEY_ALIAS);
    }

    private SecretKey secretKey(String alias) throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(alias)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(alias, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );
        generator.init(
            new KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build()
        );
        return generator.generateKey();
    }

    private void saveLoginCredentials(String requestId, String email, String password) {
        try {
            if (email == null || email.trim().isEmpty() || password == null || password.isEmpty()) {
                throw new IllegalArgumentException("email and password are required");
            }
            JSONObject credentials = new JSONObject();
            credentials.put("email", email.trim());
            credentials.put("password", password);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, loginCredentialKey());
            byte[] encrypted = cipher.doFinal(
                credentials.toString().getBytes(StandardCharsets.UTF_8)
            );
            getSharedPreferences(CREDENTIAL_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(CREDENTIAL_PAYLOAD, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(CREDENTIAL_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .apply();
            JSONObject result = new JSONObject();
            result.put("saved", true);
            result.put("email", email.trim());
            resolve(requestId, result);
        } catch (Exception error) {
            reject(requestId, "credential_save_failed: " + error.getClass().getSimpleName());
        }
    }

    private void loadLoginCredentials(String requestId) {
        try {
            SharedPreferences preferences = getSharedPreferences(
                CREDENTIAL_PREFS,
                Context.MODE_PRIVATE
            );
            String encrypted = preferences.getString(CREDENTIAL_PAYLOAD, "");
            String iv = preferences.getString(CREDENTIAL_IV, "");
            if (encrypted == null || encrypted.isEmpty() || iv == null || iv.isEmpty()) {
                JSONObject empty = new JSONObject();
                empty.put("saved", false);
                resolve(requestId, empty);
                return;
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                loginCredentialKey(),
                new GCMParameterSpec(128, Base64.decode(iv, Base64.DEFAULT))
            );
            byte[] clear = cipher.doFinal(Base64.decode(encrypted, Base64.DEFAULT));
            JSONObject credentials = new JSONObject(new String(clear, StandardCharsets.UTF_8));
            credentials.put("saved", true);
            resolve(requestId, credentials);
        } catch (Exception error) {
            getSharedPreferences(CREDENTIAL_PREFS, Context.MODE_PRIVATE).edit().clear().apply();
            reject(requestId, "credential_load_failed: " + error.getClass().getSimpleName());
        }
    }

    private void clearLoginCredentials(String requestId) {
        getSharedPreferences(CREDENTIAL_PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        resolve(requestId, new JSONObject());
    }

    private void saveManagedSessionSecrets(String requestId, JSONObject secrets) {
        try {
            String accessToken = secrets.optString("accessToken", "");
            if (accessToken.isEmpty()) {
                throw new IllegalArgumentException("accessToken is required");
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey(SESSION_KEY_ALIAS));
            byte[] encrypted = cipher.doFinal(
                secrets.toString().getBytes(StandardCharsets.UTF_8)
            );
            getSharedPreferences(SESSION_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(SESSION_PAYLOAD, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(SESSION_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .apply();
            JSONObject result = new JSONObject();
            result.put("saved", true);
            resolve(requestId, result);
        } catch (Exception error) {
            reject(requestId, "session_save_failed: " + error.getClass().getSimpleName());
        }
    }

    private void loadManagedSessionSecrets(String requestId) {
        try {
            SharedPreferences preferences = getSharedPreferences(
                SESSION_PREFS,
                Context.MODE_PRIVATE
            );
            String encrypted = preferences.getString(SESSION_PAYLOAD, "");
            String iv = preferences.getString(SESSION_IV, "");
            if (encrypted == null || encrypted.isEmpty() || iv == null || iv.isEmpty()) {
                JSONObject empty = new JSONObject();
                empty.put("saved", false);
                resolve(requestId, empty);
                return;
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                secretKey(SESSION_KEY_ALIAS),
                new GCMParameterSpec(128, Base64.decode(iv, Base64.DEFAULT))
            );
            byte[] clear = cipher.doFinal(Base64.decode(encrypted, Base64.DEFAULT));
            JSONObject secrets = new JSONObject(new String(clear, StandardCharsets.UTF_8));
            secrets.put("saved", true);
            resolve(requestId, secrets);
        } catch (Exception error) {
            getSharedPreferences(SESSION_PREFS, Context.MODE_PRIVATE).edit().clear().apply();
            reject(requestId, "session_load_failed: " + error.getClass().getSimpleName());
        }
    }

    private void clearManagedSessionSecrets(String requestId) {
        getSharedPreferences(SESSION_PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        resolve(requestId, new JSONObject());
    }

    private void requestGalleryPermission(String requestId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            resolve(requestId, permissionPayload(true, "granted"));
            return;
        }
        requestPermission(requestId, Manifest.permission.WRITE_EXTERNAL_STORAGE);
    }

    private void requestNotificationPermission(String requestId) {
        if (Build.VERSION.SDK_INT < 33) {
            resolve(requestId, permissionPayload(true, "granted"));
            return;
        }
        requestPermission(requestId, Manifest.permission.POST_NOTIFICATIONS);
    }

    private void requestPermission(String requestId, String permission) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) {
            resolve(requestId, permissionPayload(true, "granted"));
            return;
        }
        int requestCode = nextPermissionRequestCode++;
        pendingPermissions.put(requestCode, new PendingPermission(requestId, permission));
        requestPermissions(new String[] { permission }, requestCode);
    }

    private JSONObject permissionPayload(boolean granted, String status) {
        return permissionPayload(granted, status, granted);
    }

    private JSONObject permissionPayload(boolean granted, String status, boolean canAskAgain) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("granted", granted);
            payload.put("status", status);
            payload.put("canAskAgain", canAskAgain);
        } catch (JSONException ignored) {
        }
        return payload;
    }

    private void captureImage(String requestId, String fileName) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            reject(requestId, "camera permission denied");
            return;
        }
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (intent.resolveActivity(getPackageManager()) == null) {
            reject(requestId, "camera is not available");
            return;
        }
        try {
            String safeName = ensureExtension(safeFileName(fileName), ".jpg");
            pendingCameraValues = new ContentValues();
            pendingCameraValues.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
            pendingCameraValues.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                pendingCameraValues.put(
                    MediaStore.Images.Media.RELATIVE_PATH,
                    Environment.DIRECTORY_PICTURES + "/JisudengChat/Camera"
                );
                pendingCameraValues.put(MediaStore.Images.Media.IS_PENDING, 1);
            }
            pendingCameraUri = getContentResolver().insert(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                pendingCameraValues
            );
            if (pendingCameraUri == null) {
                reject(requestId, "failed to create camera item");
                return;
            }
            pendingCameraRequestId = requestId;
            intent.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(intent, CAMERA_REQUEST);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void recognizeSpeech(String requestId, String language, String prompt) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            reject(requestId, "microphone permission denied");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            reject(requestId, "speech recognition is not available");
            return;
        }
        pendingSpeechRequestId = requestId;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt);
        startActivityForResult(intent, SPEECH_REQUEST);
    }

    private void startHoldSpeech(String requestId, String language, String prompt) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            reject(requestId, "microphone permission denied");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            reject(requestId, "speech recognition is not available");
            return;
        }
        cancelForegroundPttSession(null, "replaced");
        cancelHoldSpeechSession("replaced");
        holdSpeechRequestId = requestId;
        holdSpeechMatches = new ArrayList<>();
        holdSpeechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        holdSpeechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
            }

            @Override
            public void onBeginningOfSpeech() {
            }

            @Override
            public void onRmsChanged(float rmsdB) {
            }

            @Override
            public void onBufferReceived(byte[] buffer) {
            }

            @Override
            public void onEndOfSpeech() {
            }

            @Override
            public void onError(int error) {
                String pending = holdSpeechRequestId;
                ArrayList<String> matches = holdSpeechMatches;
                destroyHoldSpeechRecognizer();
                if (pending == null) return;
                if (matches != null && !matches.isEmpty()) {
                    resolve(pending, speechPayload(matches, false));
                    return;
                }
                reject(pending, "speech recognition cancelled");
            }

            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null) {
                    holdSpeechMatches = matches;
                }
                String pending = holdSpeechRequestId;
                destroyHoldSpeechRecognizer();
                if (pending != null) {
                    resolve(pending, speechPayload(matches, false));
                }
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    holdSpeechMatches = matches;
                }
            }

            @Override
            public void onEvent(int eventType, Bundle params) {
            }
        });
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        holdSpeechRecognizer.startListening(intent);
    }

    private void stopHoldSpeech(String requestId) {
        if (holdSpeechRecognizer == null) {
            resolve(requestId, new JSONObject());
            return;
        }
        holdSpeechRecognizer.stopListening();
        resolve(requestId, new JSONObject());
    }

    private void cancelHoldSpeech(String requestId) {
        cancelHoldSpeechSession("cancelled");
        resolve(requestId, new JSONObject());
    }

    private void cancelActiveSpeechSessions(String reason) {
        cancelHoldSpeechSession(reason);
        cancelForegroundPttSession(null, reason);
        stopWakeWordSession(null, reason);
        stopSpeaking();
    }

    private void cancelHoldSpeechSession(String reason) {
        String pending = holdSpeechRequestId;
        if (pending == null) return;
        destroyHoldSpeechRecognizer();
        JSONObject payload = speechPayload(new ArrayList<>(), true);
        try {
            payload.put("reason", reason == null ? "cancelled" : reason);
        } catch (JSONException ignored) {
        }
        resolve(pending, payload);
    }

    private void startForegroundPtt(
        String requestId,
        String sessionId,
        String language,
        String prompt
    ) {
        if (!isValidForegroundPttSessionId(sessionId)) {
            reject(requestId, "invalid foreground PTT session id");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            reject(requestId, "microphone permission denied");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            reject(requestId, "speech recognition is not available");
            return;
        }

        cancelForegroundPttSession(null, "replaced");
        cancelHoldSpeechSession("replaced");

        final String activeSessionId = sessionId;
        final SpeechRecognizer recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        foregroundPttSessionId = activeSessionId;
        foregroundPttRecognizer = recognizer;
        foregroundPttMatches = new ArrayList<>();
        foregroundPttStopRequested = false;

        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                if (!isForegroundPttSessionActive(activeSessionId)) return;
                emitForegroundPttEvent(
                    activeSessionId,
                    "ready",
                    speechPayload(new ArrayList<>(), false)
                );
            }

            @Override
            public void onBeginningOfSpeech() {
            }

            @Override
            public void onRmsChanged(float rmsdB) {
            }

            @Override
            public void onBufferReceived(byte[] buffer) {
            }

            @Override
            public void onEndOfSpeech() {
            }

            @Override
            public void onError(int error) {
                if (!isForegroundPttSessionActive(activeSessionId)) return;
                ArrayList<String> matches = new ArrayList<>(foregroundPttMatches);
                boolean stopped = foregroundPttStopRequested;
                releaseForegroundPttRecognizer();
                if (stopped && !matches.isEmpty()) {
                    emitForegroundPttEvent(
                        activeSessionId,
                        "final",
                        speechPayload(matches, false)
                    );
                    return;
                }
                emitForegroundPttEvent(
                    activeSessionId,
                    "error",
                    foregroundPttErrorPayload(error, matches)
                );
            }

            @Override
            public void onResults(Bundle results) {
                if (!isForegroundPttSessionActive(activeSessionId)) return;
                ArrayList<String> matches = results.getStringArrayList(
                    SpeechRecognizer.RESULTS_RECOGNITION
                );
                if (matches == null) matches = new ArrayList<>();
                foregroundPttMatches = new ArrayList<>(matches);
                releaseForegroundPttRecognizer();
                emitForegroundPttEvent(
                    activeSessionId,
                    "final",
                    speechPayload(matches, false)
                );
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                if (!isForegroundPttSessionActive(activeSessionId)) return;
                ArrayList<String> matches = partialResults.getStringArrayList(
                    SpeechRecognizer.RESULTS_RECOGNITION
                );
                if (matches == null || matches.isEmpty()) return;
                foregroundPttMatches = new ArrayList<>(matches);
                emitForegroundPttEvent(
                    activeSessionId,
                    "partial",
                    speechPayload(matches, false)
                );
            }

            @Override
            public void onEvent(int eventType, Bundle params) {
            }
        });

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        try {
            recognizer.startListening(intent);
            JSONObject payload = new JSONObject();
            payload.put("sessionId", activeSessionId);
            payload.put("state", "listening");
            resolve(requestId, payload);
        } catch (Exception error) {
            if (isForegroundPttSessionActive(activeSessionId)) {
                releaseForegroundPttRecognizer();
            }
            reject(requestId, safeErrorMessage(error));
        }
    }

    private void stopForegroundPtt(String requestId, String sessionId) {
        if (!isValidForegroundPttSessionId(sessionId)) {
            reject(requestId, "invalid foreground PTT session id");
            return;
        }
        if (!isForegroundPttSessionActive(sessionId) || foregroundPttRecognizer == null) {
            resolve(requestId, foregroundPttCommandPayload(sessionId, false));
            return;
        }
        try {
            foregroundPttStopRequested = true;
            foregroundPttRecognizer.stopListening();
            resolve(requestId, foregroundPttCommandPayload(sessionId, true));
        } catch (Exception error) {
            ArrayList<String> matches = new ArrayList<>(foregroundPttMatches);
            releaseForegroundPttRecognizer();
            emitForegroundPttEvent(
                sessionId,
                "error",
                foregroundPttErrorPayload(SpeechRecognizer.ERROR_CLIENT, matches)
            );
            reject(requestId, safeErrorMessage(error));
        }
    }

    private void cancelForegroundPtt(String requestId, String sessionId, String reason) {
        if (!isValidForegroundPttSessionId(sessionId)) {
            reject(requestId, "invalid foreground PTT session id");
            return;
        }
        resolve(
            requestId,
            foregroundPttCommandPayload(
                sessionId,
                cancelForegroundPttSession(sessionId, reason)
            )
        );
    }

    private boolean cancelForegroundPttSession(String requestedSessionId, String reason) {
        String activeSessionId = foregroundPttSessionId;
        if (activeSessionId == null) return false;
        if (requestedSessionId != null && !requestedSessionId.isEmpty() &&
            !activeSessionId.equals(requestedSessionId)) {
            return false;
        }
        SpeechRecognizer recognizer = foregroundPttRecognizer;
        foregroundPttRecognizer = null;
        foregroundPttSessionId = null;
        foregroundPttMatches = new ArrayList<>();
        foregroundPttStopRequested = false;
        if (recognizer != null) {
            try {
                recognizer.cancel();
                recognizer.destroy();
            } catch (Exception ignored) {
            }
        }
        JSONObject payload = speechPayload(new ArrayList<>(), true);
        try {
            payload.put("reason", reason == null || reason.isEmpty() ? "cancelled" : reason);
        } catch (JSONException ignored) {
        }
        emitForegroundPttEvent(activeSessionId, "cancelled", payload);
        return true;
    }

    private boolean isForegroundPttSessionActive(String sessionId) {
        return sessionId != null && sessionId.equals(foregroundPttSessionId);
    }

    private boolean isValidForegroundPttSessionId(String sessionId) {
        return sessionId != null &&
            sessionId.length() > 0 &&
            sessionId.length() <= 128 &&
            sessionId.matches("[A-Za-z0-9._:-]+");
    }

    private void releaseForegroundPttRecognizer() {
        SpeechRecognizer recognizer = foregroundPttRecognizer;
        foregroundPttRecognizer = null;
        foregroundPttSessionId = null;
        foregroundPttMatches = new ArrayList<>();
        foregroundPttStopRequested = false;
        if (recognizer == null) return;
        try {
            recognizer.destroy();
        } catch (Exception ignored) {
        }
    }

    // Wake-word recognition is intentionally activity-foreground only. The
    // browser starts a normal PTT turn after a match; it never receives audio
    // bytes or an always-on background microphone capability.
    private void startWakeWord(String requestId, String sessionId, String phrase, String language) {
        if (!isValidForegroundPttSessionId(sessionId)) {
            reject(requestId, "wake word session id is invalid");
            return;
        }
        String cleanPhrase = phrase == null ? "" : phrase.trim();
        if (cleanPhrase.isEmpty() || cleanPhrase.length() > 64 || normalizeWakeWord(cleanPhrase).isEmpty()) {
            reject(requestId, "wake word must contain 1 to 64 characters");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            reject(requestId, "microphone permission denied");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            reject(requestId, "speech recognition is not available");
            return;
        }

        cancelForegroundPttSession(null, "replaced");
        cancelHoldSpeechSession("replaced");
        stopWakeWordSession(null, "replaced");

        wakeWordSessionId = sessionId;
        wakeWordPhrase = cleanPhrase;
        wakeWordLanguage = language == null || language.trim().isEmpty()
            ? Locale.getDefault().toLanguageTag()
            : language.trim();
        wakeWordRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        wakeWordRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                String activeSessionId = wakeWordSessionId;
                if (isWakeWordSessionActive(activeSessionId)) {
                    JSONObject payload = new JSONObject();
                    try {
                        payload.put("phrase", wakeWordPhrase);
                    } catch (JSONException ignored) {
                    }
                    emitWakeWordEvent(activeSessionId, "ready", payload);
                }
            }

            @Override
            public void onBeginningOfSpeech() {
            }

            @Override
            public void onRmsChanged(float rmsdB) {
            }

            @Override
            public void onBufferReceived(byte[] buffer) {
            }

            @Override
            public void onEndOfSpeech() {
            }

            @Override
            public void onError(int error) {
                String activeSessionId = wakeWordSessionId;
                if (!isWakeWordSessionActive(activeSessionId)) return;
                if (wakeWordErrorIsRecoverable(error)) {
                    restartWakeWordRecognizer(activeSessionId);
                    return;
                }
                JSONObject payload = wakeWordErrorPayload(error);
                releaseWakeWordRecognizer();
                clearWakeWordSession();
                emitWakeWordEvent(activeSessionId, "error", payload);
            }

            @Override
            public void onResults(Bundle results) {
                String activeSessionId = wakeWordSessionId;
                if (!isWakeWordSessionActive(activeSessionId)) return;
                ArrayList<String> matches = results == null
                    ? new ArrayList<>()
                    : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (!emitWakeWordMatchIfPresent(activeSessionId, matches)) {
                    restartWakeWordRecognizer(activeSessionId);
                }
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                String activeSessionId = wakeWordSessionId;
                if (!isWakeWordSessionActive(activeSessionId)) return;
                ArrayList<String> matches = partialResults == null
                    ? new ArrayList<>()
                    : partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (emitWakeWordMatchIfPresent(activeSessionId, matches)) return;
                if (matches != null && !matches.isEmpty()) {
                    JSONObject payload = new JSONObject();
                    try {
                        payload.put("transcript", matches.get(0));
                        payload.put("phrase", wakeWordPhrase);
                    } catch (JSONException ignored) {
                    }
                    emitWakeWordEvent(activeSessionId, "partial", payload);
                }
            }

            @Override
            public void onEvent(int eventType, Bundle params) {
            }
        });
        startWakeWordListening(sessionId);
        JSONObject payload = new JSONObject();
        try {
            payload.put("sessionId", sessionId);
            payload.put("state", "listening");
        } catch (JSONException ignored) {
        }
        resolve(requestId, payload);
    }

    private void startWakeWordListening(String sessionId) {
        if (!isWakeWordSessionActive(sessionId) || wakeWordRecognizer == null) return;
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, wakeWordLanguage);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false);
        try {
            wakeWordRecognizer.startListening(intent);
        } catch (Exception error) {
            JSONObject payload = wakeWordErrorPayload(SpeechRecognizer.ERROR_CLIENT);
            releaseWakeWordRecognizer();
            clearWakeWordSession();
            emitWakeWordEvent(sessionId, "error", payload);
        }
    }

    private void restartWakeWordRecognizer(String sessionId) {
        if (!isWakeWordSessionActive(sessionId) || webView == null) return;
        WebView activeWebView = webView;
        activeWebView.postDelayed(() -> startWakeWordListening(sessionId), 350L);
    }

    private boolean emitWakeWordMatchIfPresent(String sessionId, ArrayList<String> matches) {
        if (!isWakeWordSessionActive(sessionId) || matches == null) return false;
        String phrase = normalizeWakeWord(wakeWordPhrase);
        for (String candidate : matches) {
            String transcript = candidate == null ? "" : candidate.trim();
            if (transcript.isEmpty() || !normalizeWakeWord(transcript).contains(phrase)) continue;
            JSONObject payload = new JSONObject();
            try {
                payload.put("transcript", transcript);
                payload.put("phrase", wakeWordPhrase);
            } catch (JSONException ignored) {
            }
            releaseWakeWordRecognizer();
            clearWakeWordSession();
            emitWakeWordEvent(sessionId, "matched", payload);
            return true;
        }
        return false;
    }

    private void stopWakeWord(String requestId, String sessionId, String reason) {
        if (!sessionId.isEmpty() && !isWakeWordSessionActive(sessionId)) {
            resolve(requestId, new JSONObject());
            return;
        }
        stopWakeWordSession(sessionId, reason);
        resolve(requestId, new JSONObject());
    }

    private void stopWakeWordSession(String requestedSessionId, String reason) {
        String activeSessionId = wakeWordSessionId;
        if (activeSessionId == null ||
            (requestedSessionId != null && !requestedSessionId.isEmpty() && !requestedSessionId.equals(activeSessionId))) {
            return;
        }
        releaseWakeWordRecognizer();
        clearWakeWordSession();
        JSONObject payload = new JSONObject();
        try {
            payload.put("reason", reason == null ? "cancelled" : reason);
        } catch (JSONException ignored) {
        }
        emitWakeWordEvent(activeSessionId, "stopped", payload);
    }

    private boolean isWakeWordSessionActive(String sessionId) {
        return sessionId != null && sessionId.equals(wakeWordSessionId) && wakeWordRecognizer != null;
    }

    private void clearWakeWordSession() {
        wakeWordSessionId = null;
        wakeWordPhrase = null;
        wakeWordLanguage = null;
    }

    private void releaseWakeWordRecognizer() {
        SpeechRecognizer recognizer = wakeWordRecognizer;
        wakeWordRecognizer = null;
        if (recognizer != null) {
            try {
                recognizer.cancel();
                recognizer.destroy();
            } catch (Exception ignored) {
            }
        }
    }

    private String normalizeWakeWord(String value) {
        String lower = value == null ? "" : value.toLowerCase(Locale.ROOT);
        return lower.replaceAll("[\\s\\p{Punct}]+", "");
    }

    private boolean wakeWordErrorIsRecoverable(int error) {
        return error == SpeechRecognizer.ERROR_NO_MATCH ||
            error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ||
            error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY;
    }

    private JSONObject wakeWordErrorPayload(int error) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("errorCode", foregroundPttErrorCode(error));
            payload.put("errorMessage", foregroundPttErrorMessage(error));
            payload.put("recoverable", wakeWordErrorIsRecoverable(error));
        } catch (JSONException ignored) {
        }
        return payload;
    }

    private void emitWakeWordEvent(String sessionId, String type, JSONObject payload) {
        if (webView == null || sessionId == null || type == null) return;
        try {
            JSONObject eventPayload = payload == null ? new JSONObject() : payload;
            eventPayload.put("sessionId", sessionId);
            eventPayload.put("type", type);
            String script =
                "(function(){var callback=window.__jisudengNativeWakeWordEvent;" +
                "if(typeof callback!=='function')return;" +
                "callback(" + JSONObject.quote(sessionId) + "," + JSONObject.quote(type) +
                ",JSON.parse(" + JSONObject.quote(eventPayload.toString()) + "));})();";
            WebView activeWebView = webView;
            activeWebView.post(() -> activeWebView.evaluateJavascript(script, null));
        } catch (Exception ignored) {
        }
    }

    private void emitSpeechEvent(String utteranceId, String type, JSONObject payload) {
        if (webView == null || utteranceId == null || type == null) return;
        try {
            JSONObject eventPayload = payload == null ? new JSONObject() : payload;
            eventPayload.put("utteranceId", utteranceId);
            eventPayload.put("type", type);
            String script =
                "(function(){var callback=window.__jisudengNativeSpeechEvent;" +
                "if(typeof callback!=='function')return;" +
                "callback(" + JSONObject.quote(utteranceId) + "," + JSONObject.quote(type) +
                ",JSON.parse(" + JSONObject.quote(eventPayload.toString()) + "));})();";
            WebView activeWebView = webView;
            activeWebView.post(() -> activeWebView.evaluateJavascript(script, null));
        } catch (Exception ignored) {
        }
    }

    private void speakText(
        String requestId,
        String text,
        String language,
        double rate,
        String requestedUtteranceId
    ) {
        String cleanText = text == null ? "" : text.trim();
        if (cleanText.isEmpty()) {
            reject(requestId, "text to speech text is required");
            return;
        }
        if (textToSpeech == null || !textToSpeechReady) {
            pendingTextToSpeechRequests.add(
                new PendingTextToSpeechRequest(
                    requestId,
                    cleanText,
                    language,
                    rate,
                    requestedUtteranceId
                )
            );
            initializeTextToSpeech();
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && language != null && !language.trim().isEmpty()) {
                textToSpeech.setLanguage(Locale.forLanguageTag(language.trim()));
            }
            textToSpeech.setSpeechRate((float) Math.max(0.5d, Math.min(2.0d, rate)));
            String utteranceId = requestedUtteranceId == null || requestedUtteranceId.trim().isEmpty()
                ? "jisudeng-tts-" + UUID.randomUUID().toString()
                : requestedUtteranceId.trim();
            if (!isValidNativeSpeechUtteranceId(utteranceId)) {
                reject(requestId, "text to speech utterance id is invalid");
                return;
            }
            activeSpeechUtterances.put(utteranceId, true);
            int status = textToSpeech.speak(
                cleanText.substring(0, Math.min(cleanText.length(), 3800)),
                TextToSpeech.QUEUE_FLUSH,
                null,
                utteranceId
            );
            if (status == TextToSpeech.ERROR) {
                activeSpeechUtterances.remove(utteranceId);
                reject(requestId, "text to speech failed");
                return;
            }
            JSONObject payload = new JSONObject();
            payload.put("utteranceId", utteranceId);
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void initializeTextToSpeech() {
        if (textToSpeech != null || textToSpeechInitializing) return;
        textToSpeechInitializing = true;
        textToSpeech = new TextToSpeech(this, status -> {
            textToSpeechInitializing = false;
            textToSpeechReady = status == TextToSpeech.SUCCESS;
            if (!textToSpeechReady || textToSpeech == null) {
                textToSpeech = null;
                for (PendingTextToSpeechRequest request : new ArrayList<>(pendingTextToSpeechRequests)) {
                    reject(request.requestId, "text to speech is unavailable");
                }
                pendingTextToSpeechRequests.clear();
                return;
            }
            textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    emitSpeechEvent(utteranceId, "started", null);
                }

                @Override
                public void onDone(String utteranceId) {
                    activeSpeechUtterances.remove(utteranceId);
                    emitSpeechEvent(utteranceId, "done", null);
                }

                @Override
                @Deprecated
                public void onError(String utteranceId) {
                    activeSpeechUtterances.remove(utteranceId);
                    JSONObject payload = new JSONObject();
                    try {
                        payload.put("message", "text to speech failed");
                    } catch (JSONException ignored) {
                    }
                    emitSpeechEvent(utteranceId, "error", payload);
                }
            });
            List<PendingTextToSpeechRequest> pending = new ArrayList<>(pendingTextToSpeechRequests);
            pendingTextToSpeechRequests.clear();
            for (PendingTextToSpeechRequest request : pending) {
                speakText(
                    request.requestId,
                    request.text,
                    request.language,
                    request.rate,
                    request.utteranceId
                );
            }
        });
    }

    private void stopSpeaking() {
        if (textToSpeech == null) return;
        try {
            textToSpeech.stop();
            for (String utteranceId : new ArrayList<>(activeSpeechUtterances.keySet())) {
                activeSpeechUtterances.remove(utteranceId);
                emitSpeechEvent(utteranceId, "stopped", null);
            }
        } catch (Exception ignored) {
        }
    }

    private boolean isValidNativeSpeechUtteranceId(String utteranceId) {
        return utteranceId != null &&
            utteranceId.length() > 0 &&
            utteranceId.length() <= 128 &&
            utteranceId.matches("[A-Za-z0-9._:-]+");
    }

    private JSONObject foregroundPttCommandPayload(String sessionId, boolean active) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("sessionId", sessionId);
            payload.put("active", active);
        } catch (JSONException ignored) {
        }
        return payload;
    }

    private JSONObject foregroundPttErrorPayload(int error, ArrayList<String> matches) {
        JSONObject payload = speechPayload(matches, false);
        try {
            payload.put("errorCode", foregroundPttErrorCode(error));
            payload.put("errorMessage", foregroundPttErrorMessage(error));
            payload.put("recoverable", foregroundPttErrorIsRecoverable(error));
        } catch (JSONException ignored) {
        }
        return payload;
    }

    private String foregroundPttErrorCode(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "audio";
            case SpeechRecognizer.ERROR_CLIENT:
                return "client";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "permission_denied";
            case SpeechRecognizer.ERROR_NETWORK:
                return "network";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "network_timeout";
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "no_match";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "recognizer_busy";
            case SpeechRecognizer.ERROR_SERVER:
                return "server";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "speech_timeout";
            default:
                return "unknown";
        }
    }

    private String foregroundPttErrorMessage(int error) {
        return "speech recognition " + foregroundPttErrorCode(error);
    }

    private boolean foregroundPttErrorIsRecoverable(int error) {
        return error == SpeechRecognizer.ERROR_NETWORK ||
            error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ||
            error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ||
            error == SpeechRecognizer.ERROR_SERVER ||
            error == SpeechRecognizer.ERROR_NO_MATCH ||
            error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT;
    }

    private void emitForegroundPttEvent(String sessionId, String type, JSONObject payload) {
        if (webView == null || sessionId == null || type == null) return;
        try {
            JSONObject eventPayload = payload == null ? new JSONObject() : payload;
            eventPayload.put("sessionId", sessionId);
            eventPayload.put("type", type);
            String script =
                "(function(){var callback=window.__jisudengNativeForegroundPttEvent;" +
                "if(typeof callback!=='function')return;" +
                "callback(" + JSONObject.quote(sessionId) + "," + JSONObject.quote(type) +
                ",JSON.parse(" + JSONObject.quote(eventPayload.toString()) + "));})();";
            WebView activeWebView = webView;
            activeWebView.post(() -> activeWebView.evaluateJavascript(script, null));
        } catch (Exception ignored) {
        }
    }

    private JSONObject speechPayload(ArrayList<String> matches, boolean cancelled) {
        JSONObject payload = new JSONObject();
        JSONArray list = new JSONArray();
        try {
            if (matches != null) {
                for (String match : matches) {
                    list.put(match);
                }
            }
            payload.put("matches", list);
            payload.put("text", matches != null && !matches.isEmpty() ? matches.get(0) : "");
            payload.put("cancelled", cancelled);
        } catch (JSONException ignored) {
        }
        return payload;
    }

    private void destroyHoldSpeechRecognizer() {
        if (holdSpeechRecognizer != null) {
            try {
                holdSpeechRecognizer.cancel();
                holdSpeechRecognizer.destroy();
            } catch (Exception ignored) {
            }
        }
        holdSpeechRecognizer = null;
        holdSpeechRequestId = null;
    }

    private void saveImageToGallery(String requestId, String dataUrl, String fileName) {
        try {
            Uri uri = writeImageToGallery(dataUrl, fileName, "JisudengChat");
            JSONObject payload = new JSONObject();
            payload.put("uri", uri.toString());
            payload.put("fileName", safeFileName(fileName));
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void saveImageToAppStorage(
        String requestId,
        String dataUrl,
        String fileName,
        String prompt,
        String model,
        String taskId,
        String ownerUserId,
        String projectId,
        String runId,
        String shotId,
        String kind,
        String label,
        String collectionId
    ) {
        try {
            String requestedOwner = ownerUserId == null ? "" : ownerUserId.trim();
            if (requestedOwner.isEmpty()) {
                reject(requestId, "image owner is required");
                return;
            }
            byte[] data = decodeDataUrl(dataUrl);
            String mimeType = mimeTypeFromDataUrl(dataUrl);
            File dir = getAppImageDir();
            File file = uniqueImageFile(dir, ensureImageExtension(safeFileName(fileName), mimeType));
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(data);
            }
            JSONObject metadata = new JSONObject();
            metadata.put("id", taskId == null || taskId.trim().isEmpty() ? file.getName() : taskId);
            metadata.put("fileName", file.getName());
            metadata.put("prompt", prompt == null ? "" : prompt);
            metadata.put("model", model == null ? "" : model);
            metadata.put("ownerUserId", requestedOwner);
            metadata.put("projectId", projectId == null ? "" : projectId);
            metadata.put("runId", runId == null ? "" : runId);
            metadata.put("shotId", shotId == null ? "" : shotId);
            metadata.put("kind", kind == null ? "" : kind);
            metadata.put("label", label == null ? "" : label);
            metadata.put("collectionId", collectionId == null ? "" : collectionId);
            metadata.put("mimeType", mimeType);
            metadata.put("createdAt", System.currentTimeMillis());
            metadata.put("size", file.length());
            writeImageMetadata(file, metadata);
            resolve(requestId, appImagePayload(file, metadata));
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void listAppImages(String requestId, String ownerUserId) {
        JSONObject payload = new JSONObject();
        JSONArray items = new JSONArray();
        try {
            String requestedOwner = ownerUserId == null ? "" : ownerUserId.trim();
            if (requestedOwner.isEmpty()) {
                reject(requestId, "image owner is required");
                return;
            }
            File[] files = getAppImageDir().listFiles();
            if (files != null) {
                ArrayList<File> images = new ArrayList<>();
                for (File file : files) {
                    if (file.isFile() && isImageFile(file.getName())) {
                        images.add(file);
                    }
                }
                Collections.sort(
                    images,
                    (left, right) -> Long.compare(right.lastModified(), left.lastModified())
                );
                for (File file : images) {
                    JSONObject metadata = readImageMetadata(file);
                    String owner = metadata.optString("ownerUserId", "");
                    // Files from pre-account versions remain on disk but are
                    // hidden until an explicit, account-aware migration is
                    // available. Never claim them for whichever account logs
                    // in first.
                    if (!owner.isEmpty() && requestedOwner.equals(owner)) {
                        items.put(appImagePayload(file, metadata));
                    }
                }
            }
            payload.put("items", items);
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    /**
     * Returns only pre-account local images. This method is deliberately read-only:
     * a user must opt in before any image is attributed to the current account.
     */
    private void listUnassignedAppImages(String requestId, String ownerUserId) {
        JSONObject payload = new JSONObject();
        JSONArray items = new JSONArray();
        try {
            String requestedOwner = ownerUserId == null ? "" : ownerUserId.trim();
            if (requestedOwner.isEmpty()) {
                reject(requestId, "image owner is required");
                return;
            }
            File[] files = getAppImageDir().listFiles();
            if (files != null) {
                ArrayList<File> images = new ArrayList<>();
                for (File file : files) {
                    if (file.isFile() && isImageFile(file.getName())) {
                        images.add(file);
                    }
                }
                Collections.sort(
                    images,
                    (left, right) -> Long.compare(right.lastModified(), left.lastModified())
                );
                for (File file : images) {
                    JSONObject metadata = readImageMetadata(file);
                    String owner = metadata.optString("ownerUserId", "").trim();
                    if (owner.isEmpty()) {
                        items.put(appImagePayload(file, metadata));
                    }
                }
            }
            payload.put("items", items);
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    /**
     * Claims a caller-selected set of pre-account images for one signed-in account.
     * Existing owners are never overwritten, and every requested path is confined to
     * the app image directory before its metadata is changed.
     */
    private void claimUnassignedAppImages(
        String requestId,
        String ownerUserId,
        JSONArray fileNames
    ) {
        JSONObject payload = new JSONObject();
        JSONArray items = new JSONArray();
        int skipped = 0;
        try {
            String requestedOwner = ownerUserId == null ? "" : ownerUserId.trim();
            if (requestedOwner.isEmpty()) {
                reject(requestId, "image owner is required");
                return;
            }
            if (fileNames == null || fileNames.length() == 0) {
                reject(requestId, "at least one unassigned image is required");
                return;
            }

            File dir = getAppImageDir();
            String root = dir.getCanonicalPath() + File.separator;
            Set<String> requestedFiles = new HashSet<>();
            for (int index = 0; index < fileNames.length(); index += 1) {
                String rawFileName = fileNames.optString(index, "").trim();
                if (rawFileName.isEmpty()) {
                    skipped += 1;
                    continue;
                }
                String fileName = safeFileName(rawFileName);
                if (!requestedFiles.add(fileName)) {
                    continue;
                }
                File file = new File(dir, fileName);
                if (
                    !file.getCanonicalPath().startsWith(root) ||
                    !file.isFile() ||
                    !isImageFile(file.getName())
                ) {
                    skipped += 1;
                    continue;
                }
                JSONObject metadata = readImageMetadata(file);
                if (!metadata.optString("ownerUserId", "").trim().isEmpty()) {
                    skipped += 1;
                    continue;
                }
                metadata.put("fileName", file.getName());
                metadata.put("ownerUserId", requestedOwner);
                writeImageMetadata(file, metadata);
                items.put(appImagePayload(file, metadata));
            }
            payload.put("items", items);
            payload.put("claimed", items.length());
            payload.put("skipped", skipped);
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void deleteAppImages(String requestId, String ownerUserId, JSONArray fileNames) {
        JSONObject payload = new JSONObject();
        int deleted = 0;
        try {
            String requestedOwner = ownerUserId == null ? "" : ownerUserId.trim();
            if (requestedOwner.isEmpty()) {
                reject(requestId, "image owner is required");
                return;
            }
            if (fileNames != null) {
                File dir = getAppImageDir();
                String root = dir.getCanonicalPath() + File.separator;
                for (int i = 0; i < fileNames.length(); i += 1) {
                    String name = safeFileName(fileNames.optString(i));
                    File file = new File(dir, name);
                    if (!file.getCanonicalPath().startsWith(root)) {
                        continue;
                    }
                    File metadata = metadataFile(file);
                    JSONObject imageMetadata = readImageMetadata(file);
                    if (!requestedOwner.equals(imageMetadata.optString("ownerUserId", ""))) {
                        continue;
                    }
                    if (file.exists() && file.delete()) {
                        deleted += 1;
                    }
                    if (metadata.exists()) {
                        metadata.delete();
                    }
                }
            }
            payload.put("deleted", deleted);
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void shareImage(
        String requestId,
        String dataUrl,
        String fileName,
        String title,
        String text
    ) {
        try {
            File file = writeImageToCache(dataUrl, fileName);
            Uri uri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                file
            );
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mimeTypeFromDataUrl(dataUrl));
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.putExtra(Intent.EXTRA_TEXT, text);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(intent, title));
            resolve(requestId, new JSONObject());
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void shareImages(
        String requestId,
        JSONArray items,
        String title,
        String text
    ) {
        try {
            if (items == null || items.length() == 0) {
                reject(requestId, "no images selected");
                return;
            }
            ArrayList<Uri> uris = new ArrayList<>();
            ClipData clipData = null;
            for (int i = 0; i < items.length(); i += 1) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                File file = writeImageToCache(
                    item.optString("dataUrl"),
                    item.optString("fileName", "jisudengchat-image-" + (i + 1) + ".png")
                );
                Uri uri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    file
                );
                uris.add(uri);
                if (clipData == null) {
                    clipData = ClipData.newRawUri("images", uri);
                } else {
                    clipData.addItem(new ClipData.Item(uri));
                }
            }
            if (uris.isEmpty()) {
                reject(requestId, "no valid images selected");
                return;
            }
            Intent intent = new Intent(
                uris.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE
            );
            intent.setType("image/*");
            if (uris.size() == 1) {
                intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
            } else {
                intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
            }
            if (clipData != null) intent.setClipData(clipData);
            intent.putExtra(Intent.EXTRA_TEXT, text);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(intent, title));
            resolve(requestId, new JSONObject());
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void shareText(String requestId, String title, String text) {
        try {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("text/plain");
            intent.putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(intent, title));
            resolve(requestId, new JSONObject());
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void shareFile(
        String requestId,
        String dataUrl,
        String fileName,
        String mimeType,
        String title,
        String text
    ) {
        try {
            File file = writeShareFileToCache(dataUrl, fileName);
            Uri uri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                file
            );
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(normalizeMimeType(mimeType));
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.putExtra(Intent.EXTRA_TEXT, text);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(intent, title));
            resolve(requestId, new JSONObject());
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void copyText(String requestId, String text) {
        try {
            android.content.ClipboardManager clipboard =
                (android.content.ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard == null) throw new IllegalStateException("clipboard unavailable");
            clipboard.setPrimaryClip(ClipData.newPlainText("JisudengChat", text));
            resolve(requestId, new JSONObject());
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void showNotification(String requestId, String title, String body) {
        try {
            if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                reject(requestId, "notification permission denied");
                return;
            }
            NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "JisudengChat",
                    NotificationManager.IMPORTANCE_DEFAULT
                );
                manager.createNotificationChannel(channel);
            }
            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
            builder
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true);
            manager.notify((int) System.currentTimeMillis(), builder.build());
            resolve(requestId, new JSONObject());
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void downloadFile(String requestId, String url, String fileName, String title, String rawAuthorization) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            String authorization = safeDownloadAuthorization(rawAuthorization);
            if (!authorization.isEmpty()) {
                request.addRequestHeader("Authorization", authorization);
            }
            request.setTitle(title);
            request.setDescription(fileName);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                safeFileName(fileName)
            );
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            long id = manager.enqueue(request);
            JSONObject payload = new JSONObject();
            payload.put("id", String.valueOf(id));
            payload.put("status", "running");
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private String safeDownloadAuthorization(String rawAuthorization) {
        String authorization = rawAuthorization == null ? "" : rawAuthorization.trim();
        if (!authorization.startsWith("Bearer ") || authorization.length() > 8192 ||
            authorization.contains("\r") || authorization.contains("\n")) {
            return "";
        }
        return authorization;
    }

    private void getDownloadStatus(String requestId, String rawId) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("id", rawId);
            long id = Long.parseLong(rawId);
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
            try (Cursor cursor = manager.query(query)) {
                if (cursor == null || !cursor.moveToFirst()) {
                    payload.put("status", "unknown");
                    resolve(requestId, payload);
                    return;
                }
                int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                payload.put("bytesDownloaded", downloaded);
                payload.put("totalBytes", total);
                payload.put("progress", total > 0 ? Math.round((downloaded * 100.0) / total) : 0);
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    payload.put("status", "success");
                    payload.put("localUri", cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI)));
                } else if (status == DownloadManager.STATUS_FAILED) {
                    payload.put("status", "failed");
                    payload.put("reason", cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)));
                } else if (status == DownloadManager.STATUS_RUNNING) {
                    payload.put("status", "running");
                } else if (status == DownloadManager.STATUS_PENDING) {
                    payload.put("status", "pending");
                } else {
                    payload.put("status", "unknown");
                }
            }
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void installApk(String requestId, String rawId, String rawUri, String expectedSha256) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !getPackageManager().canRequestPackageInstalls()) {
                Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())
                );
                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(settingsIntent);
                reject(requestId, "install permission required");
                return;
            }

            Uri uri = resolveDownloadedApkUri(rawId, rawUri);
            if (uri == null) {
                reject(requestId, "downloaded apk not found");
                return;
            }
            if (!matchesSha256(uri, expectedSha256)) {
                reject(requestId, "downloaded apk checksum mismatch");
                return;
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(intent);
            resolve(requestId, new JSONObject());
        } catch (ActivityNotFoundException error) {
            reject(requestId, "no installer available");
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private Uri resolveDownloadedApkUri(String rawId, String rawUri) {
        try {
            if (rawId != null && rawId.trim().length() > 0) {
                long id = Long.parseLong(rawId);
                DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                Uri downloadUri = manager.getUriForDownloadedFile(id);
                if (downloadUri != null) {
                    return downloadUri;
                }
            }
        } catch (Exception ignored) {
            // Fall through to the URI returned by DownloadManager status.
        }

        if (rawUri == null || rawUri.trim().isEmpty()) {
            return null;
        }

        Uri uri = Uri.parse(rawUri);
        if ("file".equalsIgnoreCase(uri.getScheme())) {
            File file = new File(uri.getPath() == null ? "" : uri.getPath());
            if (!file.exists()) return null;
            return FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                file
            );
        }
        return uri;
    }

    private boolean matchesSha256(Uri uri, String expectedSha256) throws Exception {
        String expected = expectedSha256 == null ? "" : expectedSha256.replaceAll("[^A-Fa-f0-9]", "").toLowerCase(Locale.ROOT);
        if (expected.isEmpty()) return true;
        if (expected.length() != 64) return false;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) return false;
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        StringBuilder actual = new StringBuilder(64);
        for (byte value : digest.digest()) {
            actual.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        }
        return expected.equals(actual.toString());
    }

    private void openUrl(String requestId, String url) {
        try {
            resolve(requestId, openExternalUri(url));
        } catch (Exception error) {
            reject(requestId, safeOpenUrlError(error));
        }
    }

    private JSONObject openExternalUri(String rawUrl) throws Exception {
        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            throw new IOException("open_url_empty");
        }
        String url = rawUrl.trim();
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.US);

        if ("intent".equals(scheme)) {
            return openIntentUri(url);
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if ("weixin".equals(scheme)) {
            intent.setPackage("com.tencent.mm");
            return startExternalActivity(intent, "weixin");
        }
        if ("alipays".equals(scheme) || "alipay".equals(scheme)) {
            intent.setPackage("com.eg.android.AlipayGphone");
            return startExternalActivity(intent, "alipays");
        }
        if ("http".equals(scheme) || "https".equals(scheme)) {
            intent.putExtra(Intent.EXTRA_REFERRER, Uri.parse(LOCAL_ORIGIN + "/"));
            return startExternalActivity(intent, isLikelyMwebUrl(uri) ? "mweb" : "h5");
        }
        return startExternalActivity(intent, scheme.isEmpty() ? "unknown" : scheme);
    }

    private JSONObject openIntentUri(String rawUrl) throws Exception {
        Intent intent = Intent.parseUri(rawUrl, Intent.URI_INTENT_SCHEME);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.setComponent(null);
        intent.setSelector(null);
        try {
            return startExternalActivity(intent, "intent");
        } catch (ActivityNotFoundException error) {
            String fallbackUrl = intent.getStringExtra("browser_fallback_url");
            if (fallbackUrl != null && !fallbackUrl.trim().isEmpty()) {
                return openExternalUri(fallbackUrl);
            }
            String packageName = intent.getPackage();
            if (packageName != null && !packageName.trim().isEmpty()) {
                Intent market = new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + packageName)
                );
                market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                return startExternalActivity(market, "market");
            }
            throw new ActivityNotFoundException("open_url_no_handler:intent");
        }
    }

    private JSONObject startExternalActivity(Intent intent, String channel) throws JSONException {
        startActivity(intent);
        JSONObject payload = new JSONObject();
        payload.put("opened", true);
        payload.put("channel", channel);
        return payload;
    }

    private boolean isLikelyMwebUrl(Uri uri) {
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.US);
        String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase(Locale.US);
        return host.contains("wx.tenpay.com") ||
            host.contains("alipay.com") ||
            path.contains("mweb") ||
            path.contains("cashier") ||
            path.contains("checkout");
    }

    private String safeOpenUrlError(Exception error) {
        if (error instanceof ActivityNotFoundException) {
            String message = error.getMessage();
            return message != null && message.startsWith("open_url_")
                ? message
                : "open_url_no_handler";
        }
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) return "open_url_failed";
        return redactSensitiveText(message);
    }

    private void openAppSettings(String requestId) {
        try {
            Intent intent = new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", getPackageName(), null)
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            resolve(requestId, new JSONObject());
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private interface BillingReadyCallback {
        void run(BillingClient client);
    }

    private BillingClient getOrCreateBillingClient() {
        if (billingClient == null) {
            billingClient = BillingClient.newBuilder(this)
                .enablePendingPurchases(
                    PendingPurchasesParams
                        .newBuilder()
                        .enableOneTimeProducts()
                        .build()
                )
                .setListener(this::handlePurchasesUpdated)
                .enableAutoServiceReconnection()
                .build();
        }
        return billingClient;
    }

    private void withBillingClient(String requestId, BillingReadyCallback callback) {
        BillingClient client = getOrCreateBillingClient();
        if (client.isReady()) {
            callback.run(client);
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                runOnUiThread(() -> {
                    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        callback.run(client);
                        return;
                    }
                    reject(
                        requestId,
                        "play_billing_unavailable:" +
                            billingResult.getResponseCode() +
                            ":" +
                            billingResult.getDebugMessage()
                    );
                });
            }

            @Override
            public void onBillingServiceDisconnected() {
                // The next explicit billing call reconnects. Purchases are also
                // recoverable through queryPlayBillingPurchases.
            }
        });
    }

    private String normalizePlayBillingProductType(String rawType) {
        if (BillingClient.ProductType.SUBS.equals(rawType)) {
            return BillingClient.ProductType.SUBS;
        }
        return BillingClient.ProductType.INAPP;
    }

    private List<QueryProductDetailsParams.Product> playBillingProducts(
        JSONArray productIds,
        String productType
    ) throws JSONException {
        if (productIds == null || productIds.length() == 0) {
            throw new JSONException("productIds are required");
        }
        ArrayList<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (int i = 0; i < productIds.length(); i += 1) {
            String productId = productIds.optString(i, "").trim();
            if (productId.isEmpty()) continue;
            products.add(
                QueryProductDetailsParams.Product
                    .newBuilder()
                    .setProductId(productId)
                    .setProductType(productType)
                    .build()
            );
        }
        if (products.isEmpty()) {
            throw new JSONException("productIds are required");
        }
        return products;
    }

    private void getPlayBillingStatus(String requestId) {
        withBillingClient(requestId, client -> {
            JSONObject payload = billingPayload(
                true,
                true,
                BillingClient.BillingResponseCode.OK,
                "ready"
            );
            resolve(requestId, payload);
        });
    }

    private void queryPlayBillingProducts(
        String requestId,
        JSONArray productIds,
        String rawProductType
    ) {
        String productType = normalizePlayBillingProductType(rawProductType);
        List<QueryProductDetailsParams.Product> products;
        try {
            products = playBillingProducts(productIds, productType);
        } catch (JSONException error) {
            reject(requestId, error.getMessage());
            return;
        }
        withBillingClient(requestId, client -> {
            QueryProductDetailsParams params = QueryProductDetailsParams
                .newBuilder()
                .setProductList(products)
                .build();
            client.queryProductDetailsAsync(params, (billingResult, result) -> runOnUiThread(() -> {
                try {
                    JSONObject payload = billingPayload(
                        billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK,
                        client.isReady(),
                        billingResult.getResponseCode(),
                        billingResult.getDebugMessage()
                    );
                    JSONArray items = new JSONArray();
                    for (ProductDetails details : result.getProductDetailsList()) {
                        items.put(playBillingProductPayload(details));
                    }
                    payload.put("products", items);
                    payload.put("unfetchedCount", result.getUnfetchedProductList().size());
                    resolve(requestId, payload);
                } catch (JSONException error) {
                    reject(requestId, error.getMessage());
                }
            }));
        });
    }

    private ProductDetails findProductDetails(
        List<ProductDetails> detailsList,
        String productId
    ) {
        for (ProductDetails details : detailsList) {
            if (productId.equals(details.getProductId())) return details;
        }
        return null;
    }

    private void launchPlayBillingPurchase(String requestId, JSONObject options) {
        String productId = options.optString("productId", "").trim();
        if (productId.isEmpty()) {
            reject(requestId, "productId is required");
            return;
        }
        if (pendingBillingPurchaseRequestId != null) {
            reject(requestId, "play billing purchase already in progress");
            return;
        }
        String productType = normalizePlayBillingProductType(
            options.optString("productType", BillingClient.ProductType.INAPP)
        );
        JSONArray productIds = new JSONArray();
        productIds.put(productId);
        List<QueryProductDetailsParams.Product> products;
        try {
            products = playBillingProducts(productIds, productType);
        } catch (JSONException error) {
            reject(requestId, error.getMessage());
            return;
        }
        withBillingClient(requestId, client -> {
            QueryProductDetailsParams params = QueryProductDetailsParams
                .newBuilder()
                .setProductList(products)
                .build();
            client.queryProductDetailsAsync(params, (billingResult, result) -> runOnUiThread(() -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    reject(
                        requestId,
                        "play_billing_product_query_failed:" +
                            billingResult.getResponseCode() +
                            ":" +
                            billingResult.getDebugMessage()
                    );
                    return;
                }
                ProductDetails productDetails = findProductDetails(
                    result.getProductDetailsList(),
                    productId
                );
                if (productDetails == null) {
                    reject(requestId, "play billing product not found: " + productId);
                    return;
                }
                BillingFlowParams.ProductDetailsParams.Builder detailsParams =
                    BillingFlowParams.ProductDetailsParams
                        .newBuilder()
                        .setProductDetails(productDetails);
                String offerToken = options.optString("offerToken", "").trim();
                if (!offerToken.isEmpty()) {
                    detailsParams.setOfferToken(offerToken);
                }
                BillingFlowParams.Builder flowParams = BillingFlowParams
                    .newBuilder()
                    .setProductDetailsParamsList(
                        Collections.singletonList(detailsParams.build())
                    );
                String accountId = options.optString("obfuscatedAccountId", "").trim();
                if (!accountId.isEmpty()) {
                    flowParams.setObfuscatedAccountId(accountId);
                }
                String profileId = options.optString("obfuscatedProfileId", "").trim();
                if (!profileId.isEmpty()) {
                    flowParams.setObfuscatedProfileId(profileId);
                }
                pendingBillingPurchaseRequestId = requestId;
                BillingResult launchResult = client.launchBillingFlow(
                    MainActivity.this,
                    flowParams.build()
                );
                if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    pendingBillingPurchaseRequestId = null;
                    reject(
                        requestId,
                        "play_billing_launch_failed:" +
                            launchResult.getResponseCode() +
                            ":" +
                            launchResult.getDebugMessage()
                    );
                }
            }));
        });
    }

    private void queryPlayBillingPurchases(String requestId, String rawProductType) {
        String productType = normalizePlayBillingProductType(rawProductType);
        withBillingClient(requestId, client -> {
            QueryPurchasesParams params = QueryPurchasesParams
                .newBuilder()
                .setProductType(productType)
                .build();
            client.queryPurchasesAsync(params, (billingResult, purchases) -> runOnUiThread(() -> {
                try {
                    JSONObject payload = playBillingPurchaseResultPayload(
                        billingResult,
                        purchases == null ? Collections.emptyList() : purchases
                    );
                    payload.put("status", "purchased");
                    resolve(requestId, payload);
                } catch (JSONException error) {
                    reject(requestId, error.getMessage());
                }
            }));
        });
    }

    private void consumePlayBillingPurchase(String requestId, String purchaseToken) {
        if (purchaseToken == null || purchaseToken.trim().isEmpty()) {
            reject(requestId, "purchaseToken is required");
            return;
        }
        withBillingClient(requestId, client -> {
            ConsumeParams params = ConsumeParams
                .newBuilder()
                .setPurchaseToken(purchaseToken.trim())
                .build();
            client.consumeAsync(params, (billingResult, token) -> runOnUiThread(() -> {
                JSONObject payload = billingPayload(
                    billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK,
                    client.isReady(),
                    billingResult.getResponseCode(),
                    billingResult.getDebugMessage()
                );
                resolve(requestId, payload);
            }));
        });
    }

    private void acknowledgePlayBillingPurchase(String requestId, String purchaseToken) {
        if (purchaseToken == null || purchaseToken.trim().isEmpty()) {
            reject(requestId, "purchaseToken is required");
            return;
        }
        withBillingClient(requestId, client -> {
            AcknowledgePurchaseParams params = AcknowledgePurchaseParams
                .newBuilder()
                .setPurchaseToken(purchaseToken.trim())
                .build();
            client.acknowledgePurchase(params, billingResult -> runOnUiThread(() -> {
                JSONObject payload = billingPayload(
                    billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK,
                    client.isReady(),
                    billingResult.getResponseCode(),
                    billingResult.getDebugMessage()
                );
                resolve(requestId, payload);
            }));
        });
    }

    private JSONObject billingPayload(
        boolean available,
        boolean ready,
        int responseCode,
        String debugMessage
    ) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("available", available);
            payload.put("ready", ready);
            payload.put("responseCode", responseCode);
            payload.put("debugMessage", debugMessage == null ? "" : debugMessage);
        } catch (JSONException ignored) {
        }
        return payload;
    }

    private JSONObject playBillingProductPayload(ProductDetails details) throws JSONException {
        JSONObject payload = new JSONObject();
        payload.put("productId", details.getProductId());
        payload.put("productType", details.getProductType());
        payload.put("title", details.getTitle());
        payload.put("name", details.getName());
        payload.put("description", details.getDescription());
        ProductDetails.OneTimePurchaseOfferDetails offer =
            details.getOneTimePurchaseOfferDetails();
        if (
            offer == null &&
            details.getOneTimePurchaseOfferDetailsList() != null &&
            !details.getOneTimePurchaseOfferDetailsList().isEmpty()
        ) {
            offer = details.getOneTimePurchaseOfferDetailsList().get(0);
        }
        if (offer != null) {
            payload.put("formattedPrice", offer.getFormattedPrice());
            payload.put("priceCurrencyCode", offer.getPriceCurrencyCode());
            payload.put("priceAmountMicros", offer.getPriceAmountMicros());
            payload.put("offerToken", offer.getOfferToken());
        }
        return payload;
    }

    private JSONObject playBillingPurchasePayload(Purchase purchase) throws JSONException {
        JSONObject payload = new JSONObject();
        payload.put("purchaseToken", purchase.getPurchaseToken());
        payload.put("orderId", purchase.getOrderId());
        payload.put("packageName", purchase.getPackageName());
        payload.put("purchaseTime", purchase.getPurchaseTime());
        payload.put("purchaseState", purchase.getPurchaseState());
        payload.put("acknowledged", purchase.isAcknowledged());
        payload.put("autoRenewing", purchase.isAutoRenewing());
        payload.put("quantity", purchase.getQuantity());
        payload.put("originalJson", purchase.getOriginalJson());
        payload.put("signature", purchase.getSignature());
        JSONArray products = new JSONArray();
        for (String product : purchase.getProducts()) {
            products.put(product);
        }
        payload.put("productIds", products);
        return payload;
    }

    private JSONObject playBillingPurchaseResultPayload(
        BillingResult billingResult,
        List<Purchase> purchases
    ) throws JSONException {
        JSONObject payload = billingPayload(
            billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK,
            billingClient != null && billingClient.isReady(),
            billingResult.getResponseCode(),
            billingResult.getDebugMessage()
        );
        JSONArray items = new JSONArray();
        boolean hasPending = false;
        for (Purchase purchase : purchases) {
            items.put(playBillingPurchasePayload(purchase));
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                hasPending = true;
            }
        }
        payload.put("status", hasPending ? "pending" : "purchased");
        payload.put("purchases", items);
        return payload;
    }

    private void handlePurchasesUpdated(
        BillingResult billingResult,
        List<Purchase> purchases
    ) {
        String requestId = pendingBillingPurchaseRequestId;
        pendingBillingPurchaseRequestId = null;
        if (requestId == null || requestId.isEmpty()) return;
        runOnUiThread(() -> {
            try {
                if (
                    billingResult.getResponseCode() ==
                        BillingClient.BillingResponseCode.USER_CANCELED
                ) {
                    JSONObject payload = billingPayload(
                        true,
                        billingClient != null && billingClient.isReady(),
                        billingResult.getResponseCode(),
                        billingResult.getDebugMessage()
                    );
                    payload.put("status", "cancelled");
                    payload.put("purchases", new JSONArray());
                    resolve(requestId, payload);
                    return;
                }
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    JSONObject payload = billingPayload(
                        false,
                        billingClient != null && billingClient.isReady(),
                        billingResult.getResponseCode(),
                        billingResult.getDebugMessage()
                    );
                    payload.put("status", "failed");
                    payload.put("purchases", new JSONArray());
                    resolve(requestId, payload);
                    return;
                }
                resolve(
                    requestId,
                    playBillingPurchaseResultPayload(
                        billingResult,
                        purchases == null ? Collections.emptyList() : purchases
                    )
                );
            } catch (JSONException error) {
                reject(requestId, error.getMessage());
            }
        });
    }

    private void streamRequest(String requestId, JSONObject options) {
        String url = options.optString("url");
        String method = options.optString("method", "POST");
        String body = options.optString("body", "");
        String bodyBase64 = options.optString("bodyBase64", "");
        JSONObject headers = options.optJSONObject("headers");
        cancelledStreamRequests.remove(requestId);
        if (
            e2eFirstBootstrap401Fixture &&
            !e2eBootstrap401Used &&
            url.contains("/api/v1/nextchat/mobile/bootstrap")
        ) {
            e2eBootstrap401Used = true;
            runE2eHttpErrorFixture(
                requestId,
                401,
                "{\"code\":401,\"message\":\"token expired\"}"
            );
            return;
        }
        if (e2eFirstImage502Fixture && url.contains("/v1/images/")) {
            runE2eImageFixture(requestId);
            return;
        }
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(url).openConnection();
                streamConnections.put(requestId, connection);
                if (cancelledStreamRequests.containsKey(requestId)) {
                    connection.disconnect();
                    return;
                }
                connection.setRequestMethod(method);
                connection.setConnectTimeout(options.optInt("connectTimeout", 15000));
                connection.setReadTimeout(options.optInt("readTimeout", 120000));
                connection.setUseCaches(false);
                connection.setRequestProperty("Connection", "close");
                connection.setDoInput(true);
                connection.setRequestProperty("Accept", "text/event-stream, application/json");
                if (headers != null) {
                    Iterator<String> keys = headers.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        connection.setRequestProperty(key, headers.optString(key));
                    }
                }
                byte[] requestBody = null;
                if (bodyBase64 != null && !bodyBase64.isEmpty()) {
                    requestBody = Base64.decode(bodyBase64, Base64.DEFAULT);
                } else if (body != null && !body.isEmpty()) {
                    requestBody = body.getBytes(StandardCharsets.UTF_8);
                }
                if (requestBody != null && requestBody.length > 0) {
                    Log.i(LOG_TAG, "stream request " + method + " " + safeRequestPath(url) + " requestBytes=" + requestBody.length);
                    connection.setDoOutput(true);
                    connection.setFixedLengthStreamingMode(requestBody.length);
                    try (OutputStream out = connection.getOutputStream()) {
                        out.write(requestBody);
                    }
                }

                int status = connection.getResponseCode();
                Log.i(LOG_TAG, "stream response " + method + " " + safeRequestPath(url) + " status=" + status);
                streamStatus(requestId, status);
                InputStream input = status >= 200 && status < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
                if (input == null) {
                    if (status >= 200 && status < 300) {
                        streamDone(requestId);
                    } else {
                        streamError(requestId, "HTTP " + status, status);
                    }
                    return;
                }
                StringBuilder errorBody = new StringBuilder();
                int responseChars = 0;
                int responseLines = 0;
                int maxLineChars = 0;
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        responseChars += line.length();
                        responseLines += 1;
                        maxLineChars = Math.max(maxLineChars, line.length());
                        if (status >= 200 && status < 300) {
                            streamData(requestId, line);
                        } else if (errorBody.length() < 4096) {
                            errorBody.append(line).append('\n');
                        }
                    }
                }
                Log.i(
                    LOG_TAG,
                    "stream body " + method + " " + safeRequestPath(url) +
                        " chars=" + responseChars + " lines=" + responseLines +
                        " maxLineChars=" + maxLineChars
                );
                if (status >= 200 && status < 300) {
                    streamDone(requestId);
                } else {
                    streamError(requestId, errorBody.toString().trim(), status);
                }
            } catch (Exception error) {
                if (!cancelledStreamRequests.containsKey(requestId)) {
                    Log.e(
                        LOG_TAG,
                        "stream failure " + method + " " + safeRequestPath(url) +
                            " type=" + error.getClass().getSimpleName() +
                            " message=" + safeErrorMessage(error)
                    );
                    streamError(requestId, error.getMessage(), 0);
                }
            } finally {
                streamConnections.remove(requestId);
                cancelledStreamRequests.remove(requestId);
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
        JSONObject payload = new JSONObject();
        try {
            payload.put("id", requestId);
        } catch (JSONException ignored) {
        }
        resolve(requestId, payload);
    }

    private synchronized int nextE2eImageFixtureAttempt() {
        e2eImageFixtureAttempt += 1;
        return e2eImageFixtureAttempt;
    }

    private void runE2eImageFixture(String requestId) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("id", requestId);
        } catch (JSONException ignored) {
        }
        resolve(requestId, payload);
        int attempt = nextE2eImageFixtureAttempt();
        webView.postDelayed(() -> {
            Log.i(
                LOG_TAG,
                "E2E image fixture attempt=" + attempt +
                " status=" + (attempt == 1 ? 502 : 200)
            );
            if (attempt == 1) {
                streamStatus(requestId, 502);
                streamError(
                    requestId,
                    "{\"title\":\"Bad Gateway\",\"detail\":\"E2E upstream busy\",\"instance\":\"e2e-image-502\"}",
                    502
                );
                return;
            }
            streamStatus(requestId, 200);
            streamData(
                requestId,
                "{\"data\":[{\"b64_json\":\"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZJ9sAAAAASUVORK5CYII=\"}]}"
            );
            streamDone(requestId);
        }, 80);
    }

    private void runE2eHttpErrorFixture(String requestId, int status, String body) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("id", requestId);
        } catch (JSONException ignored) {
        }
        resolve(requestId, payload);
        webView.postDelayed(() -> {
            streamStatus(requestId, status);
            streamError(requestId, body, status);
        }, 80);
    }

    private String safeRequestPath(String rawUrl) {
        try {
            URL parsed = new URL(rawUrl);
            String path = parsed.getPath();
            return path == null || path.isEmpty() ? "/" : path;
        } catch (Exception ignored) {
            return "/";
        }
    }

    private void cancelStreamRequest(String requestId) {
        if (requestId == null || requestId.isEmpty()) return;
        cancelledStreamRequests.put(requestId, true);
        HttpURLConnection connection = streamConnections.remove(requestId);
        if (connection != null) {
            connection.disconnect();
        }
    }

    private void streamStatus(String requestId, int status) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("status", status);
        } catch (JSONException ignored) {
        }
        streamEvent(requestId, "status", payload);
    }

    private void streamData(String requestId, String line) {
        String value = line == null ? "" : line;
        if (value.isEmpty()) {
            streamDataChunk(requestId, "", false);
            return;
        }
        int offset = 0;
        while (offset < value.length()) {
            int end = Math.min(value.length(), offset + STREAM_EVENT_CHUNK_CHARS);
            if (
                end < value.length() &&
                end > offset &&
                Character.isHighSurrogate(value.charAt(end - 1))
            ) {
                end -= 1;
            }
            streamDataChunk(requestId, value.substring(offset, end), end < value.length());
            offset = end;
        }
    }

    private void streamDataChunk(String requestId, String chunk, boolean continued) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("line", chunk);
            payload.put("continued", continued);
        } catch (JSONException ignored) {
        }
        streamEvent(requestId, "data", payload);
    }

    private void streamDone(String requestId) {
        streamEvent(requestId, "done", new JSONObject());
    }

    private void streamError(String requestId, String message, int status) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("message", message == null || message.isEmpty() ? "stream request failed" : message);
            payload.put("status", status);
        } catch (JSONException ignored) {
        }
        streamEvent(requestId, "error", payload);
    }

    private void streamEvent(String requestId, String type, JSONObject payload) {
        if (cancelledStreamRequests.containsKey(requestId)) return;
        String js = "window.__jisudengNativeStream && window.__jisudengNativeStream(" +
            JSONObject.quote(requestId) +
            "," +
            JSONObject.quote(type) +
            "," +
            payload.toString() +
            ");";
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript(js, null);
            }
        });
    }

    private void getFcmToken(String requestId) {
        Log.i(LOG_TAG, "FCM token request started");
        AtomicBoolean completed = new AtomicBoolean(false);
        Handler handler = new Handler(Looper.getMainLooper());
        handler.postDelayed(() -> {
            if (!completed.compareAndSet(false, true)) return;
            String message = "FCM token request timed out after " + FCM_TOKEN_TIMEOUT_MS + "ms";
            Log.e(LOG_TAG, message);
            reject(requestId, message);
        }, FCM_TOKEN_TIMEOUT_MS);
        FirebaseMessaging.getInstance().setAutoInitEnabled(true);
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(new OnCompleteListener<String>() {
                @Override
                public void onComplete(Task<String> task) {
                    if (!completed.compareAndSet(false, true)) return;
                    if (!task.isSuccessful()) {
                        Exception error = task.getException();
                        String message = error == null
                            ? "FCM token request failed"
                            : safeErrorMessage(error);
                        Log.e(LOG_TAG, "FCM token request failed message=" + message);
                        reject(requestId, message);
                        return;
                    }
                    String token = task.getResult();
                    if (token == null || token.trim().isEmpty()) {
                        Log.e(LOG_TAG, "FCM token request returned an empty token");
                        reject(requestId, "FCM token is empty");
                        return;
                    }
                    JSONObject payload = new JSONObject();
                    try {
                        payload.put("token", token);
                    } catch (JSONException ignored) {
                    }
                    Log.i(LOG_TAG, "FCM token request succeeded length=" + token.length());
                    resolve(requestId, payload);
                }
            });
    }

    private JSONObject getDeviceInfoPayload() {
        JSONObject payload = new JSONObject();
        try {
            payload.put("platform", "android");
            payload.put("manufacturer", Build.MANUFACTURER);
            payload.put("brand", Build.BRAND);
            payload.put("model", Build.MODEL);
            payload.put("device", Build.DEVICE);
            payload.put("product", Build.PRODUCT);
            payload.put("androidVersion", Build.VERSION.RELEASE);
            payload.put("sdkInt", Build.VERSION.SDK_INT);
            payload.put("distributionChannel", BuildConfig.DISTRIBUTION_CHANNEL);
            PackageInfo info;
            if (Build.VERSION.SDK_INT >= 33) {
                info = getPackageManager().getPackageInfo(
                    getPackageName(),
                    PackageManager.PackageInfoFlags.of(0)
                );
            } else {
                info = getPackageManager().getPackageInfo(getPackageName(), 0);
            }
            payload.put("appVersionName", info.versionName == null ? "" : info.versionName);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                payload.put("appVersionCode", info.getLongVersionCode());
            } else {
                payload.put("appVersionCode", info.versionCode);
            }
        } catch (Exception ignored) {
        }
        return payload;
    }

    private JSONObject pendingSharePayload() throws JSONException {
        if (lastSharePayload == null) {
            JSONObject payload = new JSONObject();
            payload.put("files", new JSONArray());
            payload.put("rejected", new JSONArray());
            payload.put("limits", sharedMaterialLimitsPayload());
            return payload;
        }
        return new JSONObject(lastSharePayload.toString());
    }

    private void readSharedMaterial(String requestId, String id, String encoding) {
        try {
            JSONObject metadata = readSharedMaterialMetadata(id);
            File file = sharedMaterialFileFromMetadata(metadata);
            long size = file.length();
            if (size > MAX_SHARED_FILE_BYTES) {
                throw new IOException("shared material is too large");
            }
            JSONObject payload = safeSharedMaterialPayload(metadata);
            String normalizedEncoding = encoding == null ? "" : encoding.toLowerCase(Locale.US);
            if ("metadata".equals(normalizedEncoding) || "none".equals(normalizedEncoding)) {
                resolve(requestId, payload);
                return;
            }
            String base64 = Base64.encodeToString(readFileLimited(file, MAX_SHARED_FILE_BYTES), Base64.NO_WRAP);
            if ("base64".equals(normalizedEncoding)) {
                payload.put("base64", base64);
            } else {
                payload.put("dataUrl", "data:" + payload.optString("mimeType", "application/octet-stream") + ";base64," + base64);
            }
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, safeErrorMessage(error));
        }
    }

    private JSONObject readSharedMaterialMetadata(String id) throws IOException, JSONException {
        if (id == null || !id.matches("[0-9a-fA-F-]{36}")) {
            throw new IOException("invalid shared material id");
        }
        File dir = getSharedMaterialDir();
        File metadataFile = canonicalChild(dir, id + ".json");
        if (!metadataFile.exists()) throw new IOException("shared material not found");
        byte[] data = readFileLimited(metadataFile, 256 * 1024);
        JSONObject metadata = new JSONObject(new String(data, StandardCharsets.UTF_8));
        if (!id.equals(metadata.optString("id"))) {
            throw new IOException("shared material metadata mismatch");
        }
        return metadata;
    }

    private File sharedMaterialFileFromMetadata(JSONObject metadata) throws IOException {
        File dir = getSharedMaterialDir();
        String fileName = metadata.optString("fileName");
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new IOException("shared material file is missing");
        }
        File file = canonicalChild(dir, fileName);
        if (!file.exists() || !file.isFile()) {
            throw new IOException("shared material not found");
        }
        return file;
    }

    private File getSharedMaterialDir() throws IOException {
        File dir = new File(getCacheDir(), SHARED_MATERIAL_FOLDER);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("failed to create shared material cache");
        }
        return dir.getCanonicalFile();
    }

    private File safeSharedMaterialFile(File dir, String id, String displayName, String mimeType) throws IOException {
        String safeName = safeSharedFileName(displayName, mimeType);
        File file = canonicalChild(dir, id + "-" + safeName);
        if (file.exists()) throw new IOException("shared material already exists");
        return file;
    }

    private File canonicalChild(File dir, String fileName) throws IOException {
        File root = dir.getCanonicalFile();
        File file = new File(root, fileName).getCanonicalFile();
        String rootPath = root.getPath() + File.separator;
        if (!file.getPath().startsWith(rootPath)) {
            throw new IOException("invalid shared material path");
        }
        return file;
    }

    private long copyUriToFile(Uri uri, File target, long maxBytes) throws IOException {
        if (maxBytes <= 0) throw new IOException("shared file is too large");
        long total = 0;
        try (
            InputStream input = getContentResolver().openInputStream(uri);
            FileOutputStream output = new FileOutputStream(target)
        ) {
            if (input == null) throw new IOException("failed to open shared file");
            byte[] buffer = new byte[COPY_BUFFER_BYTES];
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > maxBytes || total > MAX_SHARED_FILE_BYTES) {
                    output.close();
                    target.delete();
                    throw new IOException("shared file is too large");
                }
                output.write(buffer, 0, read);
            }
        } catch (IOException error) {
            target.delete();
            throw error;
        }
        if (total <= 0) {
            target.delete();
            throw new IOException("shared file is empty");
        }
        return total;
    }

    private byte[] readFileLimited(File file, long maxBytes) throws IOException {
        if (file.length() > maxBytes) throw new IOException("file is too large");
        try (FileInputStream input = new FileInputStream(file)) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[COPY_BUFFER_BYTES];
            int read;
            long total = 0;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > maxBytes) throw new IOException("file is too large");
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private void writeJson(File file, JSONObject payload) throws IOException {
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(payload.toString().getBytes(StandardCharsets.UTF_8));
        }
    }

    private void cleanupSharedMaterialCache() {
        try {
            File dir = getSharedMaterialDir();
            File[] files = dir.listFiles();
            if (files == null) return;
            long cutoff = System.currentTimeMillis() - 24L * 60L * 60L * 1000L;
            for (File file : files) {
                if (file.isFile() && file.lastModified() < cutoff) {
                    file.delete();
                }
            }
        } catch (Exception ignored) {
        }
    }

    private Uri writeImageToGallery(String dataUrl, String fileName, String folder)
        throws IOException {
        byte[] data = decodeDataUrl(dataUrl);
        String safeName = ensureImageExtension(
            safeFileName(fileName),
            mimeTypeFromDataUrl(dataUrl)
        );
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
        values.put(MediaStore.Images.Media.MIME_TYPE, mimeTypeFromDataUrl(dataUrl));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(
                MediaStore.Images.Media.RELATIVE_PATH,
                Environment.DIRECTORY_PICTURES + "/" + folder
            );
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
        }
        ContentResolver resolver = getContentResolver();
        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IOException("failed to create gallery item");
        }
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) {
                throw new IOException("failed to open gallery item");
            }
            out.write(data);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.clear();
            values.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
        }
        return uri;
    }

    private File writeImageToCache(String dataUrl, String fileName) throws IOException {
        byte[] data = decodeDataUrl(dataUrl);
        String safeName = ensureImageExtension(
            safeFileName(fileName),
            mimeTypeFromDataUrl(dataUrl)
        );
        File dir = new File(getCacheDir(), "shared-images");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("failed to create share cache");
        }
        File file = uniqueImageFile(dir, safeName);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(data);
        }
        return file;
    }

    private File writeShareFileToCache(String dataUrl, String fileName) throws IOException {
        byte[] data = decodeDataUrl(dataUrl);
        File dir = new File(getCacheDir(), "shared-files");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("failed to create share cache");
        }
        File file = uniqueImageFile(dir, safeFileName(fileName));
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(data);
        }
        return file;
    }


    private File getAppImageDir() {
        File dir = new File(getFilesDir(), APP_IMAGE_FOLDER);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    private File uniqueImageFile(File dir, String fileName) {
        File file = new File(dir, fileName);
        if (!file.exists()) return file;
        int dot = fileName.lastIndexOf('.');
        String base = dot > 0 ? fileName.substring(0, dot) : fileName;
        String extension = dot > 0 ? fileName.substring(dot) : "";
        for (int index = 1; index < 10000; index += 1) {
            File candidate = new File(dir, base + "-" + index + extension);
            if (!candidate.exists()) return candidate;
        }
        return new File(dir, base + "-" + System.currentTimeMillis() + extension);
    }

    private JSONObject appImagePayload(File file, JSONObject metadata) throws JSONException {
        JSONObject payload = metadata == null ? new JSONObject() : new JSONObject(metadata.toString());
        payload.put("fileName", file.getName());
        payload.put("localUrl", LOCAL_ORIGIN + APP_IMAGE_ROUTE + Uri.encode(file.getName()));
        payload.put("mimeType", payload.optString("mimeType", mimeTypeForFile(file.getName())));
        payload.put("size", file.length());
        payload.put("updatedAt", file.lastModified());
        if (!payload.has("createdAt")) {
            payload.put("createdAt", file.lastModified());
        }
        if (!payload.has("id") || payload.optString("id").trim().isEmpty()) {
            payload.put("id", file.getName());
        }
        return payload;
    }

    private File metadataFile(File imageFile) {
        return new File(imageFile.getParentFile(), imageFile.getName() + ".json");
    }

    private void writeImageMetadata(File imageFile, JSONObject metadata) throws IOException {
        AtomicFile metadataFile = new AtomicFile(metadataFile(imageFile));
        FileOutputStream out = null;
        try {
            out = metadataFile.startWrite();
            out.write(metadata.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            metadataFile.finishWrite(out);
        } catch (IOException error) {
            if (out != null) {
                metadataFile.failWrite(out);
            }
            throw error;
        }
    }

    private JSONObject readImageMetadata(File imageFile) {
        File metadata = metadataFile(imageFile);
        if (!metadata.exists()) return new JSONObject();
        try (FileInputStream input = new FileInputStream(metadata)) {
            byte[] buffer = new byte[(int) metadata.length()];
            int read = input.read(buffer);
            if (read <= 0) return new JSONObject();
            return new JSONObject(new String(buffer, 0, read, java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private byte[] decodeDataUrl(String dataUrl) throws IOException {
        if (dataUrl == null || !dataUrl.startsWith("data:")) {
            throw new IOException("invalid image data");
        }
        int comma = dataUrl.indexOf(',');
        if (comma < 0) {
            throw new IOException("invalid image data");
        }
        return Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
    }

    private byte[] readBytes(Uri uri) throws IOException {
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) {
                throw new IOException("failed to read camera result");
            }
            byte[] buffer = new byte[8192];
            int read;
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private static String mimeTypeFromDataUrl(String dataUrl) {
        if (dataUrl != null && dataUrl.startsWith("data:")) {
            int semi = dataUrl.indexOf(';');
            if (semi > 5) {
                return dataUrl.substring(5, semi);
            }
        }
        return "image/png";
    }

    private String safeFileName(String fileName) {
        String fallback = "jisudengchat-" + System.currentTimeMillis() + ".png";
        String value = fileName == null || fileName.trim().isEmpty()
            ? fallback
            : fileName.trim();
        return value.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private String safeSharedFileName(String fileName, String mimeType) {
        String fallback = "shared-" + System.currentTimeMillis();
        String value = fileName == null || fileName.trim().isEmpty()
            ? fallback
            : fileName.trim();
        value = value.replace('\\', '/');
        int slash = value.lastIndexOf('/');
        if (slash >= 0) value = value.substring(slash + 1);
        value = value.replaceAll("[\\p{Cntrl}\\\\/:*?\"<>|]", "_")
            .replace("..", "_")
            .trim();
        while (value.startsWith(".")) value = value.substring(1);
        if (value.length() > 120) {
            int dot = value.lastIndexOf('.');
            String extension = dot > 0 && dot > value.length() - 12 ? value.substring(dot) : "";
            value = value.substring(0, Math.max(1, 120 - extension.length())) + extension;
        }
        if (value.isEmpty()) value = fallback;
        if (!value.contains(".")) {
            value += extensionForMime(mimeType);
        }
        return value;
    }

    private static boolean isImageFile(String fileName) {
        String lower = fileName.toLowerCase(Locale.US);
        return lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg") ||
            lower.endsWith(".png") ||
            lower.endsWith(".webp");
    }

    private String ensureExtension(String fileName, String extension) {
        String lower = fileName.toLowerCase(Locale.US);
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")) {
            return fileName;
        }
        return fileName + extension;
    }

    private String ensureImageExtension(String fileName, String mimeType) {
        String lower = fileName.toLowerCase(Locale.US);
        if (lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg") ||
            lower.endsWith(".png") ||
            lower.endsWith(".webp")) {
            return fileName;
        }
        if ("image/jpeg".equals(mimeType)) return fileName + ".jpg";
        if ("image/webp".equals(mimeType)) return fileName + ".webp";
        return fileName + ".png";
    }

    private static String mimeTypeForFile(String fileName) {
        String lower = fileName.toLowerCase(Locale.US);
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        return "image/png";
    }

    private String mimeTypeForName(String fileName) {
        String safe = fileName == null ? "" : fileName;
        int dot = safe.lastIndexOf('.');
        if (dot >= 0 && dot < safe.length() - 1) {
            String extension = safe.substring(dot + 1).toLowerCase(Locale.US);
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            if (mime != null && !mime.trim().isEmpty()) {
                return normalizeMimeType(mime);
            }
        }
        return "application/octet-stream";
    }

    private String normalizeMimeType(String mimeType) {
        if (mimeType == null || mimeType.trim().isEmpty()) return "application/octet-stream";
        return mimeType.trim().toLowerCase(Locale.US);
    }

    private String extensionForMime(String mimeType) {
        String normalized = normalizeMimeType(mimeType);
        if ("image/jpeg".equals(normalized)) return ".jpg";
        if ("image/png".equals(normalized)) return ".png";
        if ("image/webp".equals(normalized)) return ".webp";
        if ("application/pdf".equals(normalized)) return ".pdf";
        if (normalized.startsWith("text/")) return ".txt";
        String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(normalized);
        return extension == null || extension.trim().isEmpty() ? ".bin" : "." + extension;
    }

    private boolean isAcceptedSharedMime(String mimeType, String fileName) {
        String mime = normalizeMimeType(mimeType);
        if (mime.startsWith("image/") ||
            mime.startsWith("audio/") ||
            mime.startsWith("video/") ||
            mime.startsWith("text/")) {
            return true;
        }
        if ("application/pdf".equals(mime) ||
            "application/json".equals(mime) ||
            "application/msword".equals(mime) ||
            "application/vnd.ms-excel".equals(mime) ||
            "application/vnd.ms-powerpoint".equals(mime) ||
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(mime) ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equals(mime) ||
            "application/vnd.openxmlformats-officedocument.presentationml.presentation".equals(mime)) {
            return true;
        }
        return "application/octet-stream".equals(mime) && hasAcceptedSharedExtension(fileName);
    }

    private boolean hasAcceptedSharedExtension(String fileName) {
        String lower = fileName == null ? "" : fileName.toLowerCase(Locale.US);
        return lower.endsWith(".txt") ||
            lower.endsWith(".md") ||
            lower.endsWith(".json") ||
            lower.endsWith(".csv") ||
            lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg") ||
            lower.endsWith(".png") ||
            lower.endsWith(".webp") ||
            lower.endsWith(".gif") ||
            lower.endsWith(".mp3") ||
            lower.endsWith(".m4a") ||
            lower.endsWith(".wav") ||
            lower.endsWith(".mp4") ||
            lower.endsWith(".mov") ||
            lower.endsWith(".pdf") ||
            lower.endsWith(".doc") ||
            lower.endsWith(".docx") ||
            lower.endsWith(".xls") ||
            lower.endsWith(".xlsx") ||
            lower.endsWith(".ppt") ||
            lower.endsWith(".pptx");
    }

    private String sharedMaterialKind(String mimeType) {
        String mime = normalizeMimeType(mimeType);
        if (mime.startsWith("image/")) return "image";
        if (mime.startsWith("audio/")) return "audio";
        if (mime.startsWith("video/")) return "video";
        if (mime.startsWith("text/")) return "text";
        if ("application/pdf".equals(mime)) return "pdf";
        return "file";
    }

    private String redactSensitiveText(String text) {
        if (text == null) return "";
        return text.replaceAll(
            "(?i)(access_token|refresh_token|id_token|token|api[_-]?key|authorization|auth|code)=([^&\\s]+)",
            "$1=***"
        );
    }

    private String safeErrorMessage(Exception error) {
        String message = error == null ? "" : error.getMessage();
        if (message == null || message.trim().isEmpty()) return "native request failed";
        return redactSensitiveText(message);
    }

    private static class SharedMaterial {
        final String name;
        final String mimeType;
        final long size;

        SharedMaterial(String name, String mimeType, long size) {
            this.name = name;
            this.mimeType = mimeType;
            this.size = size;
        }
    }

    private void resolve(String requestId, JSONObject payload) {
        String js = "window.__jisudengNativeResolve && window.__jisudengNativeResolve(" +
            JSONObject.quote(requestId) +
            "," +
            payload.toString() +
            ");";
        if (webView != null) {
            webView.evaluateJavascript(js, null);
        }
    }

    private void reject(String requestId, String message) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("message", message == null ? "native request failed" : message);
        } catch (JSONException ignored) {
        }
        String js = "window.__jisudengNativeReject && window.__jisudengNativeReject(" +
            JSONObject.quote(requestId) +
            "," +
            payload.toString() +
            ");";
        if (webView != null) {
            webView.evaluateJavascript(js, null);
        }
    }

    private static class PendingPermission {
        final String requestId;
        final String permission;

        PendingPermission(String requestId, String permission) {
            this.requestId = requestId;
            this.permission = permission;
        }
    }

    private class AppWebChromeClient extends WebChromeClient {
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            if (request == null || !isTrustedLocalMediaRequest(request)) {
                if (request != null) request.deny();
                return;
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                request.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
                return;
            }
            if (pendingWebMicrophoneRequest != null) {
                pendingWebMicrophoneRequest.deny();
            }
            pendingWebMicrophoneRequest = request;
            pendingWebMicrophoneRequestCode = nextPermissionRequestCode++;
            requestPermissions(
                new String[] { Manifest.permission.RECORD_AUDIO },
                pendingWebMicrophoneRequestCode
            );
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest request) {
            if (request != null && request == pendingWebMicrophoneRequest) {
                pendingWebMicrophoneRequest = null;
                pendingWebMicrophoneRequestCode = -1;
            }
            super.onPermissionRequestCanceled(request);
        }

        @Override
        public boolean onShowFileChooser(
            WebView webView,
            ValueCallback<Uri[]> filePathCallback,
            FileChooserParams fileChooserParams
        ) {
            if (MainActivity.this.filePathCallback != null) {
                MainActivity.this.filePathCallback.onReceiveValue(null);
            }
            MainActivity.this.filePathCallback = filePathCallback;

            Intent intent = fileChooserParams.createIntent();
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
            } catch (ActivityNotFoundException error) {
                MainActivity.this.filePathCallback = null;
                return false;
            }
            return true;
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
            if (
                consoleMessage != null &&
                consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR &&
                crashlyticsConsoleLogCount < 20
            ) {
                crashlyticsConsoleLogCount += 1;
                FirebaseCrashlytics.getInstance().log(
                    "WebView console error at " +
                    clippedCrashValue(consoleMessage.sourceId(), 160) +
                    ":" +
                    consoleMessage.lineNumber() +
                    " " +
                    clippedCrashValue(consoleMessage.message(), 500)
                );
            }
            return super.onConsoleMessage(consoleMessage);
        }
    }

    private boolean isTrustedLocalMediaRequest(PermissionRequest request) {
        Uri origin = request.getOrigin();
        if (origin == null || !"https".equalsIgnoreCase(origin.getScheme()) ||
            !"localhost".equalsIgnoreCase(origin.getHost())) {
            return false;
        }
        int port = origin.getPort();
        if (port != -1 && port != 443) return false;
        String[] resources = request.getResources();
        return resources != null && resources.length == 1 &&
            PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resources[0]);
    }

    private class LocalAssetWebViewClient extends WebViewClient {
        private final AssetManager assets;
        private final File appImageDir;

        LocalAssetWebViewClient(AssetManager assets, File appImageDir) {
            this.assets = assets;
            this.appImageDir = appImageDir;
        }

        @Override
        public void onPageCommitVisible(WebView view, String url) {
            super.onPageCommitVisible(view, url);
            if (url == null || !url.startsWith(LOCAL_ORIGIN)) return;
            markWebViewFirstVisible();
            startPostFirstPaintServices();
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (initialIntentsDispatched || url == null || !url.startsWith(LOCAL_ORIGIN)) {
                return;
            }
            // Older WebView implementations can miss onPageCommitVisible. This
            // fallback records visibility without making page completion the
            // normal startup timing boundary.
            markWebViewFirstVisible();
            startPostFirstPaintServices();
            initialIntentsDispatched = true;
            dispatchIncomingDeepLink(getIntent());
            dispatchPaymentReturn(getIntent());
            dispatchIncomingShare(getIntent());
            dispatchPushOpen(getIntent());
        }

        @Override
        public boolean shouldOverrideUrlLoading(
            WebView view,
            WebResourceRequest request
        ) {
            if (!request.isForMainFrame()) return false;
            return handleTopLevelNavigation(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleTopLevelNavigation(Uri.parse(url));
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            Uri uri = Uri.parse(url);
            if (!isTrustedLocalUri(uri)) {
                view.stopLoading();
                openExternalUri(uri);
                return;
            }
            super.onPageStarted(view, url, favicon);
        }

        private boolean handleTopLevelNavigation(Uri uri) {
            if (isTrustedLocalUri(uri)) return false;
            openExternalUri(uri);
            return true;
        }

        private boolean isTrustedLocalUri(Uri uri) {
            return TrustedNavigationPolicy.isTrustedLocalUrl(uri.toString());
        }

        private void openExternalUri(Uri uri) {
            String scheme = uri.getScheme() == null ? "" : uri.getScheme();
            if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
                return;
            }
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                startActivity(intent);
            } catch (ActivityNotFoundException ignored) {
            }
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(
            WebView view,
            WebResourceRequest request
        ) {
            return assetResponse(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
            return assetResponse(Uri.parse(url));
        }

        private WebResourceResponse assetResponse(Uri uri) {
            if (!isTrustedLocalUri(uri)) {
                return null;
            }

            String rawPath = uri.getPath() == null ? "" : uri.getPath();
            if (rawPath.startsWith(APP_IMAGE_ROUTE)) {
                return appImageResponse(rawPath.substring(APP_IMAGE_ROUTE.length()));
            }

            String assetPath = normalizeAssetPath(uri.getPath());
            try {
                InputStream input = assets.open(assetPath);
                return new WebResourceResponse(
                    mimeType(assetPath),
                    "UTF-8",
                    input
                );
            } catch (IOException error) {
                return null;
            }
        }

        private WebResourceResponse appImageResponse(String encodedFileName) {
            try {
                String fileName = Uri.decode(encodedFileName);
                File file = new File(appImageDir, fileName);
                String root = appImageDir.getCanonicalPath() + File.separator;
                if (!file.getCanonicalPath().startsWith(root) ||
                    !file.exists() ||
                    !file.isFile() ||
                    !isImageFile(file.getName())) {
                    return null;
                }
                return new WebResourceResponse(
                    mimeTypeForFile(file.getName()),
                    null,
                    new FileInputStream(file)
                );
            } catch (IOException error) {
                return null;
            }
        }

        private static String normalizeAssetPath(String rawPath) {
            String path = rawPath == null || rawPath.equals("/") ? "/index.html" : rawPath;
            path = path.replace('\\', '/');
            while (path.startsWith("/")) {
                path = path.substring(1);
            }
            if (path.contains("..")) {
                return "public/404.html";
            }
            return "public/" + path;
        }

        private static String mimeType(String assetPath) {
            String lower = assetPath.toLowerCase(Locale.US);
            if (lower.endsWith(".html")) return "text/html";
            if (lower.endsWith(".js")) return "application/javascript";
            if (lower.endsWith(".mjs")) return "application/javascript";
            if (lower.endsWith(".css")) return "text/css";
            if (lower.endsWith(".json")) return "application/json";
            if (lower.endsWith(".svg")) return "image/svg+xml";
            if (lower.endsWith(".wasm")) return "application/wasm";
            if (lower.endsWith(".woff")) return "font/woff";
            if (lower.endsWith(".woff2")) return "font/woff2";
            if (lower.endsWith(".ttf")) return "font/ttf";

            int dot = assetPath.lastIndexOf('.');
            if (dot >= 0 && dot < assetPath.length() - 1) {
                String extension = assetPath.substring(dot + 1);
                String guessed = MimeTypeMap.getSingleton()
                    .getMimeTypeFromExtension(extension);
                if (guessed != null) return guessed;
            }
            return "application/octet-stream";
        }
    }
}
