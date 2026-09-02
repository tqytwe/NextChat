import {
  contentWorkbenchPackageFileName,
  exportContentWorkbenchPackage,
  importContentWorkbenchPackage,
} from "../app/client/content-workbench-package";
import { webcrypto } from "node:crypto";

Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const project: any = {
  id: "local-project",
  accountId: "account-a",
  version: 1,
  productName: "Summer shoes",
  sellingPoints: "Lightweight",
  audience: "buyers",
  platform: "shop",
  tone: "clean",
  model: "image-model",
  referenceImages: [],
  assets: [],
  copyStatus: "idle",
  createdAt: 1,
  updatedAt: 1,
};

async function blobText(blob: Blob) {
  if (typeof blob.text === "function") return blob.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

describe("content workbench package", () => {
  test("round-trips a project and verifies included file content", async () => {
    const archive = await exportContentWorkbenchPackage({
      project,
      files: [{ path: "assets/product.png", blob: new Blob(["asset"]) }],
    });
    const restored = await importContentWorkbenchPackage(archive);
    expect(restored.project.accountId).toBe("account-a");
    expect(await blobText(restored.files.get("assets/product.png")!)).toBe("asset");
    expect(contentWorkbenchPackageFileName(project)).toMatch(/\.zip$/);
  });

  test("preserves the declared completed-output order instead of ZIP entry order", async () => {
    const archive = await exportContentWorkbenchPackage({
      project,
      files: [
        { path: "outputs/002-second.png", blob: new Blob(["second"]) },
        { path: "outputs/001-first.png", blob: new Blob(["first"]) },
      ],
      outputPaths: ["outputs/002-second.png", "outputs/001-first.png"],
    });
    const restored = await importContentWorkbenchPackage(archive);
    expect(restored.outputPaths).toEqual([
      "outputs/002-second.png",
      "outputs/001-first.png",
    ]);
  });

  test("rejects a damaged archive", async () => {
    await expect(importContentWorkbenchPackage(new Blob(["not-a-zip"]))).rejects.toThrow(
      "damaged",
    );
  });
});
