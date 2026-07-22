# Managed UI Visual Reviews

This directory stores review evidence for visible changes to the Sub2API-managed
NextChat shell. A code-only review is not sufficient because sidebar height,
chat width, overlays and mobile breakpoints can regress without obvious JSX or
SCSS errors.

Create `YYYY-MM-DD-<slug>.md` from `TEMPLATE.md` for every managed visual change.
Fill the machine-readable `visual-review-manifest`, map every visible changed
file, and store before/after artifacts under `docs/visual-reviews/assets/<slug>/`.
Set `artifact_mode` to `browser-capture` for real browser or Playwright screenshots,
or `static-review-board` for a non-browser review board. Static boards are only
development evidence and must leave final browser screenshot or acceptance risk
in `residual_risks`; they must not be described as rendered browser proof.
PNG artifacts must be real decodable images; the gate validates PNG chunks, CRC,
pixel data and minimum dimensions so 1x1 placeholders or forged headers fail.
Do not include credentials, cookies, private conversations or production keys.
`yarn design:check` validates the manifest, artifact paths, viewport coverage,
artifact source mode, keyboard/reduced-motion result and chat regression evidence.
Empty headings do not pass.
