import { describe, expect, test } from "@jest/globals";

import {
  requestManagedAsyncImageTask,
  type ManagedImageTaskResponse,
} from "../app/client/mobile-image-async";

function response(
  body: unknown,
  overrides: Partial<ManagedImageTaskResponse> = {},
): ManagedImageTaskResponse {
  return {
    ok: true,
    status: 200,
    text: JSON.stringify(body),
    ...overrides,
  };
}

describe("managed asynchronous image task contract", () => {
  test("submits once, polls a 202 task, and returns nested result data", async () => {
    let submitCalls = 0;
    const pollCalls: Array<[string, string]> = [];
    const submit = async () => {
      submitCalls += 1;
      return response(
        { id: "img-task-1", task_id: "img-task-1", status: "queued", poll_url: "/v1/images/tasks/img-task-1" },
        { status: 202 },
      );
    };
    const poll = async (path: string, taskId: string) => {
      pollCalls.push([path, taskId]);
      return pollCalls.length === 1
        ? response({ status: "processing" })
        : response({ status: "completed", result: { data: [{ b64_json: "abc" }] } });
    };

    const result = await requestManagedAsyncImageTask({
      submit,
      poll,
      sleep: async () => undefined,
    });

    expect(submitCalls).toBe(1);
    expect(pollCalls).toHaveLength(2);
    expect(pollCalls[0][0]).toBe("/v1/images/tasks/img-task-1");
    expect(JSON.parse(result.text)).toMatchObject({
      status: "completed",
      result: { data: [{ b64_json: "abc" }] },
    });
  });

  test("returns a terminal failure and does not keep the queue waiting", async () => {
    let pollCalls = 0;
    const submit = async () =>
      response(
        { id: "img-task-2", task_id: "img-task-2", status: "queued" },
        { status: 202 },
      );
    const poll = async () => {
      pollCalls += 1;
      return response({
        status: "failed",
        error: { code: "MODEL_UNAVAILABLE", message: "model unavailable" },
      });
    };

    const result = await requestManagedAsyncImageTask({
      submit,
      poll,
      sleep: async () => undefined,
    });

    expect(pollCalls).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(JSON.parse(result.text)).toMatchObject({
      status: "failed",
      error: { code: "MODEL_UNAVAILABLE" },
    });
  });

  test("never retries a submission when the response has no task id", async () => {
    let submitCalls = 0;
    let pollCalls = 0;
    const submit = async () => {
      submitCalls += 1;
      return response({ status: "queued" }, { status: 202 });
    };
    const poll = async () => {
      pollCalls += 1;
      return response({ status: "completed" });
    };

    const result = await requestManagedAsyncImageTask({
      submit,
      poll,
      sleep: async () => undefined,
    });

    expect(submitCalls).toBe(1);
    expect(pollCalls).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
  });
});
