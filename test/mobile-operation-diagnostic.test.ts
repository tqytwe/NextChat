import { describe, expect, test } from "@jest/globals";

import {
  getMobileOperationDiagnostics,
  parseMobileOperationError,
  recordMobileOperationDiagnostic,
} from "../app/client/mobile-operation-diagnostic";

describe("mobile operation diagnostics", () => {
  test("normalizes OpenAI error code, type and request ID", () => {
    expect(
      parseMobileOperationError(
        JSON.stringify({
          error: { code: "MODEL_UNAVAILABLE", type: "invalid_request_error", message: "removed" },
          request_id: "gw-1",
        }),
        "client-1",
      ),
    ).toEqual({ message: "removed", code: "MODEL_UNAVAILABLE", requestId: "gw-1", retryAfterSeconds: undefined });
  });

  test("uses platform metadata when the gateway returns an envelope", () => {
    expect(
      parseMobileOperationError(
        JSON.stringify({ message: "busy", metadata: { error_code: "RATE_LIMITED", request_id: "gw-2", retry_after: 12 } }),
        "client-2",
      ),
    ).toEqual({ message: "busy", code: "RATE_LIMITED", requestId: "gw-2", retryAfterSeconds: 12 });
  });

  test("persists only the safe request correlation tuple", () => {
    localStorage.clear();
    recordMobileOperationDiagnostic({
      operation: "images.generate",
      clientRequestId: "client-1",
      requestId: "gateway-1",
      status: 503,
      code: "UPSTREAM_UNAVAILABLE",
      groupId: 45,
      modelId: "video-model",
      purpose: "image",
      apiKeyId: 17,
      phase: "failed",
      accepted: false,
      // The type intentionally has no fields for secrets or payloads.
    });
    expect(getMobileOperationDiagnostics()).toEqual([
      expect.objectContaining({
        operation: "images.generate",
        clientRequestId: "client-1",
        requestId: "gateway-1",
        status: 503,
        code: "UPSTREAM_UNAVAILABLE",
        groupId: 45,
        modelId: "video-model",
        purpose: "image",
        apiKeyId: 17,
        phase: "failed",
        accepted: false,
      }),
    ]);
  });
});
