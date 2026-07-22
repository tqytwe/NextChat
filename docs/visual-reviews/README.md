# Managed UI Visual Reviews

This directory stores review evidence for visible changes to the Sub2API-managed
NextChat shell. A code-only review is not sufficient because sidebar height,
chat width, overlays and mobile breakpoints can regress without obvious JSX or
SCSS errors.

Create `YYYY-MM-DD-<slug>.md` from `TEMPLATE.md` for every managed visual change.
Fill the machine-readable `visual-review-manifest`, map every visible changed
file, and store before/after artifacts under `docs/visual-reviews/assets/<slug>/`.
Do not include credentials, cookies, private conversations or production keys.
`yarn design:check` validates the manifest, artifact paths, viewport coverage,
keyboard/reduced-motion result and chat regression evidence. Empty headings do
not pass.
