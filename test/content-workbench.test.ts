import { describe, expect, test } from "@jest/globals";

import {
  CONTENT_WORKBENCH_MAX_OUTPUTS_PER_PROJECT,
  CONTENT_WORKBENCH_MAX_VARIANTS_PER_SHOT,
  buildContentWorkbenchCopyPrompt,
  buildContentWorkbenchPrompt,
  contentWorkbenchCanIncreaseShotCount,
  contentWorkbenchClonePlan,
  contentWorkbenchCustomShot,
  contentWorkbenchPlanOutputCount,
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
    expect(mainPrompt).toContain("Shot type: main.");
    expect(detailPrompt).toContain("macro or tight crop");
    expect(detailPagePrompt).toContain("vertical detail-page module");
    expect(detailPrompt).toContain(
      "not their camera angle, background, or framing",
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

  test("lets every scenario plan scale by shot while preserving bounded batches", () => {
    const basePlan = contentWorkbenchPlan("ecommerce");
    const plan = basePlan.map((shot) => ({
      ...shot,
      count: CONTENT_WORKBENCH_MAX_VARIANTS_PER_SHOT,
    }));

    expect(contentWorkbenchPlanOutputCount(plan)).toBe(42);
    expect(contentWorkbenchCanIncreaseShotCount(plan, plan[0].id)).toBe(false);

    const nearFullPlan = plan.map((shot, index) =>
      index === 0 ? { ...shot, count: 5 } : shot,
    );
    const fullPlan = [
      ...nearFullPlan,
      {
        ...contentWorkbenchCustomShot("extra-shot"),
        count: CONTENT_WORKBENCH_MAX_VARIANTS_PER_SHOT,
      },
      { ...contentWorkbenchCustomShot("overflow-shot"), count: 1 },
    ];
    expect(contentWorkbenchPlanOutputCount(fullPlan)).toBe(48);
    expect(
      contentWorkbenchCanIncreaseShotCount(fullPlan, "overflow-shot"),
    ).toBe(false);
    expect(CONTENT_WORKBENCH_MAX_OUTPUTS_PER_PROJECT).toBe(48);
  });

  test("clones an edited preset plan before it is attached to a project", () => {
    const [first] = contentWorkbenchPlan("ecommerce");
    const cloned = contentWorkbenchClonePlan([
      { ...first, count: 4, purpose: "show the packaging at checkout" },
    ]);

    expect(cloned).toEqual([
      expect.objectContaining({
        id: first.id,
        count: 4,
        purpose: "show the packaging at checkout",
      }),
    ]);
    expect(cloned[0]).not.toBe(first);
    expect(cloned[0].copyFields).not.toBe(first.copyFields);
  });

  test("creates scenario-aware copy with editable parameter facts", () => {
    const copyPrompt = buildContentWorkbenchCopyPrompt(brief);
    expect(copyPrompt).toContain("ecommerce content project");
    expect(copyPrompt).toContain("6.7-inch display");
    expect(copyPrompt).toContain("editable copy");
  });
});
