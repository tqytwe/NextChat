package com.jisudeng.chat;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "NextChatNative",
    permissions = {
        @Permission(alias = "legacyStorage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }),
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class NextChatNativePlugin extends Plugin {
    private static final String CHANNEL_ID = "jisudengchat_status";
    private static final String APP_IMAGE_FOLDER = "generated-images";
    private File pendingCameraFile;

    @PluginMethod
    public void requestGalleryPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            resolvePermission(call, true, "granted");
            return;
        }
        if (getPermissionState("legacyStorage") == PermissionState.GRANTED) {
            resolvePermission(call, true, "granted");
            return;
        }
        requestPermissionForAlias("legacyStorage", call, "legacyStorageCallback");
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33) {
            resolvePermission(call, true, "granted");
            return;
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            resolvePermission(call, true, "granted");
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationCallback");
    }

    @PluginMethod
    public void requestCameraPermission(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            resolvePermission(call, true, "granted");
            return;
        }
        requestPermissionForAlias("camera", call, "cameraPermissionCallback");
    }

    @PluginMethod
    public void requestMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            resolvePermission(call, true, "granted");
            return;
        }
        requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
    }

    @PermissionCallback
    private void legacyStorageCallback(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ||
            getPermissionState("legacyStorage") == PermissionState.GRANTED;
        resolvePermission(
            call,
            granted,
            granted ? "granted" : canAskAgain(Manifest.permission.WRITE_EXTERNAL_STORAGE) ? "denied" : "blocked",
            granted || canAskAgain(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        );
    }

    @PermissionCallback
    private void notificationCallback(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT < 33 ||
            getPermissionState("notifications") == PermissionState.GRANTED;
        resolvePermission(
            call,
            granted,
            granted ? "granted" : canAskAgain(Manifest.permission.POST_NOTIFICATIONS) ? "denied" : "blocked",
            granted || canAskAgain(Manifest.permission.POST_NOTIFICATIONS)
        );
    }

    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        boolean granted = getPermissionState("camera") == PermissionState.GRANTED;
        resolvePermission(
            call,
            granted,
            granted ? "granted" : canAskAgain(Manifest.permission.CAMERA) ? "denied" : "blocked",
            granted || canAskAgain(Manifest.permission.CAMERA)
        );
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        boolean granted = getPermissionState("microphone") == PermissionState.GRANTED;
        resolvePermission(
            call,
            granted,
            granted ? "granted" : canAskAgain(Manifest.permission.RECORD_AUDIO) ? "denied" : "blocked",
            granted || canAskAgain(Manifest.permission.RECORD_AUDIO)
        );
    }

    @PermissionCallback
    private void captureImagePermissionCallback(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("camera permission denied");
            return;
        }
        captureImage(call);
    }

    @PermissionCallback
    private void recognizeSpeechPermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("microphone permission denied");
            return;
        }
        recognizeSpeech(call);
    }

    @PluginMethod
    public void captureImage(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "captureImagePermissionCallback");
            return;
        }
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("camera is not available");
            return;
        }
        try {
            String fileName = safeFileName(call.getString("fileName", "jisudengchat-camera.jpg"));
            if (!fileName.toLowerCase(Locale.ROOT).endsWith(".jpg") &&
                !fileName.toLowerCase(Locale.ROOT).endsWith(".jpeg")) {
                fileName = fileName + ".jpg";
            }
            File dir = new File(getContext().getCacheDir(), "camera");
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("failed to create camera cache");
                return;
            }
            pendingCameraFile = new File(dir, fileName);
            Uri outputUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                pendingCameraFile
            );
            intent.putExtra(MediaStore.EXTRA_OUTPUT, outputUri);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, intent, "captureImageResult");
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @ActivityCallback
    private void captureImageResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("camera cancelled");
            return;
        }
        if (pendingCameraFile == null || !pendingCameraFile.exists()) {
            call.reject("camera result missing");
            return;
        }
        try {
            byte[] data = readFileBytes(pendingCameraFile);
            String dataUrl = "data:image/jpeg;base64," + Base64.encodeToString(data, Base64.NO_WRAP);
            JSObject ret = new JSObject();
            ret.put("dataUrl", dataUrl);
            ret.put("uri", pendingCameraFile.toURI().toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void recognizeSpeech(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "recognizeSpeechPermissionCallback");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("speech recognition is not available");
            return;
        }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(
            RecognizerIntent.EXTRA_LANGUAGE,
            call.getString("language", Locale.getDefault().toLanguageTag())
        );
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, call.getString("prompt", "JisudengChat"));
        startActivityForResult(call, intent, "recognizeSpeechResult");
    }

    @ActivityCallback
    private void recognizeSpeechResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("speech recognition cancelled");
            return;
        }
        ArrayList<String> matches = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        JSObject ret = new JSObject();
        if (matches != null && !matches.isEmpty()) {
            ret.put("text", matches.get(0));
            ret.put("matches", matches);
        } else {
            ret.put("text", "");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        String dataUrl = call.getString("dataUrl", "");
        String fileName = safeFileName(call.getString("fileName", "jisudengchat-image.png"));
        try {
            byte[] data = decodeDataUrl(dataUrl);
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Images.Media.MIME_TYPE, mimeTypeFromDataUrl(dataUrl));
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/JisudengChat");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }
            Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                call.reject("failed to create gallery item");
                return;
            }
            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) {
                    call.reject("failed to open gallery item");
                    return;
                }
                out.write(data);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            }
            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            ret.put("fileName", fileName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void saveImageToAppStorage(PluginCall call) {
        String dataUrl = call.getString("dataUrl", "");
        String fileName = safeFileName(call.getString("fileName", "jisudengchat-image.png"));
        String prompt = call.getString("prompt", "");
        String model = call.getString("model", "");
        String taskId = call.getString("taskId", "");
        try {
            byte[] data = decodeDataUrl(dataUrl);
            String mimeType = mimeTypeFromDataUrl(dataUrl);
            File dir = getAppImageDir();
            File file = uniqueImageFile(dir, ensureImageExtension(fileName, mimeType));
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
            call.resolve(appImagePayload(file, metadata));
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void listAppImages(PluginCall call) {
        try {
            JSONArray items = new JSONArray();
            File[] files = getAppImageDir().listFiles();
            if (files != null) {
                ArrayList<File> images = new ArrayList<>();
                for (File file : files) {
                    if (file.isFile() && isImageFile(file.getName())) {
                        images.add(file);
                    }
                }
                Collections.sort(images, (left, right) -> Long.compare(right.lastModified(), left.lastModified()));
                for (File file : images) {
                    items.put(appImagePayload(file, readImageMetadata(file)));
                }
            }
            JSObject ret = new JSObject();
            ret.put("items", items);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void deleteAppImages(PluginCall call) {
        int deleted = 0;
        try {
            JSONArray fileNames = call.getArray("fileNames");
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
            JSObject ret = new JSObject();
            ret.put("deleted", deleted);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void shareImage(PluginCall call) {
        String dataUrl = call.getString("dataUrl", "");
        String fileName = safeFileName(call.getString("fileName", "jisudengchat-image.png"));
        String title = call.getString("title", "JisudengChat");
        String text = call.getString("text", "");
        try {
            byte[] data = decodeDataUrl(dataUrl);
            File file = new File(getContext().getCacheDir(), fileName);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(data);
            }
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mimeTypeFromDataUrl(dataUrl));
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.putExtra(Intent.EXTRA_TEXT, text);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(intent, title));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        String title = call.getString("title", "JisudengChat");
        String text = call.getString("text", "");
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT, text);
        getActivity().startActivity(Intent.createChooser(intent, title));
        call.resolve();
    }

    @PluginMethod
    public void showNotification(PluginCall call) {
        String title = call.getString("title", "JisudengChat");
        String body = call.getString("body", "");
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            call.reject("notification permission denied");
            return;
        }
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "JisudengChat", NotificationManager.IMPORTANCE_DEFAULT);
            manager.createNotificationChannel(channel);
        }
        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(getContext().getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        manager.notify((int) System.currentTimeMillis(), builder.build());
        call.resolve();
    }

    @PluginMethod
    public void downloadFile(PluginCall call) {
        String url = call.getString("url", "");
        String fileName = safeFileName(call.getString("fileName", "jisudengchat-android.apk"));
        String title = call.getString("title", "JisudengChat");
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle(title);
            request.setDescription(fileName);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            long id = manager.enqueue(request);
            JSObject ret = new JSObject();
            ret.put("id", String.valueOf(id));
            ret.put("status", "running");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getDownloadStatus(PluginCall call) {
        String rawId = call.getString("id", "");
        JSObject ret = new JSObject();
        ret.put("id", rawId);
        try {
            long id = Long.parseLong(rawId);
            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
            try (Cursor cursor = manager.query(query)) {
                if (cursor == null || !cursor.moveToFirst()) {
                    ret.put("status", "unknown");
                    call.resolve(ret);
                    return;
                }
                int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                ret.put("bytesDownloaded", downloaded);
                ret.put("totalBytes", total);
                ret.put("progress", total > 0 ? Math.min(100, Math.round(downloaded * 100f / total)) : 0);
                ret.put("status", downloadStatus(status));
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    String uri = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));
                    ret.put("localUri", uri);
                }
                if (status == DownloadManager.STATUS_FAILED) {
                    int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                    ret.put("reason", String.valueOf(reason));
                }
            }
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("status", "unknown");
            ret.put("reason", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url", "");
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", getContext().getPackageName(), null)
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            ret.put("platform", "android");
            ret.put("manufacturer", Build.MANUFACTURER);
            ret.put("brand", Build.BRAND);
            ret.put("model", Build.MODEL);
            ret.put("device", Build.DEVICE);
            ret.put("product", Build.PRODUCT);
            ret.put("androidVersion", Build.VERSION.RELEASE);
            ret.put("sdkInt", Build.VERSION.SDK_INT);
            PackageInfo info;
            if (Build.VERSION.SDK_INT >= 33) {
                info = getContext().getPackageManager().getPackageInfo(
                    getContext().getPackageName(),
                    PackageManager.PackageInfoFlags.of(0)
                );
            } else {
                info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            }
            ret.put("appVersionName", info.versionName == null ? "" : info.versionName);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ret.put("appVersionCode", info.getLongVersionCode());
            } else {
                ret.put("appVersionCode", info.versionCode);
            }
        } catch (Exception ignored) {
        }
        call.resolve(ret);
    }

    private void resolvePermission(PluginCall call, boolean granted, String status) {
        resolvePermission(call, granted, status, granted);
    }

    private void resolvePermission(PluginCall call, boolean granted, String status, boolean canAskAgain) {
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("status", status);
        ret.put("canAskAgain", canAskAgain);
        call.resolve(ret);
    }

    private boolean canAskAgain(String permission) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), permission);
    }

    private byte[] readFileBytes(File file) throws IOException {
        try (FileInputStream in = new FileInputStream(file);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }

    private byte[] decodeDataUrl(String dataUrl) {
        int comma = dataUrl.indexOf(',');
        String payload = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
        return Base64.decode(payload, Base64.DEFAULT);
    }

    private File getAppImageDir() {
        File dir = new File(getContext().getFilesDir(), APP_IMAGE_FOLDER);
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

    private JSObject appImagePayload(File file, JSONObject metadata) throws Exception {
        JSObject payload = new JSObject();
        payload.put("id", metadata.optString("id", file.getName()));
        payload.put("fileName", file.getName());
        payload.put("localUrl", encodeDataUrl(file, metadata.optString("mimeType", mimeTypeForFile(file.getName()))));
        payload.put("mimeType", metadata.optString("mimeType", mimeTypeForFile(file.getName())));
        payload.put("prompt", metadata.optString("prompt", ""));
        payload.put("model", metadata.optString("model", ""));
        payload.put("createdAt", metadata.optLong("createdAt", file.lastModified()));
        payload.put("updatedAt", file.lastModified());
        payload.put("size", file.length());
        return payload;
    }

    private File metadataFile(File imageFile) {
        return new File(imageFile.getParentFile(), imageFile.getName() + ".json");
    }

    private void writeImageMetadata(File imageFile, JSONObject metadata) throws IOException {
        try (FileOutputStream out = new FileOutputStream(metadataFile(imageFile))) {
            out.write(metadata.toString().getBytes(StandardCharsets.UTF_8));
        }
    }

    private JSONObject readImageMetadata(File imageFile) {
        File metadata = metadataFile(imageFile);
        if (!metadata.exists()) return new JSONObject();
        try (FileInputStream input = new FileInputStream(metadata)) {
            byte[] data = readFileBytes(metadata);
            return new JSONObject(new String(data, StandardCharsets.UTF_8));
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private String encodeDataUrl(File file, String mimeType) throws IOException {
        return "data:" + mimeType + ";base64," + Base64.encodeToString(readFileBytes(file), Base64.NO_WRAP);
    }

    private String mimeTypeFromDataUrl(String dataUrl) {
        if (dataUrl != null && dataUrl.startsWith("data:")) {
            int semicolon = dataUrl.indexOf(';');
            if (semicolon > 5) {
                return dataUrl.substring(5, semicolon).toLowerCase(Locale.ROOT);
            }
        }
        return "image/png";
    }

    private String ensureImageExtension(String fileName, String mimeType) {
        String lower = fileName.toLowerCase(Locale.ROOT);
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

    private boolean isImageFile(String fileName) {
        String lower = fileName.toLowerCase(Locale.ROOT);
        return lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg") ||
            lower.endsWith(".png") ||
            lower.endsWith(".webp");
    }

    private String mimeTypeForFile(String fileName) {
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        return "image/png";
    }

    private String safeFileName(String fileName) {
        String cleaned = fileName == null ? "" : fileName.replaceAll("[^a-zA-Z0-9._-]", "-");
        if (cleaned.trim().isEmpty()) return "jisudengchat-file";
        return cleaned;
    }

    private String downloadStatus(int status) {
        switch (status) {
            case DownloadManager.STATUS_PENDING:
                return "pending";
            case DownloadManager.STATUS_RUNNING:
            case DownloadManager.STATUS_PAUSED:
                return "running";
            case DownloadManager.STATUS_SUCCESSFUL:
                return "success";
            case DownloadManager.STATUS_FAILED:
                return "failed";
            default:
                return "unknown";
        }
    }
}
