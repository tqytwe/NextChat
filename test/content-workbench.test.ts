import { describe, expect, test } from "@jest/globals";

import {
  buildContentWorkbenchCopyPrompt,
  buildContentWorkbenchPrompt,
  contentWorkbenchCustomShot,
  contentWorkbenchPlan,
  contentWorkbenchPresets,
  normalizeContentWorkbenchShot,
} from "../app/client/content-workbench";

describe("content creation workspace", () => {
  const brief = {
    projectName: "Nova Phone",
    sellingPoints: "all-day battery, night camera, lightweight body",
    parameters: "6.7-inch display; 5000mAh battery; 50MP camera",
    audience: "urban commuters",
    platform: "store listing and social media",
    tone: "clear and premium",
    scene: "ecommerce",
    brandControls: {
      lockProduct: true,
      lockColor: true,
      lockLogo: false,
      composition: "center" as const,
      safeArea: "top" as const,
      videoIntent: false,
    },
  };

  test("provides the five supported creation scenes", () => {
    expect(contentWorkbenchPresets().map((preset) => preset.id)).toEqual([
      "ecommerce",
      "social",
      "brand",
      "service",
      "custom",
    ]);
  });

  test("splits e-commerce output into distinct production shot purposes", () => {
    const plan = contentWorkbenchPlan("ecommerce");
    expect(plan.map((shot) => shot.kind)).toEqual([
      "main",
      "angle",
      "detail",
      "lifestyle",
      "selling-point",
      "detail-page",
      "banner",
    ]);
    expect(plan.every((shot) => shot.scene === "ecommerce")).toBe(true);
    expect(plan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "detail-page",
          aspect: "portrait",
          copyFields: expect.arrayContaining(["parameters"]),
        }),
        expect.objectContaining({
          kind: "selling-point",
          purpose: expect.stringContaining("editable copy"),
        }),
      ]),
    );
    plan.forEach((shot) => {
      expect(shot.promptTemplate).not.toEqual("");
      expect(shot.purpose).not.toEqual("");
      expect(shot.copyFields.length).toBeGreaterThan(0);
    });
  });

  test("builds different prompts for detail and hero work from the saved brief", () => {
    const plan = contentWorkbenchPlan("ecommerce");
    const main = plan.find((shot) => shot.kind === "main")!;
    const detail = plan.find((shot) => shot.kind === "detail")!;
    const detailPage = plan.find((shot) => shot.kind === "detail-page")!;

    const mainPrompt = buildContentWorkbenchPrompt(brief, main);
    const detailPrompt = buildContentWorkbenchPrompt(brief, detail);
    const detailPagePrompt = buildContentWorkbenchPrompt(brief, detailPage);

    expect(detailPrompt).not.toEqual(mainPrompt);
    expect(detailPrompt).toContain("Do not use the generic hero composition");
    expect(detailPagePrompt).toContain("locally rendered specifications");
    expect(detailPagePrompt).toContain("5000mAh battery");
    expect(detailPrompt).toContain("Subject: Nova Phone.");
    expect(detailPrompt).toContain(
      "follow this shot purpose instead of recreating the reference as a generic main image",
    );
  });

  test("normalizes legacy plans and retains user-defined custom shot direction", () => {
    const legacy = normalizeContentWorkbenchShot({
      id: "legacy-detail",
      kind: "detail",
      label: "Legacy detail",
      size: "1024x1024",
      count: 2,
    });
    expect(legacy).toMatchObject({
      id: "legacy-detail",
      kind: "detail",
      aspect: "square",
    });
    expect(legacy.promptTemplate).toContain("close-up");

    const custom = contentWorkbenchCustomShot("custom-shot-1");
    const customPrompt = buildContentWorkbenchPrompt(brief, {
      ...custom,
      label: "Camera comparison",
      purpose: "show day and night camera results side by side",
    });
    expect(customPrompt).toContain(
      "show day and night camera results side by side",
    );
  });

  test("creates scenario-aware copy with editable parameter facts", () => {
    const copyPrompt = buildContentWorkbenchCopyPrompt(brief);
    expect(copyPrompt).toContain("ecommerce content project");
    expect(copyPrompt).toContain("6.7-inch display");
    expect(copyPrompt).toContain("editable copy");
  });
});
