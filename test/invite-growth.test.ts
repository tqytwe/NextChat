import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const managedJsonRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.unstable_mockModule("@/app/client/managed-nextchat", () => ({
  managedJsonRequest,
}));

const growth = await import("../app/client/invite-growth");

describe("invite growth client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    managedJsonRequest.mockResolvedValue({ code: 0, data: { accepted: true } });
    localStorage.clear();
  });

  test("canonicalizes legacy ref and aff params into aff_code with campaign context", () => {
    const referral = growth.captureInviteReferral(
      "?ref=OLDREF&campaign=august-invite&token=signed-token",
      1_000,
    );

    expect(referral).toEqual({
      aff_code: "OLDREF",
      campaign_id: "august-invite",
      token: "signed-token",
      expires_at: 1_000 + 30 * 24 * 60 * 60 * 1000,
    });
    expect(growth.buildCanonicalRegistrationPayload(referral)).toEqual({
      aff_code: "OLDREF",
      campaign_id: "august-invite",
      invite_token: "signed-token",
    });
  });

  test("prefers explicit aff_code but accepts old aff and ref links", () => {
    expect(
      growth.captureInviteReferral("?ref=OLD&aff=AFF&aff_code=CANONICAL"),
    ).toMatchObject({ aff_code: "CANONICAL" });
    expect(growth.captureInviteReferral("?aff=AFF")).toMatchObject({
      aff_code: "AFF",
    });
  });

  test("preserves token-only links and does not truncate signed tokens", () => {
    const signedToken = `signed.${"x".repeat(1024)}.signature`;
    const referral = growth.captureInviteReferral(
      `https://www.jisudeng.com/invite?invite_token=${signedToken}`,
      5_000,
    );

    expect(referral).toEqual({
      token: signedToken,
      expires_at: 5_000 + growth.INVITE_REFERRAL_TTL_MS,
    });
    growth.storeInviteReferral(referral);
    expect(growth.loadInviteReferral(6_000)).toEqual(referral);
    expect(growth.buildCanonicalRegistrationPayload(referral)).toEqual({
      invite_token: signedToken,
    });
  });

  test("stores a stable installation id and creates attribution event payloads", () => {
    const first = growth.getInviteInstallationId();
    const second = growth.getInviteInstallationId();
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second).toBe(first);

    expect(
      growth.buildInviteAttributionEvent("registered", first, "2.1.0", {
        eventId: "event-registered-1",
        attributionToken: "signed-token",
      }),
    ).toMatchObject({
      installation_id: first,
      event_type: "register",
      idempotency_key: "event-registered-1",
      app_version: "2.1.0",
      platform: "android",
      attribution_token: "signed-token",
    });
  });

  test("reports anonymous lifecycle events through the attribution endpoint", async () => {
    await growth.reportInviteLifecycleEvent(
      "https://api.example.com",
      "",
      "active",
      "2.1.0",
      "install-1",
    );

    expect(managedJsonRequest).toHaveBeenCalledWith(
      "https://api.example.com",
      "/api/v1/mobile/attribution/events",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"event_type":"active"'),
      }),
      undefined,
    );
  });

  test("builds a dual-QR poster payload without exposing the access token", () => {
    const payload = growth.buildInvitePosterPayload({
      registerUrl:
        "https://www.jisudeng.com/register?aff_code=AFF&campaign=aug",
      appUrl: "https://www.jisudeng.com/download/android?campaign=aug",
      headline: "Invite friends, unlock rewards",
      body: "Register and complete the campaign steps to unlock more.",
      locale: "en-US",
    });

    expect(payload.registerQrValue).toContain("aff_code=AFF");
    expect(payload.appQrValue).toContain("/download/android");
    expect(payload.shareText).toContain("Invite friends");
    expect(payload.shareText).not.toContain("access-token");
    expect(payload.registerLabel).toBe("Join on the web");
    expect(payload.appLabel).toBe("Download the APP");
  });

  test.each(["midnight", "light", "celebration"] as const)(
    "builds the %s poster with Chinese dual-QR labels",
    (theme) => {
      const payload = growth.buildInvitePosterPayload({
        registerUrl:
          "https://www.jisudeng.com/register?invite_token=signed-token",
        appUrl:
          "https://www.jisudeng.com/download/android?invite_token=signed-token",
        headline: "邀请好友，解锁活动奖励",
        body: "好友完成充值与消费后计为有效邀请。",
        locale: "zh-CN",
        theme,
      });

      expect(payload.theme).toBe(theme);
      expect(payload.registerLabel).toBe("扫码参加网页活动");
      expect(payload.appLabel).toBe("扫码下载 APP");
      expect(payload.registerQrValue).toContain("/register");
      expect(payload.appQrValue).toContain("/download/android");
    },
  );
});
