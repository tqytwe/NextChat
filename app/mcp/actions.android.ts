import { DEFAULT_MCP_CONFIG, McpConfigData, ServerConfig } from "./types";

export function isMcpEnabled() {
  return false;
}

export async function initializeMcpSystem() {}

export async function getAvailableClientsCount() {
  return 0;
}

export async function getAllTools() {
  return [];
}

export async function executeMcpAction() {
  throw new Error("MCP is disabled in Android build");
}

export async function getClientsStatus() {
  return {};
}

export async function getClientTools() {
  return null;
}

export async function getMcpConfigFromFile(): Promise<McpConfigData> {
  return DEFAULT_MCP_CONFIG;
}

export async function addMcpServer(
  clientId: string,
  serverConfig: ServerConfig,
) {
  return {
    ...DEFAULT_MCP_CONFIG,
    mcpServers: {
      ...DEFAULT_MCP_CONFIG.mcpServers,
      [clientId]: serverConfig,
    },
  };
}

export async function pauseMcpServer() {
  return DEFAULT_MCP_CONFIG;
}

export async function resumeMcpServer() {
  return DEFAULT_MCP_CONFIG;
}

export async function restartAllClients() {
  return DEFAULT_MCP_CONFIG;
}
