# Mobile UX Market Research and Remediation Priorities

Scope: mobile AI/productivity apps, with emphasis on system settings, activity
history, bulk management, feedback/notifications, iconography, and light/dark
accessibility. This is research only; no product code changes are included.

## Reference patterns

| Area | Mainstream pattern | Reference products / guidance | Implication for Jisudeng |
| --- | --- | --- | --- |
| Settings | One top-level Settings entry; grouped, flat list rows; each row opens a dedicated child page. Account/profile is separate from app/system settings. | ChatGPT mobile (General, Data Controls, Security, Notifications); Claude mobile (Account, Appearance, Notifications, Privacy); Android Material settings lists; Apple HIG Settings | Put permissions, APK version, language, web opening mode, and feedback log under `System settings`. Keep account/profile in its own page. Each child page needs a clear title and back navigation. |
| Activity/history | Long-press or an Edit action enters selection mode; contextual toolbar exposes select all, delete/archive, and cancel. Swipe actions are secondary, never the only management path. | Google Photos, Gmail, Google Drive, Notion mobile, Slack; Android selection-mode guidance | Task history must support long-press, multi-select checkboxes, select all in current filter, batch delete/archive, and undo. Use the same selection model for feedback logs, downloads, and local assets. |
| Empty/loading/error states | Every list has an explicit empty state, skeleton/loading state, retry state, and destructive-action confirmation. | ChatGPT/Claude conversation lists, Google Drive offline/error states | No dead-end route after deleting the last item. Preserve filter/sort and return to the same scroll position after a mutation. |
| Navigation hierarchy | Primary navigation is reserved for high-frequency destinations. Secondary tools do not duplicate an existing home entry. | Notion mobile, Microsoft 365, Linear mobile | Remove the duplicate Content Creation Workbench entry from Account if it is already on Home. Keep one canonical route and preserve deep links. |
| Icon/button language | Familiar icon + concise label, 24dp icon in a 48dp minimum touch target; icon-only actions require a tooltip/accessibility label. Avoid mixing filled, outline, emoji, and arbitrary illustrations in one row. | Material 3, Apple HIG, Google Workspace mobile | Define one icon set and one button hierarchy. A text action should not look like a disabled caption. Use icon-only controls only for universally understood actions (back, search, more, delete). |
| Theme/accessibility | Icons and text use theme tokens, not hard-coded colors; test both themes and high contrast. Do not use transparency as the only contrast mechanism. | Material color roles and contrast guidance; WCAG 2.2 AA | Replace transparent/white-only artwork with theme-aware assets or tinted icons. Check primary text contrast >= 4.5:1 and large text >= 3:1; focus/selected state must remain visible in both themes. |
| Feedback/notifications | Feedback is a trackable ticket/list with status and reply timeline; push notification opens the exact item. | GitHub/Linear issue status patterns; ChatGPT task/notification deep links | Feedback log should show status, last update, unread marker, retry for failed submission, and notification deep link. Do not expose a separate “客服” route without live chat capability. |
| Density and polish | Compact rows and consistent spacing; large controls are reserved for primary actions and onboarding. | Claude, ChatGPT, Notion, Google settings | Profile/settings controls should use compact 48dp rows, 20-24dp icons, and one primary CTA per screen. Avoid “elderly phone” oversized cards/buttons. |

## Prioritized plan

### P0: coherence and basic manageability

1. **System settings hub**: Add one `System settings` route containing child
   pages for Permissions, App version, Language, Web opening mode, and Feedback
   log. Use a standard list-row layout, one-line title, optional secondary value,
   trailing chevron, and consistent back behavior. Keep account/profile out of
   this hub.
2. **Task-history selection mode**: Long-press any history row or tap an Edit
   action. Enter selection mode with a count, Select all (current list/filter),
   archive/delete, and cancel. Require confirmation for destructive batch delete;
   offer a time-bounded Undo snackbar. Apply the same controller to feedback,
   local gallery, and downloaded artifacts.
3. **Remove duplicate workbench entry**: Delete the Account-page shortcut when
   Home already owns the canonical Content Creation Workbench route. Verify all
   existing deep links still resolve.
4. **Icon and theme token baseline**: Inventory every settings/history icon;
   replace mixed visual styles and hard-coded colors. Ensure disabled, selected,
   pressed, and dark-theme states are explicit and legible.

### P1: robust workflows and information architecture

1. Add search, sort (newest/oldest), status filters, and date grouping to task
   history. Persist the last filter locally and restore it after navigation.
2. Add batch archive as the default reversible cleanup; keep permanent delete in
   an overflow/destructive confirmation path. Add retention copy so users know
   what is local versus server-side.
3. Feedback log: draft autosave, attachment retry, status timeline, unread
   marker, and exact push deep link. Include a no-network retry state.
4. Standardize row metrics: 48dp minimum touch target, 16dp horizontal inset,
   8dp vertical gap between sections, 20-24dp icons, and no text truncation of
   primary labels at supported widths.

### P2: refinement and measurable personalization

1. Add reduced-motion behavior and dynamic type/font scaling tests.
2. Add optional compact density only after default density passes readability
   tests; do not make compact mode a workaround for oversized defaults.
3. Add analytics for management discoverability and failure recovery (selection
   entry, batch success/cancel, undo, feedback retry, notification open).

## Acceptance metrics

- 100% of the five requested system controls are reachable within two taps from
  Account -> System settings; no duplicate route remains.
- On a list of 100 tasks, a tester can select 20 and archive/delete them in <= 4
  interactions after entering selection mode; no item is deleted by a single
  accidental tap.
- Long-press, Edit, Select all, cancel, confirmation, and Undo work at 320dp,
  360dp, and 412dp widths in all four locales.
- Zero primary-label truncation/overlap in light and dark themes; text contrast
  meets WCAG AA (4.5:1 normal text) and selected/disabled states remain
  distinguishable without color alone.
- Feedback submission failure is recoverable without data loss; opening a
  feedback notification lands on the corresponding feedback item, not merely
  the Activity tab.
- Content Creation Workbench has exactly one canonical tab entry; all old deep
  links resolve to it without duplicate UI shortcuts.

## Research references

- Android Developers, Material 3 accessibility and selection patterns:
  https://m3.material.io/foundations/accessible-design/overview
- Android Developers, selection mode / contextual action bar:
  https://developer.android.com/develop/ui/views/touch-and-input/gestures
- Apple Human Interface Guidelines, Settings and navigation:
  https://developer.apple.com/design/human-interface-guidelines
- WCAG 2.2, contrast and non-text contrast:
  https://www.w3.org/TR/WCAG22/#contrast-minimum
- Google Material Design, lists and touch targets:
  https://m3.material.io/components/lists/overview

Product examples were reviewed for their current mobile information architecture
and interaction conventions; labels and availability may vary by platform and
release. The acceptance metrics above are the product-specific source of truth.
