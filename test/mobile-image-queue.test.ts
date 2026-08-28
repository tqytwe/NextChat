import {
  canRunMobileImageQueueTask,
  MobileImageAccountQueueGate,
  recoverMobileImageQueueTask,
} from "../app/client/mobile-image-queue";

describe("mobile image account queue", () => {
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

  test("never replays an in-flight task automatically", () => {
    expect(recoverMobileImageQueueTask({ id: "a", accountId: "1", status: "running" })).toMatchObject({ status: "reconciling" });
    expect(recoverMobileImageQueueTask({ id: "a", accountId: "1", status: "submitting" })).toMatchObject({ status: "reconciling" });
    expect(canRunMobileImageQueueTask({ accountId: "1", status: "queued" }, "1")).toBe(true);
    expect(canRunMobileImageQueueTask({ accountId: "1", status: "reconciling" }, "1")).toBe(false);
    expect(canRunMobileImageQueueTask({ accountId: "1", status: "queued" }, "2")).toBe(false);
  });
});
