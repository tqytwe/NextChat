import {
  buildSub2APIImageStudioGeneratePayload,
  isSub2APIManagedImageExpired,
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

  test("includes uploaded reference ids when generating", () => {
    const payload = buildSub2APIImageStudioGeneratePayload({
      model: "gpt-image-1.5",
      params: {
        prompt: "edit this product photo",
        reference_ids: ["ref-1", "", "ref-2"],
      },
    });

    expect(payload.reference_ids).toEqual(["ref-1", "ref-2"]);
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

  test("marks managed images expired when the asset ttl has passed", () => {
    const now = Date.parse("2026-07-20T08:00:00Z");

    expect(
      isSub2APIManagedImageExpired({ expires_at: "2026-07-20T07:59:59Z" }, now),
    ).toBe(true);
    expect(
      isSub2APIManagedImageExpired({ expires_at: "2026-07-20T08:30:00Z" }, now),
    ).toBe(false);
  });
});
