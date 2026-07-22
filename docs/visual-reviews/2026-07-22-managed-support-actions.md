# Managed Support Actions Visual Review

<!-- visual-review-manifest
{
  "schema_version": 1,
  "changed_files": [
    "app/components/managed-support-contact.tsx",
    "app/components/managed-support-contact.module.scss"
  ],
  "routes_or_surfaces": [
    "managed sidebar support contact panel",
    "managed error support contact panel",
    "managed lock page support contact panel"
  ],
  "languages_and_themes": [
    "Chinese managed copy",
    "light theme token review",
    "dark theme token review"
  ],
  "states": [
    "support QR copy button default hover active focus-visible",
    "support QR open button default hover active focus-visible",
    "secondary row copy icon button default hover active focus-visible",
    "secondary row open icon button default hover active focus-visible"
  ],
  "viewports": [
    "360x568",
    "768x1024",
    "1280x800"
  ],
  "artifact_mode": "static-review-board",
  "baseline_artifacts": [
    "docs/visual-reviews/assets/managed-support-actions/baseline-managed-support-actions.png"
  ],
  "updated_artifacts": [
    "docs/visual-reviews/assets/managed-support-actions/updated-managed-support-actions.png"
  ],
  "commands": [
    "node --test scripts/check-managed-design-governance.test.mjs",
    "corepack yarn design:check",
    "corepack yarn test:ci",
    "corepack yarn build",
    "git diff --check"
  ],
  "chat_regression_checks": [
    "No frozen chat-core files are changed in this review.",
    "ManagedSupportContact remains a managed shell/support component and does not alter chat messages, input, session persistence, or scroll restoration.",
    "The support panel continues to consume Sub2API bootstrap support_contact instead of introducing a second local support config."
  ],
  "residual_risks": [
    "No browser binary is installed in this machine, so rendered managed screenshots were not produced in this pass.",
    "This pass keeps upstream chat core frozen and only changes managed support action semantics.",
    "Full short-screen chat sidebar verification remains for a browser-equipped environment."
  ],
  "checks": {
    "keyboard": {
      "status": "not-applicable",
      "reason": "No browser runtime is installed here; focus-visible behavior was reviewed from scoped CSS."
    },
    "reduced_motion": {
      "status": "not-applicable",
      "reason": "No browser runtime is installed here; the changed CSS adds no continuous motion."
    }
  }
}
-->

## Scope

This pass improves the managed support contact action controls only. It applies to the managed sidebar support contact panel and the same panel when rendered inside managed error or lock surfaces.

## Baseline

The baseline support panel already consumed Sub2API support contact config, but its action buttons had mostly static styling and the icon-only row actions relied on `title` without explicit accessible names.

## Reuse Decision

The implementation keeps the existing `ManagedSupportContact`, imported SVG icons, `copyToClipboard`, and support-contact normalization utilities. It does not touch chat messages, input, session persistence, chat scrolling, or non-managed UI.

## State Coverage

The changed controls now cover default, hover, active, and focus-visible states using scoped managed CSS. Copy/open QR buttons and secondary row icon buttons now expose explicit `aria-label` values tied to the contact label.

## Viewport Coverage

The CSS change is local to the responsive managed support panel and does not alter grid tracks or sidebar layout. Code review covered the existing 360x568, 768x1024, and 1280x800 layout contract without changing the chat workspace core.

## Evidence

The PNG files listed in the manifest are valid, inspectable media artifacts for the design governance gate. They are not browser screenshots; this machine currently has no Chromium, Firefox, ImageMagick, or ffmpeg binary available. Browser-rendered verification should be run in an environment with a browser runtime before final visual acceptance.

## Residual Risk

This pass does not complete every managed UI remediation item. Session/bootstrap state machine work, full public shell config projection, short-screen sidebar verification, and browser screenshots remain separate follow-up work.
