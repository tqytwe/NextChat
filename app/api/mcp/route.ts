import { NextRequest, NextResponse } from "next/server";

import {
  addMcpServer,
  executeMcpAction,
  getAllTools,
  getAvailableClientsCount,
  getClientTools,
  getClientsStatus,
  getMcpConfigFromFile,
  initializeMcpSystem,
  isMcpEnabled,
  pauseMcpServer,
  restartAllClients,
  resumeMcpServer,
} from "@/server/mcp/actions";

export const runtime = "nodejs";

type McpAction =
  | "addMcpServer"
  | "executeMcpAction"
  | "getAllTools"
  | "getAvailableClientsCount"
  | "getClientTools"
  | "getClientsStatus"
  | "getMcpConfigFromFile"
  | "initializeMcpSystem"
  | "isMcpEnabled"
  | "pauseMcpServer"
  | "restartAllClients"
  | "resumeMcpServer";

const ACTIONS: Record<McpAction, (...args: any[]) => Promise<any>> = {
  addMcpServer,
  executeMcpAction,
  getAllTools,
  getAvailableClientsCount,
  getClientTools,
  getClientsStatus,
  getMcpConfigFromFile,
  initializeMcpSystem,
  isMcpEnabled,
  pauseMcpServer,
  restartAllClients,
  resumeMcpServer,
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: McpAction;
      args?: any[];
    };
    const action = body.action;

    if (!action || !(action in ACTIONS)) {
      return NextResponse.json(
        { error: true, message: "Unknown MCP action" },
        { status: 400 },
      );
    }

    const data = await ACTIONS[action](...(body.args ?? []));
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: true, message }, { status: 500 });
  }
}
