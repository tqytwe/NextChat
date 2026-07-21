import { proxySub2APINextChatBFF } from "@/app/api/sub2api-managed";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_NEXTCHAT_IMAGE_PROMPT_ROUTES = [
  /^GET$/,
  /^GET [0-9]+$/,
  /^POST [0-9]+\/favorite$/,
  /^DELETE [0-9]+\/favorite$/,
  /^POST [0-9]+\/use$/,
] as const;

type RouteContext = {
  params: { path?: string[] };
};

async function handle(req: NextRequest, context: RouteContext) {
  const subpath = normalizeImagePromptSubpath(context.params.path);
  if (!isAllowedImagePromptRoute(req.method, subpath)) {
    return NextResponse.json(
      { error: true, msg: "NextChat image prompt route is not allowed" },
      { status: 404 },
    );
  }

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("Content-Type") || undefined;
  if (contentType) headers["Content-Type"] = contentType;
  const init: RequestInit = {
    method: req.method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  return proxySub2APINextChatBFF(
    req,
    `image-prompts${subpath ? `/${subpath}` : ""}`,
    init,
  );
}

function normalizeImagePromptSubpath(path?: string[]) {
  return (path ?? [])
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function isAllowedImagePromptRoute(method: string, subpath: string) {
  const routeKey = `${method.toUpperCase()} ${subpath}`.trim();
  return ALLOWED_NEXTCHAT_IMAGE_PROMPT_ROUTES.some((pattern) =>
    pattern.test(routeKey),
  );
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

export const runtime = "edge";
