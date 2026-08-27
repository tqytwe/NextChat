import { beforeEach, describe, expect, test } from "@jest/globals";

import { contentWorkbenchPlan } from "../app/client/content-workbench";
import { useManagedMobileAppStore } from "../app/store/mobile";

describe("managed mobile account isolation", () => {
  beforeEach(() => {
    useManagedMobileAppStore.setState({
      chatSessions: [],
      currentChatId: "",
      contentKits: [],
      activeAccountId: "",
      accounts: {},
    });
  });

  test("keeps chat sessions private while switching accounts", () => {
    const store = useManagedMobileAppStore.getState();
    store.activateAccount(101);
    const firstSessionId = store.createChatSession("model-a", 1);
    useManagedMobileAppStore.getState().addChatMessage(firstSessionId, {
      role: "user",
      content: "account 101 private message",
      status: "done",
    });

    useManagedMobileAppStore.getState().activateAccount(202);
    expect(useManagedMobileAppStore.getState().chatSessions).toEqual([]);

    const secondSessionId = useManagedMobileAppStore
      .getState()
      .createChatSession("model-b", 2);
    expect(secondSessionId).not.toBe(firstSessionId);

    useManagedMobileAppStore.getState().activateAccount(101);
    const restored = useManagedMobileAppStore.getState();
    expect(restored.currentChatId).toBe(firstSessionId);
    expect(restored.chatSessions).toHaveLength(1);
    expect(restored.chatSessions[0].messages[0].content).toBe(
      "account 101 private message",
    );
  });

  test("clears only the active account", () => {
    const store = useManagedMobileAppStore.getState();
    store.activateAccount(101);
    store.createChatSession("model-a", 1);
    useManagedMobileAppStore.getState().activateAccount(202);
    useManagedMobileAppStore.getState().createChatSession("model-b", 2);

    useManagedMobileAppStore.getState().clearActiveAccount();
    expect(useManagedMobileAppStore.getState().chatSessions).toEqual([]);

    useManagedMobileAppStore.getState().activateAccount(101);
    expect(useManagedMobileAppStore.getState().chatSessions).toHaveLength(1);
  });

  test("clears every account only when the user chooses clear all", () => {
    const store = useManagedMobileAppStore.getState();
    store.activateAccount(101);
    store.createChatSession("model-a", 1);
    useManagedMobileAppStore.getState().activateAccount(202);
    useManagedMobileAppStore.getState().createChatSession("model-b", 2);

    useManagedMobileAppStore.getState().clearAllAccounts();
    const cleared = useManagedMobileAppStore.getState();
    expect(cleared.activeAccountId).toBe("");
    expect(cleared.chatSessions).toEqual([]);
    expect(cleared.contentKits).toEqual([]);
    expect(cleared.accounts).toEqual({});
  });

  test("keeps content kit inputs and results isolated by account", () => {
    const store = useManagedMobileAppStore.getState();
    store.activateAccount(101);
    store.createContentKit({
      productName: "Account 101 product",
      sellingPoints: "private selling point",
      audience: "buyers",
      platform: "store",
      tone: "clear",
      model: "gpt-image-private-alias",
      referenceImages: [],
      assets: [],
      copyStatus: "idle",
    });

    useManagedMobileAppStore.getState().activateAccount(202);
    expect(useManagedMobileAppStore.getState().contentKits).toEqual([]);

    useManagedMobileAppStore.getState().activateAccount(101);
    expect(useManagedMobileAppStore.getState().contentKits[0]).toMatchObject({
      productName: "Account 101 product",
      model: "gpt-image-private-alias",
    });
  });

  test("attributes a legacy content-kit-only store to the first account", () => {
    useManagedMobileAppStore.setState({
      activeAccountId: "",
      accounts: {},
      chatSessions: [],
      currentChatId: "",
      contentKits: [
        {
          id: "legacy-kit",
          accountId: "",
          version: 1,
          productName: "Saved product",
          sellingPoints: "Saved points",
          audience: "",
          platform: "",
          tone: "",
          model: "image-model",
          referenceImages: [],
          assets: [],
          copyStatus: "completed",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    useManagedMobileAppStore.getState().activateAccount(101);
    expect(useManagedMobileAppStore.getState().contentKits).toHaveLength(1);
    expect(useManagedMobileAppStore.getState().contentKits[0].id).toBe(
      "legacy-kit",
    );
  });

  test("persists a multi-output content-kit run without collapsing repeated shot groups", () => {
    const store = useManagedMobileAppStore.getState();
    store.activateAccount(303);
    const runId = "run-ecommerce-16";
    const assets = Array.from({ length: 16 }, (_, index) => ({
      id: `${runId}-${index + 1}`,
      runId,
      shotId: index < 3 ? "main" : "detail",
      kind: index < 3 ? "main" : "detail",
      label: index < 3 ? "Main" : "Detail",
      prompt: `product visual ${index + 1}`,
      size: "1024x1024",
      variant: index + 1,
      status: "queued" as const,
      updatedAt: Date.now(),
    }));
    store.createContentKit({
      productName: "Batch product",
      sellingPoints: "durable",
      audience: "buyers",
      platform: "store",
      tone: "clear",
      model: "image-model",
      referenceImages: [],
      presetId: "ecommerce",
      activeRunId: runId,
      runs: [
        {
          id: runId,
          presetId: "ecommerce",
          status: "queued",
          total: 16,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      assets,
      copyStatus: "idle",
    });
    const project = useManagedMobileAppStore.getState().contentKits[0];
    expect(project.assets).toHaveLength(16);
    expect(new Set(project.assets.map((asset) => asset.id)).size).toBe(16);
    expect(project.runs?.[0]).toMatchObject({ total: 16, status: "queued" });
  });

  test("persists the structured workspace brief and output ownership metadata", () => {
    const store = useManagedMobileAppStore.getState();
    store.activateAccount(505);
    const [shot] = contentWorkbenchPlan("ecommerce");
    const runId = "run-workbench-1";
    const projectId = store.createContentKit({
      scene: "ecommerce",
      productName: "Structured product",
      sellingPoints: "durable",
      parameters: "5000mAh battery",
      audience: "buyers",
      platform: "store",
      tone: "clear",
      model: "image-model",
      imageGroupId: 73,
      referenceImages: [],
      presetId: "ecommerce",
      shotPlan: [shot],
      activeRunId: runId,
      runs: [
        {
          id: runId,
          presetId: "ecommerce",
          status: "queued",
          total: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      assets: [
        {
          id: "workbench-output-1",
          runId,
          shotId: shot.id,
          scene: shot.scene,
          kind: shot.kind,
          label: shot.label,
          purpose: shot.purpose,
          aspect: shot.aspect,
          copyFields: shot.copyFields,
          prompt: "structured shot prompt",
          size: shot.size,
          variant: 1,
          status: "queued",
          updatedAt: Date.now(),
        },
      ],
      copyStatus: "idle",
    });

    const project = useManagedMobileAppStore
      .getState()
      .contentKits.find((item) => item.id === projectId)!;
    expect(project).toMatchObject({
      scene: "ecommerce",
      parameters: "5000mAh battery",
      imageGroupId: 73,
    });
    expect(project.shotPlan?.[0]).toMatchObject({
      purpose: expect.any(String),
      aspect: "square",
      promptTemplate: expect.any(String),
      copyFields: expect.any(Array),
    });
    expect(project.assets[0]).toMatchObject({
      projectId,
      runId,
      shotId: shot.id,
      scene: "ecommerce",
      kind: shot.kind,
    });
  });

  test("does not infer a group for a legacy content-kit project", () => {
    const store = useManagedMobileAppStore.getState();
    store.activateAccount(606);
    const projectId = store.createContentKit({
      productName: "Legacy image project",
      sellingPoints: "private",
      audience: "buyers",
      platform: "store",
      tone: "clear",
      model: "legacy-image-model",
      referenceImages: [],
      assets: [],
      copyStatus: "idle",
    });

    expect(
      useManagedMobileAppStore
        .getState()
        .contentKits.find((project) => project.id === projectId)?.imageGroupId,
    ).toBeUndefined();
  });

  test("does not silently discard older local projects", () => {
    const store = useManagedMobileAppStore.getState();
    store.activateAccount(404);
    for (let index = 0; index < 41; index += 1) {
      store.createContentKit({
        productName: `Project ${index}`,
        sellingPoints: "private",
        audience: "",
        platform: "",
        tone: "",
        model: "image-model",
        referenceImages: [],
        assets: [],
        copyStatus: "idle",
      });
    }
    expect(useManagedMobileAppStore.getState().contentKits).toHaveLength(41);
  });
});
