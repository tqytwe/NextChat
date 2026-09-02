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

const projects = await import("../app/client/local-video-projects");
const packages = await import("../app/client/local-video-project-package");

describe("local video projects", () => {
  beforeEach(() => database.clear());

  test("keeps projects isolated by account and preserves ordered shots", async () => {
    const project = await projects.createLocalVideoProject("user-a", {
      name: "Pilot",
      brief: "A short story",
      shots: [
        {
          id: "shot-2",
          order: 2,
          title: "Second",
          prompt: "B",
          referenceMaterialIds: [],
          taskStatus: "queued",
          updatedAt: 2,
        },
        {
          id: "shot-1",
          order: 1,
          title: "First",
          prompt: "A",
          referenceMaterialIds: [],
          taskStatus: "queued",
          updatedAt: 1,
        },
      ],
    });
    expect((await projects.listLocalVideoProjects("user-b"))).toEqual([]);
    expect((await projects.listLocalVideoProjects("user-a"))[0].shots.map((shot) => shot.id)).toEqual([
      "shot-1",
      "shot-2",
    ]);
    const updated = await projects.updateLocalVideoProject("user-a", project.id, {
      script: "Final script",
    });
    expect(updated.script).toBe("Final script");
  });

  test("exports and imports a checksummed project package", async () => {
    const project = await projects.createLocalVideoProject("user-a", {
      name: "Package",
      shots: [],
    });
    const archive = await packages.exportLocalVideoProjectPackage({
      project,
      files: [{ path: "references/ref.txt", blob: new Blob(["reference"]) }],
    });
    const restored = await packages.importLocalVideoProjectPackage(archive);
    expect(restored.project.name).toBe("Package");
    expect(restored.files.get("references/ref.txt")).toBeInstanceOf(Blob);
  });

  test("rejects a damaged package before exposing any file", async () => {
    await expect(
      packages.importLocalVideoProjectPackage(new Blob(["not-a-zip"])),
    ).rejects.toThrow(/damaged|manifest/i);
  });
});
