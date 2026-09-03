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
    expect(app).toContain("/sensenova|sense-nova/i");
    expect(app).toContain("basePayload.watermark = false");
    expect(app).toContain(
      "...(mustDisableSenseNovaWatermark(exactModel)\n          ? { watermark: false }",
    );
  });

  test("keeps image output quantity at the documented local safety limit", () => {
    expect(app).toContain("const imageOutputLimit = 16;");
    expect(app).toContain(
      "Number(overrides?.n ?? persistedParams.n ?? count ?? 1)",
    );
    expect(app).toContain('inputMode="numeric"');
    expect(app).toContain("disabled={count >= imageOutputLimit}");
  });
});
