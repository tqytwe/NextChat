import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const database = new Map<string, unknown>();

jest.unstable_mockModule("idb-keyval", () => ({
  get: jest.fn(async (key: string) => database.get(key)),
  set: jest.fn(async (key: string, value: unknown) => {
    database.set(key, value);
  }),
  del: jest.fn(async (key: string) => {
    database.delete(key);
  }),
}));

const library = await import("../app/client/local-prompt-library");

type CatalogItem = {
  id: number;
  title: string;
  description?: string;
  prompt_text?: string;
  purpose?: string;
  featured?: boolean;
  version?: number;
  updated_at?: string;
  category_ids?: number[];
  media?: Array<{ media_type?: string; url?: string }>;
};

function success(data: unknown) {
  return {
    ok: true,
    status: 200,
    text: JSON.stringify({ code: 0, data }),
  };
}

function page(items: CatalogItem[], total = items.length, pages = 1) {
  return { items, total, page: 1, page_size: 100, pages };
}

function responseForCatalog(
  items: CatalogItem[],
  categories: Array<Record<string, unknown>> = [],
  details: Record<string, CatalogItem> = {},
  manifestRevision = "catalog-v1",
  catalogSupported = true,
) {
  return jest.fn(async (_base: string, path: string, _init: RequestInit, headers: Headers) => {
    if (path.startsWith("/api/v1/prompts/manifest?")) {
      if (headers.get("If-None-Match") === `\"${manifestRevision}\"`) {
        return { ok: false, status: 304, text: "" };
      }
      const mediaType = new URLSearchParams(path.split("?")[1]).get("media_type");
      return success({
        media_type: mediaType,
        revision: manifestRevision,
        total: items.length,
        updated_at: "2026-08-20T01:02:03Z",
      });
    }
    if (path.startsWith("/api/v1/prompts/catalog?")) {
      if (!catalogSupported) return { ok: false, status: 404, text: "" };
      const query = new URLSearchParams(path.split("?")[1] || "");
      const pageNumber = Number(query.get("page") || 1);
      const pageSize = Number(query.get("page_size") || 100);
      const start = (pageNumber - 1) * pageSize;
      const catalogItems = items.map((item) => ({
        ...item,
        ...(details[String(item.id)] || {}),
      }));
      return success({
        items: catalogItems.slice(start, start + pageSize),
        total: catalogItems.length,
        page: pageNumber,
        page_size: pageSize,
        pages: Math.max(1, Math.ceil(catalogItems.length / pageSize)),
      });
    }
    if (path.startsWith("/api/v1/prompts/catalog/delta?")) {
      return { ok: false, status: 404, text: "" };
    }
    const pageSize = new URLSearchParams(path.split("?")[1] || "").get(
      "page_size",
    );
    if (pageSize === "1") return success(page([items[0]].filter(Boolean), items.length));
    if (path === "/api/v1/prompt-categories") return success(categories);
    if (pageSize === "100") return success(page(items));
    const detail = path.match(/^\/api\/v1\/prompts\/(\d+)$/)?.[1];
    if (detail) return success(details[detail] || items.find((item) => String(item.id) === detail));
    throw new Error(`Unexpected request: ${path} (${headers.get("Accept-Language") || ""})`);
  });
}

describe("local prompt catalog", () => {
  beforeEach(() => {
    database.clear();
  });

  test("rejects Canvas as a video prompt source", async () => {
    await expect(
      library.syncLocalPromptCatalog(
        "user-canvas",
        "zh",
        "video",
        "https://api.example.test",
        "token",
        {},
        "canvas",
      ),
    ).rejects.toThrow("Canvas prompt catalog supports image prompts only");
  });

  test("does not use Canvas categories for video filtering", async () => {
    await expect(
      library.syncLocalPromptCatalog(
        "user-canvas-categories",
        "zh",
        "video",
        "https://api.example.test",
        "token",
        {},
        "canvas",
      ),
    ).rejects.toThrow("Canvas prompt catalog supports image prompts only");
  });

  test("does not treat a Canvas image cover as a video prompt", async () => {
    await expect(
      library.syncLocalPromptCatalog(
        "user-cover-error",
        "zh",
        "video",
        "https://api.example.test",
        "token",
        {},
        "canvas",
      ),
    ).rejects.toThrow("Canvas prompt catalog supports image prompts only");
  });

  test("downloads the complete image catalog and cover once, scoped to account and language", async () => {
    const item: CatalogItem = {
      id: 81,
      title: "城市海报",
      description: "夜景海报",
      purpose: "image",
      version: 4,
      updated_at: "2026-08-20T01:02:03Z",
      media: [{ media_type: "image", url: "https://cdn.example/cover-81.webp" }],
    };
    const requestText = responseForCatalog(
      [item],
      [{ id: 7, slug: "poster", name_zh: "海报", updated_at: "2026-08-20T01:00:00Z" }],
      { "81": { ...item, prompt_text: "霓虹灯下的城市海报" } },
    );
    const downloadBlob = jest.fn(async () => new Blob(["cover-81"], { type: "image/webp" }));

    const first = await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "access-token",
      { requestText, downloadBlob },
    );

    expect(first.changed).toBe(true);
    expect(first.downloadedCovers).toBe(1);
    expect(first.catalog.items).toHaveLength(1);
    expect(first.catalog.items[0]).toMatchObject({
      id: "81",
      prompt_text: "霓虹灯下的城市海报",
      category: "image",
    });
    expect(first.catalog.categories).toEqual([
      expect.objectContaining({ id: "poster", label: "海报" }),
    ]);
    expect(downloadBlob).toHaveBeenCalledWith(
      "https://cdn.example/cover-81.webp",
      "access-token",
      undefined,
    );
    expect(requestText.mock.calls[0][3].get("Authorization")).toBe(
      "Bearer access-token",
    );
    expect(requestText.mock.calls[0][3].get("Accept-Language")).toBe("zh");

    await expect(
      library.readLocalPromptCover("user-a", "zh", "image", "81"),
    ).resolves.toBeInstanceOf(Blob);
    await expect(
      library.readLocalPromptCatalog("user-b", "zh", "image"),
    ).resolves.toBeNull();
    await expect(
      library.readLocalPromptCatalog("user-a", "ja", "image"),
    ).resolves.toBeNull();

    const callsBeforeSecondSync = requestText.mock.calls.length;
    const second = await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "access-token",
      { requestText, downloadBlob },
    );
    expect(second.changed).toBe(false);
    expect(second.downloadedCovers).toBe(0);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(requestText.mock.calls).toHaveLength(callsBeforeSecondSync + 1);
    expect(requestText.mock.calls.slice(callsBeforeSecondSync).map((call) => call[1])).toEqual([
      "/api/v1/prompts/manifest?media_type=image&locale=zh",
    ]);
  });

  test("refreshes only changed prompt bodies and covers when the marker changes", async () => {
    const unchanged: CatalogItem = {
      id: 10,
      title: "保留提示词",
      prompt_text: "保留正文",
      purpose: "image",
      version: 1,
      updated_at: "2026-08-20T01:00:00Z",
      media: [{ media_type: "image", url: "https://cdn.example/keep.webp" }],
    };
    const changed: CatalogItem = {
      id: 11,
      title: "更新提示词",
      purpose: "image",
      version: 1,
      updated_at: "2026-08-20T01:00:01Z",
      media: [{ media_type: "image", url: "https://cdn.example/old.webp" }],
    };
    const firstRequests = responseForCatalog(
      [unchanged, changed],
      [],
      {
        "10": { ...unchanged, prompt_text: "保留正文" },
        "11": { ...changed, prompt_text: "旧正文" },
      },
      "catalog-v1",
    );
    const firstDownload = jest.fn(async (url: string) => new Blob([url]));
    await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "token",
      { requestText: firstRequests, downloadBlob: firstDownload },
    );

    const changedNext = {
      ...changed,
      version: 2,
      updated_at: "2026-08-20T01:03:00Z",
      media: [{ media_type: "image", url: "https://cdn.example/new.webp" }],
    };
    const nextRequests = responseForCatalog(
      [unchanged, changedNext],
      [],
      { "11": { ...changedNext, prompt_text: "新正文" } },
      "catalog-v2",
    );
    const nextDownload = jest.fn(async (url: string) => new Blob([url]));

    const next = await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "token",
      { requestText: nextRequests, downloadBlob: nextDownload },
    );

    expect(next.changed).toBe(true);
    expect(next.catalog.items.find((item) => item.id === "11")?.cover_url).toBe(
      "https://cdn.example/new.webp",
    );
    expect(next.downloadedCovers).toBe(1);
    expect(nextDownload).toHaveBeenCalledWith(
      "https://cdn.example/new.webp",
      "token",
      undefined,
    );
    expect(nextRequests.mock.calls.map((call) => call[1])).toContain(
      "/api/v1/prompts/catalog?media_type=image&page=1&page_size=100",
    );
    expect(nextRequests.mock.calls.map((call) => call[1])).not.toContain(
      "/api/v1/prompts/11",
    );
    expect(nextRequests.mock.calls.map((call) => call[1])).not.toContain(
      "/api/v1/prompts/10",
    );
    expect(next.catalog.items.find((item) => item.id === "11")?.prompt_text).toBe(
      "新正文",
    );
  });

  test("uses the delta contract after first install and only downloads changed covers", async () => {
    const unchanged: CatalogItem = {
      id: 40,
      title: "保留",
      prompt_text: "保留正文",
      purpose: "video",
      version: 1,
      updated_at: "2026-08-20T01:00:00Z",
      media: [{ media_type: "image", url: "https://cdn.example/keep.webp" }],
    };
    const removed: CatalogItem = {
      id: 41,
      title: "删除",
      prompt_text: "删除正文",
      purpose: "video",
      version: 1,
      updated_at: "2026-08-20T01:00:01Z",
      media: [{ media_type: "image", url: "https://cdn.example/remove.webp" }],
    };
    await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "video",
      "https://api.example.test",
      "token",
      {
        requestText: responseForCatalog(
          [unchanged, removed],
          [],
          {},
          "catalog-v1",
        ),
        downloadBlob: jest.fn(async (url: string) => new Blob([url])),
      },
    );

    const changed: CatalogItem = {
      id: 42,
      title: "新增",
      prompt_text: "新增正文",
      purpose: "video",
      version: 1,
      updated_at: "2026-08-20T01:03:00Z",
      media: [{ media_type: "image", url: "https://cdn.example/new.webp" }],
    };
    const paths: string[] = [];
    const requestText = jest.fn(async (_base: string, path: string, _init: RequestInit, headers: Headers) => {
      paths.push(path);
      if (path.startsWith("/api/v1/prompts/manifest?")) {
        expect(headers.get("If-None-Match")).toBe('"catalog-v1"');
        return success({
          media_type: "video",
          revision: "catalog-v2",
          total: 2,
          updated_at: "2026-08-20T01:03:00Z",
        });
      }
      if (path.startsWith("/api/v1/prompts/catalog/delta?")) {
        expect(headers.get("If-None-Match")).toBe('"catalog-v1"');
        expect(path).toContain("since=2026-08-20T01%3A02%3A03Z");
        return success({
          cursor: "2026-08-20T01:03:00Z",
          version: "catalog-v2",
          etag: "catalog-v2",
          items: [changed],
          deleted_ids: ["41"],
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const downloadBlob = jest.fn(async (url: string) => new Blob([url]));

    const next = await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "video",
      "https://api.example.test",
      "token",
      { requestText, downloadBlob },
    );

    expect(paths).toEqual([
      "/api/v1/prompts/manifest?media_type=video&locale=zh",
      "/api/v1/prompts/catalog/delta?media_type=video&since=2026-08-20T01%3A02%3A03Z",
    ]);
    expect(next.catalog.items.map((item) => item.id).sort()).toEqual(["40", "42"]);
    expect(next.catalog.cursor).toBe("2026-08-20T01:03:00Z");
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(downloadBlob).toHaveBeenCalledWith(
      "https://cdn.example/new.webp",
      "token",
      undefined,
    );
    await expect(
      library.readLocalPromptCover("user-a", "zh", "video", "41"),
    ).resolves.toBeNull();
  });

  test("maps numeric prompt category IDs to catalog slugs for client filtering", async () => {
    const item: CatalogItem = {
      id: 50,
      title: "海报提示词",
      prompt_text: "海报正文",
      purpose: "image",
      category_ids: [7],
      version: 1,
      updated_at: "2026-08-20T04:00:00Z",
      media: [{ media_type: "image", url: "https://cdn.example/poster.webp" }],
    };
    const result = await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "token",
      {
        requestText: responseForCatalog(
          [item],
          [{ id: 7, slug: "poster", name_zh: "海报" }],
        {},
        "catalog-category-v1",
        true,
        ),
        downloadBlob: jest.fn(async () => new Blob(["cover"])),
      },
    );

    expect(result.catalog.items[0]).toMatchObject({
      category: "poster",
      categories: ["poster"],
    });
  });

  test("repairs an evicted cover instead of accepting an unchanged manifest", async () => {
    const item: CatalogItem = {
      id: 12,
      title: "可修复封面",
      purpose: "image",
      version: 1,
      updated_at: "2026-08-20T01:00:00Z",
      media: [{ media_type: "image", url: "https://cdn.example/repair.webp" }],
    };
    const firstRequests = responseForCatalog(
      [item],
      [],
      { "12": { ...item, prompt_text: "修复封面" } },
      "catalog-repair-v1",
    );
    await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "token",
      {
        requestText: firstRequests,
        downloadBlob: jest.fn(async () => new Blob(["cover"])),
      },
    );
    database.delete("jisudeng-local-prompt-cover:v1:user-a:zh:image:12");

    const repairDownload = jest.fn(async () => new Blob(["repaired-cover"]));
    const repairRequests = responseForCatalog(
      [item],
      [],
      { "12": { ...item, prompt_text: "修复封面" } },
      "catalog-repair-v1",
    );
    const repaired = await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "token",
      { requestText: repairRequests, downloadBlob: repairDownload },
    );

    expect(repaired.changed).toBe(true);
    expect(repaired.downloadedCovers).toBe(1);
    expect(repairRequests.mock.calls[0][1]).toBe(
      "/api/v1/prompts/manifest?media_type=image&locale=zh",
    );
    expect(repairRequests.mock.calls[0][3].get("If-None-Match")).toBeNull();
    await expect(
      library.readLocalPromptCover("user-a", "zh", "image", "12"),
    ).resolves.toBeInstanceOf(Blob);
  });

  test("keeps the cached directory usable when the lightweight update check is offline", async () => {
    const item: CatalogItem = {
      id: 3,
      title: "离线提示词",
      purpose: "video",
      version: 1,
      updated_at: "2026-08-20T01:00:00Z",
      media: [{ media_type: "image", url: "https://cdn.example/video-cover.webp" }],
    };
    await library.syncLocalPromptCatalog(
      "user-a",
      "ko",
      "video",
      "https://api.example.test",
      "token",
      {
        requestText: responseForCatalog(
          [item],
          [],
          { "3": { ...item, prompt_text: "비디오 프롬프트" } },
        ),
        downloadBlob: jest.fn(async () => new Blob(["cover"])),
      },
    );

    const offline = await library.syncLocalPromptCatalog(
      "user-a",
      "ko",
      "video",
      "https://api.example.test",
      "token",
      {
        requestText: jest.fn(async () => {
          throw new TypeError("network offline");
        }),
      },
    );

    expect(offline.fromCache).toBe(true);
    expect(offline.offline).toBe(true);
    expect(offline.catalog.items[0]).toMatchObject({
      id: "3",
      prompt_text: "비디오 프롬프트",
    });
  });

  test("refreshes a cover when its media URL changes without a version bump", async () => {
    const original: CatalogItem = {
      id: 21,
      title: "媒体封面",
      purpose: "image",
      version: 1,
      updated_at: "2026-08-20T02:00:00Z",
      media: [{ media_type: "image", url: "https://cdn.example/old.webp" }],
    };
    await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "token",
      {
        requestText: responseForCatalog(
          [original],
          [],
          { "21": { ...original, prompt_text: "原始正文" } },
          "catalog-cover-v1",
        ),
        downloadBlob: jest.fn(async () => new Blob(["old-cover"])),
      },
    );
    const changed = {
      ...original,
      media: [{ media_type: "image", url: "https://cdn.example/new.webp" }],
    };
    const requestText = responseForCatalog(
      [changed],
      [],
      { "21": { ...changed, prompt_text: "更新正文" } },
      "catalog-cover-v2",
    );
    const downloadBlob = jest.fn(async (url: string) => new Blob([url]));
    const result = await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "token",
      { requestText, downloadBlob },
    );
    expect(result.changed).toBe(true);
    expect(result.catalog.items[0]).toMatchObject({
      id: "21",
      cover_url: "https://cdn.example/new.webp",
      prompt_text: "更新正文",
    });
    expect(downloadBlob).toHaveBeenCalledWith(
      "https://cdn.example/new.webp",
      "token",
      undefined,
    );
  });

  test("falls back to legacy list and detail requests when catalog endpoint is unavailable", async () => {
    const item: CatalogItem = {
      id: 31,
      title: "兼容旧服务",
      purpose: "image",
      version: 1,
      updated_at: "2026-08-20T02:00:00Z",
      media: [{ media_type: "image", url: "https://cdn.example/legacy.webp" }],
    };
    const requestText = responseForCatalog(
      [item],
      [],
      { "31": { ...item, prompt_text: "旧服务正文" } },
      "legacy-v1",
      false,
    );
    const result = await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "token",
      {
        requestText,
        downloadBlob: jest.fn(async () => new Blob(["cover"])),
      },
    );

    expect(result.catalog.items[0].prompt_text).toBe("旧服务正文");
    expect(requestText.mock.calls.map((call) => call[1])).toContain(
      "/api/v1/prompts/31",
    );
    expect(requestText.mock.calls.map((call) => call[1])).toContain(
      "/api/v1/prompts/catalog?media_type=image&page=1&page_size=100",
    );
  });

  test("limits concurrent cover downloads while caching the complete catalog", async () => {
    const items = Array.from({ length: 14 }, (_, index) => ({
      id: index + 100,
      title: `提示词 ${index}`,
      purpose: "image",
      version: 1,
      updated_at: `2026-08-20T03:00:${String(index).padStart(2, "0")}Z`,
      media: [{ media_type: "image", url: `https://cdn.example/${index}.webp` }],
      prompt_text: `正文 ${index}`,
    }));
    let active = 0;
    let peak = 0;
    const downloadBlob = jest.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return new Blob(["cover"]);
    });
    const result = await library.syncLocalPromptCatalog(
      "user-a",
      "zh",
      "image",
      "https://api.example.test",
      "token",
      { requestText: responseForCatalog(items), downloadBlob },
    );

    expect(result.catalog.items).toHaveLength(items.length);
    expect(result.downloadedCovers).toBe(items.length);
    expect(peak).toBeLessThanOrEqual(6);
    await expect(library.readLocalPromptCatalog("user-a", "zh", "image")).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ id: "100", prompt_text: "正文 0" })]),
    });
  });
});
