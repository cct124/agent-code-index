import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const workspaceRoot = "/home/janex/project/ai-agent/agent-code-index";
const fixturePath = `${workspaceRoot}/packages/mcp-server/test/fixtures/stdio-smoke-server.mjs`;

describe("stdio MCP smoke", () => {
  beforeAll(async () => {
    await execFileAsync("corepack", ["yarn", "build"], {
      cwd: workspaceRoot,
    });
  }, 120000);

  it("connects to a child-process stdio server and calls get_file_context", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fixturePath],
      cwd: workspaceRoot,
      stderr: "pipe",
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
      },
    });
    const client = new Client(
      { name: "smoke-client", version: "1.0.0" },
      { capabilities: {} },
    );

    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "delete_files",
      "get_file_context",
      "index_files",
      "index_repository",
      "search_code_context",
    ]);

    const result = await client.callTool({
      name: "get_file_context",
      arguments: {
        filePath: " src/index.ts ",
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        repositoryId: "repo-a",
        filePath: "src/index.ts",
        chunkCount: 1,
        contextPacket: expect.objectContaining({
          kind: "file",
          files: [
            expect.objectContaining({
              filePath: "src/index.ts",
              chunkCount: 1,
            }),
          ],
        }),
      }),
    );

    await client.close();
  }, 120000);
});
