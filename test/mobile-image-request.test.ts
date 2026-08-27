import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(
  resolve(process.cwd(), "app/components/mobile-app.tsx"),
  "utf8",
);

describe("mobile image request policy", () => {
  test("sends SenseNova watermark false through both existing image paths", () => {
    expect(app).toContain("function mustDisableSenseNovaWatermark");
    expect(app).toContain('"sensenova-u1-fast", "sensenova-u1.5-lite"');
    expect(app).toContain("basePayload.watermark = false");
    expect(app).toContain(
      "...(mustDisableSenseNovaWatermark(exactModel)\n          ? { watermark: false }",
    );
  });

  test("keeps image output quantity bounded by the selected model capability", () => {
    expect(app).toContain("max_outputs_per_job || 4");
    expect(app).toContain(
      "Math.min(imageOutputLimit, Number(overrides?.n || count || 1))",
    );
    expect(app).toContain('inputMode="numeric"');
    expect(app).toContain("disabled={count >= imageOutputLimit}");
  });
});
