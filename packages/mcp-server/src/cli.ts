#!/usr/bin/env node

import { startStdioServer } from "./server.js";

void startStdioServer().catch((error) => {
  console.error("Failed to start agent-code-index MCP server", error);
  process.exitCode = 1;
});
