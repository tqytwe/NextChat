import {
  buildSub2APIImageStudioGeneratePayload,
  canSub2APIImageStudioUseReferences,
  getSub2APIImageStudioReferenceLimit,
  isSub2APIImageStudioDrawActive,
  isSub2APIManagedImageExpired,
  mergeSub2APIImageStudioDraws,
  normalizeSub2APIImageStudioAssetURL,
  useSdStore,
} from "../app/store/sd";
import { useManagedWorkspaceStore } from "../app/store/managed-workspace";
import { Path } from "../app/constant";
import {
  fetchManagedImageAssetBlob,
  downloadManagedImage,
  getManagedImageAssetMessage,
  getImageStudioBackPath,
  isManagedImageAssetExpiredError,
  ManagedImageAssetError,
  summarizeManagedImageItems,
} from "../app/utils/managed-image-studio-ui";
import {
  getModelParamBasicData,
  getSub2APIImageStudioParams,
} from "../app/components/sd/sd-panel";
import { jest } from "@jest/globals";

describe("Sub2API managed image studio helpers", () => {
  test("builds an image studio payload without frontend-owned retention", () => {
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
    });
    expect(payload).not.toHaveProperty("retain_days");
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

  test("omits reference ids for create-only models and clamps edit models", () => {
    const createOnlyPayload = buildSub2APIImageStudioGeneratePayload(
      {
        model: "agnes-2.1",
        params: {
          prompt: "draw only",
          reference_ids: ["ref-1"],
          input_fidelity: "high",
        },
      },
      {
        id: "agnes-2.1",
        operations: ["create"],
        max_reference_images: 2,
      },
    );
    const editPayload = buildSub2APIImageStudioGeneratePayload(
      {
        model: "gpt-image-2",
        params: {
          prompt: "edit one reference",
          reference_ids: ["ref-1", "ref-2"],
          input_fidelity: "high",
        },
      },
      {
        id: "gpt-image-2",
        operations: ["create", "edit"],
        max_reference_images: 1,
      },
    );

    expect(createOnlyPayload).not.toHaveProperty("reference_ids");
    expect(createOnlyPayload).not.toHaveProperty("input_fidelity");
    expect(editPayload.reference_ids).toEqual(["ref-1"]);
    expect(editPayload.input_fidelity).toBe("high");
  });

  test("keeps fixed-size model requests free of aspect controls and references", () => {
    const payload = buildSub2APIImageStudioGeneratePayload(
      {
        model: "agnes-image-2.0-flash",
        params: {
          prompt: "fixed square product photo",
          size: "1024x1024",
          aspect: "16:9",
          resolution: "2K",
          reference_ids: ["ref-1"],
        },
      },
      {
        id: "agnes-image-2.0-flash",
        operations: ["create"],
        sizing_kind: "fixed",
        supported_sizes: ["1024x1024"],
        default_size: "1024x1024",
        max_reference_images: 0,
      },
    );

    expect(payload).toMatchObject({
      model: "agnes-image-2.0-flash",
      size: "1024x1024",
      count: 1,
    });
    expect(payload).not.toHaveProperty("aspect");
    expect(payload).not.toHaveProperty("tier");
    expect(payload).not.toHaveProperty("reference_ids");
  });

  test("omits output format for models without output format capability", () => {
    const model = {
      id: "agnes-image-2.1-flash",
      operations: ["create"],
      sizing_kind: "aspect_resolution",
      supported_aspect_ratios: ["1:1", "16:9"],
      supported_resolutions: ["1k", "2k"],
      supported_output_formats: [],
      max_reference_images: 0,
    };
    const payload = buildSub2APIImageStudioGeneratePayload(
      {
        model: "agnes-image-2.1-flash",
        params: {
          prompt: "clean product photo",
          aspect: "1:1",
          resolution: "1K",
          output_format: "png",
          output_compression: 80,
        },
      },
      model,
    );
    const columns = getSub2APIImageStudioParams(model, {
      output_format: "png",
    });
    const normalized = getModelParamBasicData(columns, {
      prompt: "clean product photo",
      output_format: "png",
    });

    expect(payload).toMatchObject({
      model: "agnes-image-2.1-flash",
      size: "1024x1024",
      aspect: "1:1",
      tier: "1K",
    });
    expect(payload).not.toHaveProperty("output_format");
    expect(payload).not.toHaveProperty("output_compression");
    expect(columns.some((item) => item.value === "output_format")).toBe(false);
    expect(normalized).not.toHaveProperty("output_format");
  });

  test("uses model sizing_kind for fixed and custom image studio controls", () => {
    const fixed = getSub2APIImageStudioParams({
      id: "agnes-2.0",
      operations: ["create"],
      sizing_kind: "fixed",
      supported_sizes: ["1024x1024"],
      default_size: "1024x1024",
      max_reference_images: 0,
    });
    const custom = getSub2APIImageStudioParams({
      id: "custom-image",
      operations: ["create"],
      sizing_kind: "custom",
      supported_sizes: ["768x1344", "1344x768"],
      default_size: "1344x768",
      max_reference_images: 0,
    });

    expect(fixed.find((item) => item.value === "size")).toMatchObject({
      type: "readonly",
      default: "1024x1024",
    });
    expect(fixed.some((item) => item.value === "aspect")).toBe(false);
    expect(fixed.some((item) => item.value === "resolution")).toBe(false);
    expect(custom.find((item) => item.value === "size")).toMatchObject({
      type: "select",
      default: "1344x768",
      options: [
        { name: "768x1344", value: "768x1344" },
        { name: "1344x768", value: "1344x768" },
      ],
    });
  });

  test("exposes references only for edit-capable models with a positive limit", () => {
    const createOnly = {
      id: "agnes-2.1",
      operations: ["create"],
      max_reference_images: 2,
    };
    const editCapable = {
      id: "gpt-image-2",
      operations: ["create", "edit"],
      max_reference_images: 3,
    };

    expect(canSub2APIImageStudioUseReferences(createOnly)).toBe(false);
    expect(getSub2APIImageStudioReferenceLimit(createOnly)).toBe(2);
    expect(canSub2APIImageStudioUseReferences(editCapable)).toBe(true);
    expect(getSub2APIImageStudioReferenceLimit(editCapable)).toBe(3);
  });

  test("honors background transparency and output compression capabilities", () => {
    const columns = getSub2APIImageStudioParams(
      {
        id: "gpt-image-2",
        operations: ["create", "edit"],
        sizing_kind: "aspect_resolution",
        supported_aspect_ratios: ["1:1"],
        supported_resolutions: ["1k"],
        supported_backgrounds: ["auto", "transparent"],
        supports_transparency: false,
        supported_output_formats: ["png", "webp"],
        default_output_format: "webp",
        output_compression: {
          min: 20,
          max: 90,
          formats: ["webp"],
        },
      },
      { output_format: "webp" },
    );

    expect(
      columns.find((item) => item.value === "background")?.options,
    ).toEqual([{ name: "Auto", value: "auto" }]);
    expect(
      columns.find((item) => item.value === "output_compression"),
    ).toMatchObject({
      min: 20,
      max: 90,
    });
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
    expect(
      normalizeSub2APIImageStudioAssetURL(
        "/api/v1/nextchat/image-studio/assets/asset-1/thumbnail?token=old",
      ),
    ).toBe(
      "/api/nextchat/image-studio/assets/asset-1/thumbnail?token=old",
    );
    expect(
      normalizeSub2APIImageStudioAssetURL(
        "https://www.jisudeng.com/api/v1/nextchat/image-studio/assets/asset-1/content",
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

  test("downloads multi-image managed jobs through a single ZIP blob", async () => {
    const originalFetch = globalThis.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createdLinks: HTMLAnchorElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    const click = jest.fn();
    const onMultiDownload = jest.fn();
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => {
        return makeAssetFetchResponse({
          status: 200,
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="job-1.zip"',
          },
          blob: new Blob(["zip-bytes"], { type: "application/zip" }),
        });
      }),
      configurable: true,
    });
    Object.defineProperty(URL, "createObjectURL", {
      value: jest.fn(() => "blob:managed-zip"),
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: jest.fn(),
      configurable: true,
    });
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

    await downloadManagedImage(
      {
        id: "draw-1",
        job_id: "job-1",
        assets: [
          { id: "a", download_url: "/api/nextchat/image-studio/assets/a" },
          { id: "b", url: "/api/nextchat/image-studio/assets/b" },
        ],
      },
      onMultiDownload,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/nextchat/image-studio/jobs/job-1/download",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(createdLinks.map((link) => link.href)).toEqual(["blob:managed-zip"]);
    expect(createdLinks[0].download).toBe("job-1.zip");
    expect(onMultiDownload).toHaveBeenCalledWith(2);

    jest.restoreAllMocks();
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
    Object.defineProperty(URL, "createObjectURL", {
      value: originalCreateObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: originalRevokeObjectURL,
      configurable: true,
    });
  });

  test("classifies expired asset responses as 410 asset errors", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => {
        return makeAssetFetchResponse({
          status: 410,
          headers: { "Content-Type": "application/json" },
          json: {
            code: "IMAGE_STUDIO_ASSET_EXPIRED",
            message: "asset expired",
          },
        });
      }),
      configurable: true,
    });

    await expect(
      fetchManagedImageAssetBlob("/asset/content", { kind: "image" }),
    ).rejects.toMatchObject({
      name: "ManagedImageAssetError",
      status: 410,
      code: "IMAGE_STUDIO_ASSET_EXPIRED",
      retryable: false,
    } satisfies Partial<ManagedImageAssetError>);

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("maps managed asset errors to user-facing preview messages", () => {
    expect(
      getManagedImageAssetMessage(
        new ManagedImageAssetError("asset expired", {
          status: 410,
          code: "IMAGE_STUDIO_ASSET_EXPIRED",
        }),
      ),
    ).toBe("图片已过期");
    expect(
      getManagedImageAssetMessage(
        new ManagedImageAssetError("storage unavailable", {
          status: 503,
          code: "IMAGE_STUDIO_ASSET_UNAVAILABLE",
        }),
      ),
    ).toBe("图片暂时不可用");
    expect(
      getManagedImageAssetMessage(
        new ManagedImageAssetError("unauthorized", { status: 401 }),
      ),
    ).toBe("登录已失效，请重新进入工作台");
    expect(
      isManagedImageAssetExpiredError(
        new ManagedImageAssetError("asset expired", {
          status: 410,
          code: "IMAGE_STUDIO_ASSET_EXPIRED",
        }),
      ),
    ).toBe(true);
  });

  test("rejects successful asset responses with the wrong MIME type", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => {
        return makeAssetFetchResponse({
          status: 200,
          headers: { "Content-Type": "application/json" },
          blob: new Blob([JSON.stringify({ code: 0 })], {
            type: "application/json",
          }),
        });
      }),
      configurable: true,
    });

    await expect(
      fetchManagedImageAssetBlob("/asset/content", { kind: "image" }),
    ).rejects.toMatchObject({
      name: "ManagedImageAssetError",
      status: 200,
      retryable: false,
    } satisfies Partial<ManagedImageAssetError>);

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
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

  test("replaces remote managed image jobs by default and preserves local submitting items", () => {
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

  test("preserves known active jobs when active loading is unavailable", () => {
    const merged = mergeSub2APIImageStudioDraws(
      [
        {
          id: "job-active",
          job_id: "active",
          status: "running",
          sub2api_status: "running",
          params: { prompt: "active" },
        },
        {
          id: "job-stale",
          job_id: "stale",
          status: "success",
          params: { prompt: "old terminal" },
        },
      ],
      [
        {
          id: "job-history",
          job_id: "history",
          status: "success",
          sub2api_status: "completed",
          params: { prompt: "history" },
        },
      ],
      { preserveExistingActive: true },
    );

    expect(merged.map((item) => item.id)).toEqual([
      "job-active",
      "job-history",
    ]);
  });

  test("preserves known terminal jobs when history loading is unavailable", () => {
    const merged = mergeSub2APIImageStudioDraws(
      [
        {
          id: "job-terminal",
          job_id: "terminal",
          status: "success",
          sub2api_status: "completed",
          params: { prompt: "terminal" },
        },
        {
          id: "job-old-active",
          job_id: "old-active",
          status: "running",
          sub2api_status: "running",
          params: { prompt: "old active" },
        },
      ],
      [
        {
          id: "job-active",
          job_id: "active",
          status: "running",
          sub2api_status: "running",
          params: { prompt: "active" },
        },
      ],
      { preserveExistingTerminal: true },
    );

    expect(merged.map((item) => item.id)).toEqual([
      "job-terminal",
      "job-active",
    ]);
  });

  test("ignores stale managed image jobs returned after a group switch", async () => {
    const originalFetch = globalThis.fetch;
    const resolveFetches: Array<(value: any) => void> = [];
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(
        () =>
          new Promise((resolve) => {
            resolveFetches.push(resolve);
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
    resolveFetches.forEach((resolve) =>
      resolve(makeSub2APIImageStudioResponse({ jobs: [] })),
    );

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

  test("delays managed submit cleanup callback until generation accepts references", async () => {
    const originalFetch = globalThis.fetch;
    const restoreManagedConfig = installManagedClientConfig();
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
    const okCall = jest.fn();
    useSdStore.setState({
      currentId: 60,
      draw: [],
    } as any);

    const request = useSdStore.getState().sendTask(
      {
        model: "gpt-image-2",
        model_name: "GPT Image 2",
        status: "wait",
        params: {
          prompt: "edit this reference",
          reference_ids: ["ref-1"],
        },
      },
      okCall,
    );

    await Promise.resolve();
    expect(okCall).not.toHaveBeenCalled();

    resolveFetch(
      makeSub2APIImageStudioResponse({
        job: {
          id: "job-reference-safe",
          model: "gpt-image-2",
          status: "completed",
          assets: [{ id: "asset-reference-safe" }],
        },
      }),
    );

    await expect(request).resolves.toBeUndefined();
    expect(okCall).toHaveBeenCalledTimes(1);

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
    restoreManagedConfig();
  });

  test("uses the submitted managed model capability when pruning references", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(async () =>
      makeSub2APIImageStudioResponse({
        job: {
          id: "job-retry-model",
          model: "gpt-image-2",
          status: "completed",
          assets: [{ id: "asset-retry-model" }],
        },
      }),
    );
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });
    useSdStore.setState({
      currentModel: {
        name: "Agnes 2.1",
        value: "agnes-image-2.1-flash",
        sub2apiModel: {
          id: "agnes-image-2.1-flash",
          operations: ["create"],
          max_reference_images: 0,
        },
      },
      sub2apiImageStudioModels: [
        {
          id: "gpt-image-2",
          operations: ["create", "edit"],
          max_reference_images: 2,
        },
      ],
    } as any);

    await useSdStore.getState().sub2apiImageStudioRequestCall({
      id: "retry-with-reference",
      model: "gpt-image-2",
      model_name: "GPT Image 2",
      status: "running",
      params: {
        prompt: "retry with refs",
        reference_ids: ["ref-1", "ref-2", "ref-3"],
      },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.reference_ids).toEqual(["ref-1", "ref-2"]);

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
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeSub2APIImageStudioResponse({ jobs: [] }))
      .mockResolvedValueOnce(
        makeSub2APIImageStudioResponse({
          jobs: [
            {
              id: "job-1",
              model: "gpt-image-2",
              status: "completed",
              user_prompt: "fresh product photo",
              created_at: "2026-07-20T09:00:00Z",
              expires_at: "2026-07-27T09:00:00Z",
              size: "1024x1024",
              count: 1,
              assets: [
                {
                  id: "asset-1",
                  content_type: "image/png",
                  byte_size: 128,
                  filename: "fresh-product.png",
                  expires_at: "2026-07-21T09:00:00Z",
                  availability: "available",
                },
              ],
            },
          ],
        }),
      );
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
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
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "/api/nextchat/image-studio/jobs/active",
      "/api/nextchat/image-studio/jobs?page=1&page_size=24",
    ]);
    expect(state.draw.map((item: any) => item.id)).toEqual([
      "local-pending",
      "job-job-1",
    ]);
    expect(state.draw[1]).toMatchObject({
      status: "success",
      sub2api_status: "completed",
      job_id: "job-1",
      model_name: "gpt-image-2",
      params: {
        prompt: "fresh product photo",
        size: "1024x1024",
        count: 1,
      },
    });
    expect(state.draw[1].img_data).toBe(
      "/api/nextchat/image-studio/assets/asset-1/thumbnail",
    );
    expect(state.draw[1].record_expires_at).toBe("2026-07-27T09:00:00Z");
    expect(state.draw[1].expires_at).toBe("2026-07-21T09:00:00Z");
    expect(state.draw[1].assets[0]).toMatchObject({
      content_type: "image/png",
      byte_size: 128,
      filename: "fresh-product.png",
      availability: "available",
      download_url: "/api/nextchat/image-studio/assets/asset-1/download",
    });

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
                size: "1024x1024",
                count: 1,
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          makeSub2APIImageStudioResponse({
            jobs: [],
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
      sub2api_status: "running",
    });

    await jest.runOnlyPendingTimersAsync();

    expect(useSdStore.getState().draw[0]).toMatchObject({
      job_id: "job-running",
      status: "success",
      sub2api_status: "completed",
      img_data: "/api/nextchat/image-studio/assets/asset-done/thumbnail",
    });

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
    jest.useRealTimers();
  });

  test("keeps a running job sync-deferred instead of failed when polling is interrupted", async () => {
    const originalFetch = globalThis.fetch;
    jest.useFakeTimers();
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => {
        throw new Error("network timeout");
      }),
      configurable: true,
    });
    useSdStore.setState({
      draw: [
        {
          id: "job-running",
          job_id: "job-running",
          status: "running",
          sub2api_status: "running",
          params: { prompt: "still running" },
        },
      ],
      sub2apiImageStudioRequestGeneration: 0,
    } as any);

    useSdStore
      .getState()
      .pollSub2APIImageStudioJob(
        useSdStore.getState().draw[0],
        "job-running",
        0,
        0,
      );
    await jest.runOnlyPendingTimersAsync();

    expect(useSdStore.getState().draw[0]).toMatchObject({
      job_id: "job-running",
      status: "running",
      sub2api_status: "running",
      sync_deferred: true,
      sync_error: "network timeout",
    });

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
    jest.useRealTimers();
  });

  test("merges active and history independently when one endpoint fails", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        makeSub2APIImageStudioResponse({
          jobs: [
            {
              id: "job-active",
              model: "gpt-image-2",
              status: "running",
              user_prompt: "active prompt",
            },
          ],
        }),
      )
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          code: 500,
          message: "history unavailable",
        }),
      });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });
    useSdStore.setState({
      draw: [
        {
          id: "job-terminal",
          job_id: "terminal",
          status: "success",
          sub2api_status: "completed",
          params: { prompt: "already synced" },
        },
      ],
      sub2apiImageStudioJobsError: "",
    } as any);

    await expect(
      useSdStore.getState().fetchSub2APIImageStudioJobs(),
    ).resolves.toHaveLength(1);

    expect(useSdStore.getState().draw.map((item: any) => item.id)).toEqual([
      "job-terminal",
      "job-job-active",
    ]);
    expect(useSdStore.getState().sub2apiImageStudioJobsError).toContain(
      "history unavailable",
    );

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("keeps history and known active jobs when active loading fails", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            code: 503,
            message: "active unavailable",
          }),
        })
        .mockResolvedValueOnce(
          makeSub2APIImageStudioResponse({
            jobs: [
              {
                id: "job-history",
                model: "gpt-image-2",
                status: "completed",
                user_prompt: "history prompt",
                assets: [{ id: "asset-history" }],
              },
            ],
          }),
        ),
      configurable: true,
    });
    useSdStore.setState({
      draw: [
        {
          id: "job-active-old",
          job_id: "active-old",
          status: "running",
          sub2api_status: "running",
          params: { prompt: "known active" },
        },
      ],
      sub2apiImageStudioJobsError: "",
    } as any);

    await expect(
      useSdStore.getState().fetchSub2APIImageStudioJobs(),
    ).resolves.toHaveLength(1);

    expect(useSdStore.getState().draw.map((item: any) => item.id)).toEqual([
      "job-active-old",
      "job-job-history",
    ]);
    expect(useSdStore.getState().sub2apiImageStudioJobsError).toContain(
      "active unavailable",
    );

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("keeps partial backend status and failed item details", () => {
    const merged = mergeSub2APIImageStudioDraws(
      [],
      [
        {
          id: "job-partial",
          job_id: "partial",
          status: "success",
          sub2api_status: "partial",
          params: { prompt: "mixed result" },
          assets: [{ id: "asset-ok" }],
          items: [
            { id: "item-ok", status: "success", asset_id: "asset-ok" },
            { id: "item-failed", status: "failed", error: "upstream failed" },
          ],
        },
      ],
    );

    expect(merged[0]).toMatchObject({
      status: "success",
      sub2api_status: "partial",
      items: [
        { id: "item-ok", status: "success" },
        { id: "item-failed", status: "failed", error: "upstream failed" },
      ],
    });
    expect(summarizeManagedImageItems(merged[0].items)).toEqual({
      total: 2,
      counts: { failed: 1, success: 1 },
      label: "failed: 1 · success: 1",
      failedItems: [
        {
          id: "item-failed",
          status: "failed",
          error: "upstream failed",
          assetID: undefined,
        },
      ],
    });
  });

  test("cancels active managed image jobs instead of deleting them", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(async () =>
      makeSub2APIImageStudioResponse({
        id: "job-active",
        model: "gpt-image-2",
        status: "cancelled",
      }),
    );
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });
    useSdStore.setState({
      draw: [
        {
          id: "job-active",
          job_id: "job-active",
          status: "running",
          sub2api_status: "running",
          params: { prompt: "cancel me" },
        },
      ],
    } as any);

    expect(isSub2APIImageStudioDrawActive(useSdStore.getState().draw[0])).toBe(
      true,
    );
    await expect(
      useSdStore.getState().cancelSub2APIImageStudioJob("job-active"),
    ).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[0]).toMatchObject([
      "/api/nextchat/image-studio/jobs/job-active/cancel",
      expect.objectContaining({ method: "POST" }),
    ]);
    expect(useSdStore.getState().draw[0]).toMatchObject({
      job_id: "job-active",
      status: "error",
      sub2api_status: "cancelled",
    });

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
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

    expect(useSdStore.getState().sub2apiImageStudioJobsError).toContain(
      "job database unavailable",
    );

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("maps generic managed image sync failures to sync deferred copy", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => ({
        ok: false,
        json: async () => undefined,
      })),
      configurable: true,
    });
    useSdStore.setState({
      draw: [],
      sub2apiImageStudioJobsError: "",
    } as any);

    await expect(
      useSdStore.getState().fetchSub2APIImageStudioJobs(),
    ).resolves.toEqual([]);

    expect(useSdStore.getState().sub2apiImageStudioJobsError).toBe(
      "同步暂缓：运行中任务；历史任务",
    );

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });
});

function installManagedClientConfig() {
  const existing = Array.from(
    document.head.querySelectorAll("meta[name='config']"),
  );
  existing.forEach((node) => node.remove());
  const meta = document.createElement("meta");
  meta.name = "config";
  meta.content = JSON.stringify({ sub2apiManagedMode: true });
  document.head.appendChild(meta);
  return () => {
    meta.remove();
    existing.forEach((node) => document.head.appendChild(node));
  };
}

function makeSub2APIImageStudioResponse(data: any) {
  return {
    ok: true,
    json: async () => ({
      code: 0,
      data,
    }),
  };
}

function makeAssetFetchResponse(input: {
  status: number;
  headers?: Record<string, string>;
  blob?: Blob;
  json?: any;
}) {
  const headers = input.headers ?? {};
  return {
    ok: input.status >= 200 && input.status < 300,
    status: input.status,
    headers: {
      get(name: string) {
        const lower = name.toLowerCase();
        const match = Object.entries(headers).find(
          ([key]) => key.toLowerCase() === lower,
        );
        return match?.[1] ?? null;
      },
    },
    blob: async () => input.blob ?? new Blob([]),
    json: async () => input.json,
  };
}
