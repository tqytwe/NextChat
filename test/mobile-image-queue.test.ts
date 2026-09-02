import {
  MobileCreationQueueCoordinator,
  classifyCreationQueueFailure,
  nextRunnableCreationQueueTask,
  recoverMobileImageQueueTask,
  resumeBlockedCreationQueueTasks,
} from "../app/client/mobile-image-queue";

describe("mobile creation queue", () => {
  test("classifies only account, balance and permission failures as blocked", () => {
    expect(classifyCreationQueueFailure({ status: 503 })).toEqual({
      status: "error",
    });
    expect(
      classifyCreationQueueFailure({ message: "余额不足" }),
    ).toEqual({ status: "blocked", blockedReason: "balance" });
    expect(classifyCreationQueueFailure({ status: 401 })).toEqual({
      status: "blocked",
      blockedReason: "authentication",
    });
    expect(classifyCreationQueueFailure({ status: 403 })).toEqual({
      status: "blocked",
      blockedReason: "permission",
    });
  });

  test("keeps FIFO order and resumes blocked work only for the active account", () => {
    const tasks = [
      { id: "late", accountId: "a", status: "queued" as const, createdAt: 20 },
      { id: "first", accountId: "a", status: "queued" as const, createdAt: 10 },
      { id: "blocked", accountId: "a", status: "blocked" as const, createdAt: 1 },
      { id: "other", accountId: "b", status: "blocked" as const, createdAt: 2 },
    ];
    expect(nextRunnableCreationQueueTask(tasks, "a")?.id).toBe("first");
    expect(resumeBlockedCreationQueueTasks(tasks, "a")).toEqual([
      tasks[0],
      tasks[1],
      expect.objectContaining({ id: "blocked", status: "queued" }),
      tasks[3],
    ]);
  });

  test("never replays an in-flight task automatically", () => {
    expect(
      recoverMobileImageQueueTask({ id: "a", accountId: "1", status: "running" }),
    ).toMatchObject({ status: "reconciling" });
    expect(
      recoverMobileImageQueueTask({ id: "a", accountId: "1", status: "submitting" }),
    ).toMatchObject({ status: "reconciling" });
  });

  test("does not select a reconciling request for automatic execution", async () => {
    const coordinator = new MobileCreationQueueCoordinator();
    let runs = 0;
    coordinator.register({
      source: "image-studio",
      tasks: () => [
        {
          id: "unknown-network-boundary",
          sourceTaskId: "unknown-network-boundary",
          source: "image-studio" as const,
          accountId: "a",
          status: "reconciling" as const,
          createdAt: 1,
        },
      ],
      run: async () => {
        runs += 1;
        return { status: "settled" };
      },
      block: () => undefined,
      resume: () => undefined,
    });

    await coordinator.wake("a");
    expect(runs).toBe(0);
  });

  test("continues the shared FIFO after one source task fails", async () => {
    const coordinator = new MobileCreationQueueCoordinator();
    const events: string[] = [];
    const imageTasks = [
      {
        id: "image-2",
        sourceTaskId: "image-2",
        source: "image-studio" as const,
        accountId: "a",
        status: "queued" as const,
        createdAt: 20,
      },
    ];
    const contentTasks = [
      {
        id: "content-1",
        sourceTaskId: "content-1",
        source: "content-workbench" as const,
        accountId: "a",
        status: "queued" as const,
        createdAt: 10,
      },
      {
        id: "content-3",
        sourceTaskId: "content-3",
        source: "content-workbench" as const,
        accountId: "a",
        status: "queued" as const,
        createdAt: 30,
      },
    ];
    coordinator.register({
      source: "image-studio",
      tasks: () => imageTasks,
      run: async (task) => {
        events.push(task.id);
        imageTasks.splice(0, 1);
        return { status: "settled" };
      },
      block: () => undefined,
      resume: () => undefined,
    });
    coordinator.register({
      source: "content-workbench",
      tasks: () => contentTasks,
      run: async (task) => {
        events.push(task.id);
        contentTasks.splice(
          contentTasks.findIndex((item) => item.id === task.id),
          1,
        );
        // A normal provider failure settles only this request. The next item
        // must still be selected from both source queues.
        return { status: "settled" };
      },
      block: () => undefined,
      resume: () => undefined,
    });

    await coordinator.wake("a");
    expect(events).toEqual(["content-1", "image-2", "content-3"]);
  });

  test("blocks both creation sources until the account is explicitly resumed", async () => {
    const coordinator = new MobileCreationQueueCoordinator();
    const blocked: string[] = [];
    const resumed: string[] = [];
    const task = {
      id: "image-1",
      sourceTaskId: "image-1",
      source: "image-studio" as const,
      accountId: "a",
      status: "queued" as const,
      createdAt: 10,
    };
    coordinator.register({
      source: "image-studio",
      tasks: () => [task],
      run: async () => ({ status: "blocked", blockedReason: "balance" }),
      block: (_account, _createdAt, reason) => blocked.push(`image:${reason}`),
      resume: (account) => resumed.push(`image:${account}`),
    });
    coordinator.register({
      source: "content-workbench",
      tasks: () => [],
      run: async () => ({ status: "skipped" }),
      block: (_account, _createdAt, reason) => blocked.push(`content:${reason}`),
      resume: (account) => resumed.push(`content:${account}`),
    });

    await coordinator.wake("a");
    expect(blocked).toEqual(["image:balance", "content:balance"]);
    await coordinator.resume("a");
    expect(resumed).toEqual(["image:a", "content:a"]);
  });

  test("keeps a durable executor across navigation but refuses a different account session", async () => {
    const coordinator = new MobileCreationQueueCoordinator();
    const events: string[] = [];
    let activeAccount = "";
    const tasks = [
      {
        id: "image-1",
        sourceTaskId: "image-1",
        source: "image-studio" as const,
        accountId: "a",
        status: "queued" as const,
        createdAt: 1,
      },
    ];
    const unregister = coordinator.register({
      source: "image-studio",
      persistOnUnmount: true,
      isActive: (accountId) => accountId === activeAccount,
      tasks: () => tasks,
      run: async (task) => {
        events.push(task.id);
        tasks.splice(0, 1);
        return { status: "settled" };
      },
      block: () => undefined,
      resume: () => undefined,
    });

    // The component can unmount while the account is signed out or switched.
    // Its retained executor cannot borrow a different account's credentials.
    unregister();
    await coordinator.wake("a");
    expect(events).toEqual([]);

    activeAccount = "a";
    await coordinator.wake("a");
    expect(events).toEqual(["image-1"]);
  });

  test("uses task ID as a stable tie-breaker and stops on an unavailable source", async () => {
    const coordinator = new MobileCreationQueueCoordinator();
    const events: string[] = [];
    const imageTasks = [
      {
        id: "z-image",
        sourceTaskId: "z-image",
        source: "image-studio" as const,
        accountId: "a",
        status: "queued" as const,
        createdAt: 10,
      },
    ];
    const contentTasks = [
      {
        id: "a-content",
        sourceTaskId: "a-content",
        source: "content-workbench" as const,
        accountId: "a",
        status: "queued" as const,
        createdAt: 10,
      },
    ];
    coordinator.register({
      source: "image-studio",
      tasks: () => imageTasks,
      run: async (task) => {
        events.push(task.id);
        imageTasks.splice(0, 1);
        return { status: "settled" };
      },
      block: () => undefined,
      resume: () => undefined,
    });
    coordinator.register({
      source: "content-workbench",
      tasks: () => contentTasks,
      run: async () => ({ status: "skipped" }),
      block: () => undefined,
      resume: () => undefined,
    });

    await coordinator.wake("a");
    expect(events).toEqual([]);
    expect(imageTasks).toHaveLength(1);
  });
});
