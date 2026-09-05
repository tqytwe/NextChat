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

/**
 * The image studio and the project workbench retain their own local records:
 * each record has different result data and migration history. This is the
 * common, persisted-task projection used to select one account-wide FIFO
 * instead of letting either screen reserve a second worker independently.
 */
export type CreationQueueSource = "image-studio" | "content-workbench";

export type CreationQueueTask = MobileImageQueueTask & {
  source: CreationQueueSource;
  /** The durable ID in the source store; `id` is globally namespaced. */
  sourceTaskId: string;
};

export type CreationQueueRunOutcome =
  | { status: "settled" }
  | { status: "blocked"; blockedReason?: CreationQueueBlockReason }
  /** The record was cancelled/deleted/settled by its owner; continue FIFO. */
  | { status: "stale" }
  /** The source cannot safely run until an explicit later wake. */
  | { status: "unavailable" };

export type CreationQueueSourceRegistration = {
  source: CreationQueueSource;
  tasks: (accountId: string) => CreationQueueTask[];
  run: (task: CreationQueueTask) => Promise<CreationQueueRunOutcome>;
  /** Persist a safe task result when the executor itself throws. */
  onExecutorError?: (
    task: CreationQueueTask,
    error: unknown,
  ) => Promise<void> | void;
  /**
   * A screen can leave its executor registered while it is not visible, but
   * it must never submit a saved request using a later account's session.
   * The application shell checks this immediately before selecting work.
   */
  isActive?: (accountId: string) => boolean;
  /**
   * Keep a registered executor for the lifetime of the authenticated app.
   * This is used by durable creation queues: navigation must not stop an
   * already registered source from progressing its persisted FIFO records.
   */
  persistOnUnmount?: boolean;
  /** Visible pages temporarily override the retained app-level worker. */
  priority?: number;
  block: (
    accountId: string,
    createdAt: number,
    reason?: CreationQueueBlockReason,
  ) => void;
  resume: (accountId: string) => void;
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
  const code = String(input.code || "")
    .trim()
    .toUpperCase();
  if (
    status === 401 ||
    code === "TOKEN_EXPIRED" ||
    code === "AUTHENTICATION_REQUIRED"
  ) {
    return { status: "blocked", blockedReason: "authentication" };
  }
  if (
    status === 402 ||
    code === "INSUFFICIENT_BALANCE" ||
    code === "BALANCE_INSUFFICIENT"
  ) {
    return { status: "blocked", blockedReason: "balance" };
  }
  if (code === "GROUP_ACCESS_DENIED" || code === "GROUP_PERMISSION_DENIED") {
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

export function nextRunnableCreationTask(
  tasks: CreationQueueTask[],
  accountId: string,
) {
  return nextRunnableCreationQueueTask(tasks, accountId);
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
 * The coordinator owns scheduling, while each screen remains the owner of its
 * durable task payload. It intentionally does not persist a duplicate task
 * table: image-history and content-kit records are already the recovery
 * source, and duplicating them would make interrupted work ambiguous.
 *
 * A source only runs one immutable task per call. After its terminal outcome,
 * the next oldest task is selected from every registered source. A normal
 * provider/model/network failure therefore cannot strand later queued work.
 */
export class MobileCreationQueueCoordinator {
  private registrations = new Map<
    CreationQueueSource,
    CreationQueueSourceRegistration[]
  >();
  private drains = new Map<string, Promise<void>>();

  register(registration: CreationQueueSourceRegistration) {
    const current = this.registrations.get(registration.source) || [];
    // There is one retained worker per source. Replacing it after a login
    // transition must not displace a currently visible page's higher-priority
    // executor, because that page owns its cancel/progress controls.
    const next = registration.persistOnUnmount
      ? current.filter((item) => !item.persistOnUnmount)
      : current;
    next.push(registration);
    this.registrations.set(registration.source, next);
    return () => {
      if (registration.persistOnUnmount) return;
      const remaining = (
        this.registrations.get(registration.source) || []
      ).filter((item) => item !== registration);
      if (remaining.length)
        this.registrations.set(registration.source, remaining);
      else this.registrations.delete(registration.source);
    };
  }

  private activeRegistrations() {
    return Array.from(this.registrations.values()).map((registrations) =>
      registrations.reduce((selected, candidate) =>
        Number(candidate.priority || 0) >= Number(selected.priority || 0)
          ? candidate
          : selected,
      ),
    );
  }

  wake(accountId: string) {
    const account = String(accountId || "").trim();
    if (!account) return Promise.resolve();
    const existing = this.drains.get(account);
    if (existing) return existing;
    const drain = this.drain(account).finally(() => {
      if (this.drains.get(account) === drain) this.drains.delete(account);
    });
    this.drains.set(account, drain);
    return drain;
  }

  resume(accountId: string) {
    const account = String(accountId || "").trim();
    if (!account) return Promise.resolve();
    this.activeRegistrations().forEach((registration) =>
      registration.resume(account),
    );
    return this.wake(account);
  }

  private next(accountId: string) {
    return this.activeRegistrations()
      .flatMap((registration) =>
        registration.tasks(accountId).map((task) => ({ registration, task })),
      )
      .filter(
        ({ registration }) => registration.isActive?.(accountId) !== false,
      )
      .filter(({ task }) => canRunMobileImageQueueTask(task, accountId))
      .sort(
        (left, right) =>
          Number(left.task.createdAt || 0) -
            Number(right.task.createdAt || 0) ||
          left.task.id.localeCompare(right.task.id),
      )[0];
  }

  private async drain(accountId: string) {
    for (let guard = 0; guard < 10_000; guard += 1) {
      const selected = this.next(accountId);
      if (!selected) return;
      let outcome: CreationQueueRunOutcome;
      try {
        outcome = await selected.registration.run(selected.task);
      } catch (error) {
        // The source owns task persistence. An unexpected bridge/storage
        // failure must not reject the account drain into a stuck UI state.
        // If its owner settles the selected task, continue FIFO.
        if (!selected.registration.onExecutorError) return;
        try {
          await selected.registration.onExecutorError(selected.task, error);
        } catch {
          return;
        }
        continue;
      }
      if (outcome.status === "unavailable") return;
      if (outcome.status === "stale") continue;
      if (outcome.status === "blocked") {
        const blockedReason = outcome.blockedReason;
        this.activeRegistrations().forEach((registration) =>
          registration.block(
            accountId,
            Number(selected.task.createdAt || 0),
            blockedReason,
          ),
        );
        return;
      }
    }
  }
}
