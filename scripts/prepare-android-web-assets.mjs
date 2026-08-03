import { readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";

const root = process.cwd();
const outDir = path.join(root, "out");
const downloadsDir = path.join(root, "out", "downloads");
const androidCleanupScript = `<script id="jisudeng-android-cleanup">(function(){try{if("serviceWorker"in navigator){navigator.serviceWorker.getRegistrations().then(function(registrations){registrations.forEach(function(registration){registration.unregister();});});}if("caches"in window){caches.keys().then(function(keys){keys.forEach(function(key){caches.delete(key);});});}}catch(error){console.warn("[Android Assets] cleanup skipped",error);}})();</script>`;

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(file));
    } else if (entry.isFile()) {
      files.push(file);
    }
  }
  return files;
}

try {
  for (const entry of readdirSync(downloadsDir, { withFileTypes: true })) {
    if (
      entry.isFile() &&
      (entry.name.toLowerCase().endsWith(".apk") ||
        entry.name.toLowerCase() === "android-version.json")
    ) {
      const file = path.join(downloadsDir, entry.name);
      rmSync(file);
      console.log(`[Android Assets] removed bundled release asset: ${file}`);
    }
  }
} catch {
  // No downloads directory is fine for local Android builds.
}

try {
  for (const file of walkFiles(outDir)) {
    const name = path.basename(file).toLowerCase();

    if (name === "serviceworker.js" || name === "serviceworkerregister.js") {
      rmSync(file);
      console.log(`[Android Assets] removed service worker asset: ${file}`);
      continue;
    }

    if (!name.endsWith(".html")) {
      continue;
    }

    const original = readFileSync(file, "utf8");
    let html = original
      .replace(
        /<script\b[^>]*\bsrc=["']\/serviceWorkerRegister\.js["'][^>]*><\/script>/gi,
        "",
      )
      .replace(
        /<link\b[^>]*\bhref=["']https:\/\/www\.googletagmanager\.com\/gtag\/js[^"']*["'][^>]*>/gi,
        "",
      )
      .replace(
        /<script\b[^>]*\bsrc=["']https:\/\/www\.googletagmanager\.com\/[^"']*["'][^>]*><\/script>/gi,
        "",
      );

    if (!html.includes('id="jisudeng-android-cleanup"')) {
      html = html.includes("</head>")
        ? html.replace("</head>", `${androidCleanupScript}</head>`)
        : `${androidCleanupScript}${html}`;
    }

    if (html !== original) {
      writeFileSync(file, html);
      console.log(`[Android Assets] sanitized html: ${file}`);
    }
  }
} catch (error) {
  console.warn("[Android Assets] sanitize skipped", error);
}
