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
});
