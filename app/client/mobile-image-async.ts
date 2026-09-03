export type ManagedImageTaskResponse = {
  ok: boolean;
  status: number;
  text: string;
  requestId?: string;
  imageApiKey?: string;
  /** Set after the gateway has accepted a durable task. */
  taskId?: string;
};

/**
 * The asynchronous task API returns the original Images response under
 * `result`. Mobile BFF callers can additionally wrap that task row in
 * `data`, so accept both shapes before deciding that a completed task has no
 * image output.
 */
export function extractManagedImageResultData(payload: any): any[] {
  const candidates = [
    payload?.data,
    payload?.images,
    payload?.result?.data,
    payload?.result?.images,
    payload?.data?.result?.data,
    payload?.data?.result?.images,
    payload?.output,
    payload?.data?.output,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  if (
    payload?.b64_json ||
    payload?.url ||
    payload?.image ||
    payload?.data?.b64_json ||
    payload?.data?.url ||
    payload?.data?.image
  ) {
    return [
      payload?.data?.b64_json || payload?.data?.url || payload?.data?.image
        ? payload.data
        : payload,
    ];
  }
  return [];
}

/**
 * A durable task has not been accepted until the API has returned an ID. Only
 * those pre-admission capability misses may use the existing synchronous
 * Images endpoint; polling failures after acceptance must never cause a new
 * billable request.
 */
export function isManagedAsyncImagePreAdmissionUnsupported(
  response: Pick<ManagedImageTaskResponse, "status" | "text" | "taskId">,
) {
  // A 503 is safe only for the gateway's explicit pre-admission readiness
  // errors. Generic upstream 503s may have crossed the billing boundary and
  // must remain terminal/reconciling instead of being replayed synchronously.
  if (response.taskId || ![404, 405, 501, 503].includes(response.status)) {
    return false;
  }
  try {
    const payload = JSON.parse(response.text || "{}");
    const code = String(
      payload?.error?.code || payload?.code || "",
    ).toLowerCase();
    const message = String(
      payload?.error?.message || payload?.message || response.text || "",
    ).toLowerCase();
    const preAdmissionCode = [
      "not_found_error",
      "not_found",
      "method_not_allowed",
      "image_task_not_ready",
      "image_task_unavailable",
      "async_image_not_ready",
      "async_image_tasks_not_enabled",
    ].includes(code);
    const preAdmissionMessage =
      /async image|image task.*(?:not ready|not enabled|unavailable)|images api is not supported for this platform|not supported|not found|disabled|未启用|未就绪|暂不可用|不支持/.test(
        message,
      );
    return preAdmissionCode || preAdmissionMessage;
  } catch {
    return false;
  }
}

type ManagedImageTaskPayload = {
  id?: string;
  task_id?: string;
  poll_url?: string;
  status?: string;
  state?: string;
  http_status?: number;
};

type RequestOptions = {
  submit: () => Promise<ManagedImageTaskResponse>;
  poll: (pollPath: string, taskId: string) => Promise<ManagedImageTaskResponse>;
  sleep?: (milliseconds: number) => Promise<void>;
  pollIntervalMs?: number;
  timeoutMs?: number;
  timeoutMessage?: string;
  signal?: AbortSignal;
  onAccepted?: (taskId: string, pollPath: string) => void | Promise<void>;
};

type PollOptions = Omit<RequestOptions, "submit" | "onAccepted"> & {
  taskId: string;
  pollPath?: string;
};

function parsePayload(text: string): ManagedImageTaskPayload | null {
  if (!text) return null;
  try {
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return null;
    const envelope = payload as { data?: unknown };
    return (
      envelope.data &&
      typeof envelope.data === "object" &&
      !Array.isArray(envelope.data)
        ? envelope.data
        : payload
    ) as ManagedImageTaskPayload;
  } catch {
    return null;
  }
}

function terminalFailure(
  response: ManagedImageTaskResponse,
  payload: ManagedImageTaskPayload,
): ManagedImageTaskResponse {
  return {
    ...response,
    ok: false,
    status: Number(payload.http_status) || 502,
  };
}

/**
 * Run the durable image task contract. The submit callback is intentionally
 * separate from polling so a transport timeout can never replay a billable
 * image request. Callers may persist the task ID before invoking this helper.
 */
export async function requestManagedAsyncImageTask({
  submit,
  poll,
  sleep = (milliseconds) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
  pollIntervalMs = 3_000,
  timeoutMs = 20 * 60 * 1_000,
  timeoutMessage = "Image task polling timed out.",
  signal,
  onAccepted,
}: RequestOptions): Promise<ManagedImageTaskResponse> {
  const submitted = await submit();
  if (!submitted.ok) return submitted;

  const task = parsePayload(submitted.text);
  const taskId = String(task?.task_id || task?.id || "").trim();
  if (!taskId) return submitted;

  const pollPath = String(
    task?.poll_url || `/v1/images/tasks/${encodeURIComponent(taskId)}`,
  ).trim();
  const accepted = { ...submitted, taskId };
  await onAccepted?.(taskId, pollPath);
  return pollManagedAsyncImageTask({
    taskId,
    pollPath,
    poll,
    sleep,
    pollIntervalMs,
    timeoutMs,
    timeoutMessage,
    signal,
    initialResponse: accepted,
  });
}

export async function pollManagedAsyncImageTask({
  taskId,
  pollPath,
  poll,
  sleep = (milliseconds) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
  pollIntervalMs = 3_000,
  timeoutMs = 20 * 60 * 1_000,
  timeoutMessage = "Image task polling timed out.",
  signal,
  initialResponse,
}: PollOptions & {
  initialResponse?: ManagedImageTaskResponse;
}): Promise<ManagedImageTaskResponse> {
  const normalizedTaskId = String(taskId || "").trim();
  if (!normalizedTaskId) {
    return {
      ok: false,
      status: 400,
      text: JSON.stringify({
        error: {
          code: "IMAGE_TASK_ID_REQUIRED",
          message: "Image task id is required.",
        },
      }),
    };
  }
  const normalizedPollPath = String(
    pollPath || `/v1/images/tasks/${encodeURIComponent(normalizedTaskId)}`,
  ).trim();
  const startedAt = Date.now();
  let lastResponse = initialResponse
    ? { ...initialResponse, taskId: normalizedTaskId }
    : ({
        ok: true,
        status: 202,
        text: JSON.stringify({ status: "queued", task_id: normalizedTaskId }),
        taskId: normalizedTaskId,
      } satisfies ManagedImageTaskResponse);

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await sleep(pollIntervalMs);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const next = await poll(normalizedPollPath, normalizedTaskId);
    lastResponse = { ...next, taskId: normalizedTaskId };
    if (!next.ok) return lastResponse;
    const payload = parsePayload(next.text);
    const status = String(
      payload?.status || payload?.state || "",
    ).toLowerCase();
    if (status === "completed" || status === "partial") return lastResponse;
    if (
      status === "failed" ||
      status === "cancelled" ||
      status === "canceled" ||
      status === "expired"
    ) {
      return terminalFailure(lastResponse, payload || {});
    }
  }

  return {
    ...lastResponse,
    ok: false,
    status: 504,
    text: JSON.stringify({
      error: {
        code: "IMAGE_TASK_POLL_TIMEOUT",
        message: timeoutMessage,
      },
    }),
  };
}
