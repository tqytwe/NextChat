# Chat Image Upload Compatibility Review

<!-- visual-review-manifest
{
  "schema_version": 1,
  "changed_files": [
    "app/components/chat.tsx",
    "app/client/platforms/ai302.ts",
    "app/client/platforms/alibaba.ts",
    "app/client/platforms/anthropic.ts",
    "app/client/platforms/glm.ts",
    "app/client/platforms/google.ts",
    "app/client/platforms/openai.ts",
    "app/client/platforms/siliconflow.ts",
    "app/client/platforms/tencent.ts",
    "app/utils.ts",
    "test/utils.test.ts"
  ],
  "routes_or_surfaces": [
    "chat image upload control",
    "chat paste image handling",
    "provider image-content preservation"
  ],
  "languages_and_themes": [
    "managed chat copy",
    "light theme compatibility",
    "dark theme compatibility"
  ],
  "states": [
    "image upload control default and focus-visible",
    "image paste handling with text-only history",
    "provider request preserves uploaded image content"
  ],
  "viewports": [
    "390x844",
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
    "The upload control remains available when the selected model is not marked as vision-capable, so managed model routing can decide image support from the actual request.",
    "Provider adapters preserve image content when the message history contains images, while text-only histories retain the existing text normalization path.",
    "The change does not alter session persistence, message rendering, scroll restoration, or the managed shell layout."
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

This pass preserves user-uploaded and pasted images for managed chat requests regardless of the selected model capability label. The upload control remains available and provider adapters inspect actual message content before normalizing requests.

## Baseline

The previous path hid image upload and paste handling for non-vision model labels and several providers stripped image content before forwarding. This could discard a user attachment even when the managed gateway supported it.

## Reuse Decision

The existing chat action control, message image helpers, preprocessing functions, provider adapters, and test utilities are reused. No new visual component, route, layout shell, or animation was introduced.

## State Coverage

The review covers image upload availability, paste handling, image-bearing histories, and text-only histories. Provider request normalization remains unchanged for text-only messages.

## Viewport Coverage

The existing chat action layout is unchanged at 390x844, 768x1024, and 1280x800. The uploaded-image control uses the existing action row and does not change sidebar or message widths.

## Evidence

The existing managed support visual review artifacts are reused as valid static review-board evidence for the unchanged managed shell/action layout. The code regression is covered by the added `hasMessageImages` unit cases and provider-path inspection. GitHub CI remains responsible for the full Jest, typecheck, and production build checks; no local compilation was performed for this deployment transfer.

## Residual Risk

Browser acceptance should confirm upload and paste behavior against the deployed managed gateway for a non-vision model and a vision-capable model. The static artifacts are not browser captures.
