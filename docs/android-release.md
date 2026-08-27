# Android Release Artifact

The only Android APK handoff path is:

`public/downloads/jisudengchat-android.apk`

The Android download page, update manifest, emulator smoke test, Maestro E2E flow,
and the repository release artifact all use this path. It is checked into Git and
is the file that deployment must publish.

`android/app/build/outputs/apk/direct/release/app-direct-release.apk` is the
direct-channel Gradle intermediate. Older unflavored builds used
`android/app/build/outputs/apk/release/app-release.apk`; the packager accepts it
only as a compatibility fallback. Neither path must ever be sent to testers or
referenced by deployment instructions.

Create a release with one command after setting the version environment values:

```bash
ANDROID_VERSION_NAME=2.0.77 ANDROID_VERSION_CODE=277 yarn android:release
```

The release packager verifies the APK package ID, version, signing certificate and
SHA-256 before replacing the canonical artifact and `public/downloads/android-version.json`.

For Google Play, build the Play flavor as an AAB from the Dell Android build
machine:

```bash
ANDROID_VERSION_NAME=3.0.0 ANDROID_VERSION_CODE=300 yarn android:release:play
```

Release builds require Firebase Cloud Messaging configuration. Put the real
Firebase Console Android config for package `com.jisudeng.chat` at
`android/app/google-services.json`, or use channel-specific files at
`android/app/src/play/google-services.json` and
`android/app/src/direct/google-services.json`. Channel-specific files are preferred
over the shared root config; the shared file is only a fallback. The release
scripts and Gradle release tasks fail when the file is missing, empty, invalid
JSON, or registered to another Android package. Do not synthesize placeholder
values. After adding the config, rebuild and verify that FCM token registration reaches
`PUT /api/v1/mobile/devices/:installation_id` and that a server-sent test
notification is received on a device or emulator.

## Firebase / FCM configuration checklist

Detailed operator runbook:
`docs/audit/2026-08-11-firebase-fcm-and-play-console-runbook.md`.

Do not generate or edit `google-services.json` by hand. It must come from the
Firebase Console Android app whose package name is exactly `com.jisudeng.chat`.

1. In Firebase Console, create or open the Firebase project that will own
   Jisudeng APP push notifications.
2. Add an Android app with Android package name `com.jisudeng.chat`.
3. Download `google-services.json`.
4. On the Dell build machine, copy it to one of these ignored local paths:
   - shared project for both channels: `android/app/google-services.json`;
   - separate Firebase apps/projects: `android/app/src/play/google-services.json`
     and `android/app/src/direct/google-services.json`.
5. In Google Play Console, open Setup -> App integrity and copy the Play App
   Signing SHA-1 / SHA-256 certificate fingerprints. Add those fingerprints to
   the same Firebase Android app. If Google/GitHub OAuth uses Android package
   fingerprints, also update the Google Cloud OAuth credentials.
6. In Firebase Console, create/download a service account JSON that can send FCM
   HTTP v1 messages for the Firebase project. Store it on the server outside the
   repository, for example:
   `/secure/firebase/jisudeng-fcm-service-account.json`.
7. Configure the backend push worker:

```bash
MOBILE_PUSH_ENABLED=true
FCM_PROJECT_ID=<firebase-project-id>
FCM_SERVICE_ACCOUNT_FILE=/secure/firebase/jisudeng-fcm-service-account.json
```

Use `FCM_SERVICE_ACCOUNT_JSON` only if the hosting secret manager requires an
inline JSON secret. Never set both `FCM_SERVICE_ACCOUNT_FILE` and
`FCM_SERVICE_ACCOUNT_JSON`.

Owner-side verification after the files/secrets are present:

```bash
node scripts/validate-android-fcm-config.mjs --distribution=play
node scripts/validate-android-fcm-config.mjs --distribution=direct
ANDROID_VERSION_NAME=3.0.0 ANDROID_VERSION_CODE=300 yarn android:release:play
```

Then install through `bundletool` or Play internal testing, log in, confirm the
APP registers its token through `PUT /api/v1/mobile/devices/:installation_id`,
send one backend test notification, and verify foreground/background receipt plus
notification tap behavior on the emulator or a physical device.

The Play flavor removes `REQUEST_INSTALL_PACKAGES`; direct APK releases keep
that permission only for the existing sideload update channel.
The native bridge also exposes `distributionChannel`, so the Play flavor hides
the in-app APK update check/download surface while the direct flavor keeps it.
The Play flavor must never surface external digital-content purchase links. It
uses Google Play Billing for balance/plan purchases and keeps a neutral
redeem-code entry so users can enter a code they already have. The APP reads
Google Play product IDs from backend checkout fields such as
`play_billing_products`, `google_play_product_id`,
`play_billing_product_id`, or `android_product_id`; it does not hard-code SKUs
or credit balance locally. After Google returns a purchase, the APP posts the
purchase token to `/api/v1/mobile/play-billing/purchases`; the backend verifies
the token through Google Play Android Publisher API, maps the product to
balance/entitlement, creates an idempotent `payment_orders` record, reuses the
existing balance ledger / subscription fulfillment, and then tells the APP
whether to consume or acknowledge the purchase. Until Play Console products,
Google Play Developer API service-account credentials, product mappings, and a
real internal-test purchase are configured, Play Billing must not be called
end-to-end accepted.

Recommended Play Billing server configuration:

```bash
PLAY_BILLING_PACKAGE_NAME=com.jisudeng.chat
PLAY_BILLING_SERVICE_ACCOUNT_FILE=/secure/google-play/android-publisher-service-account.json
MOBILE_PLAY_BILLING_PRODUCTS_JSON='[
  {"product_id":"jisudeng.balance.50","product_type":"inapp","order_type":"balance","amount":50,"pay_amount":7.99,"currency":"USD","formatted_price":"$7.99"},
  {"product_id":"jisudeng.plan.pro.30d","product_type":"inapp","order_type":"subscription","plan_id":7,"amount":19.99,"currency":"USD","formatted_price":"$19.99"}
]'
```

For launch, prefer one-time products for both balance top-ups and fixed-duration
platform plans; map plan products with `order_type=subscription` so the backend
extends the existing platform subscription. Use Google auto-renewing
subscriptions only if the product actually needs recurring billing.

Direct APK releases continue to use the existing Web/external payment and
redemption flows. In the direct/domestic APK, WeChat payment methods are not
shown as ordinary in-app payment buttons; if the backend reports a WeChat
method, the APP replaces that row with a redeem-code shop action. USDT, PayNow,
and other non-WeChat payment methods remain orderable through the mobile payment
API.
Direct APK releases also expose a third-party redeem-code shop entry that opens
`https://pay.ldxp.cn/shop/4B4R3T44`; the Play build must never surface or
bundle that URL. The mobile login screen supports quick sign-in with the
configured Google or GitHub OAuth flow: the callback returns to
`/auth/oauth/callback`, the native bridge forwards the URL fragment back into
the APP, and existing accounts resume into the managed workspace.
Because the APP allows account creation, Play releases must expose account
deletion/request paths. The APP profile/security page provides an in-app
deletion request form that sends an `account_deletion_request` support ticket
for manual backend review. A public web deletion request URL must also be
configured in Play Console before submission. Use
`https://www.jisudeng.com/legal/account-deletion` after adding an
`account-deletion` document in `login_agreement_documents`; the exact content
template is recorded in
`docs/audit/2026-08-11-firebase-fcm-and-play-console-runbook.md`.
`NEXT_PUBLIC_ANDROID_DISTRIBUTION=direct` is the direct-channel web export
switch; `NEXT_PUBLIC_ANDROID_DISTRIBUTION=play` is the Play export switch.
Release builds explicitly disable cleartext traffic through the manifest and
`network_security_config.xml`; the native WebView also disables file/content URL
access and release debugging.

The managed APP UI ships Chinese, English, Japanese, and Korean copy from the
same codebase for both channels. Local curated templates, payment labels,
commerce notices, OAuth login, AI content reporting, and administrator labels
must stay four-language complete. The larger remote image-prompt library is
currently only published as zh/en JSON; Japanese and Korean runtimes therefore
fall back to the four-language built-in curated templates unless ja/ko prompt
JSON files are added to `public/image-prompts/manifest.json`.

## Version contract

`ANDROID_VERSION_NAME` is the user-visible Android application version and
`ANDROID_VERSION_CODE` is the monotonically increasing Android release number.
Play launch starts at `3.0.0` / versionCode `300`; direct APK releases keep the
`2.0.x` line until the owner intentionally unifies the channels. Artifact names
must always expose the channel: Play uses
`app-play-release-<versionName>-<versionCode>.aab`; direct uses the canonical
`public/downloads/jisudengchat-android.apk` and may stage Dell intermediate
outputs as `app-direct-release-<versionName>-<versionCode>.apk`.
The installed APK is authoritative: the account page, analytics, and update
checks read these fields from Android package metadata. Update eligibility is
compared only by `versionCode`; an APK with the same code is never treated as an
update.

The NextChat/Tauri version embedded in the web resources is a separate web
bundle version (`webVersion`, retained as the legacy `version` field for
desktop callers). The Android build config uses the explicit
`androidReleaseVersion`/`androidVersionCode` fields. The web value must never be
shown as the installed APK version or used for APK update comparisons.

Before replacing the canonical APK, the packager rejects a build unless all of
the following agree on both version name and version code:

- the Gradle output metadata;
- the actual signed APK manifest;
- `ANDROID_VERSION_NAME` and `ANDROID_VERSION_CODE`;
- the Android metadata embedded in `assets/public/index.html`
  (`androidReleaseVersion` and `androidVersionCode`).

The published manifest uses a content-addressed cache key
`?v=<versionName>-<versionCode>-<sha256>`. The SHA-256 is calculated from the
signed APK, so replacing an artifact can never reuse a Cloudflare/browser cache
entry. Older embedded bundles may still advertise the legacy
`?v=<versionName>-<versionCode>` fallback; it is accepted only for that same
release and the update/download pages always prefer the manifest URL.

The APK must not bundle `assets/public/downloads/android-version.json` or an APK
copy. Those are downloadable release artifacts, not application resources. The
Android update probe resolves the authoritative manifest from the official web
host, while the release verifier rejects any embedded copy so an older manifest
cannot survive an upgrade.

The generated manifest records `builtFromCommit` (also retained as the legacy
`sourceCommit` field) so the source revision used for the APK cannot be confused
with the later Git commit that records the release artifact.

The public Android download page refreshes its APK link and QR code from the
same release manifest. It accepts only the relative canonical APK path, so a
stale build variable or an unexpected download host cannot redirect users.

`scripts/verify-android-release-artifact.mjs` is the final artifact gate. It
checks the canonical APK hash, the native APK package/version, the embedded
Android release config, and the public manifest together. It also requires the
embedded web bundle to expose `webVersion` separately from the APK release
fields. Do not manually replace the APK or downgrade the manifest: the
packager rejects any `versionCode` that is not greater than every version code
already recorded in Git history.

For a mandatory update, publish `minSupportedVersionCode` in
`public/downloads/android-version.json`. Do not use a semantic string version
for mandatory-update policy.
