import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const managedJsonRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const managedRequestText = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const managedApiUrl = jest.fn(
  (baseUrl: string, path: string) =>
    `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`,
);

class MockManagedApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly code?: number | string,
  ) {
    super(message);
    this.name = "ManagedApiError";
  }
}

jest.unstable_mockModule("@/app/client/managed-nextchat", () => ({
  ManagedApiError: MockManagedApiError,
  managedApiUrl,
  managedJsonRequest,
  managedRequestText,
}));

const platform = await import("../app/client/mobile-platform");

describe("mobile platform client", () => {
  const baseUrl = "https://api.example.com/";
  const accessToken = "secret-token";

  beforeEach(() => {
    jest.clearAllMocks();
    managedJsonRequest.mockResolvedValue({ ok: true });
    managedRequestText.mockResolvedValue({
      ok: true,
      status: 200,
      text: "ok",
    });
    window.fetch = jest.fn<typeof window.fetch>();
  });

  test("lists assets with the mobile API prefix and query parameters", async () => {
    await platform.listMobileAssets(baseUrl, accessToken, {
      kind: "image",
      status: "ready",
      query: "头像",
      page: 2,
      page_size: 20,
    });

    expect(managedJsonRequest).toHaveBeenCalledWith(
      baseUrl,
      "/api/v1/mobile/assets?kind=image&status=ready&query=%E5%A4%B4%E5%83%8F&page=2&page_size=20",
      expect.objectContaining({ method: "GET" }),
      accessToken,
    );
  });

  test("creates tasks without putting the token in the JSON body", async () => {
    await platform.createMobileTask(baseUrl, accessToken, {
      kind: "image",
      operation: "generate",
      client_request_id: "client-1",
      model: "gpt-image-1",
      resource: { prompt: "一张产品海报" },
      parameters: { size: "1024x1024" },
    });

    const init = managedJsonRequest.mock.calls[0][2] as RequestInit;
    expect(managedJsonRequest).toHaveBeenCalledWith(
      baseUrl,
      "/api/v1/mobile/tasks",
      expect.objectContaining({ method: "POST" }),
      accessToken,
    );
    expect(init.body).toBe(
      JSON.stringify({
        kind: "image",
        operation: "generate",
        client_request_id: "client-1",
        model: "gpt-image-1",
        resource: { prompt: "一张产品海报" },
        parameters: { size: "1024x1024" },
      }),
    );
    expect(String(init.body)).not.toContain(accessToken);
  });

  test("uploads assets with FormData over fetch instead of JSON request", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["image"]), "image.png");
    jest.mocked(window.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            code: 0,
            data: {
              id: "asset-1",
              kind: "image",
              status: "ready",
              content_type: "image/png",
              byte_size: 5,
              content_url: "https://cdn.example.com/a.png",
              created_at: "2026-07-26T00:00:00Z",
            },
          }),
        ),
    } as Response);

    await expect(
      platform.uploadMobileAssetFormData(baseUrl, accessToken, formData),
    ).resolves.toMatchObject({ id: "asset-1" });

    expect(managedJsonRequest).not.toHaveBeenCalled();
    expect(window.fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/mobile/assets",
      expect.objectContaining({
        method: "POST",
        body: formData,
        headers: expect.any(Headers),
      }),
    );
    const headers = jest.mocked(window.fetch).mock.calls[0][1]
      ?.headers as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
    expect(headers.has("Content-Type")).toBe(false);
  });

  test("wraps skill, support, and device operations in a bound client", async () => {
    const client = platform.createMobilePlatformClient(baseUrl, accessToken);

    await client.skills.install("paint pro", { version: "1.2.0" });
    await client.skills.uninstall("paint pro");
    await client.skills.use("paint pro", { asset_ids: ["asset-1"] });
    await client.tasks.status("task-1", { status: "running", progress: 25 });
    await client.support.tickets.message("ticket-1", { content: "需要帮助" });
    await client.support.tickets.close("ticket-1", { reason: "resolved" });
    await client.devices.register("install-1", {
      fcm_token: "fcm-1",
      platform: "android",
      app_version: "2.0.27",
      locale: "zh-CN",
    });
    await client.devices.delete("install-1");

    expect(managedJsonRequest.mock.calls.map((call) => call[1])).toEqual([
      "/api/v1/mobile/skills/paint%20pro/install",
      "/api/v1/mobile/skills/paint%20pro/install",
      "/api/v1/mobile/skills/paint%20pro/use",
      "/api/v1/mobile/tasks/task-1/status",
      "/api/v1/mobile/support/tickets/ticket-1/messages",
      "/api/v1/mobile/support/tickets/ticket-1/close",
      "/api/v1/mobile/devices/install-1",
      "/api/v1/mobile/devices/install-1",
    ]);
    expect(managedJsonRequest.mock.calls[1][2]).toMatchObject({
      method: "DELETE",
    });
    expect(managedJsonRequest.mock.calls[6][2]).toMatchObject({
      method: "PUT",
    });
  });

  test("exposes a text helper backed by managedRequestText", async () => {
    await platform.mobilePlatformRequestText(
      baseUrl,
      accessToken,
      "/assets/export",
      { method: "GET" },
    );

    expect(managedRequestText).toHaveBeenCalledWith(
      baseUrl,
      "/api/v1/mobile/assets/export",
      expect.objectContaining({ method: "GET" }),
      expect.any(Headers),
    );
    const headers = managedRequestText.mock.calls[0][3] as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
  });
});
