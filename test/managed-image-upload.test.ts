jest.mock("../app/config/client", () => ({
  getClientConfig: jest.fn(),
}));

import { getClientConfig } from "../app/config/client";
import { uploadImage } from "../app/utils/chat";

const mockedGetClientConfig = getClientConfig as jest.MockedFunction<
  typeof getClientConfig
>;

function installSuccessfulFileReader(result: string) {
  class MockFileReader {
    result: string | ArrayBuffer | null = null;
    onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
    onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

    readAsDataURL() {
      this.result = result;
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
    }
  }

  Object.defineProperty(global, "FileReader", {
    configurable: true,
    value: MockFileReader,
  });
}

describe("managed image upload", () => {
  const originalImage = global.Image;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockedGetClientConfig.mockReset();
    Object.defineProperty(window, "_SW_ENABLED", {
      configurable: true,
      value: true,
      writable: true,
    });
    installSuccessfulFileReader("data:image/png;base64,input");

    class MockImage {
      width = 64;
      height = 64;
      onload: (() => void) | null = null;
      onerror: ((error: unknown) => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(global, "Image", {
      configurable: true,
      value: MockImage,
    });

    HTMLCanvasElement.prototype.getContext = jest.fn(
      () =>
        ({
          clearRect: jest.fn(),
          drawImage: jest.fn(),
        }) as unknown as CanvasRenderingContext2D,
    );
    HTMLCanvasElement.prototype.toDataURL = jest.fn(
      () => "data:image/jpeg;base64,managed-inline",
    );
    global.fetch = jest.fn();
  });

  afterEach(() => {
    Object.defineProperty(global, "Image", {
      configurable: true,
      value: originalImage,
    });
    global.fetch = originalFetch;
  });

  test("keeps managed attachments inline even when the service worker is enabled", async () => {
    mockedGetClientConfig.mockReturnValue({ sub2apiManagedMode: true } as any);

    const result = await uploadImage(new Blob(["image"], { type: "image/png" }));

    expect(result).toBe("data:image/jpeg;base64,managed-inline");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("keeps the service-worker upload path for non-managed web mode", async () => {
    mockedGetClientConfig.mockReturnValue({ sub2apiManagedMode: false } as any);
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ code: 0, data: "https://app.test/api/cache/image.png" }),
    });

    const result = await uploadImage(new Blob(["image"], { type: "image/png" }));

    expect(result).toBe("https://app.test/api/cache/image.png");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/cache/upload",
      expect.objectContaining({ method: "post" }),
    );
  });
});
