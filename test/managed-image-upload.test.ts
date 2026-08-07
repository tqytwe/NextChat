import { shouldInlineUploadedImage } from "@/app/utils/managed-image-upload";

describe("managed image upload transport", () => {
  test("keeps managed attachments inline when the service worker is enabled", () => {
    expect(shouldInlineUploadedImage(true, true)).toBe(true);
  });

  test("keeps the service-worker cache path for non-managed web mode", () => {
    expect(shouldInlineUploadedImage(false, true)).toBe(false);
  });

  test("uses inline data when the service worker is unavailable", () => {
    expect(shouldInlineUploadedImage(false, false)).toBe(true);
  });
});
