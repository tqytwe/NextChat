import { StoreKey } from "../app/constant";
import { useSdStore } from "../app/store/sd";
import {
  buildManagedWorkspaceExportPackage,
  MANAGED_IMAGE_EXPIRED_LABEL,
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
        return {
          ok: true,
          blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
        };
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
        return {
          ok: true,
          blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
        };
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
});
