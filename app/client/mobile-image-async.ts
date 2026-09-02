export type ManagedImageTaskResponse = {
  ok: boolean;
  status: number;
  text: string;
  requestId?: string;
  imageApiKey?: string;
};

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
};

function parsePayload(text: string): ManagedImageTaskPayload | null {
  if (!text) return null;
  try {
    const payload = JSON.parse(text);
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as ManagedImageTaskPayload)
      : null;
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
}: RequestOptions): Promise<ManagedImageTaskResponse> {
  const submitted = await submit();
  if (!submitted.ok) return submitted;

  const task = parsePayload(submitted.text);
  const taskId = String(task?.task_id || task?.id || "").trim();
  if (!taskId) return submitted;

  const pollPath = String(
    task?.poll_url || `/v1/images/tasks/${encodeURIComponent(taskId)}`,
  ).trim();
  const startedAt = Date.now();
  let lastResponse = submitted;

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await sleep(pollIntervalMs);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const next = await poll(pollPath, taskId);
    lastResponse = next;
    if (!next.ok) return next;
    const payload = parsePayload(next.text);
    const status = String(
      payload?.status || payload?.state || "",
    ).toLowerCase();
    if (status === "completed" || status === "partial") return next;
    if (
      status === "failed" ||
      status === "cancelled" ||
      status === "canceled" ||
      status === "expired"
    ) {
      return terminalFailure(next, payload || {});
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
