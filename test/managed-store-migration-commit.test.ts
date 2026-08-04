import { expect, jest, test } from "@jest/globals";

const managedStoreKey = "nextchat-managed-store";
const database = new Map<string, string>();
const writes: Array<{ key: string; value: string }> = [];

database.set(
  managedStoreKey,
  JSON.stringify({
    version: 3,
    state: {
      backendBaseUrl: "https://legacy-gateway.example.com///",
      accessToken: "legacy-access-token",
      refreshToken: "legacy-refresh-token",
      pendingTotpToken: "legacy-totp-token",
      user: { id: 7, email: "legacy@example.com" },
      session: { user_id: 7, api_key: "legacy-chat-key", api_key_id: 71 },
      imageSession: {
        user_id: 7,
        api_key: "legacy-image-key",
        api_key_id: 72,
      },
      workspace: { models: { groups: [{ id: 1, name: "legacy" }] } },
    },
  }),
);

jest.unstable_mockModule("idb-keyval", () => ({
  get: jest.fn(async (key: string) => database.get(key)),
  set: jest.fn(async (key: string, value: string) => {
    writes.push({ key, value });
    database.set(key, value);
  }),
  del: jest.fn(async (key: string) => {
    database.delete(key);
  }),
  clear: jest.fn(async () => {
    database.clear();
  }),
}));

const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
const { useManagedNextChatStore } = await import("../app/store/managed");

async function waitForHydration() {
  if (useManagedNextChatStore.persist.hasHydrated()) return;

  await new Promise<void>((resolve) => {
    const unsubscribe = useManagedNextChatStore.persist.onFinishHydration(
      () => {
        unsubscribe();
        resolve();
      },
    );
  });
}

async function waitForFinalWrite() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const serialized = database.get(managedStoreKey);
    const stored = serialized ? JSON.parse(serialized) : null;
    if (
      stored?.version === 4 &&
      stored?.state?._hasHydrated === true &&
      writes.some((write) => write.key === managedStoreKey)
    ) {
      return stored;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("managed v3 to v4 migration did not commit a hydrated state");
}

test("commits a sanitized v4 managed-store snapshot after v3 hydration", async () => {
  await waitForHydration();
  const stored = await waitForFinalWrite();

  expect(stored).toEqual({
    version: 4,
    state: {
      backendBaseUrl: "https://legacy-gateway.example.com",
      _hasHydrated: true,
      _persistenceBlocked: false,
    },
  });
  expect(writes.filter((write) => write.key === managedStoreKey)).toHaveLength(1);

  const backupWrites = writes.filter((write) =>
    write.key.startsWith(`${managedStoreKey}:backup:v3:`),
  );
  expect(backupWrites).toHaveLength(1);
  expect(JSON.parse(backupWrites[0].value)).toEqual({
    version: 3,
    state: {
      backendBaseUrl: "https://legacy-gateway.example.com",
      _hasHydrated: false,
      _persistenceBlocked: false,
    },
  });

  const finalSnapshot = JSON.stringify(stored);
  const backupSnapshot = JSON.stringify(JSON.parse(backupWrites[0].value));
  expect(finalSnapshot).not.toContain("legacy-access-token");
  expect(finalSnapshot).not.toContain("legacy-refresh-token");
  expect(finalSnapshot).not.toContain("legacy-totp-token");
  expect(finalSnapshot).not.toContain("legacy-chat-key");
  expect(finalSnapshot).not.toContain("legacy-image-key");
  expect(finalSnapshot).not.toContain("legacy@example.com");
  expect(finalSnapshot).not.toContain("workspace");
  expect(backupSnapshot).not.toContain("legacy-access-token");
  expect(backupSnapshot).not.toContain("legacy-refresh-token");
  expect(backupSnapshot).not.toContain("legacy-totp-token");
  expect(backupSnapshot).not.toContain("legacy-chat-key");
  expect(backupSnapshot).not.toContain("legacy-image-key");
  expect(backupSnapshot).not.toContain("legacy@example.com");
  expect(backupSnapshot).not.toContain("workspace");
  expect(consoleWarn).toHaveBeenCalledWith("skip setItem", managedStoreKey);
});
