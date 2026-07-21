import { jest } from "@jest/globals";
import {
  getManagedImagePrompt,
  listManagedImagePrompts,
  loadManagedPromptCatalog,
  loadManagedPromptSquareCatalog,
  setManagedImagePromptFavorite,
  useManagedImagePrompt,
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

  test("loads paginated managed image prompts from the dedicated BFF", async () => {
    const fetchMock = jest.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            items: [
              {
                id: 88,
                title: "电商主图",
                description: "白底商品图",
                prompt_text: "生成白底商品主图",
                models: ["gpt-image-2"],
                sizes: ["1024x1024"],
                reference_requirement: "optional",
                requires_reference: false,
                use_count: 7,
                favorite_count: 3,
                favorited: true,
              },
            ],
            total: 1,
            page: 2,
            page_size: 12,
            pages: 1,
          },
        }),
      };
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });

    await expect(
      listManagedImagePrompts({
        q: "product",
        favorite: true,
        page: 2,
        pageSize: 12,
        reference: "optional",
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 88,
          title: "电商主图",
          promptText: "生成白底商品主图",
          models: ["gpt-image-2"],
          sizes: ["1024x1024"],
          referenceRequirement: "optional",
          useCount: 7,
          favoriteCount: 3,
          favorited: true,
        }),
      ],
      total: 1,
      page: 2,
      pageSize: 12,
      pages: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nextchat/image-prompts?q=product&favorite=true&page=2&page_size=12&reference=optional",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
  });

  test("loads image prompt detail, favorite state, and use records", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            id: 88,
            title: "电商主图",
            prompt_text: "生成白底商品主图",
            models: ["gpt-image-2"],
            sizes: ["1024x1024"],
            requires_reference: true,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          data: { prompt_id: 88, favorited: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            prompt_id: 88,
            version: 3,
            title: "电商主图",
            prompt_text: "生成白底商品主图",
            models: ["gpt-image-2"],
            sizes: ["1024x1024"],
            reference_requirement: "required",
            requires_reference: true,
          },
        }),
      });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });

    await expect(getManagedImagePrompt(88)).resolves.toMatchObject({
      id: 88,
      promptText: "生成白底商品主图",
      requiresReference: true,
    });
    await expect(setManagedImagePromptFavorite(88, true)).resolves.toBe(true);
    await expect(useManagedImagePrompt(88)).resolves.toMatchObject({
      promptId: 88,
      version: 3,
      promptText: "生成白底商品主图",
      referenceRequirement: "required",
      requiresReference: true,
    });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/nextchat/image-prompts/88",
      "/api/nextchat/image-prompts/88/favorite",
      "/api/nextchat/image-prompts/88/use",
    ]);
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
  });
});
