import { describe, expect, test } from "@jest/globals";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Android Play/direct distribution split", () => {
  test("build scripts keep direct APK packaging separate from Play AAB bundling", () => {
    const pkg = JSON.parse(read("package.json"));

    expect(pkg.scripts["android:build"]).toContain("assembleDirectRelease");
    expect(pkg.scripts["android:build"]).toContain("android:export:direct");
    expect(pkg.scripts["android:export:direct"]).toContain(
      "NEXT_PUBLIC_ANDROID_DISTRIBUTION=direct",
    );
    expect(pkg.scripts["android:export:direct"]).toContain(
      "NEXT_PUBLIC_ANDROID_DIRECT_REDEEM_SHOP_URL=https://pay.ldxp.cn/shop/4B4R3T44",
    );
    expect(pkg.scripts["android:bundle:play"]).toContain("bundlePlayRelease");
    expect(pkg.scripts["android:bundle:play"]).toContain("android:export:play");
    expect(pkg.scripts["android:export:play"]).toContain(
      "NEXT_PUBLIC_ANDROID_DISTRIBUTION=play",
    );
    expect(pkg.scripts["android:build"]).toContain("npx cap sync android");
    expect(pkg.scripts["android:export:play"]).toContain(
      "scripts/check-android-play-assets.mjs",
    );
    expect(pkg.scripts["android:package:play"]).toContain(
      "scripts/package-android-play-release.mjs",
    );
    expect(pkg.scripts["android:release:play"]).toContain(
      "android:bundle:play",
    );
    expect(pkg.scripts["android:release:play"]).toContain(
      "android:package:play",
    );
    expect(pkg.scripts["android:build"]).not.toContain("assembleRelease");
  });

  test("Gradle declares Play and direct flavors with the same application id", () => {
    const build = read("android/app/build.gradle");

    expect(build).toContain('flavorDimensions "distribution"');
    expect(build).toContain("productFlavors");
    expect(build).toContain("play {");
    expect(build).toContain("direct {");
    expect(build).toContain(
      'manifestPlaceholders = [distributionChannel: "play"]',
    );
    expect(build).toContain(
      'manifestPlaceholders = [distributionChannel: "direct"]',
    );
    expect(build).toContain(
      'buildConfigField "String", "DISTRIBUTION_CHANNEL", "\\"play\\""',
    );
    expect(build).toContain(
      'buildConfigField "String", "DISTRIBUTION_CHANNEL", "\\"direct\\""',
    );
    expect(build).toContain('def androidApplicationId = "com.jisudeng.chat"');
    expect(build).toContain("applicationId androidApplicationId");
  });

  test("Play manifest removes APK self-install permission while direct keeps it", () => {
    const mainManifest = read("android/app/src/main/AndroidManifest.xml");
    const playManifestPath = "android/app/src/play/AndroidManifest.xml";

    expect(mainManifest).toContain(
      "android.permission.REQUEST_INSTALL_PACKAGES",
    );
    expect(existsSync(resolve(process.cwd(), playManifestPath))).toBe(true);
    expect(read(playManifestPath)).toContain(
      'android:name="android.permission.REQUEST_INSTALL_PACKAGES"',
    );
    expect(read(playManifestPath)).toContain('tools:node="remove"');
  });

  test("native bridge exposes distribution channel and Play UI does not self-update", () => {
    const app = read("app/components/mobile-app.tsx");
    const nativeTs = read("app/client/android-native.ts");
    const plugin = read(
      "android/app/src/main/java/com/jisudeng/chat/NextChatNativePlugin.java",
    );
    const activity = read(
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    );

    expect(nativeTs).toContain("distributionChannel?: string");
    expect(plugin).toContain(
      'ret.put("distributionChannel", BuildConfig.DISTRIBUTION_CHANNEL)',
    );
    expect(activity).toContain(
      'payload.put("distributionChannel", BuildConfig.DISTRIBUTION_CHANNEL)',
    );
    expect(app).toContain("function isPlayDistribution");
    expect(app).toContain("if (playDistribution)");
    expect(app).toContain("!playDistribution && (");
    expect(app).toContain("playDistribution || !visible");
    expect(app).toContain("!playDistribution &&");
  });

  test("video creation stays confined to the direct build", () => {
    const app = read("app/components/mobile-app.tsx");

    expect(app).toContain('mode === "video" ? <AndroidVideoStudio />');
    expect(app).toContain("!playDistribution && (");
    expect(app).toContain("if (playDistribution && mode === \"video\") setMode(\"image\")");
  });

  test("Android release manifest and WebView are hardened for Play", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    const networkSecurityConfig = read(
      "android/app/src/main/res/xml/network_security_config.xml",
    );
    const activity = read(
      "android/app/src/main/java/com/jisudeng/chat/MainActivity.java",
    );

    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).toContain(
      'android:networkSecurityConfig="@xml/network_security_config"',
    );
    expect(networkSecurityConfig).toContain(
      'cleartextTrafficPermitted="false"',
    );
    expect(activity).toContain("settings.setAllowFileAccess(false)");
    expect(activity).toContain("settings.setAllowContentAccess(false)");
    expect(activity).toContain(
      "settings.setAllowFileAccessFromFileURLs(false)",
    );
    expect(activity).toContain(
      "settings.setAllowUniversalAccessFromFileURLs(false)",
    );
    expect(activity).toContain(
      "settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW)",
    );
    expect(activity).toContain(
      "WebView.setWebContentsDebuggingEnabled(debuggable)",
    );
  });

  test("Play launch targets the 2026 Google Play API level window", () => {
    const variables = read("android/variables.gradle");

    expect(variables).toContain("compileSdkVersion = 36");
    expect(variables).toContain("targetSdkVersion = 36");
    expect(variables).toContain("minSdkVersion = 23");
  });

  test("Play AAB packaging emits channel and version-coded handoff names", () => {
    const packager = read("scripts/package-android-play-release.mjs");
    const docs = read("docs/android-release.md");

    expect(packager).toContain(
      "app-play-release-${versionName}-${versionCode}.aab",
    );
    expect(packager).toContain("dist/android/play");
    expect(packager).toContain('channel: "play"');
    expect(packager).toContain('artifactType: "aab"');
    expect(packager).toContain("verifyAabSigningCertificate");
    expect(packager).toContain("signingCertificateSha256");
    expect(packager).toContain("sourceCommit");
    expect(packager).toContain("builtFromCommit");
    expect(docs).toContain("app-play-release-<versionName>-<versionCode>.aab");
    expect(docs).toContain(
      "app-direct-release-<versionName>-<versionCode>.apk",
    );
  });

  test("Play commerce uses Play Billing while hiding external purchase surfaces", () => {
    const app = read("app/components/mobile-app.tsx");
    const i18n = read("app/client/managed-mobile-i18n.ts");
    const buildConfig = read("app/config/build.ts");
    const playAssetCheck = read("scripts/check-android-play-assets.mjs");

    expect(app).toContain('data-distribution-commerce="play-billing"');
    expect(app).toContain("queryPlayBillingProducts");
    expect(app).toContain("launchPlayBillingPurchase");
    expect(app).toContain("client.playBilling.submitPurchase");
    expect(app).toContain('productType: "inapp",');
    expect(app).not.toContain(
      'productType: fallbackOrderType === "subscription" ? "subs" : "inapp"',
    );
    expect(app).toContain(
      'data-distribution-commerce="direct-external-code-shop"',
    );
    expect(app).toContain("function isWechatPaymentMethod");
    expect(app).toContain("function directActualPaymentMethodsFromCheckout");
    expect(app).toContain(
      'data-distribution-commerce="direct-wechat-replaced-code-shop"',
    );
    expect(app).toContain(
      "const paymentMethods = playDistribution\n    ? []\n    : directActualPaymentMethodsFromCheckout(checkoutInfo);",
    );
    expect(app).toContain("hasWechatPaymentMethod(checkoutInfo)");
    expect(app).toContain("text.account.directWechatReplacementTitle");
    expect(app).toContain("usdt_trc20");
    expect(app).toContain("paynow");
    expect(app).toContain(
      'const directRedeemShopUrl = playDistribution\n    ? ""\n    : String(clientConfig?.androidDirectRedeemShopUrl || "").trim();',
    );
    expect(app).toContain("route === Path.AccountRecharge && playDistribution");
    expect(app).toContain("route === Path.AccountPlans && playDistribution");
    expect(app).toContain("text.account.playCommerceUnavailable");
    expect(app).toContain("text.account.playBillingBackendRequired");
    expect(app).toContain("!playDistribution && (");
    expect(i18n).toContain("Google Play 版的数字权益购买必须通过 Play Billing");
    expect(i18n).toContain(
      "Digital balance and entitlements in the Google Play build must use Play Billing",
    );
    expect(i18n).toContain("此入口仅在直装/国内版显示");
    expect(buildConfig).toContain('androidDistribution === "direct"');
    expect(buildConfig).not.toContain("https://pay.ldxp.cn/shop/4B4R3T44");
    expect(buildConfig).toContain(
      'process.env.NEXT_PUBLIC_ANDROID_DIRECT_REDEEM_SHOP_URL ?? ""',
    );
    expect(playAssetCheck).toContain("pay.ldxp.cn");
    expect(playAssetCheck).toContain(
      "Google Play assets must not contain external digital-content purchase links",
    );
  });
});
