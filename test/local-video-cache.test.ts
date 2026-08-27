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

const videos = await import("../app/client/local-video-cache");

describe("local video cache", () => {
  beforeEach(() => database.clear());

  test("persists completed videos per account and restores the blob", async () => {
    const first = await videos.saveLocalVideo(
      "user-a",
      "task-1",
      new Blob(["video-a"], { type: "video/mp4" }),
      { prompt: "a test scene", createdAt: 100 },
    );
    expect(first.taskId).toBe("task-1");
    expect(await videos.listLocalVideos("user-b")).toEqual([]);
    expect(await videos.listLocalVideos("user-a")).toHaveLength(1);
    await expect(videos.readLocalVideoBlob("user-a", first.id)).resolves.toBeInstanceOf(Blob);
  });

  test("replaces the same task without creating duplicate history", async () => {
    await videos.saveLocalVideo("user-a", "task-1", new Blob(["old"]), { prompt: "old" });
    const updated = await videos.saveLocalVideo("user-a", "task-1", new Blob(["new"]), { prompt: "new" });
    expect((await videos.listLocalVideos("user-a")).map((item) => item.taskId)).toEqual(["task-1"]);
    expect((await videos.readLocalVideoBlob("user-a", updated.id))?.size).toBe(3);
    expect(updated.prompt).toBe("new");
  });

  test("treats an index entry without its blob as a cache miss", async () => {
    const cached = await videos.saveLocalVideo(
      "user-a",
      "task-missing-blob",
      new Blob(["video"], { type: "video/mp4" }),
    );
    database.delete(`jisudeng-local-videos:blob:user-a:${cached.id}`);

    await expect(videos.listLocalVideos("user-a")).resolves.toHaveLength(1);
    await expect(videos.listLocalVideosWithBlobs("user-a")).resolves.toEqual([]);
  });

  test("deletes only the selected account's videos", async () => {
    const [first, second] = await Promise.all([
      videos.saveLocalVideo("user-a", "task-1", new Blob(["one"])),
      videos.saveLocalVideo("user-a", "task-2", new Blob(["two"])),
    ]);
    await expect(videos.deleteLocalVideos("user-a", [first.id])).resolves.toBe(1);
    expect(await videos.readLocalVideoBlob("user-a", first.id)).toBeNull();
    expect(await videos.readLocalVideoBlob("user-a", second.id)).toBeInstanceOf(Blob);
  });

  test("evicts the oldest blob when the local history exceeds its entry limit", async () => {
    const first = await videos.saveLocalVideo(
      "user-a",
      "task-0",
      new Blob(["oldest"], { type: "video/mp4" }),
    );

    for (let index = 1; index <= 24; index += 1) {
      await videos.saveLocalVideo(
        "user-a",
        `task-${index}`,
        new Blob([`video-${index}`], { type: "video/mp4" }),
      );
    }

    expect(await videos.listLocalVideos("user-a")).toHaveLength(24);
    await expect(videos.readLocalVideoBlob("user-a", first.id)).resolves.toBeNull();
  });

  test("evicts the oldest local copies once the total video cache budget is full", () => {
    const entries = [
      { id: "new", ownerUserId: "user-a", taskId: "new", prompt: "", createdAt: 3, updatedAt: 3, mimeType: "video/mp4", size: 80 },
      { id: "middle", ownerUserId: "user-a", taskId: "middle", prompt: "", createdAt: 2, updatedAt: 2, mimeType: "video/mp4", size: 80 },
      { id: "old", ownerUserId: "user-a", taskId: "old", prompt: "", createdAt: 1, updatedAt: 1, mimeType: "video/mp4", size: 80 },
    ];
    const result = videos.retainLocalVideoEntries(entries, 24, 160);
    expect(result.retained.map((entry) => entry.id)).toEqual(["new", "middle"]);
    expect(result.evicted.map((entry) => entry.id)).toEqual(["old"]);
    expect(result.totalBytes).toBe(160);
  });
});
