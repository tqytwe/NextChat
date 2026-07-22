# Managed Visual Review: managed-sidebar-support-removal

<!-- visual-review-manifest
{
  "schema_version": 1,
  "changed_files": [
    "app/components/sidebar.tsx",
    "app/components/home.module.scss"
  ],
  "routes_or_surfaces": ["managed chat workspace sidebar"],
  "languages_and_themes": ["zh-CN/light", "en-US/dark"],
  "states": ["ready", "narrow sidebar", "action buttons", "chat scroll"],
  "viewports": ["360x800", "1280x800"],
  "artifact_mode": "static-review-board",
  "baseline_artifacts": [
    "docs/visual-reviews/assets/managed-sidebar-support-removal/baseline-sidebar-support-card.png"
  ],
  "updated_artifacts": [
    "docs/visual-reviews/assets/managed-sidebar-support-removal/updated-sidebar-support-removed.png"
  ],
  "commands": [
    "node generated static review board PNGs",
    "corepack yarn design:check",
    "corepack yarn next lint"
  ],
  "checks": {
    "keyboard": { "status": "passed" },
    "reduced_motion": { "status": "passed" }
  },
  "chat_regression_checks": [
    "Removal is limited to SideBarTail.extra; ChatList, chat body, input bar and session store code paths are unchanged."
  ],
  "residual_risks": [
    "Static review boards are not browser screenshots; final browser acceptance should confirm the managed sidebar after deployment."
  ]
}
-->

## Scope

- Managed states: ready managed workspace with populated chat list and sidebar footer actions.
- Routes or hash routes: managed chat workspace sidebar.
- Languages and themes: zh-CN light is the reported production case; en-US dark has no text or token change in this patch.

## Baseline

- Current behavior: the managed sidebar footer can render a compact customer-service QR/contact card above the action buttons.
- Baseline screenshot or recording: `docs/visual-reviews/assets/managed-sidebar-support-removal/baseline-sidebar-support-card.png` is a static review board showing the previous inline support-card footprint.
- Risk to chat layout or behavior: the inline card consumes vertical space in the sidebar and duplicates the customer-service entry that is already available through the floating support button.

## Reuse Decision

- Existing components and icons reused: no new component or icon is introduced; the inline `ManagedSupportContact` call site is removed.
- Managed tokens used: existing sidebar and action button styling remains intact.
- Exception, if any: static board evidence is used because this patch is a small removal and browser acceptance remains a deployment follow-up.

## State Coverage

- Session and bootstrap: managed bootstrap data is still read for return/recharge URLs and balance; support contact data is no longer rendered in the sidebar footer.
- Hover, active and focus-visible: footer action buttons keep their existing `IconButton` behavior.
- Loading, disabled, error and retry: no loading, disabled, error or retry state is changed by this patch.

## Viewport Coverage

- Mobile and short screen: narrow sidebar behavior keeps the single-column footer action grid.
- Tablet: sidebar footer no longer reserves space for the inline support card.
- Desktop: the chat list gains the vertical space formerly occupied by the compact support contact card.
- Reduced motion and keyboard: no animation or keyboard handling is changed; existing footer buttons remain keyboard reachable.

## Evidence

- Updated screenshot or recording: `docs/visual-reviews/assets/managed-sidebar-support-removal/updated-sidebar-support-removed.png` is a static review board showing the sidebar footer without the inline support card.
- Chat input/list/scroll regression evidence: code diff only removes `SideBarTail.extra`; `ChatList`, message viewport, input bar, persistence and send flow are untouched.
- Commands run: `corepack yarn design:check`; `corepack yarn next lint`.

## Residual Risk

- Known limitations: static review boards are not rendered browser proof; final browser screenshot or user acceptance should confirm the live managed workspace.
- Follow-up owner: release owner during the NextChat managed deployment check.
