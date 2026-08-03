import { afterEach, describe, expect, jest, test } from "@jest/globals";

import {
  chooseContentTextOverlayDimensions,
  contentTextOverlayBlocks,
  renderContentTextOverlay,
  resolveContentTextOverlayPlacement,
  shouldRenderContentTextOverlay,
} from "../app/client/content-text-overlay";
import type {
  ContentWorkbenchBrief,
  ContentWorkbenchShotPlan,
} from "../app/client/content-workbench";

const brief: ContentWorkbenchBrief = {
  projectName: "Nova Phone",
  sellingPoints: "All-day battery; Night camera",
  parameters: "6.7-inch display; 5000mAh battery",
  brandControls: {
    lockProduct: true,
    lockColor: false,
    lockLogo: false,
    composition: "center",
    safeArea: "top",
    videoIntent: false,
  },
};

const sellingPointShot: ContentWorkbenchShotPlan = {
  id: "selling-point",
  kind: "selling-point",
  label: "Selling point",
  purpose: "facts",
  aspect: "portrait",
  size: "1024x1536",
  count: 1,
  promptTemplate: "reserve copy space",
  copyFields: ["title", "sellingPoints", "parameters"],
};

const mainShot: ContentWorkbenchShotPlan = {
  ...sellingPointShot,
  id: "main",
  kind: "main",
};

describe("content text overlay", () => {
  const originalCreateElement = document.createElement.bind(document);
  const originalImage = global.Image;

  afterEach(() => {
    Object.defineProperty(global, "Image", {
      configurable: true,
      value: originalImage,
    });
    jest.restoreAllMocks();
  });

  test("keeps raw factual copy for selling-point and detail-page assets", () => {
    const blocks = contentTextOverlayBlocks(brief, sellingPointShot);
    expect(blocks).toEqual([
      { kind: "title", text: "Nova Phone" },
      { kind: "selling-point", text: "All-day battery" },
      { kind: "selling-point", text: "Night camera" },
      { kind: "parameter", text: "6.7-inch display" },
      { kind: "parameter", text: "5000mAh battery" },
    ]);
    expect(
      contentTextOverlayBlocks(brief, { ...sellingPointShot, kind: "poster" }),
    ).toEqual([{ kind: "title", text: "Nova Phone" }]);
    expect(shouldRenderContentTextOverlay(brief, mainShot)).toBe(false);
  });

  test("honors an explicit copy-safe edge and bounds the output dimensions", () => {
    expect(
      resolveContentTextOverlayPlacement(brief, sellingPointShot, 1024, 1536)
        .edge,
    ).toBe("top");
    expect(
      resolveContentTextOverlayPlacement(
        {
          ...brief,
          brandControls: {
            ...brief.brandControls!,
            safeArea: "none",
            composition: "left",
          },
        },
        sellingPointShot,
        1024,
        1536,
      ).edge,
    ).toBe("right");
    expect(
      chooseContentTextOverlayDimensions(
        { naturalWidth: 8000, naturalHeight: 2000, width: 0, height: 0 },
        sellingPointShot,
      ),
    ).toEqual({ width: 2048, height: 512 });
  });

  test("renders a readable local PNG panel with a mocked browser canvas", async () => {
    const fillText = jest.fn();
    const context = {
      drawImage: jest.fn(),
      fillRect: jest.fn(),
      fillText,
      measureText: jest.fn((text: string) => ({ width: text.length * 12 })),
      font: "",
      fillStyle: "",
      textBaseline: "alphabetic" as CanvasTextBaseline,
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => context),
      toDataURL: jest.fn(() => "data:image/png;base64,local-overlay"),
    } as unknown as HTMLCanvasElement;
    jest.spyOn(document, "createElement").mockImplementation(((
      tagName: string,
    ) => {
      return tagName === "canvas" ? canvas : originalCreateElement(tagName);
    }) as typeof document.createElement);

    class MockImage {
      naturalWidth = 3000;
      naturalHeight = 1500;
      width = 3000;
      height = 1500;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    Object.defineProperty(global, "Image", {
      configurable: true,
      value: MockImage,
    });

    const result = await renderContentTextOverlay({
      imageDataUrl: "data:image/png;base64,source",
      brief,
      shot: sellingPointShot,
    });

    expect(result).toEqual({
      dataUrl: "data:image/png;base64,local-overlay",
      width: 2048,
      height: 1024,
      applied: true,
    });
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.any(MockImage),
      0,
      0,
      2048,
      1024,
    );
    expect(fillText.mock.calls.map(([text]) => text).join(" ")).toContain(
      "Nova Phone",
    );
    expect(fillText.mock.calls.map(([text]) => text).join(" ")).toContain(
      "All-day battery",
    );
    expect(fillText.mock.calls.map(([text]) => text).join(" ")).toContain(
      "5000mAh battery",
    );
    expect(context.fillRect).toHaveBeenCalled();
  });

  test("leaves non-copy visual assets untouched without requiring canvas APIs", async () => {
    await expect(
      renderContentTextOverlay({
        imageDataUrl: "data:image/png;base64,source",
        brief,
        shot: mainShot,
      }),
    ).resolves.toEqual({
      dataUrl: "data:image/png;base64,source",
      width: 0,
      height: 0,
      applied: false,
    });
  });
});
