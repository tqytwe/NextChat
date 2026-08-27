import { describe, expect, test } from "@jest/globals";

import {
  hasManagedMediaContract,
  isExecutableManagedImageModel,
  isExecutableManagedVideoModel,
  isManagedImageSizeSupported,
  validateManagedImageRequest,
  validateManagedVideoRequest,
} from "../app/client/mobile-media-contract";

const u15 = {
  id: "sensenova-u1.5-lite",
  name: "sensenova-u1.5-lite",
  modalities: ["image"],
  adapter: "sensenova",
  capability_version: "2026-08-26.1",
  image_capabilities: {
    operations: ["create", "edit"],
    sizing_kind: "custom_dimensions",
    min_dimension: 512,
    max_dimension: 4096,
    dimension_step: 32,
    max_aspect_ratio: 3,
    supported_formats: ["png", "jpeg", "webp"],
    max_reference_images: 8,
  },
};

const u1Fast = {
  id: "sensenova-u1-fast",
  name: "sensenova-u1-fast",
  modalities: ["image"],
  adapter: "sensenova",
  capability_version: "2026-08-26.1",
  image_capabilities: {
    operations: ["create"],
    sizing_kind: "fixed",
    supported_sizes: ["1664x2496", "2752x1536", "2048x2048"],
    max_reference_images: 0,
  },
};

const video = {
  id: "opaque-video-model",
  name: "opaque-video-model",
  modalities: ["video"],
  adapter: "grok_video",
  capability_version: "2026-08-26.1",
  video_capabilities: {
    operations: ["generate"],
    supported_resolutions: ["720p"],
    supported_ratios: ["16:9"],
    supported_durations: [5, 10],
    max_reference_images: 1,
    max_reference_videos: 0,
    max_reference_audios: 0,
  },
};

describe("managed mobile media contract", () => {
  test("uses the exact SenseNova declaration instead of model-name heuristics", () => {
    expect(isExecutableManagedImageModel(u15 as any, "create")).toBe(true);
    expect(isExecutableManagedImageModel(u15 as any, "edit")).toBe(true);
    expect(isExecutableManagedImageModel(u1Fast as any, "create")).toBe(true);
    expect(isExecutableManagedImageModel(u1Fast as any, "edit")).toBe(false);

    expect(isManagedImageSizeSupported(u15.image_capabilities, "512x512")).toBe(
      true,
    );
    expect(
      isManagedImageSizeSupported(u15.image_capabilities, "4096x4096"),
    ).toBe(true);
    expect(isManagedImageSizeSupported(u15.image_capabilities, "513x512")).toBe(
      false,
    );
    expect(
      isManagedImageSizeSupported(u15.image_capabilities, "4096x1024"),
    ).toBe(false);
    expect(
      isManagedImageSizeSupported(u1Fast.image_capabilities, "2752x1536"),
    ).toBe(true);
    expect(
      isManagedImageSizeSupported(u1Fast.image_capabilities, "1024x1024"),
    ).toBe(false);
  });

  test("rejects incomplete, edit-only, and out-of-contract image requests before transport", () => {
    const incomplete = {
      ...u15,
      adapter: "",
    };
    expect(isExecutableManagedImageModel(incomplete as any, "create")).toBe(
      false,
    );
    expect(
      validateManagedImageRequest({
        model: u1Fast as any,
        operation: "edit",
        size: "2048x2048",
        referenceCount: 1,
      }),
    ).toMatchObject({ valid: false, code: "model_not_executable" });
    expect(
      validateManagedImageRequest({
        model: u15 as any,
        operation: "edit",
        size: "1024x1024",
        referenceCount: 9,
      }),
    ).toMatchObject({ valid: false, code: "reference_not_supported" });
    expect(
      validateManagedImageRequest({
        model: u15 as any,
        operation: "create",
        size: "4096x1024",
        referenceCount: 0,
      }),
    ).toMatchObject({ valid: false, code: "size_not_supported" });
  });

  test("uses name fallback only for an entirely legacy workspace", () => {
    const legacy = { id: "custom-image-preview" };
    expect(isExecutableManagedImageModel(legacy as any, "create")).toBe(true);

    const declaredWorkspace = {
      image_capabilities_version: "2026-08-26.1",
      groups: [{ id: 1, models: [legacy] }],
    };
    expect(hasManagedMediaContract(declaredWorkspace as any)).toBe(true);
    expect(
      isExecutableManagedImageModel(
        legacy as any,
        "create",
        declaredWorkspace as any,
      ),
    ).toBe(false);

    const declaredVideoWorkspace = {
      video_capabilities_version: "2026-08-26.1",
      groups: [{ id: 2, models: [{ id: "video-looking-legacy" }] }],
    };
    expect(
      isExecutableManagedVideoModel(
        { id: "video-looking-legacy" } as any,
        declaredVideoWorkspace as any,
      ),
    ).toBe(false);
  });

  test("requires a runnable video adapter, generate operation, and exact limits", () => {
    expect(isExecutableManagedVideoModel(video as any)).toBe(true);
    expect(
      validateManagedVideoRequest({
        model: video as any,
        resolution: "720p",
        ratio: "16:9",
        duration: 10,
        referenceImageCount: 1,
      }),
    ).toEqual({ valid: true, strict: true });
    expect(
      validateManagedVideoRequest({
        model: video as any,
        resolution: "1080p",
        ratio: "16:9",
        duration: 10,
      }),
    ).toMatchObject({ valid: false, code: "resolution_not_supported" });
    expect(
      validateManagedVideoRequest({
        model: video as any,
        resolution: "720p",
        ratio: "16:9",
        duration: 12,
      }),
    ).toMatchObject({ valid: false, code: "duration_not_supported" });
    expect(
      validateManagedVideoRequest({
        model: { ...video, capability_version: "" } as any,
        resolution: "720p",
        ratio: "16:9",
        duration: 10,
      }),
    ).toMatchObject({ valid: false, code: "model_not_executable" });
  });
});
