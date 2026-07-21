import { StoreKey } from "../app/constant";
import { useSdStore } from "../app/store/sd";
import {
  buildManagedWorkspaceExportPackage,
  MANAGED_IMAGE_EXPIRED_LABEL,
  MANAGED_IMAGE_UNAVAILABLE_LABEL,
  MANAGED_WORKSPACE_EXPORT_VERSION,
  normalizeImportedState,
  readManagedWorkspaceImport,
} from "../app/utils/managed-workspace-export";
import { getLocalAppState, mergeAppState } from "../app/utils/sync";
import JSZip from "jszip";
import { jest } from "@jest/globals";

describe("Sub2API managed export/import state", () => {
  test("includes image studio history in local app state", () => {
    useSdStore.setState({
      currentId: 3,
      draw: [{ id: "img-local", status: "success", img_data: "/x.png" }],
    } as any);

    const state = getLocalAppState();

    expect(state[StoreKey.SdList].draw).toEqual([
      expect.objectContaining({ id: "img-local" }),
    ]);
  });

  test("merges imported image studio history by id", () => {
    const local = getLocalAppState();
    const remote = JSON.parse(JSON.stringify(local));
    local[StoreKey.SdList].currentId = 1;
    local[StoreKey.SdList].draw = [{ id: "img-local" }] as any;
    remote[StoreKey.SdList].currentId = 9;
    remote[StoreKey.SdList].draw = [
      { id: "img-remote" },
      { id: "img-local" },
    ] as any;

    const merged = mergeAppState(local, remote);

    expect(merged[StoreKey.SdList].currentId).toBe(9);
    expect(merged[StoreKey.SdList].draw.map((item: any) => item.id)).toEqual([
      "img-remote",
      "img-local",
    ]);
  });

  test("builds a workspace zip with chat metadata and image assets", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => {
        return makeImageExportResponse(200, "image/png", "image-bytes");
      }),
      configurable: true,
    });
    const state = getLocalAppState();
    state[StoreKey.Chat].sessions = [
      {
        id: "chat-1",
        topic: "Product copy",
        messages: [{ id: "m1", role: "user", content: "hello" }],
      },
    ] as any;
    state[StoreKey.SdList].draw = [
      {
        id: "img-local",
        status: "success",
        job_id: "job-1",
        img_data: "/api/nextchat/image-studio/assets/a/content",
        params: { prompt: "clean product photo" },
        expires_at: "2026-07-21T08:00:00Z",
      },
    ] as any;

    const blob = await buildManagedWorkspaceExportPackage(
      state,
      new Date("2026-07-20T08:00:00Z"),
    );
    const zip = await JSZip.loadAsync(blob);
    const metadata = JSON.parse(await zip.file("metadata.json")!.async("text"));

    expect(zip.file("chat.json")).toBeTruthy();
    expect(zip.file("chat.md")).toBeTruthy();
    expect(metadata.version).toBe(MANAGED_WORKSPACE_EXPORT_VERSION);
    expect(metadata.retention).toEqual({
      text_session_days: 7,
      image_job_days: 7,
      image_asset_hours: 24,
      image_reference_hours: 24,
    });
    expect(metadata.images[0]).toEqual(
      expect.objectContaining({
        draw_id: "img-local",
        archived: true,
        file: "images/img-local-image.png",
      }),
    );
    expect(zip.file("images/img-local-image.png")).toBeTruthy();

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("imports archived images as durable local data urls", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => {
        return makeImageExportResponse(200, "image/png", "image-bytes");
      }),
      configurable: true,
    });
    const state = getLocalAppState();
    state[StoreKey.SdList].draw = [
      {
        id: "img-local",
        status: "success",
        img_data: "/api/nextchat/image-studio/assets/a/content",
        params: { prompt: "clean product photo" },
        expires_at: "2026-07-21T08:00:00Z",
      },
    ] as any;
    const blob = await buildManagedWorkspaceExportPackage(
      state,
      new Date("2026-07-20T08:00:00Z"),
    );

    const imported = await readManagedWorkspaceImport(
      new File([blob], "workspace-export.zip"),
    );
    const item = imported.state[StoreKey.SdList].draw[0] as any;

    expect(item.image_asset_archived).toBe(true);
    expect(item.image_asset_expired).toBe(false);
    expect(item.img_data).toMatch(/^data:image\/png;base64,/);

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("marks metadata-only imported images as expired", () => {
    const state = getLocalAppState();
    state[StoreKey.SdList].draw = [
      { id: "img-expired", status: "success", img_data: "/gone.png" },
    ] as any;

    const normalized = normalizeImportedState(state, {
      version: 1,
      exported_at: "2026-07-20T08:00:00Z",
      retention: { text_session_days: 7, image_asset_hours: 24 },
      files: {
        chat_json: "chat.json",
        chat_markdown: "chat.md",
        images_dir: "images/",
      },
      images: [
        {
          draw_id: "img-expired",
          asset_index: 0,
          expired: true,
          archived: false,
        },
      ],
    });
    const item = normalized[StoreKey.SdList].draw[0] as any;

    expect(item.status).toBe("expired");
    expect(item.img_data).toBe("");
    expect(item.error).toBe(MANAGED_IMAGE_EXPIRED_LABEL);
  });

  test("keeps mixed archived and unavailable image assets mapped by asset identity", () => {
    const state = getLocalAppState();
    state[StoreKey.SdList].draw = [
      {
        id: "img-mixed",
        status: "success",
        img_data: "/old-a1.png",
        assets: [
          { id: "a1", url: "/old-a1.png" },
          { id: "a2", url: "/old-a2.png" },
        ],
      },
    ] as any;

    const normalized = normalizeImportedState(
      state,
      {
        version: 2,
        exported_at: "2026-07-20T08:00:00Z",
        retention: { text_session_days: 7, image_asset_hours: 24 },
        files: {
          chat_json: "chat.json",
          chat_markdown: "chat.md",
          images_dir: "images/",
        },
        images: [
          {
            draw_id: "img-mixed",
            asset_id: "a1",
            asset_index: 0,
            expired: false,
            archived: false,
            unavailable: true,
            error: "asset unavailable",
          },
          {
            draw_id: "img-mixed",
            asset_id: "a2",
            asset_index: 1,
            expired: false,
            archived: true,
            file: "images/a2.png",
          },
        ],
      },
      { "images/a2.png": "data:image/png;base64,a2" },
    );
    const item = normalized[StoreKey.SdList].draw[0] as any;

    expect(item.image_asset_archived).toBe(true);
    expect(item.image_asset_unavailable).toBe(true);
    expect(item.img_data).toBe("data:image/png;base64,a2");
    expect(item.assets[0]).toMatchObject({
      id: "a1",
      availability: "unavailable",
      url: "",
    });
    expect(item.assets[1]).toMatchObject({
      id: "a2",
      availability: "archived",
      url: "data:image/png;base64,a2",
    });
  });

  test("records 410 image assets as expired metadata", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () =>
        makeImageExportResponse(410, "application/json", {
          code: "IMAGE_STUDIO_ASSET_EXPIRED",
          message: "asset expired",
        }),
      ),
      configurable: true,
    });
    const state = getLocalAppState();
    state[StoreKey.SdList].draw = [
      {
        id: "img-expired",
        status: "success",
        img_data: "/api/nextchat/image-studio/assets/a/content",
        params: { prompt: "old product photo" },
      },
    ] as any;

    const blob = await buildManagedWorkspaceExportPackage(
      state,
      new Date("2026-07-20T08:00:00Z"),
    );
    const imported = await readManagedWorkspaceImport(
      new File([blob], "workspace-export.zip"),
    );
    const item = imported.state[StoreKey.SdList].draw[0] as any;

    expect(imported.metadata?.images[0]).toMatchObject({
      expired: true,
      archived: false,
      error: "asset expired",
    });
    expect(item.status).toBe("expired");
    expect(item.error).toBe(MANAGED_IMAGE_EXPIRED_LABEL);

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("records 404 image assets as unavailable without marking them expired", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () =>
        makeImageExportResponse(404, "application/json", {
          code: "IMAGE_STUDIO_ASSET_NOT_FOUND",
          message: "asset unavailable",
        }),
      ),
      configurable: true,
    });
    const state = getLocalAppState();
    state[StoreKey.SdList].draw = [
      {
        id: "img-missing",
        status: "success",
        img_data: "/api/nextchat/image-studio/assets/missing/content",
      },
    ] as any;

    const blob = await buildManagedWorkspaceExportPackage(
      state,
      new Date("2026-07-20T08:00:00Z"),
    );
    const imported = await readManagedWorkspaceImport(
      new File([blob], "workspace-export.zip"),
    );
    const item = imported.state[StoreKey.SdList].draw[0] as any;

    expect(imported.metadata?.images[0]).toMatchObject({
      expired: false,
      archived: false,
      unavailable: true,
      error: "asset unavailable",
    });
    expect(item.status).toBe("error");
    expect(item.image_asset_expired).toBe(false);
    expect(item.image_asset_unavailable).toBe(true);
    expect(item.error).toBe("asset unavailable");

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("aborts strict export when the managed session is no longer valid", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () =>
        makeImageExportResponse(401, "application/json", {
          message: "managed session required",
        }),
      ),
      configurable: true,
    });
    const state = getLocalAppState();
    state[StoreKey.SdList].draw = [
      { id: "img-auth", status: "success", img_data: "/asset/content" },
    ] as any;

    await expect(
      buildManagedWorkspaceExportPackage(
        state,
        new Date("2026-07-20T08:00:00Z"),
      ),
    ).rejects.toThrow("重新进入 NextChat");

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("retries then aborts strict export on unavailable image storage", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(async () =>
      makeImageExportResponse(503, "application/json", {
        code: "IMAGE_STUDIO_ASSET_UNAVAILABLE",
        message: "asset storage unavailable",
      }),
    );
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });
    const state = getLocalAppState();
    state[StoreKey.SdList].draw = [
      { id: "img-503", status: "success", img_data: "/asset/content" },
    ] as any;

    await expect(
      buildManagedWorkspaceExportPackage(
        state,
        new Date("2026-07-20T08:00:00Z"),
      ),
    ).rejects.toThrow("asset storage unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });
});

function makeImageExportResponse(
  status: number,
  contentType: string,
  body: string | Record<string, unknown>,
) {
  const ok = status >= 200 && status < 300;
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok,
    status,
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-type" ? contentType : null;
      },
    },
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    blob: async () => new Blob([payload], { type: contentType }),
  };
}
