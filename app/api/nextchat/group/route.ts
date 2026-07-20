import { proxySub2APINextChatBFF } from "@/app/api/sub2api-managed";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxySub2APINextChatBFF(req, "group", {
    method: "POST",
    body,
  });
}

export const runtime = "edge";
