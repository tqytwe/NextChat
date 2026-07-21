import { isSub2APIManagedMode } from "@/app/api/sub2api-managed";
import { getServerSideConfig } from "@/app/config/server";
import type { SupportContactConfig } from "@/app/utils/support-contact";
import { NextResponse } from "next/server";

type Sub2APIEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
};

type PublicSettingsPayload = {
  support_contact?: SupportContactConfig;
};

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getServerSideConfig();
  if (!isSub2APIManagedMode(config)) {
    return NextResponse.json(
      { error: true, msg: "Sub2API managed mode is disabled" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const baseUrl = normalizeOrigin(config.sub2apiBaseUrl);
  if (!baseUrl) {
    return NextResponse.json(
      { error: true, msg: "Sub2API public settings route is not configured" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const upstream = await fetch(`${baseUrl}/api/v1/settings/public`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const envelope = (await safeReadJSON(upstream)) as
    | Sub2APIEnvelope<PublicSettingsPayload>
    | PublicSettingsPayload
    | undefined;
  const data =
    envelope && "data" in envelope
      ? envelope.data
      : (envelope as PublicSettingsPayload | undefined);

  if (!upstream.ok || !data) {
    return NextResponse.json(
      { error: true, msg: "Failed to load Sub2API public settings" },
      {
        status: upstream.status || 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { support_contact: data.support_contact },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
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
