import { proxySub2APINextChatBFF } from "@/app/api/sub2api-managed";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_NEXTCHAT_IMAGE_STUDIO_ROUTES = [
  /^GET models$/,
  /^GET estimate$/,
  /^POST generate$/,
  /^POST references$/,
  /^DELETE references\/[^/]+$/,
  /^GET jobs$/,
  /^GET jobs\/active$/,
  /^GET jobs\/[^/]+$/,
  /^GET jobs\/[^/]+\/download$/,
  /^POST jobs\/[^/]+\/cancel$/,
  /^DELETE jobs\/[^/]+$/,
  /^GET assets\/[^/]+\/thumbnail$/,
  /^GET assets\/[^/]+\/content$/,
  /^GET assets\/[^/]+\/download$/,
] as const;

type RouteContext = {
  params: { path?: string[] };
};

async function handle(req: NextRequest, context: RouteContext) {
  const subpath = normalizeImageStudioSubpath(context.params.path);
  if (!isAllowedImageStudioRoute(req.method, subpath)) {
    return NextResponse.json(
      { error: true, msg: "NextChat image studio route is not allowed" },
      { status: 404 },
    );
  }

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("Content-Type") || undefined;
  const idempotencyKey = req.headers.get("Idempotency-Key") || undefined;
  if (contentType) headers["Content-Type"] = contentType;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const init: RequestInit = {
    method: req.method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  return proxySub2APINextChatBFF(req, `image-studio/${subpath}`, init);
}

function normalizeImageStudioSubpath(path?: string[]) {
  return (path ?? [])
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function isAllowedImageStudioRoute(method: string, subpath: string) {
  const routeKey = `${method.toUpperCase()} ${subpath}`;
  return ALLOWED_NEXTCHAT_IMAGE_STUDIO_ROUTES.some((pattern) =>
    pattern.test(routeKey),
  );
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

export const runtime = "edge";
