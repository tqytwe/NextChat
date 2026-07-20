import { proxySub2APINextChatBFF } from "@/app/api/sub2api-managed";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  return proxySub2APINextChatBFF(req, "bootstrap", { method: "GET" });
}

export const runtime = "edge";
