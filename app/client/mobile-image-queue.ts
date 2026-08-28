export type MobileImageQueueStatus =
  | "queued"
  | "submitting"
  | "running"
  | "reconciling"
  | "success"
  | "partial"
  | "error"
  | "cancelled";

export type MobileImageQueueTask = {
  id: string;
  accountId: string;
  status: MobileImageQueueStatus;
};

/**
 * Only a locally queued request is safe to submit after hydration. A request
 * that had already crossed the network boundary must first be reconciled with
 * its existing task/billing evidence; resending it would risk a second charge.
 */
export function recoverMobileImageQueueTask<T extends MobileImageQueueTask>(
  task: T,
): T {
  if (task.status !== "submitting" && task.status !== "running") return task;
  return { ...task, status: "reconciling" };
}

export function canRunMobileImageQueueTask(
  task: Pick<MobileImageQueueTask, "accountId" | "status"> | undefined,
  activeAccountId: string,
) {
  return Boolean(
    task &&
      task.status === "queued" &&
      task.accountId &&
      task.accountId === activeAccountId,
  );
}

/** A FIFO gate shared by simple image generation and content projects. */
export class MobileImageAccountQueueGate {
  private tails = new Map<string, Promise<void>>();

  async run<T>(accountId: string, work: () => Promise<T>): Promise<T> {
    const key = String(accountId || "anonymous");
    const previous = this.tails.get(key) || Promise.resolve();
    let release!: () => void;
    const tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => tail);
    this.tails.set(key, queued);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.tails.get(key) === queued) this.tails.delete(key);
    }
  }
}
