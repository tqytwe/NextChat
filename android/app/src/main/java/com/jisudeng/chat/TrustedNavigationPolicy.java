package com.jisudeng.chat;

import java.net.URI;

final class TrustedNavigationPolicy {
    private TrustedNavigationPolicy() {}

    static boolean isTrustedLocalUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.trim().isEmpty()) return false;
        try {
            URI uri = new URI(rawUrl);
            return "https".equalsIgnoreCase(uri.getScheme()) &&
                "localhost".equalsIgnoreCase(uri.getHost()) &&
                uri.getUserInfo() == null &&
                uri.getPort() == -1;
        } catch (Exception ignored) {
            return false;
        }
    }
}
