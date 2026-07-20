import {
  buildSub2APIImageStudioGeneratePayload,
  normalizeSub2APIImageStudioAssetURL,
} from "../app/store/sd";

describe("Sub2API managed image studio helpers", () => {
  test("builds a one-day retained image studio payload", () => {
    const payload = buildSub2APIImageStudioGeneratePayload({
      model: "gpt-image-1.5",
      params: {
        prompt: "clean product photo",
        size: "1024x1536",
        count: 8,
        quality: "high",
        output_format: "webp",
      },
    });

    expect(payload).toEqual({
      template_id: "free-create",
      user_prompt: "clean product photo",
      size: "1024x1536",
      count: 4,
      model: "gpt-image-1.5",
      quality: "high",
      output_format: "webp",
      retain_days: 1,
    });
  });

  test("rewrites Sub2API asset paths through the NextChat BFF", () => {
    expect(
      normalizeSub2APIImageStudioAssetURL(
        "/api/v1/image-studio/assets/asset-1/content",
      ),
    ).toBe("/api/nextchat/image-studio/assets/asset-1/content");
    expect(normalizeSub2APIImageStudioAssetURL(undefined, "asset-2")).toBe(
      "/api/nextchat/image-studio/assets/asset-2/content",
    );
  });
});
