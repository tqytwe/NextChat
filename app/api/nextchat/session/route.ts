import { getServerSideConfig } from "@/app/config/server";
import {
  SUB2API_MANAGED_SESSION_COOKIE,
  getSub2APIManagedCookiePath,
  isSub2APIManagedMode,
  sealManagedSession,
} from "@/app/api/sub2api-managed";
import { NextRequest, NextResponse } from "next/server";

type LaunchExchangeBody = {
  launch_token?: string;
};

type Sub2APIEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
};

type Sub2APISessionResponse = {
  user_id: number;
  api_key: string;
  api_key_id: number;
  expires_at: string;
};

export async function POST(req: NextRequest) {
  const config = getServerSideConfig();
  if (!isSub2APIManagedMode(config)) {
    return NextResponse.json(
      { error: true, msg: "Sub2API managed mode is disabled" },
      { status: 404 },
    );
  }

  const sub2apiBaseUrl = normalizeOrigin(config.sub2apiBaseUrl);
  if (
    !sub2apiBaseUrl ||
    !config.sub2apiNextChatSecret ||
    !config.nextChatSessionSecret
  ) {
    return NextResponse.json(
      { error: true, msg: "Sub2API managed session is not configured" },
      { status: 500 },
    );
  }

  let body: LaunchExchangeBody;
  try {
    body = (await req.json()) as LaunchExchangeBody;
  } catch {
    return NextResponse.json(
      { error: true, msg: "Invalid request body" },
      { status: 400 },
    );
  }

  const launchToken = body.launch_token?.trim();
  if (!launchToken) {
    return NextResponse.json(
      { error: true, msg: "launch_token is required" },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${sub2apiBaseUrl}/api/v1/nextchat/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-NextChat-Secret": config.sub2apiNextChatSecret,
    },
    body: JSON.stringify({ launch_token: launchToken }),
    cache: "no-store",
  });

  const envelope = (await safeReadJSON(upstream)) as
    | Sub2APIEnvelope<Sub2APISessionResponse>
    | undefined;
  if (!upstream.ok || envelope?.code !== 0 || !envelope.data?.api_key) {
    return NextResponse.json(
      {
        error: true,
        msg: envelope?.message || "Failed to exchange launch token",
      },
      { status: upstream.status || 502 },
    );
  }

  const session = {
    userId: envelope.data.user_id,
    apiKey: envelope.data.api_key,
    apiKeyId: envelope.data.api_key_id,
    expiresAt: envelope.data.expires_at,
  };
  const sealed = await sealManagedSession(
    session,
    config.nextChatSessionSecret,
  );
  const expires = new Date(session.expiresAt);
  const maxAge = Math.max(
    0,
    Math.floor((expires.getTime() - Date.now()) / 1000),
  );
  const res = NextResponse.json({
    ok: true,
    user_id: session.userId,
    expires_at: session.expiresAt,
  });

  res.cookies.set({
    name: SUB2API_MANAGED_SESSION_COOKIE,
    value: sealed,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: getSub2APIManagedCookiePath(config),
    expires,
    maxAge,
  });

  return res;
}

export async function DELETE() {
  const config = getServerSideConfig();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SUB2API_MANAGED_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: getSub2APIManagedCookiePath(config),
    maxAge: 0,
  });
  return res;
}

async function safeReadJSON(res: Response) {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function normalizeOrigin(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/g, "");
}
