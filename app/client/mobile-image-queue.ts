export type MobileImageQueueStatus =
  | "queued"
  | "submitting"
  | "running"
  | "reconciling"
  | "blocked"
  | "success"
  | "partial"
  | "error"
  | "cancelled";

export type MobileImageQueueTask = {
  id: string;
  accountId: string;
  status: MobileImageQueueStatus;
  createdAt?: number;
  blockedReason?: CreationQueueBlockReason;
};

export type CreationQueueBlockReason =
  | "authentication"
  | "balance"
  | "permission";

export type CreationQueueFailure = {
  status: "error" | "blocked";
  blockedReason?: CreationQueueBlockReason;
};

/**
 * A blocked task needs an explicit user recovery action. Network, provider and
 * one-model failures remain terminal for that one task only, so later queued
 * work can continue without silently spending a second request.
 */
export function classifyCreationQueueFailure(input: {
  status?: number;
  code?: string;
  message?: string;
}): CreationQueueFailure {
  const status = Number(input.status || 0);
  const raw = `${input.code || ""} ${input.message || ""}`.toLowerCase();
  if (
    status === 401 ||
    /unauthori[sz]ed|token.*expired|login.*expired|登录.*过期|请.*登录/.test(
      raw,
    )
  ) {
    return { status: "blocked", blockedReason: "authentication" };
  }
  if (
    status === 402 ||
    /insufficient.*balance|balance.*insufficient|余额.*不足|充值/.test(raw)
  ) {
    return { status: "blocked", blockedReason: "balance" };
  }
  if (
    status === 403 ||
    /permission|forbidden|not allowed|权限|无权|不可用.*分组/.test(raw)
  ) {
    return { status: "blocked", blockedReason: "permission" };
  }
  return { status: "error" };
}

export function isCreationQueueActive(status: MobileImageQueueStatus | string) {
  return ["queued", "submitting", "running", "reconciling", "blocked"].includes(
    String(status || ""),
  );
}

export function nextRunnableCreationQueueTask<T extends MobileImageQueueTask>(
  tasks: T[],
  accountId: string,
): T | undefined {
  return tasks
    .filter((task) => canRunMobileImageQueueTask(task, accountId))
    .sort(
      (left, right) =>
        Number(left.createdAt || 0) - Number(right.createdAt || 0) ||
        String(left.id).localeCompare(String(right.id)),
    )[0];
}

export function resumeBlockedCreationQueueTasks<T extends MobileImageQueueTask>(
  tasks: T[],
  accountId: string,
): T[] {
  return tasks.map((task) =>
    task.accountId === accountId && task.status === "blocked"
      ? { ...task, status: "queued", blockedReason: undefined }
      : task,
  );
}

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

/**
 * Account-scoped execution gate shared by simple image generation and content
 * projects. It deliberately serializes only a single request at a time, while
 * callers persist the queue state before asking the gate to execute.
 */
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
