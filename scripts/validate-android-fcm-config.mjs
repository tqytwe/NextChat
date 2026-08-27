import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const expectedPackage = "com.jisudeng.chat";
const validDistributions = new Set(["play", "direct"]);

function fail(message) {
  console.error(`[Android FCM] ${message}`);
  process.exit(1);
}

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : "";
}

const distribution = argValue("distribution");
if (distribution && !validDistributions.has(distribution)) {
  fail(`Unknown distribution "${distribution}". Expected play or direct.`);
}

const candidatePaths = [
  ...(distribution
    ? [`android/app/src/${distribution}/google-services.json`]
    : [
        "android/app/src/play/google-services.json",
        "android/app/src/direct/google-services.json",
      ]),
  "android/app/google-services.json",
];

function readConfig(file) {
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8").trim();
  if (!raw) {
    fail(`${path.relative(root, file)} exists but is empty.`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(
      `${path.relative(root, file)} is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function packageNames(config) {
  return (Array.isArray(config?.client) ? config.client : [])
    .map(
      (client) =>
        client?.client_info?.android_client_info?.package_name ?? "",
    )
    .filter(Boolean);
}

for (const candidatePath of candidatePaths) {
  const file = path.join(root, candidatePath);
  const config = readConfig(file);
  if (!config) continue;

  const packages = packageNames(config);
  if (!packages.includes(expectedPackage)) {
    fail(
      `${candidatePath} does not contain Firebase Android client package ${expectedPackage}. Found: ${
        packages.join(", ") || "none"
      }`,
    );
  }

  const projectId = String(config?.project_info?.project_id || "").trim();
  console.log(
    `[Android FCM] using ${candidatePath}${
      projectId ? ` for Firebase project ${projectId}` : ""
    }`,
  );
  process.exit(0);
}

fail(
  [
    `Release builds require a real Firebase google-services.json containing package ${expectedPackage}.`,
    `Checked: ${candidatePaths.join(", ")}`,
    "Download it from Firebase Console for the Android app and keep it on the Dell build machine; do not synthesize placeholder values.",
  ].join(" "),
);
