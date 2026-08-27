import { existsSync, readFileSync } from "fs";
import path from "path";

const root = process.cwd();
const required = [
  "docs/mobile/README.md",
  "docs/mobile/current-baseline.json",
  "docs/mobile/architecture.md",
  "docs/mobile/module-map.md",
  "docs/mobile/api-lifecycle.md",
  "docs/mobile/dell-build-environment.md",
  "docs/mobile/signing-and-secrets.md",
  "docs/mobile/release-runbook.md",
  "docs/mobile/change-log.md",
  "docs/mobile/archive-index.md",
  "android/release/direct.json",
  "tools/android/toolchain-manifest.json",
];

const missing = required.filter((file) => !existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required mobile governance documents: ${missing.join(", ")}`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(path.join(root, "docs/mobile/current-baseline.json"), "utf8"));
for (const key of ["appRepository", "appBranch", "appCommit", "backendRepository", "backendBranch", "backendCommit", "acceptanceStatus"]) {
  if (!String(baseline[key] || "").trim()) {
    console.error(`Mobile baseline is missing ${key}.`);
    process.exit(1);
  }
}

const lifecycle = readFileSync(path.join(root, "docs/mobile/api-lifecycle.md"), "utf8");
const requiredLifecyclePaths = [
  "/api/v1/mobile/sessions/{purpose}/switch-group",
  "/api/v1/mobile/tasks",
  "/api/v1/mobile/projects",
  "/api/v1/mobile/video/jobs",
  "/api/v1/mobile/play-billing/purchases",
  "/api/v1/mobile/devices/{installation_id}",
];
const absent = requiredLifecyclePaths.filter((apiPath) => !lifecycle.includes(apiPath));
if (absent.length) {
  console.error(`Mobile API lifecycle is missing canonical paths: ${absent.join(", ")}`);
  process.exit(1);
}

console.log("Mobile governance documentation check passed.");
