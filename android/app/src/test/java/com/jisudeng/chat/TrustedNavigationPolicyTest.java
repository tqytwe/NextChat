package com.jisudeng.chat;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class TrustedNavigationPolicyTest {
    @Test
    public void acceptsOnlyTheBundledHttpsOrigin() {
        assertTrue(TrustedNavigationPolicy.isTrustedLocalUrl("https://localhost/"));
        assertTrue(
            TrustedNavigationPolicy.isTrustedLocalUrl(
                "https://localhost/chat?nativeBridgeToken=random"
            )
        );
        assertFalse(TrustedNavigationPolicy.isTrustedLocalUrl("http://localhost/"));
        assertFalse(TrustedNavigationPolicy.isTrustedLocalUrl("https://localhost.evil.test/"));
        assertFalse(TrustedNavigationPolicy.isTrustedLocalUrl("https://localhost@evil.test/"));
        assertFalse(TrustedNavigationPolicy.isTrustedLocalUrl("https://localhost:444/"));
        assertFalse(TrustedNavigationPolicy.isTrustedLocalUrl("javascript:alert(1)"));
    }
}
