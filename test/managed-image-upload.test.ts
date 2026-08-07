import { jest } from "@jest/globals";
import { getClientConfig } from "@/app/config/client";
import { shouldInlineUploadedImage } from "@/app/utils/managed-image-upload";

jest.mock("@/app/config/client", () => ({
  getClientConfig: jest.fn(),
}));

const mockedGetClientConfig = getClientConfig as jest.MockedFunction<
  typeof getClientConfig
>;

describe("managed image upload transport", () => {
  beforeEach(() => {
    mockedGetClientConfig.mockReset();
  });

  test("keeps managed attachments inline when the service worker is enabled", () => {
    mockedGetClientConfig.mockReturnValue({ sub2apiManagedMode: true } as any);

    expect(shouldInlineUploadedImage(true)).toBe(true);
  });

  test("keeps the service-worker cache path for non-managed web mode", () => {
    mockedGetClientConfig.mockReturnValue({ sub2apiManagedMode: false } as any);

    expect(shouldInlineUploadedImage(true)).toBe(false);
  });

  test("uses inline data when the service worker is unavailable", () => {
    mockedGetClientConfig.mockReturnValue({ sub2apiManagedMode: false } as any);

    expect(shouldInlineUploadedImage(false)).toBe(true);
  });
});
