import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { MobileTask } from "../app/client/mobile-platform";

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

  test("lists tasks with the stable cursor and filter contract", async () => {
    await platform.listMobileTasks(baseUrl, accessToken, {
      kind: "image",
      status: "completed",
      query: "poster",
      date_from: "2026-08-01T00:00:00Z",
      date_to: "2026-08-31T00:00:00Z",
      order: "desc",
      cursor: "next-page",
      limit: 50,
    });

    expect(managedJsonRequest.mock.calls[0][1]).toBe(
      "/api/v1/mobile/tasks?kind=image&status=completed&query=poster&date_from=2026-08-01T00%3A00%3A00Z&date_to=2026-08-31T00%3A00%3A00Z&order=desc&cursor=next-page&limit=50",
    );
  });

  test("bulk deletes tasks with a stable request and idempotency key", async () => {
    await platform.bulkDeleteMobileTasks(baseUrl, accessToken, {
      ids: ["task-1", "task-2"],
      client_request_id: "bulk-delete-1",
    });

    const init = managedJsonRequest.mock.calls[0][2] as RequestInit;
    expect(managedJsonRequest).toHaveBeenCalledWith(
      baseUrl,
      "/api/v1/mobile/tasks/bulk-delete",
      expect.objectContaining({ method: "POST" }),
      accessToken,
    );
    expect(init.body).toBe(
      JSON.stringify({
        ids: ["task-1", "task-2"],
        client_request_id: "bulk-delete-1",
      }),
    );
    const headers = new Headers(init.headers);
    expect(headers.get("X-Client-Request-ID")).toBe("bulk-delete-1");
    expect(headers.get("Idempotency-Key")).toBe("bulk-delete-1");
    expect(headers.get("X-Request-ID")).toBe("bulk-delete-1");
  });

  test("bulk cancels tasks with the same idempotency contract", async () => {
    await platform.bulkCancelMobileTasks(baseUrl, accessToken, {
      ids: ["task-1"],
      client_request_id: "bulk-cancel-1",
    });
    expect(managedJsonRequest.mock.calls[0][1]).toBe(
      "/api/v1/mobile/tasks/bulk-cancel",
    );
    const headers = new Headers(
      (managedJsonRequest.mock.calls[0][2] as RequestInit).headers,
    );
    expect(headers.get("Idempotency-Key")).toBe("bulk-cancel-1");
  });

  test("merges refreshed and appended task pages without duplicates", () => {
    const existing = [
      { id: "task-2", status: "running" },
      { id: "task-1", status: "queued" },
    ] as MobileTask[];
    const refreshed = [
      { id: "task-3", status: "queued" },
      { id: "task-2", status: "completed" },
    ] as MobileTask[];

    expect(
      platform.mergeMobileTaskPages(existing, refreshed, "refresh"),
    ).toEqual([refreshed[0], refreshed[1], existing[1]]);
    expect(
      platform.mergeMobileTaskPages(existing, [existing[1]], "append"),
    ).toEqual(existing);
  });

  test("uploads assets through the managed native-capable transport", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["image"]), "image.png");
    managedRequestText.mockResolvedValue({
      ok: true,
      status: 200,
      text: JSON.stringify({
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
    });

    await expect(
      platform.uploadMobileAssetFormData(baseUrl, accessToken, formData),
    ).resolves.toMatchObject({ id: "asset-1" });

    expect(managedJsonRequest).not.toHaveBeenCalled();
    expect(managedRequestText).toHaveBeenCalledWith(
      baseUrl,
      "/api/v1/mobile/assets",
      expect.objectContaining({
        method: "POST",
        body: formData,
      }),
      expect.any(Headers),
    );
    expect(window.fetch).not.toHaveBeenCalled();
    const headers = managedRequestText.mock.calls[0][3] as Headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.get("X-Client-Request-ID")).toMatch(/^mobile-asset-/);
    expect(headers.get("Idempotency-Key")).toBe(
      headers.get("X-Client-Request-ID"),
    );
    expect(headers.get("X-Request-ID")).toBe(
      headers.get("X-Client-Request-ID"),
    );
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

  test("supports cloud project CRUD with retry-safe request identifiers", async () => {
    const client = platform.createMobilePlatformClient(baseUrl, accessToken);

    await client.projects.create({
      name: "Launch",
      description: "Assets",
      task_ids: ["task-1"],
      asset_ids: ["asset-1"],
      client_request_id: "project-create-1",
    });
    await client.projects.list({ page: 2, page_size: 20 });
    await client.projects.detail("project-1");
    await client.projects.update("project-1", {
      name: "Launch v2",
      client_request_id: "project-update-1",
    });
    await client.projects.delete("project-1", "project-delete-1");

    expect(managedJsonRequest.mock.calls.map((call) => call[1])).toEqual([
      "/api/v1/mobile/projects",
      "/api/v1/mobile/projects?page=2&page_size=20",
      "/api/v1/mobile/projects/project-1",
      "/api/v1/mobile/projects/project-1",
      "/api/v1/mobile/projects/project-1",
    ]);
    expect(managedJsonRequest.mock.calls[0][2]).toMatchObject({
      method: "POST",
    });
    expect(managedJsonRequest.mock.calls[3][2]).toMatchObject({
      method: "PUT",
    });
    const deleteInit = managedJsonRequest.mock.calls[4][2] as RequestInit;
    expect(deleteInit.method).toBe("DELETE");
    expect(new Headers(deleteInit.headers).get("X-Client-Request-ID")).toBe(
      "project-delete-1",
    );
  });

  test("wraps account, session, image history, redeem, and payment operations", async () => {
    const client = platform.createMobilePlatformClient(baseUrl, accessToken);

    await client.protocol.get();
    await client.session.status();
    await client.account.summary();
    await client.sessions.list();
    await client.sessions.switchGroup("image", {
      group_id: 12,
      model: "gpt-image-1",
      client_request_id: "switch-1",
    });
    await client.tasks.delete("task-1");
    await client.tasks.bulkDelete({
      ids: ["task-1"],
      client_request_id: "bulk-delete-2",
    });
    await client.tasks.bulkCancel({
      ids: ["task-2"],
      client_request_id: "bulk-cancel-2",
    });
    await client.imageHistory.list({ status: "failed", limit: 10 });
    await client.imageHistory.delete("history-1");
    await client.imageHistory.retry("history-2", {
      client_request_id: "retry-image-1",
    });
    await client.redeemCodes.redeem({
      redeem_code: "JSD-2026",
      client_request_id: "redeem-1",
    });
    await client.redeemCodes.history({ limit: 20 });
    await client.payments.create({
      provider: "wechat",
      payment_type: "wechat",
      order_type: "balance",
      amount: 50,
      plan_id: "pro",
      payment_source: "android_app",
      is_mobile: true,
      client_request_id: "pay-1",
    });
    await client.payments.detail("order-1");
    await client.payments.sync("order-1", {
      client_request_id: "sync-1",
    });

    expect(managedJsonRequest.mock.calls.map((call) => call[1])).toEqual([
      "/api/v1/mobile/protocol",
      "/api/v1/mobile/session/status",
      "/api/v1/mobile/account-summary",
      "/api/v1/mobile/sessions",
      "/api/v1/mobile/sessions/image/switch-group",
      "/api/v1/mobile/tasks/task-1",
      "/api/v1/mobile/tasks/bulk-delete",
      "/api/v1/mobile/tasks/bulk-cancel",
      "/api/v1/mobile/image-history?status=failed&limit=10",
      "/api/v1/mobile/image-history/history-1",
      "/api/v1/mobile/image-history/history-2/retry",
      "/api/v1/redeem-codes/redeem",
      "/api/v1/redeem-codes/history?limit=20",
      "/api/v1/mobile/payments/create",
      "/api/v1/mobile/payments/order-1",
      "/api/v1/mobile/payments/order-1/sync",
    ]);
    expect(managedJsonRequest.mock.calls[4][2]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        group_id: 12,
        model: "gpt-image-1",
        client_request_id: "switch-1",
      }),
    });
    expect(managedJsonRequest.mock.calls[5][2]).toMatchObject({
      method: "DELETE",
    });
    expect(managedJsonRequest.mock.calls[11][2]).toMatchObject({
      method: "POST",
    });
    expect(managedJsonRequest.mock.calls[13][2]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        provider: "wechat",
        payment_type: "wechat",
        order_type: "balance",
        amount: 50,
        plan_id: "pro",
        payment_source: "android_app",
        is_mobile: true,
        client_request_id: "pay-1",
      }),
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
