import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const managedJsonRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mobileInstallationId = jest.fn(
  () => "4bf9e6f0-6e77-4fdc-8ae8-e4f5b4ec4852",
);

jest.unstable_mockModule("@/app/client/managed-nextchat", () => ({
  managedJsonRequest,
}));
jest.unstable_mockModule("@/app/client/mobile-push", () => ({
  mobileInstallationId,
}));

const attribution = await import("../app/client/mobile-attribution");

describe("mobile attribution client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    attribution.resetMobileAttributionReportsForTest();
    managedJsonRequest.mockResolvedValue({ created: true });
    window.history.replaceState({}, "", "/");
  });

  test("reports a signed invitation token without exposing it outside the request body", async () => {
    window.history.replaceState({}, "", "/?invite_token=v1.payload.signature");

    await expect(
      attribution.reportMobileAttributionEvent({
        baseUrl: "https://api.example.com",
        eventType: "open",
        appVersion: "2.0.64",
        locale: "zh-CN",
        metadata: { surface: "android_app", event_name: "first_launch" },
      }),
    ).resolves.toBe(true);

    expect(managedJsonRequest).toHaveBeenCalledWith(
      "https://api.example.com",
      "/api/v1/mobile/attribution/events",
      expect.objectContaining({ method: "POST" }),
      undefined,
    );
    const request = managedJsonRequest.mock.calls[0][2] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      installation_id: "4bf9e6f0-6e77-4fdc-8ae8-e4f5b4ec4852",
      event_type: "open",
      platform: "android",
      app_version: "2.0.64",
      locale: "zh-CN",
      attribution_token: "v1.payload.signature",
    });
    expect(body.idempotency_key).toContain("nextchat:open:");
  });

  test("deduplicates successful lifecycle events but retries failed reporting", async () => {
    const options = {
      baseUrl: "https://api.example.com",
      eventType: "active" as const,
      accessToken: "access-token",
      userScope: 42,
    };
    await attribution.reportMobileAttributionEvent(options);
    await attribution.reportMobileAttributionEvent(options);
    expect(managedJsonRequest).toHaveBeenCalledTimes(1);

    attribution.resetMobileAttributionReportsForTest();
    managedJsonRequest.mockRejectedValueOnce(new Error("offline"));
    await expect(
      attribution.reportMobileAttributionEvent(options),
    ).resolves.toBe(false);
    await expect(
      attribution.reportMobileAttributionEvent(options),
    ).resolves.toBe(true);
    expect(managedJsonRequest).toHaveBeenCalledTimes(3);
  });
});
