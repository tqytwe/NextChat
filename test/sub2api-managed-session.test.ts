import { webcrypto } from "crypto";
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

let openManagedSession: typeof import("../app/api/sub2api-managed").openManagedSession;
let sealManagedSession: typeof import("../app/api/sub2api-managed").sealManagedSession;

beforeAll(async () => {
  ({ openManagedSession, sealManagedSession } = await import(
    "../app/api/sub2api-managed"
  ));
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
