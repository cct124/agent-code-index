import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@agent-code-index/core";

import type { App } from "../src/bootstrap/app.js";
import { createMcpServer } from "../src/server.js";

describe("createMcpServer", () => {
  it("logs an obvious runtime fingerprint", () => {
    const info = vi.fn<Logger["info"]>();
    const logger = createLoggerMock(info);
    const app = {
      container: {
        logger,
      },
    } as App;

    createMcpServer(app);

    expect(info).toHaveBeenCalledWith(
      "MCP runtime fingerprint",
      expect.objectContaining({
        serverName: "agent-code-index",
        serverVersion: "0.1.0",
        sourceFingerprint: "startup-fingerprint-2026-03-22a",
        serverModulePath: expect.stringContaining(
          "packages/mcp-server/src/server.ts",
        ),
        isSourceRuntime: true,
        pid: expect.any(Number),
      }),
    );
  });
});

function createLoggerMock(
  info: ReturnType<typeof vi.fn<Logger["info"]>>,
): Logger {
  const logger: Logger = {
    debug: vi.fn(),
    info: (...args) => {
      info(...args);
    },
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };

  return logger;
}
