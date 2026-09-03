import { describe, expect, test } from "@jest/globals";

import {
  extractManagedImageResultData,
  isManagedAsyncImagePreAdmissionUnsupported,
  pollManagedAsyncImageTask,
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
  test("reads completed image output from a mobile BFF data envelope", () => {
    expect(
      extractManagedImageResultData({
        data: { result: { data: [{ b64_json: "completed-image" }] } },
      }),
    ).toEqual([{ b64_json: "completed-image" }]);
  });

  test("falls back only before an unsupported async endpoint accepts a task", () => {
    const unsupported = {
      ok: false,
      status: 404,
      text: JSON.stringify({
        error: {
          code: "not_found_error",
          message: "Images API is not supported for this platform",
        },
      }),
    } satisfies ManagedImageTaskResponse;
    expect(isManagedAsyncImagePreAdmissionUnsupported(unsupported)).toBe(true);
    expect(
      isManagedAsyncImagePreAdmissionUnsupported({
        ...unsupported,
        taskId: "already-accepted",
      }),
    ).toBe(false);
  });

  test("falls back when the async worker explicitly reports it is not ready", () => {
    expect(
      isManagedAsyncImagePreAdmissionUnsupported({
        status: 503,
        text: JSON.stringify({
          error: {
            code: "IMAGE_TASK_NOT_READY",
            message: "image task worker is not ready",
          },
        }),
      }),
    ).toBe(true);
  });

  test("does not replay a generic upstream 503", () => {
    expect(
      isManagedAsyncImagePreAdmissionUnsupported({
        status: 503,
        text: JSON.stringify({
          error: {
            code: "upstream_unavailable",
            message: "No available compatible accounts",
          },
        }),
      }),
    ).toBe(false);
  });

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

  test("persists the accepted task identity before the first poll", async () => {
    const accepted: Array<[string, string]> = [];
    const result = await requestManagedAsyncImageTask({
      submit: async () =>
        response(
          { data: { task_id: "img-task-envelope", poll_url: "/v1/images/tasks/img-task-envelope" } },
          { status: 202 },
        ),
      poll: async () => response({ status: "completed", result: { data: [] } }),
      onAccepted: async (taskId, pollPath) => {
        accepted.push([taskId, pollPath]);
      },
      sleep: async () => undefined,
    });

    expect(accepted).toEqual([
      ["img-task-envelope", "/v1/images/tasks/img-task-envelope"],
    ]);
    expect(result.taskId).toBe("img-task-envelope");
  });

  test("reconciles an accepted task without submitting another image request", async () => {
    let pollCalls = 0;
    const result = await pollManagedAsyncImageTask({
      taskId: "img-task-resume",
      pollPath: "/v1/images/tasks/img-task-resume",
      poll: async () => {
        pollCalls += 1;
        return response({
          status: "completed",
          result: { data: [{ b64_json: "abc" }] },
        });
      },
      sleep: async () => undefined,
    });

    expect(pollCalls).toBe(1);
    expect(result.taskId).toBe("img-task-resume");
    expect(JSON.parse(result.text)).toMatchObject({
      result: { data: [{ b64_json: "abc" }] },
    });
  });
});
