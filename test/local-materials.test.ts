import { webcrypto } from "crypto";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

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

const materials = await import("../app/client/local-materials");

describe("local material library", () => {
  beforeEach(() => {
    database.clear();
  });

  test("keeps imported files account-isolated and reads an image locally", async () => {
    const image = new File(["image bytes"], "product.png", {
      type: "image/png",
    });
    const note = new File(["local notes"], "brief.txt", {
      type: "text/plain",
    });

    const imported = await materials.importLocalMaterials("user-a", [
      image,
      note,
    ]);

    expect(imported.map((item) => item.kind)).toEqual(["image", "text"]);
    expect(await materials.listLocalMaterials("user-b")).toEqual([]);
    expect(await materials.listLocalMaterials("user-a")).toHaveLength(2);
    await expect(
      materials.readLocalMaterialDataUrl("user-a", imported[0].id),
    ).resolves.toMatch(/^data:image\/png;base64,/);
  });

  test("removes only selected local material blobs", async () => {
    const [first, second] = await materials.importLocalMaterials("user-a", [
      new File(["first"], "first.png", { type: "image/png" }),
      new File(["second"], "second.png", { type: "image/png" }),
    ]);

    await expect(
      materials.deleteLocalMaterials("user-a", [first.id]),
    ).resolves.toBe(1);
    await expect(
      materials.readLocalMaterialBlob("user-a", first.id),
    ).resolves.toBeNull();
    await expect(
      materials.readLocalMaterialBlob("user-a", second.id),
    ).resolves.toBeInstanceOf(Blob);
  });

  test("classifies documents without uploading them", () => {
    expect(
      materials.localMaterialKind(
        new File(["pdf"], "reference.pdf", { type: "application/pdf" }),
      ),
    ).toBe("pdf");
    expect(
      materials.localMaterialKind(
        new File(["audio"], "voice.m4a", { type: "audio/mp4" }),
      ),
    ).toBe("audio");
  });

  test("merges server material deltas without replacing unchanged local files", () => {
    const current = [
      {
        id: "remote-existing",
        ownerUserId: "user-a",
        name: "old.mp4",
        fileName: "old.mp4",
        mimeType: "video/mp4",
        size: 10,
        kind: "video" as const,
        createdAt: 10,
        updatedAt: 20,
        remoteId: "asset-existing",
        remoteUpdatedAt: "2026-08-19T00:00:00Z",
        remoteSha256: "same-hash",
      },
      {
        id: "local-only",
        ownerUserId: "user-a",
        name: "offline.png",
        fileName: "offline.png",
        mimeType: "image/png",
        size: 4,
        kind: "image" as const,
        createdAt: 1,
        updatedAt: 2,
      },
    ];
    const merged = materials.mergeLocalMaterialSyncDelta("user-a", current, {
      version: "2026-08-20T00:00:00Z",
      etag: '"v2"',
      items: [
        {
          id: "asset-existing",
          kind: "video",
          original_name: "old.mp4",
          content_type: "video/mp4",
          byte_size: 10,
          sha256: "same-hash",
          updated_at: "2026-08-19T00:00:00Z",
        },
        {
          id: "asset-new",
          kind: "video",
          original_name: "new.mp4",
          content_type: "video/mp4",
          byte_size: 20,
          updated_at: "2026-08-20T00:00:00Z",
        },
      ],
      deleted_ids: ["asset-deleted"],
    });
    expect(merged.map((item) => item.remoteId)).toEqual([
      "asset-new",
      "asset-existing",
      undefined,
    ]);
    expect(merged.find((item) => item.remoteId === "asset-existing")?.id).toBe(
      "remote-existing",
    );
  });

  test("normalizes the server's document kind for the local library", () => {
    const merged = materials.mergeLocalMaterialSyncDelta("user-a", [], {
      version: "v1",
      etag: '"v1"',
      items: [
        {
          id: "document-1",
          kind: "document" as never,
          original_name: "brief.docx",
          content_type: "text/plain",
          updated_at: "2026-08-20T00:00:00Z",
        },
      ],
      deleted_ids: [],
    });
    expect(merged[0].kind).toBe("text");
  });

  test("downloads once, then uses 304 without downloading unchanged blobs", async () => {
    const responses = [
      {
        ok: true,
        status: 200,
        text: JSON.stringify({
          code: 0,
          data: {
            version: "2026-08-20T00:00:00Z",
            etag: '"v1"',
            items: [
              {
                id: "asset-1",
                kind: "video",
                original_name: "first.mp4",
                content_type: "video/mp4",
                byte_size: 5,
                sha256: "hash-1",
                content_url: "/api/v1/mobile/assets/asset-1/content",
                updated_at: "2026-08-20T00:00:00Z",
              },
            ],
            deleted_ids: [],
          },
        }),
      },
      { ok: false, status: 304, text: "" },
    ];
    const requestedPaths: string[] = [];
    const downloadedUrls: string[] = [];
    const requestText = jest.fn(async (_base: string, path: string) => {
      requestedPaths.push(path);
      return responses.shift()!;
    });
    const downloadBlob = jest.fn(async (url: string) => {
      downloadedUrls.push(url);
      return new Blob(["first"], { type: "video/mp4" });
    });

    const first = await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      { requestText, downloadBlob },
    );
    expect(first.downloaded).toBe(1);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(downloadedUrls[0]).toBe(
      "https://api.example.test/api/v1/mobile/assets/asset-1/content",
    );

    const second = await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      { requestText, downloadBlob },
    );
    expect(second.changed).toBe(false);
    expect(second.downloaded).toBe(0);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(requestedPaths[1]).toContain("since=2026-08-20T00%3A00%3A00Z");
  });

  test("repairs only a failed remote material without clearing other local assets", async () => {
    const response = {
      ok: true,
      status: 200,
      text: JSON.stringify({
        code: 0,
        data: {
          version: "v1",
          etag: '"v1"',
          items: [
            {
              id: "asset-retry",
              kind: "image",
              original_name: "retry.png",
              content_type: "image/png",
              byte_size: 5,
              content_url: "/api/v1/mobile/assets/asset-retry/content",
              updated_at: "2026-08-20T00:00:00Z",
            },
          ],
          deleted_ids: [],
        },
      }),
    };
    await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "token",
      {
        requestText: jest.fn(async () => response),
        downloadBlob: jest.fn(async () => {
          throw new Error("offline");
        }),
      },
    );
    const failed = (await materials.listLocalMaterials("user-a"))[0];
    expect(failed.syncError).toMatchObject({ stage: "download", retryable: true });
    const repaired = await materials.retryLocalMaterial(
      "user-a",
      failed.id,
      "https://api.example.test",
      "token",
      { downloadBlob: jest.fn(async () => new Blob(["bytes"], { type: "image/png" })) },
    );
    expect(repaired.syncError).toBeUndefined();
    await expect(materials.readLocalMaterialBlob("user-a", repaired.id)).resolves.toBeInstanceOf(Blob);
  });

  test("recovers the full remote library when IndexedDB evicts only its index", async () => {
    const requests: Array<{ path: string; etag: string | null }> = [];
    const item = {
      id: "asset-evicted-index",
      kind: "video",
      original_name: "recovered.mp4",
      content_type: "video/mp4",
      byte_size: 9,
      sha256: "recovered-hash",
      content_url: "/api/v1/mobile/assets/asset-evicted-index/content",
      updated_at: "2026-08-20T00:00:00Z",
    };
    const response = () => ({
      ok: true,
      status: 200,
      text: JSON.stringify({
        code: 0,
        data: {
          version: "2026-08-20T00:00:00Z",
          etag: '"index-recovery-v1"',
          items: [item],
          deleted_ids: [],
        },
      }),
    });
    const requestText = jest.fn(
      async (_base: string, path: string, _init: RequestInit, headers: Headers) => {
        requests.push({ path, etag: headers.get("If-None-Match") });
        if (headers.get("If-None-Match")) {
          return { ok: false, status: 304, text: "" };
        }
        return response();
      },
    );
    const downloadBlob = jest.fn(async () => new Blob(["recovered"]));

    await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      { requestText, downloadBlob },
    );
    // IndexedDB may independently evict the small metadata key while a
    // sync-state key remains. The next open must not accept a stale 304.
    database.delete("jisudeng-local-materials:index:user-a");

    const recovered = await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      { requestText, downloadBlob },
    );

    expect(requests).toEqual([
      { path: "/api/v1/mobile/assets/sync", etag: null },
      { path: "/api/v1/mobile/assets/sync", etag: null },
    ]);
    expect(recovered.downloaded).toBe(1);
    expect(recovered.materials).toEqual([
      expect.objectContaining({ remoteId: "asset-evicted-index" }),
    ]);
  });

  test("coalesces concurrent first-install syncs for the same account", async () => {
    let resolveRequest: ((value: { ok: boolean; status: number; text: string }) => void) | undefined;
    const requestText = jest.fn(
      () =>
        new Promise<{ ok: boolean; status: number; text: string }>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const downloadBlob = jest.fn(async () => new Blob(["cached"]));
    const first = materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      { requestText, downloadBlob },
    );
    const second = materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      { requestText, downloadBlob },
    );
    expect(second).toBe(first);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    resolveRequest?.({
      ok: true,
      status: 200,
      text: JSON.stringify({
        code: 0,
        data: {
          version: "2026-08-20T00:00:00Z",
          etag: '"v1"',
          items: [
            {
              id: "asset-1",
              kind: "video",
              original_name: "cached.mp4",
              content_type: "video/mp4",
              byte_size: 6,
              sha256: "cached",
              content_url: "/api/v1/mobile/assets/asset-1/content",
              updated_at: "2026-08-20T00:00:00Z",
            },
          ],
          deleted_ids: [],
        },
      }),
    });
    await expect(first).resolves.toMatchObject({ downloaded: 1 });
    expect(requestText).toHaveBeenCalledTimes(1);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });

  test("downloads only a changed remote material and removes deleted blobs", async () => {
    await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      {
        requestText: jest.fn(async () => ({
          ok: true,
          status: 200,
          text: JSON.stringify({
            code: 0,
            data: {
              version: "2026-08-20T00:00:00Z",
              etag: '"v1"',
              items: [
                {
                  id: "asset-1",
                  kind: "image",
                  original_name: "one.png",
                  content_type: "image/png",
                  byte_size: 3,
                  sha256: "same",
                  content_url: "/api/v1/mobile/assets/asset-1/content",
                  updated_at: "2026-08-20T00:00:00Z",
                },
                {
                  id: "asset-2",
                  kind: "image",
                  original_name: "two.png",
                  content_type: "image/png",
                  byte_size: 3,
                  sha256: "old",
                  content_url: "/api/v1/mobile/assets/asset-2/content",
                  updated_at: "2026-08-20T00:00:00Z",
                },
              ],
              deleted_ids: [],
            },
          }),
        })),
        downloadBlob: jest.fn(async () => new Blob(["old"])),
      },
    );
    const downloadBlob = jest.fn(async () => new Blob(["new"]));
    const next = await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      {
        requestText: jest.fn(async () => ({
          ok: true,
          status: 200,
          text: JSON.stringify({
            code: 0,
            data: {
              version: "2026-08-20T00:01:00Z",
              etag: '"v2"',
              items: [
                {
                  id: "asset-1",
                  kind: "image",
                  original_name: "one.png",
                  content_type: "image/png",
                  byte_size: 3,
                  sha256: "same",
                  content_url: "/api/v1/mobile/assets/asset-1/content",
                  updated_at: "2026-08-20T00:00:00Z",
                },
                {
                  id: "asset-2",
                  kind: "image",
                  original_name: "two.png",
                  content_type: "image/png",
                  byte_size: 3,
                  sha256: "new",
                  content_url: "/api/v1/mobile/assets/asset-2/content",
                  updated_at: "2026-08-20T00:01:00Z",
                },
              ],
              deleted_ids: ["asset-1"],
            },
          }),
        })),
        downloadBlob,
      },
    );
    expect(next.downloaded).toBe(1);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(next.materials.some((item) => item.remoteId === "asset-1")).toBe(
      false,
    );
    expect(next.materials.find((item) => item.remoteId === "asset-2")?.remoteSha256).toBe(
      "new",
    );
    await expect(
      materials.readLocalMaterialBlob(
        "user-a",
        next.materials.find((item) => item.remoteId === "asset-1")?.id || "missing",
      ),
    ).resolves.toBeNull();
  });

  test("cleans tombstone blobs even when a later download in the same delta fails", async () => {
    const oldItem = {
      id: "asset-deleted-before-failure",
      kind: "image",
      status: "ready",
      original_name: "old.png",
      content_type: "image/png",
      sha256: "old-hash",
      content_url: "/api/v1/mobile/assets/asset-deleted-before-failure/content",
      updated_at: "2026-08-20T00:00:00Z",
    };
    const envelope = (data: unknown) => ({
      ok: true,
      status: 200,
      text: JSON.stringify({ code: 0, data }),
    });
    await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      {
        requestText: jest.fn(async () =>
          envelope({
            version: "2026-08-20T00:00:00Z",
            etag: '"before-delete"',
            items: [oldItem],
            deleted_ids: [],
          }),
        ),
        downloadBlob: jest.fn(async () => new Blob(["old"])),
      },
    );

    const partial = await materials.syncLocalMaterials(
        "user-a",
        "https://api.example.test",
        "access-token",
        {
          requestText: jest.fn(async () =>
            envelope({
              version: "2026-08-20T00:01:00Z",
              etag: '"delete-and-fail"',
              items: [
                {
                  id: "asset-download-failure",
                  kind: "image",
                  status: "ready",
                  original_name: "new.png",
                  content_type: "image/png",
                  sha256: "new-hash",
                  content_url: "/api/v1/mobile/assets/asset-download-failure/content",
                  updated_at: "2026-08-20T00:01:00Z",
                },
              ],
              deleted_ids: ["asset-deleted-before-failure"],
            }),
          ),
          downloadBlob: jest.fn(async () => {
            throw new Error("download interrupted");
          }),
        },
      );
    expect(partial.failedIds).toEqual(["remote-asset-download-failure"]);

    await expect(
      materials.readLocalMaterialBlob(
        "user-a",
        "remote-asset-deleted-before-failure",
      ),
    ).resolves.toBeNull();
  });

  test("retries a changed material after its replacement blob download fails", async () => {
    const oldItem = {
      id: "asset-retry-changed",
      kind: "image",
      status: "ready",
      original_name: "image.png",
      content_type: "image/png",
      sha256: "old-content-hash",
      content_url: "/api/v1/mobile/assets/asset-retry-changed/content",
      updated_at: "2026-08-20T00:00:00Z",
    };
    const changedItem = {
      ...oldItem,
      sha256: "new-content-hash",
      updated_at: "2026-08-20T00:01:00Z",
    };
    const envelope = (data: unknown) => ({
      ok: true,
      status: 200,
      text: JSON.stringify({ code: 0, data }),
    });
    await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      {
        requestText: jest.fn(async () =>
          envelope({
            version: oldItem.updated_at,
            etag: '"retry-old"',
            items: [oldItem],
            deleted_ids: [],
          }),
        ),
        downloadBlob: jest.fn(async () => new Blob(["old-bytes"])),
      },
    );

    const partial = await materials.syncLocalMaterials(
        "user-a",
        "https://api.example.test",
        "access-token",
        {
          requestText: jest.fn(async () =>
            envelope({
              version: changedItem.updated_at,
              etag: '"retry-new"',
              items: [changedItem],
              deleted_ids: [],
            }),
          ),
          downloadBlob: jest.fn(async () => {
            throw new Error("replacement interrupted");
          }),
        },
      );
    expect(partial.failedIds).toEqual(["remote-asset-retry-changed"]);

    const retryDownload = jest.fn(async () => new Blob(["new-bytes"]));
    const retried = await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      {
        requestText: jest.fn(async () =>
          envelope({
            version: changedItem.updated_at,
            etag: '"retry-new"',
            items: [changedItem],
            deleted_ids: [],
          }),
        ),
        downloadBlob: retryDownload,
      },
    );

    expect(retryDownload).toHaveBeenCalledTimes(1);
    expect(retried.downloaded).toBe(1);
    await expect(
      materials.readLocalMaterialBlob(
        "user-a",
        "remote-asset-retry-changed",
      ),
    ).resolves.toBeInstanceOf(Blob);
  });

  test("repairs a missing cached blob with a full manifest instead of accepting a stale 304", async () => {
    const item = {
      id: "asset-1",
      kind: "video",
      original_name: "repair.mp4",
      content_type: "video/mp4",
      byte_size: 6,
      sha256: "repair-hash",
      content_url: "/api/v1/mobile/assets/asset-1/content",
      updated_at: "2026-08-20T00:00:00Z",
    };
    await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      {
        requestText: jest.fn(async () => ({
          ok: true,
          status: 200,
          text: JSON.stringify({
            code: 0,
            data: {
              version: "2026-08-20T00:00:00Z",
              etag: '"repair-v1"',
              items: [item],
              deleted_ids: [],
            },
          }),
        })),
        downloadBlob: jest.fn(async () => new Blob(["cached"])),
      },
    );

    database.delete("jisudeng-local-materials:blob:user-a:remote-asset-1");
    const paths: string[] = [];
    const etags: Array<string | null> = [];
    const downloadBlob = jest.fn(async () => new Blob(["repair"]));
    const repaired = await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      {
        requestText: jest.fn(async (_base: string, path: string, _init: RequestInit, headers: Headers) => {
          paths.push(path);
          etags.push(headers.get("If-None-Match"));
          return {
            ok: true,
            status: 200,
            text: JSON.stringify({
              code: 0,
              data: {
                version: "2026-08-20T00:00:00Z",
                etag: '"repair-v1"',
                items: [item],
                deleted_ids: [],
              },
            }),
          };
        }),
        downloadBlob,
      },
    );

    expect(paths).toEqual(["/api/v1/mobile/assets/sync"]);
    expect(etags).toEqual([null]);
    expect(repaired.downloaded).toBe(1);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    await expect(
      materials.readLocalMaterialBlob("user-a", "remote-asset-1"),
    ).resolves.toBeInstanceOf(Blob);
  });

  test("continues a failed first download without re-downloading completed blobs", async () => {
    const items = [
      {
        id: "asset-1",
        kind: "image",
        original_name: "first.png",
        content_type: "image/png",
        byte_size: 5,
        sha256: "first-hash",
        content_url: "/api/v1/mobile/assets/asset-1/content",
        updated_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "asset-2",
        kind: "image",
        original_name: "second.png",
        content_type: "image/png",
        byte_size: 6,
        sha256: "second-hash",
        content_url: "/api/v1/mobile/assets/asset-2/content",
        updated_at: "2026-08-20T00:00:01Z",
      },
    ];
    const envelope = () => ({
      ok: true,
      status: 200,
      text: JSON.stringify({
        code: 0,
        data: {
          version: "2026-08-20T00:00:01Z",
          etag: '"first-install"',
          items,
          deleted_ids: [],
        },
      }),
    });
    let attempts = 0;
    const partial = await materials.syncLocalMaterials(
        "user-a",
        "https://api.example.test",
        "access-token",
        {
          requestText: jest.fn(async () => envelope()),
          downloadBlob: jest.fn(async () => {
            attempts += 1;
            if (attempts === 2) throw new Error("connection lost");
            return new Blob(["first"]);
          }),
        },
      );
    expect(partial.downloaded).toBe(1);
    expect(partial.failedIds).toEqual(["remote-asset-2"]);

    expect(await materials.listLocalMaterials("user-a")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ remoteId: "asset-1" }),
        expect.objectContaining({ remoteId: "asset-2" }),
      ]),
    );
    const recoveredDownloads: string[] = [];
    const completed = await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      {
        requestText: jest.fn(async () => envelope()),
        downloadBlob: jest.fn(async (url: string) => {
          recoveredDownloads.push(url);
          return new Blob(["second"]);
        }),
      },
    );

    expect(completed.downloaded).toBe(1);
    expect(recoveredDownloads).toEqual([
      "https://api.example.test/api/v1/mobile/assets/asset-2/content",
    ]);
  });

  test("does not fetch an explicitly non-ready server asset into the device cache", async () => {
    const downloadBlob = jest.fn(async () => new Blob(["should not download"]));
    const result = await materials.syncLocalMaterials(
      "user-a",
      "https://api.example.test",
      "access-token",
      {
        requestText: jest.fn(async () => ({
          ok: true,
          status: 200,
          text: JSON.stringify({
            code: 0,
            data: {
              version: "2026-08-20T00:00:00Z",
              etag: '"pending-v1"',
              items: [
                {
                  id: "asset-pending",
                  kind: "video",
                  status: "uploading",
                  original_name: "not-ready.mp4",
                  content_type: "video/mp4",
                  content_url: "/api/v1/mobile/assets/asset-pending/content",
                  updated_at: "2026-08-20T00:00:00Z",
                },
              ],
              deleted_ids: [],
            },
          }),
        })),
        downloadBlob,
      },
    );

    expect(result.downloaded).toBe(0);
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(result.materials[0]).toMatchObject({
      remoteId: "asset-pending",
      remoteStatus: "uploading",
    });
  });

  test("does not commit a truncated download as a locally cached material", async () => {
    const requestText = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: JSON.stringify({
        code: 0,
        data: {
          version: "2026-08-20T00:00:00Z",
          etag: '"truncated-v1"',
          items: [{
            id: "asset-truncated",
            kind: "video",
            status: "ready",
            original_name: "truncated.mp4",
            content_type: "video/mp4",
            byte_size: 5,
            content_url: "/api/v1/mobile/assets/asset-truncated/content",
            updated_at: "2026-08-20T00:00:00Z",
          }],
          deleted_ids: [],
        },
      }),
    }));

    const partial = await materials.syncLocalMaterials(
        "user-a",
        "https://api.example.test",
        "access-token",
        {
          requestText,
          downloadBlob: jest.fn(async () => new Blob(["bad"])),
        },
      );
    expect(partial.failedIds).toEqual(["remote-asset-truncated"]);
    await expect(
      materials.readLocalMaterialBlob("user-a", "remote-asset-truncated"),
    ).resolves.toBeNull();
  });

  test("does not commit a hash-mismatched download as a locally cached material", async () => {
    const partial = await materials.syncLocalMaterials(
        "user-a",
        "https://api.example.test",
        "access-token",
        {
          requestText: jest.fn(async () => ({
            ok: true,
            status: 200,
            text: JSON.stringify({
              code: 0,
              data: {
                version: "2026-08-20T00:00:00Z",
                etag: '"hash-mismatch-v1"',
                items: [{
                  id: "asset-hash-mismatch",
                  kind: "image",
                  status: "ready",
                  original_name: "mismatch.png",
                  content_type: "image/png",
                  byte_size: 5,
                  sha256: "ec654fac9599f62e79e2706abef23dfb7c07c08185aa86db4d8695f0b718d1b3",
                  content_url: "/api/v1/mobile/assets/asset-hash-mismatch/content",
                  updated_at: "2026-08-20T00:00:00Z",
                }],
                deleted_ids: [],
              },
            }),
          })),
          downloadBlob: jest.fn(async () => new Blob(["wrong"])),
        },
      );
    expect(partial.failedIds).toEqual(["remote-asset-hash-mismatch"]);
    await expect(
      materials.readLocalMaterialBlob("user-a", "remote-asset-hash-mismatch"),
    ).resolves.toBeNull();
  });

  test("does not forward the account bearer token to an external asset URL", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBeNull();
      return {
        ok: true,
        status: 200,
        blob: async () => new Blob(["external-bytes"], { type: "video/mp4" }),
      } as Response;
    });
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const result = await materials.syncLocalMaterials(
        "user-a",
        "https://api.example.test",
        "account-token",
        {
          requestText: jest.fn(async () => ({
            ok: true,
            status: 200,
            text: JSON.stringify({
              code: 0,
              data: {
                version: "2026-08-20T00:00:00Z",
                etag: '"external-url-v1"',
                items: [
                  {
                    id: "asset-external-url",
                    kind: "video",
                    status: "ready",
                    original_name: "external.mp4",
                    content_type: "video/mp4",
                    content_url: "https://cdn.example.test/external.mp4",
                    updated_at: "2026-08-20T00:00:00Z",
                  },
                ],
                deleted_ids: [],
              },
            }),
          })),
        },
      );
      expect(result.downloaded).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
