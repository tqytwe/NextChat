import { jest } from "@jest/globals";
import { loadManagedPromptCatalog } from "../app/utils/managed-prompts";

describe("Sub2API managed prompts", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("loads chat prompts from the managed BFF catalog", async () => {
    const fetchMock = jest.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            chat_prompts: [
              {
                id: "ecommerce-copy",
                title: "电商文案",
                content: "输出商品标题和卖点。",
              },
            ],
          },
        }),
      };
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });

    await expect(loadManagedPromptCatalog()).resolves.toEqual([
      {
        id: "ecommerce-copy",
        title: "电商文案",
        content: "输出商品标题和卖点。",
        createdAt: 0,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nextchat/prompts",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
  });
});
