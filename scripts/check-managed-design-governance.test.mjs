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
import { deflateSync } from "node:zlib";

import {
  REQUIRED_RULE_NAMES,
  collectAddedLines,
  findRuleViolations,
  hasValidAllowance,
  resolveBase,
  validateFunctionalIconContent,
  validateEvidenceRecords,
} from "./check-managed-design-governance.mjs";

function pngWithDimensions(width, height) {
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const scanlineLength = width * 4 + 1;
  const pixels = Buffer.alloc(scanlineLength * height);
  for (let offset = 0; offset < pixels.length; offset += scanlineLength) {
    pixels[offset] = 0;
  }
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function fakePngWithDimensions(width, height) {
  const bytes = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes, 0);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

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
    writeFileSync(join(assetDir, "before.png"), pngWithDimensions(320, 200));
    writeFileSync(join(assetDir, "after.png"), pngWithDimensions(320, 200));

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
          artifact_mode: "browser-capture",
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

    writeFileSync(join(assetDir, "after.png"), fakePngWithDimensions(320, 200));
    const fakeArtifactViolations = validateEvidenceRecords({
      repoRoot: repo,
      visualFiles: ["app/components/chat.tsx"],
      frozenFiles: ["app/components/chat.tsx"],
      evidenceFiles: [review]
    });
    assert.ok(
      fakeArtifactViolations.some((item) =>
        item.source.includes("not a complete PNG image") ||
        item.source.includes("valid PNG"),
      ),
    );

    writeFileSync(join(assetDir, "after.png"), pngWithDimensions(320, 200));
    const violations = validateEvidenceRecords({
      repoRoot: repo,
      visualFiles: ["app/components/chat.tsx"],
      frozenFiles: ["app/components/chat.tsx"],
      evidenceFiles: [review],
      requireFrozenJustification: false
    });
    assert.deepEqual(violations, []);

    writeFileSync(join(assetDir, "after.png"), pngWithDimensions(1, 1));
    const tinyArtifactViolations = validateEvidenceRecords({
      repoRoot: repo,
      visualFiles: ["app/components/chat.tsx"],
      frozenFiles: ["app/components/chat.tsx"],
      evidenceFiles: [review]
    });
    assert.ok(
      tinyArtifactViolations.some((item) =>
        item.source.includes("artifact dimensions are too small"),
      ),
    );
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
