import {
  buildSub2APIImageStudioGeneratePayload,
  isSub2APIManagedImageExpired,
  mergeSub2APIImageStudioDraws,
  normalizeSub2APIImageStudioAssetURL,
  useSdStore,
} from "../app/store/sd";
import { useManagedWorkspaceStore } from "../app/store/managed-workspace";
import { Path } from "../app/constant";
import {
  downloadManagedImage,
  getImageStudioBackPath,
} from "../app/utils/managed-image-studio-ui";
import { getModelParamBasicData } from "../app/components/sd/sd-panel";
import { jest } from "@jest/globals";

describe("Sub2API managed image studio helpers", () => {
  test("builds a one-day retained image studio payload", () => {
    const payload = buildSub2APIImageStudioGeneratePayload({
      model: "gpt-image-1.5",
      params: {
        prompt: "clean product photo",
        template_id: "ecom-white-bg",
        size: "1024x1536",
        count: 8,
        quality: "high",
        output_format: "webp",
      },
    });

    expect(payload).toEqual({
      template_id: "ecom-white-bg",
      user_prompt: "clean product photo",
      size: "1024x1536",
      aspect: "2:3",
      tier: "1K",
      count: 4,
      model: "gpt-image-1.5",
      quality: "high",
      output_format: "webp",
      retain_days: 1,
    });
  });

  test("resolves aspect and resolution into a Sub2API image size", () => {
    const payload = buildSub2APIImageStudioGeneratePayload({
      model: "grok-imagine-image",
      params: {
        prompt: "wide campaign visual",
        aspect: "16:9",
        resolution: "2K",
        count: 1,
        quality: "standard",
        output_format: "jpeg",
      },
    });

    expect(payload).toMatchObject({
      size: "3584x2048",
      aspect: "16:9",
      tier: "2K",
      output_format: "jpeg",
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

  test("preserves hidden prompt-square image template ids while normalizing params", () => {
    const params = getModelParamBasicData(
      [{ name: "Prompt", value: "prompt", type: "textarea", default: "" }],
      { prompt: "product photo", template_id: "ecom-white-bg" },
    );

    expect(params).toMatchObject({
      prompt: "product photo",
      template_id: "ecom-white-bg",
    });
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

  test("returns from managed image studio to chat instead of browser history", () => {
    expect(getImageStudioBackPath(true)).toBe(Path.Chat);
    expect(getImageStudioBackPath(false)).toBe(Path.Home);
  });

  test("downloads every managed image asset instead of only the first one", () => {
    const createdLinks: HTMLAnchorElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    const click = jest.fn();
    jest.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === "a") {
        Object.defineProperty(element, "click", {
          value: click,
          configurable: true,
        });
        createdLinks.push(element as HTMLAnchorElement);
      }
      return element;
    });

    downloadManagedImage({
      id: "draw-1",
      job_id: "job-1",
      assets: [
        { id: "a", download_url: "/api/nextchat/image-studio/assets/a" },
        { id: "b", url: "/api/nextchat/image-studio/assets/b" },
      ],
    });

    expect(click).toHaveBeenCalledTimes(2);
    expect(createdLinks.map((link) => link.href)).toEqual([
      "http://localhost/api/nextchat/image-studio/assets/a",
      "http://localhost/api/nextchat/image-studio/assets/b",
    ]);
    expect(createdLinks.map((link) => link.download)).toEqual([
      "job-1-1.png",
      "job-1-2.png",
    ]);

    jest.restoreAllMocks();
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

  test("clears stale managed image models when model loading fails", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => ({
        ok: false,
        json: async () => ({
          code: 400,
          message: "image generation is not enabled for this group",
        }),
      })),
      configurable: true,
    });
    useSdStore.setState({
      currentModel: { name: "old", value: "old-image-model" },
      sub2apiImageStudioModels: [{ id: "old-image-model" }],
      sub2apiImageStudioModelsError: "",
    } as any);

    await expect(
      useSdStore.getState().fetchSub2APIImageStudioModels(),
    ).resolves.toEqual([]);

    const state = useSdStore.getState();
    expect(state.sub2apiImageStudioModels).toEqual([]);
    expect(state.currentModel.value).not.toBe("old-image-model");
    expect(state.sub2apiImageStudioModelsError).toBe(
      "当前分组未开启图片生成，请切换到支持图片的分组",
    );

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("clears managed image library state when switching groups", () => {
    useSdStore.setState({
      currentId: 10,
      draw: [{ id: "job-old", job_id: "old", status: "success" }],
      sub2apiImageStudioReferences: [{ id: "ref-old" }],
      sub2apiImageStudioJobsError: "old error",
    } as any);

    useSdStore.getState().resetSub2APIImageStudioForGroupSwitch();

    const state = useSdStore.getState();
    expect(state.draw).toEqual([]);
    expect(state.sub2apiImageStudioReferences).toEqual([]);
    expect(state.sub2apiImageStudioJobsError).toBe("");
    expect(state.currentId).toBe(11);
  });

  test("replaces remote managed image jobs and preserves local pending items", () => {
    const merged = mergeSub2APIImageStudioDraws(
      [
        {
          id: "local-pending",
          status: "running",
          params: { prompt: "local" },
        },
        {
          id: "job-old",
          job_id: "old",
          status: "success",
          params: { prompt: "old group" },
        },
      ],
      [
        {
          id: "job-new",
          job_id: "new",
          status: "success",
          params: { prompt: "new group" },
        },
      ],
    );

    expect(merged.map((item) => item.id)).toEqual(["local-pending", "job-new"]);
  });

  test("ignores stale managed image jobs returned after a group switch", async () => {
    const originalFetch = globalThis.fetch;
    let resolveFetch: (value: any) => void = () => {};
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
      configurable: true,
    });
    useSdStore.setState({
      currentId: 30,
      draw: [{ id: "job-old", job_id: "old", status: "success" }],
      sub2apiImageStudioRequestGeneration: 0,
    } as any);

    const request = useSdStore.getState().fetchSub2APIImageStudioJobs();
    useSdStore.getState().resetSub2APIImageStudioForGroupSwitch();
    resolveFetch({
      ok: true,
      json: async () => ({
        code: 0,
        data: {
          jobs: [
            {
              id: "old",
              model: "old-model",
              status: "completed",
              assets: [{ id: "old-asset" }],
            },
          ],
        },
      }),
    });

    await expect(request).resolves.toEqual([]);
    expect(useSdStore.getState().draw).toEqual([]);

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("ignores stale managed image generation responses after switching groups", async () => {
    const originalFetch = globalThis.fetch;
    let resolveFetch: (value: any) => void = () => {};
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
      configurable: true,
    });
    useManagedWorkspaceStore.setState({
      bootstrap: {
        models: {
          selected_group_id: 1,
          groups: [{ id: 1, name: "old" }],
        },
      },
    } as any);
    useSdStore.setState({
      currentId: 50,
      draw: [{ id: "local-generate", status: "running" }],
    } as any);

    const request = useSdStore.getState().sub2apiImageStudioRequestCall({
      id: "local-generate",
      model: "gpt-image-2",
      model_name: "GPT Image 2",
      status: "running",
      params: { prompt: "old group image" },
    });
    useManagedWorkspaceStore.setState({
      bootstrap: {
        models: {
          selected_group_id: 2,
          groups: [{ id: 2, name: "new" }],
        },
      },
    } as any);
    useSdStore.getState().resetSub2APIImageStudioForGroupSwitch();
    resolveFetch(
      makeSub2APIImageStudioResponse({
        job: {
          id: "old-job",
          model: "gpt-image-2",
          status: "completed",
          assets: [{ id: "old-asset" }],
        },
      }),
    );

    await expect(request).resolves.toBeUndefined();
    expect(useSdStore.getState().draw).toEqual([]);

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("updates refreshed remote image jobs by job id while polling continues", () => {
    useSdStore.setState({
      draw: [
        {
          id: "job-job-1",
          job_id: "job-1",
          status: "running",
          params: { prompt: "remote" },
        },
      ],
    } as any);

    useSdStore.getState().updateDraw({
      id: "local-running-id",
      job_id: "job-1",
      status: "success",
      img_data: "/api/nextchat/image-studio/assets/asset-1/content",
    });

    expect(useSdStore.getState().draw).toEqual([
      expect.objectContaining({
        id: "job-job-1",
        job_id: "job-1",
        status: "success",
        img_data: "/api/nextchat/image-studio/assets/asset-1/content",
      }),
    ]);
  });

  test("loads remote jobs into the managed creation library", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => ({
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            jobs: [
              {
                id: "job-1",
                model: "gpt-image-2",
                status: "completed",
                user_prompt: "fresh product photo",
                created_at: "2026-07-20T09:00:00Z",
                expires_at: "2026-07-21T09:00:00Z",
                size: "1024x1024",
                count: 1,
                assets: [{ id: "asset-1" }],
              },
            ],
          },
        }),
      })),
      configurable: true,
    });
    useSdStore.setState({
      currentId: 20,
      draw: [
        {
          id: "local-pending",
          status: "running",
          params: { prompt: "local" },
        },
        {
          id: "job-stale",
          job_id: "stale",
          status: "success",
          params: { prompt: "stale" },
        },
      ],
      sub2apiImageStudioJobsError: "",
    } as any);

    await expect(
      useSdStore.getState().fetchSub2APIImageStudioJobs(),
    ).resolves.toHaveLength(1);

    const state = useSdStore.getState();
    expect(state.currentId).toBe(21);
    expect(state.sub2apiImageStudioJobsError).toBe("");
    expect(state.draw.map((item: any) => item.id)).toEqual([
      "local-pending",
      "job-job-1",
    ]);
    expect(state.draw[1]).toMatchObject({
      status: "success",
      job_id: "job-1",
      model_name: "gpt-image-2",
      params: {
        prompt: "fresh product photo",
        size: "1024x1024",
        count: 1,
      },
    });
    expect(state.draw[1].img_data).toBe(
      "/api/nextchat/image-studio/assets/asset-1/content",
    );

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("continues polling running remote jobs after loading the creation library", async () => {
    const originalFetch = globalThis.fetch;
    jest.useFakeTimers();
    Object.defineProperty(globalThis, "fetch", {
      value: jest
        .fn()
        .mockResolvedValueOnce(
          makeSub2APIImageStudioResponse({
            jobs: [
              {
                id: "job-running",
                model: "gpt-image-2",
                status: "running",
                user_prompt: "pending poster",
                created_at: "2026-07-20T09:00:00Z",
                expires_at: "2026-07-21T09:00:00Z",
                size: "1024x1024",
                count: 1,
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          makeSub2APIImageStudioResponse({
            id: "job-running",
            model: "gpt-image-2",
            status: "completed",
            user_prompt: "pending poster",
            assets: [{ id: "asset-done" }],
          }),
        ),
      configurable: true,
    });
    useSdStore.setState({
      currentId: 40,
      draw: [],
      sub2apiImageStudioRequestGeneration: 0,
      sub2apiImageStudioJobsError: "",
    } as any);

    await expect(
      useSdStore.getState().fetchSub2APIImageStudioJobs(),
    ).resolves.toHaveLength(1);
    expect(useSdStore.getState().draw[0]).toMatchObject({
      job_id: "job-running",
      status: "running",
    });

    await jest.runOnlyPendingTimersAsync();

    expect(useSdStore.getState().draw[0]).toMatchObject({
      job_id: "job-running",
      status: "success",
      img_data: "/api/nextchat/image-studio/assets/asset-done/content",
    });

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
    jest.useRealTimers();
  });

  test("keeps a managed image job visible when deletion fails", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => ({
        ok: false,
        json: async () => ({
          code: 500,
          message: "delete failed",
        }),
      })),
      configurable: true,
    });
    useSdStore.setState({
      draw: [{ id: "job-job-1", job_id: "job-1", status: "success" }],
      sub2apiImageStudioJobsError: "",
    } as any);

    await expect(
      useSdStore.getState().deleteSub2APIImageStudioJob("job-1"),
    ).rejects.toThrow("delete failed");

    expect(useSdStore.getState().draw).toEqual([
      expect.objectContaining({ job_id: "job-1", status: "success" }),
    ]);
    expect(useSdStore.getState().sub2apiImageStudioJobsError).toBe(
      "delete failed",
    );

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("keeps managed image job load failures visible", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => ({
        ok: false,
        json: async () => ({
          code: 500,
          message: "job database unavailable",
        }),
      })),
      configurable: true,
    });
    useSdStore.setState({
      sub2apiImageStudioJobsError: "",
    } as any);

    await expect(
      useSdStore.getState().fetchSub2APIImageStudioJobs(),
    ).resolves.toEqual([]);

    expect(useSdStore.getState().sub2apiImageStudioJobsError).toBe(
      "job database unavailable",
    );

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });
});

function makeSub2APIImageStudioResponse(data: any) {
  return {
    ok: true,
    json: async () => ({
      code: 0,
      data,
    }),
  };
}
