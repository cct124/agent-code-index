/**
 * mcp-server 包的公共导出入口。
 */
import { createApp } from "./bootstrap/app.js";
import {
  createMcpServer,
  isExecutedAsMainModule,
  startStdioServer,
} from "./server.js";
import {
  resolveRepositoryId,
  resolveRootPath,
} from "./adapters/shared/input-resolver.js";
import { registerAgentCodeIndexTools } from "./adapters/tools/register-tools.js";

/**
 * 导出应用装配入口，供后续服务启动逻辑复用。
 */
export { createApp };
export { createMcpServer, isExecutedAsMainModule, startStdioServer };
export { registerAgentCodeIndexTools };
export { resolveRepositoryId, resolveRootPath };

if (isExecutedAsMainModule(import.meta.url)) {
  void startStdioServer().catch((error) => {
    console.error("Failed to start agent-code-index MCP server", error);
    process.exitCode = 1;
  });
}
