import {
  MobileImageAccountQueueGate,
  classifyCreationQueueFailure,
  nextRunnableCreationQueueTask,
  recoverMobileImageQueueTask,
  resumeBlockedCreationQueueTasks,
} from "../app/client/mobile-image-queue";

describe("mobile creation queue", () => {
  test("runs one account FIFO while independent accounts are not serialized", async () => {
    const gate = new MobileImageAccountQueueGate();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const first = gate.run("account-a", async () => {
      events.push("a1:start");
      await new Promise<void>((resolve) => (releaseFirst = resolve));
      events.push("a1:end");
    });
    const second = gate.run("account-a", async () => events.push("a2"));
    const other = gate.run("account-b", async () => events.push("b1"));
    await other;
    expect(events).toEqual(["a1:start", "b1"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["a1:start", "b1", "a1:end", "a2"]);
  });

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
});
