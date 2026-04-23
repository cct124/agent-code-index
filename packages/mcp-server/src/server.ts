import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";

import { registerAgentCodeIndexTools } from "./adapters/tools/register-tools.js";
import { createApp, type App } from "./bootstrap/app.js";

const SERVER_NAME = "agent-code-index";
const SERVER_VERSION = "0.1.9";

/**
 * 基于已装配应用创建 MCP server，并注册当前可用 tools。
 */
export function createMcpServer(app: App): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerAgentCodeIndexTools(server, app);

  app.container.logger.info("MCP server created", {
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
  });

  return server;
}

/**
 * 启动 stdio MCP server。
 */
export async function startStdioServer(): Promise<void> {
  const app = await createApp();
  const server = createMcpServer(app);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  app.container.logger.info("MCP stdio server started", {
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
  });
}

/**
 * 判断当前文件是否作为 Node.js 入口直接执行。
 */
export function isExecutedAsMainModule(
  moduleUrl: string,
  argv: string[] = process.argv,
): boolean {
  const entryPath = argv[1];

  return Boolean(entryPath) && fileURLToPath(moduleUrl) === entryPath;
}
