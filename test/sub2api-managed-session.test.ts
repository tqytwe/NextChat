import { webcrypto } from "crypto";
import { jest } from "@jest/globals";
import {
  Headers as NodeFetchHeaders,
  Request as NodeFetchRequest,
  Response as NodeFetchResponse,
} from "node-fetch";
import { TextDecoder, TextEncoder } from "util";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}
if (typeof (globalThis as any).TextEncoder === "undefined") {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (typeof (globalThis as any).TextDecoder === "undefined") {
  (globalThis as any).TextDecoder = TextDecoder;
}
if (typeof (globalThis as any).Request === "undefined") {
  (globalThis as any).Request = NodeFetchRequest;
}
if (typeof (globalThis as any).Response === "undefined") {
  (globalThis as any).Response = NodeFetchResponse;
}
if (typeof (globalThis as any).Headers === "undefined") {
  (globalThis as any).Headers = NodeFetchHeaders;
}
if (typeof (globalThis as any).Response.json !== "function") {
  (globalThis as any).Response.json = (body: any, init?: ResponseInit) =>
    new (globalThis as any).Response(JSON.stringify(body), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
}

let openManagedSession: typeof import("../app/api/sub2api-managed").openManagedSession;
let sealManagedSession: typeof import("../app/api/sub2api-managed").sealManagedSession;
let canUseProviderApiInManagedMode: typeof import("../app/api/sub2api-managed").canUseProviderApiInManagedMode;
let SUB2API_MANAGED_SESSION_COOKIE: typeof import("../app/api/sub2api-managed").SUB2API_MANAGED_SESSION_COOKIE;

beforeAll(async () => {
  ({
    SUB2API_MANAGED_SESSION_COOKIE,
    canUseProviderApiInManagedMode,
    openManagedSession,
    sealManagedSession,
  } = await import("../app/api/sub2api-managed"));
});

describe("Sub2API managed session cookie", () => {
  const secret = "test-session-secret";

  test("opens a valid sealed session", async () => {
    const sealed = await sealManagedSession(
      {
        userId: 42,
        apiKey: "sk-managed",
        apiKeyId: 7,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      secret,
    );

    await expect(openManagedSession(sealed, secret)).resolves.toMatchObject({
      userId: 42,
      apiKey: "sk-managed",
      apiKeyId: 7,
    });
  });

  test("rejects a tampered session", async () => {
    const sealed = await sealManagedSession(
      {
        userId: 42,
        apiKey: "sk-managed",
        apiKeyId: 7,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      secret,
    );
    const parts = sealed.split(".");
    parts[2] = (parts[2].startsWith("a") ? "b" : "a") + parts[2].slice(1);
    const tampered = parts.join(".");

    await expect(openManagedSession(tampered, secret)).resolves.toBeNull();
  });

  test("rejects an expired session", async () => {
    const sealed = await sealManagedSession(
      {
        userId: 42,
        apiKey: "sk-managed",
        apiKeyId: 7,
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      },
      secret,
    );

    await expect(openManagedSession(sealed, secret)).resolves.toBeNull();
  });
});

describe("Sub2API managed provider API guard", () => {
  test("allows only the OpenAI-compatible gateway provider path", () => {
    expect(canUseProviderApiInManagedMode("/api/openai")).toBe(true);
    expect(canUseProviderApiInManagedMode("/api/google")).toBe(false);
    expect(canUseProviderApiInManagedMode("/api/anthropic")).toBe(false);
    expect(canUseProviderApiInManagedMode("/api/stability")).toBe(false);
    expect(canUseProviderApiInManagedMode("/api/tencent")).toBe(false);
    expect(canUseProviderApiInManagedMode("/api/proxy")).toBe(false);
  });
});

describe("Sub2API managed direct provider routes", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      SUB2API_MANAGED_MODE: "true",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("blocks the standalone Tencent route", async () => {
    const { POST } = await import("../app/api/tencent/route");

    const res = await POST({ method: "POST" } as any, {
      params: { path: [] },
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.msg).toContain("/api/tencent");
  });
});

describe("Sub2API managed session status route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      SUB2API_MANAGED_MODE: "true",
      NEXTCHAT_SESSION_SECRET: "test-session-secret",
      NEXTCHAT_BASE_PATH: "/",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("reports unauthenticated without a session cookie", async () => {
    const { GET } = await import("../app/api/nextchat/session/route");
    const req = nextSessionStatusRequest();

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, authenticated: false });
  });

  test("reports authenticated session status without exposing the API key", async () => {
    const managed = await import("../app/api/sub2api-managed");
    const { GET } = await import("../app/api/nextchat/session/route");
    const sealed = await managed.sealManagedSession(
      {
        userId: 42,
        apiKey: "sk-managed",
        apiKeyId: 7,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      "test-session-secret",
    );
    const req = nextSessionStatusRequest(sealed);

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      authenticated: true,
      user_id: 42,
      api_key_id: 7,
    });
    expect(JSON.stringify(body)).not.toContain("sk-managed");
  });

  test("clears the managed session cookie on logout", async () => {
    const { DELETE } = await import("../app/api/nextchat/session/route");

    const res = await DELETE();
    const setCookie = res.headers.get("set-cookie");

    expect(res.status).toBe(200);
    expect(setCookie).toContain(SUB2API_MANAGED_SESSION_COOKIE);
    expect(setCookie).toContain("Max-Age=0");
  });
});

describe("Sub2API managed BFF proxy", () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      SUB2API_MANAGED_MODE: "true",
      SUB2API_BASE_URL: "https://sub2api.internal/",
      SUB2API_NEXTCHAT_SECRET: "server-secret",
      NEXTCHAT_SESSION_SECRET: "test-session-secret",
      NEXTCHAT_BASE_PATH: "/",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
    });
  });

  test("rejects BFF requests without a managed session", async () => {
    const managed = await import("../app/api/sub2api-managed");

    const res = await managed.proxySub2APINextChatBFF(
      nextSessionStatusRequest(),
      "bootstrap",
      { method: "GET" },
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.msg).toContain("managed session");
  });

  test("forwards BFF requests with server controlled identity headers", async () => {
    const managed = await import("../app/api/sub2api-managed");
    const sealed = await managed.sealManagedSession(
      {
        userId: 42,
        apiKey: "sk-managed-secret",
        apiKeyId: 7,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      "test-session-secret",
    );
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ code: 0, data: { ok: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });

    const res = await managed.proxySub2APINextChatBFF(
      nextSessionStatusRequest(sealed),
      "bootstrap",
      { method: "GET" },
    );
    const body = await res.json();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(res.status).toBe(200);
    expect(body).toEqual({ code: 0, data: { ok: true } });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://sub2api.internal/api/v1/nextchat/bootstrap",
    );
    expect(headers["X-NextChat-Secret"]).toBe("server-secret");
    expect(headers["X-NextChat-User-ID"]).toBe("42");
    expect(headers["X-NextChat-API-Key-ID"]).toBe("7");
    expect(JSON.stringify(headers)).not.toContain("sk-managed-secret");
  });

  test("preserves binary BFF response bodies", async () => {
    const managed = await import("../app/api/sub2api-managed");
    const sealed = await managed.sealManagedSession(
      {
        userId: 42,
        apiKey: "sk-managed-secret",
        apiKeyId: 7,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      "test-session-secret",
    );
    Object.defineProperty(globalThis, "fetch", {
      value: jest.fn(async () => {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      }),
      configurable: true,
    });

    const res = await managed.proxySub2APINextChatBFF(
      nextSessionStatusRequest(sealed),
      "image-studio/assets/asset_1/content",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual([
      1, 2, 3,
    ]);
  });

  test("image studio catch-all route proxies allowed paths", async () => {
    const managed = await import("../app/api/sub2api-managed");
    const route = await import(
      "../app/api/nextchat/image-studio/[...path]/route"
    );
    const sealed = await managed.sealManagedSession(
      {
        userId: 42,
        apiKey: "sk-managed-secret",
        apiKeyId: 7,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      "test-session-secret",
    );
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ code: 0, data: { models: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });

    const res = await route.GET(nextBFFRequest(sealed, "GET"), {
      params: { path: ["models"] },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://sub2api.internal/api/v1/nextchat/image-studio/models",
    );
    expect(headers["X-NextChat-User-ID"]).toBe("42");
    expect(headers["X-NextChat-API-Key-ID"]).toBe("7");
  });

  test("image studio catch-all route forwards generate JSON bodies", async () => {
    const managed = await import("../app/api/sub2api-managed");
    const route = await import(
      "../app/api/nextchat/image-studio/[...path]/route"
    );
    const sealed = await managed.sealManagedSession(
      {
        userId: 42,
        apiKey: "sk-managed-secret",
        apiKeyId: 7,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      "test-session-secret",
    );
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ code: 0, data: { async: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    });

    const res = await route.POST(
      nextBFFRequest(
        sealed,
        "POST",
        "application/json",
        JSON.stringify({ template_id: "free-create", user_prompt: "cat" }),
      ),
      { params: { path: ["generate"] } },
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = Buffer.from(init.body as ArrayBuffer).toString("utf8");

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://sub2api.internal/api/v1/nextchat/image-studio/generate",
    );
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(body).toContain('"user_prompt":"cat"');
  });

  test("image studio catch-all route rejects unknown paths", async () => {
    const route = await import(
      "../app/api/nextchat/image-studio/[...path]/route"
    );

    const res = await route.GET(nextBFFRequest(undefined, "GET"), {
      params: { path: ["admin", "users"] },
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.msg).toContain("not allowed");
  });
});

function nextSessionStatusRequest(cookieValue?: string) {
  return {
    cookies: {
      get(name: string) {
        if (name !== SUB2API_MANAGED_SESSION_COOKIE || !cookieValue) {
          return undefined;
        }
        return { value: cookieValue };
      },
    },
  } as any;
}

function nextBFFRequest(
  cookieValue: string | undefined,
  method: string,
  contentType?: string,
  body = "",
) {
  return {
    method,
    headers: new Headers(
      contentType ? { "Content-Type": contentType } : undefined,
    ),
    cookies: {
      get(name: string) {
        if (name !== SUB2API_MANAGED_SESSION_COOKIE || !cookieValue) {
          return undefined;
        }
        return { value: cookieValue };
      },
    },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  } as any;
}
