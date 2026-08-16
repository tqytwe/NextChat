import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "out");
const forbidden = ["pay.ldxp.cn", "https://pay.ldxp.cn/shop/4B4R3T44"];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(file));
    } else if (entry.isFile()) {
      files.push(file);
    }
  }
  return files;
}

if (!existsSync(outDir)) {
  throw new Error(
    "Android Play asset check requires the exported out/ directory",
  );
}

const hits = [];
for (const file of walk(outDir)) {
  const data = readFileSync(file);
  const text = data.toString("utf8");
  for (const marker of forbidden) {
    if (text.includes(marker)) {
      hits.push(`${path.relative(root, file)} contains ${marker}`);
    }
  }
}

if (hits.length) {
  throw new Error(
    [
      "Google Play assets must not contain external digital-content purchase links.",
      ...hits,
    ].join("\n"),
  );
}

console.log("[Android Play Assets] no external purchase links found");
