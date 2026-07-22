import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  REQUIRED_RULE_NAMES,
  collectAddedLines,
  findRuleViolations,
  hasValidAllowance,
  resolveBase,
  validateFunctionalIconContent,
  validateEvidenceRecords,
} from "./check-managed-design-governance.mjs";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

test("managed governance rule set cannot silently shrink", () => {
  assert.deepEqual(REQUIRED_RULE_NAMES, [
    "inline-svg",
    "transition-all",
    "large-radius",
    "raw-color",
    "focus-reset",
    "global-style",
    "continuous-motion",
  ]);
});

test("invalid managed base fails closed on Node-compatible code path", () => {
  const repo = mkdtempSync(join(tmpdir(), "nextchat-design-base-"));
  try {
    git(repo, ["init"]);
    git(repo, ["config", "user.email", "design@example.com"]);
    git(repo, ["config", "user.name", "Design Test"]);
    writeFileSync(join(repo, "file.txt"), "baseline\n");
    git(repo, ["add", "file.txt"]);
    git(repo, ["commit", "-m", "baseline"]);

    assert.throws(
      () =>
        resolveBase(
          repo,
          "definitely-not-a-ref",
          "origin/feat/sub2api-managed-20260720",
        ),
      /cannot resolve Git base/,
    );
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("managed diff parser preserves added line numbers", () => {
  const parsed = collectAddedLines(
    [
      "diff --git a/app/components/managed-test.tsx b/app/components/managed-test.tsx",
      "--- a/app/components/managed-test.tsx",
      "+++ b/app/components/managed-test.tsx",
      "@@ -0,0 +1,2 @@",
      "+export function Test() {",
      "+  return null;",
    ].join("\n"),
  );
  assert.equal(parsed.get("app/components/managed-test.tsx")[1].line, 2);
});

test("managed allowances require a comment and reason", () => {
  assert.equal(
    hasValidAllowance(
      ["/* design-governance-allow: raw-color - upstream provider logo */"],
      1,
      "raw-color",
    ),
    true,
  );
  assert.equal(
    hasValidAllowance(
      ["design-governance-allow: raw-color"],
      1,
      "raw-color",
    ),
    false,
  );
});

test("each managed rule and functional icon contract has a negative probe", () => {
  const cases = [
    ["app/components/managed-test.tsx", "<svg>", "inline-svg"],
    ["app/components/managed-test.module.scss", "transition: all 100ms;", "transition-all"],
    ["app/components/managed-test.module.scss", "border-radius: 24px;", "large-radius"],
    ["app/components/managed-test.module.scss", "color: oklch(20% 0.1 20);", "raw-color"],
    ["app/components/managed-test.module.scss", "outline: none;", "focus-reset"],
    ["app/components/managed-test.module.scss", "  :root {", "global-style"],
    ["app/components/managed-test.module.scss", "animation: spin 1s infinite;", "continuous-motion"]
  ];
  for (const [file, source, expectedRule] of cases) {
    const violations = findRuleViolations(
      file,
      [{ line: 1, source }],
      [source],
    );
    assert.ok(
      violations.some((item) => item.rule === expectedRule),
      `${expectedRule} did not reject its negative probe`,
    );
  }

  assert.deepEqual(
    findRuleViolations(
      "app/components/managed-test.module.scss",
      [{ line: 1, source: "outline: none; &:focus-visible { outline: 2px solid; }" }],
      ["outline: none; &:focus-visible { outline: 2px solid; }"],
    ),
    [],
  );
  assert.ok(
    validateFunctionalIconContent(
      '<svg viewBox="0 0 16 16" fill="#fff"><animate /></svg>',
    ).length >= 3,
  );
});

test("managed visual evidence covers artifacts and frozen core review", () => {
  const repo = mkdtempSync(join(tmpdir(), "nextchat-design-evidence-"));
  try {
    const reviewDir = join(repo, "docs/visual-reviews");
    const assetDir = join(reviewDir, "assets");
    mkdirSync(assetDir, { recursive: true });
    const pngHeader = Buffer.from("89504e470d0a1a0a", "hex");
    writeFileSync(join(assetDir, "before.png"), pngHeader);
    writeFileSync(join(assetDir, "after.png"), pngHeader);

    const review = "docs/visual-reviews/2026-07-21-test.md";
    writeFileSync(
      join(repo, review),
      [
        "# Managed Visual Review: Test",
        "",
        "<!-- visual-review-manifest",
        JSON.stringify({
          schema_version: 1,
          changed_files: ["app/components/chat.tsx"],
          routes_or_surfaces: ["managed chat"],
          languages_and_themes: ["zh-CN/light"],
          states: ["ready", "error"],
          viewports: ["360x800", "1280x800"],
          baseline_artifacts: ["docs/visual-reviews/assets/before.png"],
          updated_artifacts: ["docs/visual-reviews/assets/after.png"],
          commands: ["playwright screenshot managed chat"],
          checks: {
            keyboard: { status: "passed" },
            reduced_motion: { status: "passed" }
          },
          chat_regression_checks: ["input, scroll and persistence tests passed"],
          frozen_core_justification: "Required managed accessibility attribute only.",
          residual_risks: ["No known residual risk after local review."]
        }),
        "-->",
        "",
        "## Scope",
        "Managed chat.",
        "## Baseline",
        "Existing state.",
        "## Reuse Decision",
        "Existing chat DOM.",
        "## State Coverage",
        "Ready and error.",
        "## Viewport Coverage",
        "Mobile and desktop.",
        "## Evidence",
        "Artifacts above.",
        "## Residual Risk",
        "None found."
      ].join("\n"),
    );

    assert.deepEqual(
      validateEvidenceRecords({
        repoRoot: repo,
        visualFiles: ["app/components/chat.tsx"],
        frozenFiles: ["app/components/chat.tsx"],
        evidenceFiles: [review]
      }),
      [],
    );

    const violations = validateEvidenceRecords({
      repoRoot: repo,
      visualFiles: ["app/components/chat.tsx"],
      frozenFiles: ["app/components/chat.tsx"],
      evidenceFiles: [review],
      requireFrozenJustification: false
    });
    assert.deepEqual(violations, []);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
