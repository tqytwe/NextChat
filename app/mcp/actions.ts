import { getClientConfig } from "@/app/config/client";

import {
  DEFAULT_MCP_CONFIG,
  ListToolsResponse,
  McpConfigData,
  McpRequestMessage,
  ServerConfig,
  ServerStatusResponse,
} from "./types";

const MCP_ENDPOINT = "/api/mcp";

type McpToolsByClient = Array<{
  clientId: string;
  tools: ListToolsResponse | null;
}>;

function shouldUseDisabledMcp() {
  const clientConfig = getClientConfig();
  return clientConfig?.isAndroidApp || clientConfig?.buildMode === "export";
}

async function callMcpAction<T>(action: string, args: any[] = []): Promise<T> {
  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, args }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    throw new Error(payload?.message || "MCP request failed");
  }

  return payload.data as T;
}

export async function isMcpEnabled() {
  if (shouldUseDisabledMcp()) {
    return false;
  }

  try {
    return await callMcpAction<boolean>("isMcpEnabled");
  } catch (error) {
    console.error("[MCP] failed to check status:", error);
    return false;
  }
}

export async function initializeMcpSystem() {
  if (shouldUseDisabledMcp()) {
    return;
  }

  return callMcpAction<McpConfigData | undefined>("initializeMcpSystem");
}

export async function getAvailableClientsCount() {
  if (shouldUseDisabledMcp()) {
    return 0;
  }

  return callMcpAction<number>("getAvailableClientsCount");
}

export async function getAllTools() {
  if (shouldUseDisabledMcp()) {
    return [];
  }

  return callMcpAction<McpToolsByClient>("getAllTools");
}

export async function executeMcpAction(
  clientId: string,
  request: McpRequestMessage,
) {
  if (shouldUseDisabledMcp()) {
    throw new Error("MCP is disabled in this build");
  }

  return callMcpAction("executeMcpAction", [clientId, request]);
}

export async function getClientsStatus() {
  if (shouldUseDisabledMcp()) {
    return {};
  }

  return callMcpAction<Record<string, ServerStatusResponse>>(
    "getClientsStatus",
  );
}

export async function getClientTools(clientId: string) {
  if (shouldUseDisabledMcp()) {
    return null;
  }

  return callMcpAction("getClientTools", [clientId]);
}

export async function getMcpConfigFromFile(): Promise<McpConfigData> {
  if (shouldUseDisabledMcp()) {
    return DEFAULT_MCP_CONFIG;
  }

  return callMcpAction<McpConfigData>("getMcpConfigFromFile");
}

export async function addMcpServer(
  clientId: string,
  serverConfig: ServerConfig,
) {
  if (shouldUseDisabledMcp()) {
    return DEFAULT_MCP_CONFIG;
  }

  return callMcpAction<McpConfigData>("addMcpServer", [clientId, serverConfig]);
}

export async function pauseMcpServer(clientId: string) {
  if (shouldUseDisabledMcp()) {
    return DEFAULT_MCP_CONFIG;
  }

  return callMcpAction<McpConfigData>("pauseMcpServer", [clientId]);
}

export async function resumeMcpServer(clientId: string) {
  if (shouldUseDisabledMcp()) {
    return DEFAULT_MCP_CONFIG;
  }

  await callMcpAction<void>("resumeMcpServer", [clientId]);
}

export async function restartAllClients() {
  if (shouldUseDisabledMcp()) {
    return DEFAULT_MCP_CONFIG;
  }

  return callMcpAction<McpConfigData>("restartAllClients");
}
