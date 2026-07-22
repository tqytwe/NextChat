# Managed Visual Review: managed-support-error-shell

<!-- visual-review-manifest
{
  "schema_version": 1,
  "changed_files": [
    "app/components/error.tsx",
    "app/components/managed-support-contact.tsx"
  ],
  "routes_or_surfaces": [
    "managed workspace error boundary",
    "managed support contact panel",
    "managed sidebar support entry"
  ],
  "languages_and_themes": [
    "zh-CN/light",
    "zh-CN/dark",
    "en-US/light",
    "en-US/dark"
  ],
  "states": [
    "managed error",
    "reload action",
    "return console action",
    "support contact with two QR cards",
    "support contact without QR",
    "copy and open actions"
  ],
  "viewports": [
    "360x800",
    "768x1024",
    "1280x800",
    "1600x900"
  ],
  "baseline_artifacts": [
    "docs/visual-reviews/assets/managed-support-error-shell/before-managed-error.png"
  ],
  "updated_artifacts": [
    "docs/visual-reviews/assets/managed-support-error-shell/after-managed-error-support.png",
    "docs/visual-reviews/assets/managed-support-error-shell/after-managed-support-contact.png"
  ],
  "commands": [
    "corepack yarn design:test",
    "corepack yarn design:check",
    "node static PNG artifact generation for review boards"
  ],
  "checks": {
    "keyboard": {
      "status": "not-applicable",
      "reason": "No browser runner is installed in this shell; managed action controls remain real buttons."
    },
    "reduced_motion": {
      "status": "not-applicable",
      "reason": "No browser runner is installed in this shell; managed shell motion remains under CSS governance."
    }
  },
  "chat_regression_checks": [
    "No frozen chat-core files are changed in this review.",
    "Error boundary changes are managed-mode gated and preserve upstream non-managed error handling.",
    "Support contact reads bootstrap support_contact instead of introducing a separate editable config."
  ],
  "residual_risks": [
    "Rendered browser screenshots still need to be captured in an environment with Playwright or a manual browser session.",
    "The generated updated artifacts are static review boards and do not replace final managed workspace acceptance."
  ]
}
-->

## Scope

- Managed states: runtime error in Sub2API managed mode and support-contact rendering from bootstrap.
- Routes or hash routes: managed workspace shell, managed sidebar support area, and error boundary fallback.
- Languages and themes: primary copy is Chinese for managed users; non-managed upstream error copy is preserved.

## Baseline

- Current behavior: managed errors could expose the generic upstream clear-data action and did not give the user the same central support path.
- Baseline screenshot or recording: `before-managed-error.png` static review board.
- Risk to chat layout or behavior: low, because no frozen chat-core files are edited.

## Reuse Decision

- Existing components and icons reused: upstream `IconButton`, existing reload/return/copy icons, and the managed `support-contact` utility parser.
- Managed tokens used: support contact styles remain in the existing managed component stylesheet and are scoped through the managed component.
- Exception, if any: none for chat core; this change stays in managed shell surfaces.

## State Coverage

- Session and bootstrap: BFF managed errors now include `Cache-Control: no-store`; support data is consumed from `bootstrap.support_contact`.
- Hover, active and focus-visible: action controls remain buttons or `IconButton` instances.
- Loading, disabled, error and retry: error fallback offers reload, return console, and support contact instead of destructive clear-data in managed mode.

## Viewport Coverage

- Mobile and short screen: support contact compact mode is used inside the error fallback.
- Tablet: QR and secondary contact rows keep the managed panel rhythm.
- Desktop: managed error actions stay grouped and support panel follows the same central config.
- Reduced motion and keyboard: not executed in this shell; static review confirms no chat-core motion or key handling was changed.

## Evidence

- Updated screenshot or recording: static review boards under `docs/visual-reviews/assets/managed-support-error-shell/`.
- Chat input/list/scroll regression evidence: changed-file review confirms no frozen chat-core file is touched.
- Commands run: managed governance tests and static artifact generation listed in the manifest.

## Residual Risk

- Known limitations: browser screenshots and live chat send/scroll checks still need to run before release acceptance.
- Follow-up owner: release owner running a browser-backed managed workspace check should update this record if rendered state differs.
