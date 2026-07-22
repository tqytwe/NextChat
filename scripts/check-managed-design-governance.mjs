#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(scriptPath, "../..");

const requiredFiles = [
  "AGENTS.md",
  "docs/MANAGED_UI_DESIGN_SYSTEM.md",
  "docs/MANAGED_UI_REMEDIATION_PLAN.md",
  "docs/SUB2API_MANAGED_MODE.md",
  "docs/managed-ui-governance.json",
  "docs/visual-reviews/README.md",
  "docs/visual-reviews/TEMPLATE.md",
  "scripts/check-managed-design-governance.test.mjs"
];

export const REQUIRED_RULE_NAMES = [
  "inline-svg",
  "transition-all",
  "large-radius",
  "raw-color",
  "focus-reset",
  "global-style",
  "continuous-motion"
];

function runGit(cwd, args, description) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trimEnd();
  } catch (error) {
    const stderr = error?.stderr?.toString().trim();
    throw new Error(
      `[managed-design] ${description} failed: git ${args.join(" ")}` +
        (stderr ? `\n${stderr}` : ""),
    );
  }
}

function tryGit(cwd, args) {
  try {
    return runGit(cwd, args, "optional Git lookup");
  } catch {
    return "";
  }
}

export function resolveBase(
  cwd,
  explicitRef = process.env.DESIGN_BASE_REF,
  remoteRef = "origin/feat/sub2api-managed-20260720",
) {
  let candidate = explicitRef;
  if (!candidate) {
    if (tryGit(cwd, ["rev-parse", "--verify", `${remoteRef}^{commit}`])) {
      candidate = runGit(
        cwd,
        ["merge-base", "HEAD", remoteRef],
        `resolve merge-base against ${remoteRef}`,
      );
    } else {
      candidate = tryGit(cwd, ["rev-parse", "--verify", "HEAD^"]);
    }
  }

  if (!candidate) {
    throw new Error(
      "[managed-design] cannot resolve Git base; fetch the managed branch " +
        "or set DESIGN_BASE_REF to a commit",
    );
  }

  try {
    const baseSha = runGit(
      cwd,
      ["rev-parse", "--verify", `${candidate}^{commit}`],
      `resolve base ${candidate}`,
    );
    const headSha = runGit(
      cwd,
      ["rev-parse", "--verify", "HEAD^{commit}"],
      "resolve HEAD",
    );
    if (
      process.env.GITHUB_EVENT_NAME === "pull_request" &&
      baseSha === headSha
    ) {
      throw new Error(
        "[managed-design] pull request base resolves to HEAD; refusing a zero-diff check",
      );
    }
    return baseSha;
  } catch (error) {
    if (String(error?.message).includes("pull request base resolves")) throw error;
    throw new Error(
      `[managed-design] cannot resolve Git base "${candidate}" to a commit`,
      { cause: error },
    );
  }
}

export function collectAddedLines(diff) {
  const addedByFile = new Map();
  let currentFile = "";
  let currentLine = 0;

  for (const text of diff.split("\n")) {
    if (text.startsWith("+++ b/")) {
      currentFile = text.slice(6);
      continue;
    }
    if (text === "+++ /dev/null") {
      currentFile = "";
      continue;
    }
    if (text.startsWith("@@")) {
      const match = text.match(/\+(\d+)/);
      currentLine = match ? Number(match[1]) : 0;
      continue;
    }
    if (currentFile && text.startsWith("+") && !text.startsWith("+++")) {
      const lines = addedByFile.get(currentFile) ?? [];
      lines.push({ line: currentLine, source: text.slice(1) });
      addedByFile.set(currentFile, lines);
      currentLine += 1;
      continue;
    }
    if (currentFile && !text.startsWith("-")) currentLine += 1;
  }
  return addedByFile;
}

function isCommentAllowance(text, ruleName) {
  const escaped = ruleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    String.raw`(?:\/\/|\/\*|\*|<!--|#)\s*design-governance-allow:\s*${escaped}\s*-\s*\S.{7,}`,
    "i",
  ).test(text);
}

export function hasValidAllowance(fullLines, lineNumber, ruleName) {
  const current = fullLines[Math.max(0, lineNumber - 1)] ?? "";
  const previous = fullLines[Math.max(0, lineNumber - 2)] ?? "";
  return (
    isCommentAllowance(current, ruleName) ||
    isCommentAllowance(previous, ruleName)
  );
}

function hasFocusReplacement(fullLines, lineNumber, source) {
  if (/\bfocus-visible:(?:ring|outline|shadow)/i.test(source)) return true;
  const start = Math.max(0, lineNumber - 4);
  const end = Math.min(fullLines.length, lineNumber + 8);
  const context = fullLines.slice(start, end).join("\n");
  return (
    /:focus-visible|focus-visible:/i.test(context) &&
    /(?:outline|box-shadow|ring)(?:-|\s*:)/i.test(context)
  );
}

const rules = [
  {
    name: "inline-svg",
    pattern: /<svg(?:\s|>)/i,
    message: "import a shared app/icons SVG instead of adding managed inline SVG",
    exempt: (file) => file.endsWith(".svg")
  },
  {
    name: "transition-all",
    pattern: /\btransition-all\b|transition\s*:\s*all\b/i,
    message: "transition only the properties that actually change"
  },
  {
    name: "large-radius",
    pattern:
      /border-radius\s*:\s*(?:(?:1[3-9]|[2-9]\d)px|(?:0\.(?:8[1-9]|9\d)|[1-9]\d*(?:\.\d+)?)rem)/i,
    message: "managed cards use 8px and overlays use 12px"
  },
  {
    name: "raw-color",
    pattern:
      /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(/i,
    message: "use scoped managed semantic tokens instead of raw colors"
  },
  {
    name: "focus-reset",
    pattern: /outline\s*:\s*(?:none|0)\b/i,
    message: "do not remove focus indication without a focus-visible replacement",
    exempt: (_file, source, fullLines, line) =>
      hasFocusReplacement(fullLines, line, source)
  },
  {
    name: "global-style",
    pattern:
      /^\s*(?::root|:global\([^)]*\)|(?:body|html|\*|input|select|textarea|button)(?:\s|,|\{))/i,
    message: "scope managed visual rules under .managed-shell or a CSS module"
  },
  {
    name: "continuous-motion",
    pattern:
      /\banimation\s*:[^;]*(?:infinite|shimmer|pulse|spin)|<animate(?:Transform)?\b/i,
    message: "continuous motion requires a reduced-motion-safe reviewed exception"
  }
];

export function findRuleViolations(
  file,
  lines,
  fullLines,
  { tokenFiles = new Set(), isBrandIcon = () => false } = {},
) {
  const violations = [];
  for (const { line, source } of lines) {
    for (const rule of rules) {
      if (rule.name === "raw-color" && (tokenFiles.has(file) || isBrandIcon(file))) {
        continue;
      }
      if (rule.exempt?.(file, source, fullLines, line)) continue;
      if (!rule.pattern.test(source)) continue;
      if (hasValidAllowance(fullLines, line, rule.name)) continue;
      violations.push({
        file,
        line,
        rule: rule.name,
        message: rule.message,
        source: source.trim()
      });
    }
  }
  return violations;
}

export function validateFunctionalIconContent(content) {
  const iconErrors = [];
  if (!/viewBox=["']0 0 24 24["']/.test(content)) {
    iconErrors.push("viewBox must be 0 0 24 24");
  }
  if (!/currentColor/.test(content)) {
    iconErrors.push("functional icon must use currentColor");
  }
  if (/<animate(?:Transform)?\b/i.test(content)) {
    iconErrors.push("functional icon cannot contain persistent SVG animation");
  }
  return iconErrors;
}

const requiredEvidenceSections = [
  "## Scope",
  "## Baseline",
  "## Reuse Decision",
  "## State Coverage",
  "## Viewport Coverage",
  "## Evidence",
  "## Residual Risk"
];

function parseEvidenceManifest(content) {
  const match = content.match(
    /<!--\s*visual-review-manifest\s*([\s\S]*?)-->/i,
  );
  if (!match) throw new Error("missing visual-review-manifest JSON block");
  return JSON.parse(match[1].trim());
}

function nonEmptyStringArray(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length >= 3)
  );
}

function validCheck(value) {
  if (!value || typeof value !== "object") return false;
  if (value.status === "passed") return true;
  return (
    value.status === "not-applicable" &&
    typeof value.reason === "string" &&
    value.reason.trim().length >= 8
  );
}

function validateArtifact(cwd, artifact) {
  if (
    typeof artifact !== "string" ||
    !/^docs\/visual-reviews\/assets\/[a-zA-Z0-9._/-]+\.(?:png|jpe?g|webp|gif|mp4|webm|json|zip)$/.test(
      artifact,
    ) ||
    artifact.includes("..")
  ) {
    return `invalid artifact path: ${String(artifact)}`;
  }
  const fullPath = resolve(cwd, artifact);
  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
    return `artifact does not exist: ${artifact}`;
  }
  if (statSync(fullPath).size === 0) return `artifact is empty: ${artifact}`;
  const extension = artifact.split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm"].includes(extension)) {
    const bytes = readFileSync(fullPath);
    const validSignature =
      (extension === "png" &&
        bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) ||
      ((extension === "jpg" || extension === "jpeg") &&
        bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) ||
      (extension === "gif" && bytes.subarray(0, 4).toString() === "GIF8") ||
      (extension === "webp" &&
        bytes.subarray(0, 4).toString() === "RIFF" &&
        bytes.subarray(8, 12).toString() === "WEBP") ||
      (extension === "mp4" && bytes.subarray(4, 8).toString() === "ftyp") ||
      (extension === "webm" &&
        bytes.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex")));
    if (!validSignature) return `artifact has an invalid media signature: ${artifact}`;
  }
  return "";
}

export function validateEvidenceRecords({
  repoRoot: cwd,
  visualFiles,
  frozenFiles,
  evidenceFiles,
  requireFrozenJustification = true
}) {
  const violations = [];
  const coveredFiles = new Set();
  const frozenCovered = new Set();

  if (visualFiles.length > 0 && evidenceFiles.length === 0) {
    violations.push({
      file: visualFiles.join(", "),
      line: 0,
      rule: "visual-evidence",
      message: "managed UI changes require a structured visual review record",
      source: "Add rendered before/after artifacts and chat regression evidence."
    });
    return violations;
  }

  for (const file of evidenceFiles) {
    const fullPath = resolve(cwd, file);
    if (!existsSync(fullPath)) {
      violations.push({
        file,
        line: 0,
        rule: "visual-evidence",
        message: "visual review record was deleted or cannot be read",
        source: file
      });
      continue;
    }
    const content = readFileSync(fullPath, "utf8");
    if (/\bTODO\b|replace-with|<slug>|待填写|截图待补/i.test(content)) {
      violations.push({
        file,
        line: 0,
        rule: "visual-evidence",
        message: "managed visual review still contains template placeholders",
        source: "Replace every placeholder with observed evidence."
      });
      continue;
    }
    const missing = requiredEvidenceSections.filter(
      (section) => !content.includes(section),
    );
    if (missing.length > 0) {
      violations.push({
        file,
        line: 0,
        rule: "visual-evidence",
        message: "managed visual review is missing required sections",
        source: missing.join(", ")
      });
      continue;
    }

    let manifest;
    try {
      manifest = parseEvidenceManifest(content);
    } catch (error) {
      violations.push({
        file,
        line: 0,
        rule: "visual-evidence",
        message: "managed visual review manifest is invalid",
        source: error.message
      });
      continue;
    }

    const fields = [
      "changed_files",
      "routes_or_surfaces",
      "languages_and_themes",
      "states",
      "viewports",
      "baseline_artifacts",
      "updated_artifacts",
      "commands",
      "chat_regression_checks",
      "residual_risks"
    ];
    const invalidFields = fields.filter(
      (field) => !nonEmptyStringArray(manifest[field]),
    );
    if (
      manifest.schema_version !== 1 ||
      invalidFields.length > 0 ||
      manifest.viewports.length < 2 ||
      !manifest.viewports.every((viewport) => /^\d{3,4}x\d{3,4}$/.test(viewport)) ||
      !manifest.baseline_artifacts.some((artifact) =>
        /\.(?:png|jpe?g|webp|gif|mp4|webm)$/i.test(artifact),
      ) ||
      !manifest.updated_artifacts.some((artifact) =>
        /\.(?:png|jpe?g|webp|gif|mp4|webm)$/i.test(artifact),
      ) ||
      !validCheck(manifest.checks?.keyboard) ||
      !validCheck(manifest.checks?.reduced_motion)
    ) {
      violations.push({
        file,
        line: 0,
        rule: "visual-evidence",
        message: "managed visual review manifest is incomplete",
        source:
          `invalid fields: ${invalidFields.join(", ") || "checks/schema/viewports"}`
      });
      continue;
    }

    const artifactErrors = [
      ...manifest.baseline_artifacts,
      ...manifest.updated_artifacts
    ]
      .map((artifact) => validateArtifact(cwd, artifact))
      .filter(Boolean);
    if (artifactErrors.length > 0) {
      violations.push({
        file,
        line: 0,
        rule: "visual-evidence",
        message: "managed visual review artifacts are invalid",
        source: artifactErrors.join("; ")
      });
      continue;
    }

    manifest.changed_files.forEach((changedFile) => {
      coveredFiles.add(changedFile);
      if (frozenFiles.includes(changedFile)) {
        if (
          !requireFrozenJustification ||
          (typeof manifest.frozen_core_justification === "string" &&
            manifest.frozen_core_justification.trim().length >= 12)
        ) {
          frozenCovered.add(changedFile);
        }
      }
    });
  }

  const uncovered = visualFiles.filter((file) => !coveredFiles.has(file));
  if (uncovered.length > 0) {
    violations.push({
      file: uncovered.join(", "),
      line: 0,
      rule: "visual-evidence",
      message: "managed visible files are not mapped by a visual review",
      source: "List every managed visible file in manifest.changed_files."
    });
  }

  const unjustifiedFrozen = frozenFiles.filter(
    (file) => !frozenCovered.has(file),
  );
  if (unjustifiedFrozen.length > 0) {
    violations.push({
      file: unjustifiedFrozen.join(", "),
      line: 0,
      rule: "managed-frozen-core",
      message: "frozen chat core changes need an explicit justification and regression evidence",
      source: "Add frozen_core_justification and chat_regression_checks to the review manifest."
    });
  }

  return violations;
}

function isPrefixMatch(file, prefixes) {
  return prefixes.some((prefix) => file.startsWith(prefix));
}

function main() {
  process.chdir(repoRoot);
  for (const file of requiredFiles) {
    if (!existsSync(resolve(repoRoot, file))) {
      throw new Error(`[managed-design] missing required file: ${file}`);
    }
  }

  const policy = JSON.parse(
    readFileSync(resolve(repoRoot, "docs/managed-ui-governance.json"), "utf8"),
  );
  if (
    policy.schema_version !== 1 ||
    JSON.stringify(policy.required_rule_names) !==
      JSON.stringify(REQUIRED_RULE_NAMES) ||
    rules.map((rule) => rule.name).join("\n") !== REQUIRED_RULE_NAMES.join("\n")
  ) {
    throw new Error(
      "[managed-design] machine policy and executable rule set are out of sync",
    );
  }

  const visualPrefixes = policy.managed_visual_prefixes;
  const visualFilesSet = new Set(policy.managed_visual_files);
  const sharedFiles = new Set(policy.shared_contract_files);
  const configFiles = new Set(policy.managed_config_files);
  const frozenFilesSet = new Set(policy.frozen_core_files);
  const brandFiles = new Set(policy.brand_icon_files);
  const tokenFiles = new Set(policy.token_files);
  const isBrandIcon = (file) =>
    brandFiles.has(file) || isPrefixMatch(file, policy.brand_icon_prefixes);
  const isFunctionalIcon = (file) =>
    file.startsWith(policy.functional_icon_prefix) && !isBrandIcon(file);
  const isGovernedFile = (file) =>
    isPrefixMatch(file, visualPrefixes) ||
    visualFilesSet.has(file) ||
    sharedFiles.has(file) ||
    configFiles.has(file) ||
    frozenFilesSet.has(file) ||
    file.startsWith(policy.functional_icon_prefix);
  const isManagedVisibleFile = (file) =>
    isPrefixMatch(file, visualPrefixes) ||
    visualFilesSet.has(file) ||
    sharedFiles.has(file) ||
    isFunctionalIcon(file) ||
    frozenFilesSet.has(file);

  const base = resolveBase(repoRoot);
  const diff = runGit(
    repoRoot,
    ["diff", "--unified=0", "--no-ext-diff", "--find-renames", base, "--", "app"],
    "read managed diff",
  );
  const allAddedLines = collectAddedLines(diff);
  const addedByFile = new Map(
    [...allAddedLines].filter(([file]) => isGovernedFile(file)),
  );

  const untracked = runGit(
    repoRoot,
    ["ls-files", "--others", "--exclude-standard", "--", "app"],
    "list untracked app files",
  )
    .split("\n")
    .filter((file) => file && isGovernedFile(file));
  for (const file of untracked) {
    addedByFile.set(
      file,
      readFileSync(resolve(repoRoot, file), "utf8")
        .split("\n")
        .map((source, index) => ({ line: index + 1, source })),
    );
  }

  const changedFiles = new Set(
    runGit(
      repoRoot,
      ["diff", "--name-only", "--find-renames", base],
      "list changed files",
    )
      .split("\n")
      .filter(Boolean),
  );
  for (const file of runGit(
    repoRoot,
    ["ls-files", "--others", "--exclude-standard"],
    "list all untracked files",
  )
    .split("\n")
    .filter(Boolean)) {
    changedFiles.add(file);
  }

  const violations = [];
  for (const [file, lines] of addedByFile) {
    const fullPath = resolve(repoRoot, file);
    const fullLines = existsSync(fullPath)
      ? readFileSync(fullPath, "utf8").split("\n")
      : [];
    violations.push(
      ...findRuleViolations(file, lines, fullLines, { tokenFiles, isBrandIcon }),
    );
  }

  const changedFunctionalIcons = [...changedFiles].filter(
    (file) => isFunctionalIcon(file) && file.endsWith(".svg") && existsSync(file),
  );
  for (const file of changedFunctionalIcons) {
    const content = readFileSync(resolve(repoRoot, file), "utf8");
    const iconErrors = validateFunctionalIconContent(content);
    if (iconErrors.length > 0) {
      violations.push({
        file,
        line: 0,
        rule: "functional-icon-contract",
        message: "changed functional icon does not match the managed icon contract",
        source: iconErrors.join("; ")
      });
    }
  }

  const managedVisibleFiles = [...changedFiles].filter(isManagedVisibleFile);
  const frozenFiles = [...changedFiles].filter((file) =>
    frozenFilesSet.has(file),
  );
  const evidenceFiles = [...changedFiles].filter(
    (file) =>
      /^docs\/visual-reviews\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(file) &&
      !file.endsWith("/README.md") &&
      !file.endsWith("/TEMPLATE.md"),
  );
  violations.push(
    ...validateEvidenceRecords({
      repoRoot,
      visualFiles: managedVisibleFiles,
      frozenFiles,
      evidenceFiles
    }),
  );

  if (violations.length > 0) {
    console.error("[managed-design] new visual-contract violations found:\n");
    for (const violation of violations) {
      console.error(
        `- ${violation.file}${violation.line ? `:${violation.line}` : ""} ` +
          `[${violation.rule}]: ${violation.message}`,
      );
      console.error(`  ${violation.source}`);
    }
    console.error(
      "\nUse existing managed components and tokens, or add a reviewed comment " +
        "`design-governance-allow: <rule> - <concrete reason>`.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `[managed-design] passed (base: ${base}; changed files: ${changedFiles.size}; ` +
      `checked files: ${addedByFile.size}; visual files: ${managedVisibleFiles.length}; ` +
      `frozen files: ${frozenFiles.length}; evidence records: ${evidenceFiles.length})`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
