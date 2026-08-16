import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const distribution = String(process.argv[2] || "").trim().toLowerCase();
if (distribution !== "direct" && distribution !== "play") {
  throw new Error("Usage: node scripts/snapshot-android-web-assets.mjs <direct|play>");
}

const source = path.join(root, "out");
const target = path.join(root, "dist", "android", "web", distribution);
if (!existsSync(source)) {
  throw new Error(`Android export directory not found: ${source}`);
}

mkdirSync(path.dirname(target), { recursive: true });
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`Android ${distribution} web assets: ${path.relative(root, target)}`);
