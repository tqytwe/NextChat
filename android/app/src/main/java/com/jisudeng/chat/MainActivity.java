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
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.OpenableColumns;
import android.provider.MediaStore;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Base64;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int PERMISSION_REQUEST_BASE = 5200;
    private static final int CAMERA_REQUEST = 6200;
    private static final int SPEECH_REQUEST = 6201;
    private static final String CHANNEL_ID = "jisudengchat_status";
    private static final String LOCAL_ORIGIN = "https://localhost";
    private static final String APP_IMAGE_ROUTE = "/__jisudeng_app_images/";
    private static final String APP_IMAGE_FOLDER = "generated-images";
    private static final String SHARED_MATERIAL_FOLDER = "shared-materials";
    private static final long MAX_SHARED_FILE_BYTES = 25L * 1024L * 1024L;
    private static final long MAX_SHARED_TOTAL_BYTES = 50L * 1024L * 1024L;
    private static final int MAX_SHARED_FILE_COUNT = 8;
    private static final int COPY_BUFFER_BYTES = 32 * 1024;
    private ValueCallback<Uri[]> filePathCallback;
    private WebView webView;
    private int nextPermissionRequestCode = PERMISSION_REQUEST_BASE;
    private final Map<Integer, PendingPermission> pendingPermissions = new HashMap<>();
    private String pendingCameraRequestId;
    private Uri pendingCameraUri;
    private ContentValues pendingCameraValues;
    private String pendingSpeechRequestId;
    private SpeechRecognizer holdSpeechRecognizer;
    private String holdSpeechRequestId;
    private ArrayList<String> holdSpeechMatches = new ArrayList<>();
    private final Map<String, HttpURLConnection> streamConnections = new ConcurrentHashMap<>();
    private final Map<String, Boolean> cancelledStreamRequests = new ConcurrentHashMap<>();
    private JSONObject lastSharePayload;
    private boolean hasResumedOnce = false;
    private boolean initialIntentsDispatched = false;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(245, 245, 247));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        WebView.setWebContentsDebuggingEnabled(true);
        webView.setWebViewClient(new LocalAssetWebViewClient(getAssets(), getAppImageDir()));
        webView.setWebChromeClient(new AppWebChromeClient());
        webView.addJavascriptInterface(new NativeBridge(), "JisudengNativeBridge");

        setContentView(webView);
        webView.loadUrl(LOCAL_ORIGIN + "/");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchIncomingShare(intent);
        dispatchPaymentReturn(intent);
        dispatchIncomingDeepLink(intent);
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

    private void dispatchPaymentReturn(Intent intent) {
        if (intent == null || webView == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return;
        String host = uri.getHost() == null ? "" : uri.getHost();
        if (!("jisudeng.com".equalsIgnoreCase(host) || "www.jisudeng.com".equalsIgnoreCase(host))) return;
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
        if (!("jisudeng.com".equalsIgnoreCase(host) || "www.jisudeng.com".equalsIgnoreCase(host))) return;
        String path = uri.getPath() == null ? "" : uri.getPath();
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

    @Override
    public void onBackPressed() {
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
        destroyHoldSpeechRecognizer();
        for (HttpURLConnection connection : streamConnections.values()) {
            try {
                connection.disconnect();
            } catch (Exception ignored) {
            }
        }
        streamConnections.clear();
        super.onDestroy();
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
                        options.optString("taskId", "")
                    );
                    break;
                case "listAppImages":
                    listAppImages(requestId);
                    break;
                case "deleteAppImages":
                    deleteAppImages(requestId, options.optJSONArray("fileNames"));
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
                case "shareText":
                    shareText(
                        requestId,
                        options.optString("title", "JisudengChat"),
                        options.optString("text", "")
                    );
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
                        options.optString("title", "JisudengChat")
                    );
                    break;
                case "getDownloadStatus":
                    getDownloadStatus(requestId, options.optString("id"));
                    break;
                case "installApk":
                    installApk(
                        requestId,
                        options.optString("id"),
                        options.optString("uri")
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
        destroyHoldSpeechRecognizer();
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
        String pending = holdSpeechRequestId;
        destroyHoldSpeechRecognizer();
        if (pending != null) {
            resolve(pending, speechPayload(new ArrayList<>(), true));
        }
        resolve(requestId, new JSONObject());
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
        String taskId
    ) {
        try {
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
            metadata.put("mimeType", mimeType);
            metadata.put("createdAt", System.currentTimeMillis());
            metadata.put("size", file.length());
            writeImageMetadata(file, metadata);
            resolve(requestId, appImagePayload(file, metadata));
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void listAppImages(String requestId) {
        JSONObject payload = new JSONObject();
        JSONArray items = new JSONArray();
        try {
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
                    items.put(appImagePayload(file, readImageMetadata(file)));
                }
            }
            payload.put("items", items);
            resolve(requestId, payload);
        } catch (Exception error) {
            reject(requestId, error.getMessage());
        }
    }

    private void deleteAppImages(String requestId, JSONArray fileNames) {
        JSONObject payload = new JSONObject();
        int deleted = 0;
        try {
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

    private void downloadFile(String requestId, String url, String fileName, String title) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
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

    private void installApk(String requestId, String rawId, String rawUri) {
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

    private void streamRequest(String requestId, JSONObject options) {
        String url = options.optString("url");
        String method = options.optString("method", "POST");
        String body = options.optString("body", "");
        JSONObject headers = options.optJSONObject("headers");
        cancelledStreamRequests.remove(requestId);
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
                if (body != null && !body.isEmpty()) {
                    connection.setDoOutput(true);
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    connection.setFixedLengthStreamingMode(bytes.length);
                    try (OutputStream out = connection.getOutputStream()) {
                        out.write(bytes);
                    }
                }

                int status = connection.getResponseCode();
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
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (status >= 200 && status < 300) {
                            streamData(requestId, line);
                        } else if (errorBody.length() < 4096) {
                            errorBody.append(line).append('\n');
                        }
                    }
                }
                if (status >= 200 && status < 300) {
                    streamDone(requestId);
                } else {
                    streamError(requestId, errorBody.toString().trim(), status);
                }
            } catch (Exception error) {
                if (!cancelledStreamRequests.containsKey(requestId)) {
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
        JSONObject payload = new JSONObject();
        try {
            payload.put("line", line == null ? "" : line);
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
        try (FileOutputStream out = new FileOutputStream(metadataFile(imageFile))) {
            out.write(metadata.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
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
            return super.onConsoleMessage(consoleMessage);
        }
    }

    private class LocalAssetWebViewClient extends WebViewClient {
        private final AssetManager assets;
        private final File appImageDir;

        LocalAssetWebViewClient(AssetManager assets, File appImageDir) {
            this.assets = assets;
            this.appImageDir = appImageDir;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (initialIntentsDispatched || url == null || !url.startsWith(LOCAL_ORIGIN)) {
                return;
            }
            initialIntentsDispatched = true;
            dispatchIncomingDeepLink(getIntent());
            dispatchPaymentReturn(getIntent());
            dispatchIncomingShare(getIntent());
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
            if (!"https".equals(uri.getScheme()) || !"localhost".equals(uri.getHost())) {
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
