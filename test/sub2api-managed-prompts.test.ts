import { jest } from "@jest/globals";
import {
  loadManagedPromptCatalog,
  loadManagedPromptSquareCatalog,
} from "../app/utils/managed-prompts";

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

  test("loads prompt square chat prompts and image templates", async () => {
    const fetchMock = jest.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            chat_prompts: [
              {
                id: "general-assistant",
                title: "通用助手",
                description: "日常问答",
                content: "请清晰回答。",
                category: "chat",
              },
            ],
            image_templates: {
              intents: [
                {
                  id: "ecommerce",
                  label: { zh: "电商主图", en: "E-commerce" },
                  templates: [
                    {
                      id: "ecom-white-bg",
                      label: { zh: "白底主图", en: "White background" },
                      description: { zh: "主体居中", en: "Centered product" },
                      defaults: { size: "1024x1024", count: 4 },
                      preview_emoji: "box",
                    },
                  ],
                },
              ],
            },
          },
        }),
      };
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });

    await expect(loadManagedPromptSquareCatalog()).resolves.toEqual({
      chatPrompts: [
        {
          id: "general-assistant",
          title: "通用助手",
          description: "日常问答",
          category: "chat",
          content: "请清晰回答。",
          createdAt: 0,
        },
      ],
      imageTemplates: [
        {
          id: "ecom-white-bg",
          title: "白底主图",
          description: "主体居中",
          category: "ecommerce",
          categoryLabel: "电商主图",
          previewEmoji: "box",
          defaults: { size: "1024x1024", count: 4 },
        },
      ],
    });
  });
});
