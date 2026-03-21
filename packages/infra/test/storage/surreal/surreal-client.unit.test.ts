import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../../../core/src/index.js";

import {
  DefaultSurrealClient,
  type SurrealConnectionConfig,
} from "../../../src/storage/surreal/surreal-client.js";

function createConfig(): SurrealConnectionConfig {
  return {
    url: "ws://127.0.0.1:8000/rpc",
    namespace: "demo_project",
    database: "default",
    username: "root",
    password: "root-password",
    token: "secret-token",
    useTls: false,
    deploymentMode: "local",
  };
}

function createLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(function (this: Logger) {
      return this;
    }),
  };
}

describe("DefaultSurrealClient", () => {
  it("logs sanitized connection context on successful health check", async () => {
    const logger = createLogger();
    const driver = {
      connect: vi.fn(async () => undefined),
      authenticate: vi.fn(async () => undefined),
      signin: vi.fn(async () => undefined),
      use: vi.fn(async () => undefined),
      query: vi.fn(async () => [true]),
      close: vi.fn(async () => undefined),
    } as never;
    const client = new DefaultSurrealClient(createConfig(), driver, logger);

    const health = await client.healthCheck();

    expect(health.ok).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      "Connecting to SurrealDB",
      expect.objectContaining({
        url: "ws://127.0.0.1:8000/rpc",
        authMode: "token",
      }),
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ token: "secret-token" }),
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ password: "root-password" }),
    );
  });

  it("logs classified error fields when health check fails", async () => {
    const logger = createLogger();
    const driver = {
      connect: vi.fn(async () => undefined),
      authenticate: vi.fn(async () => undefined),
      signin: vi.fn(async () => undefined),
      use: vi.fn(async () => undefined),
      query: vi.fn(async () => {
        throw new Error("status 401 unauthorized");
      }),
      close: vi.fn(async () => undefined),
    } as never;
    const client = new DefaultSurrealClient(createConfig(), driver, logger);

    await expect(client.healthCheck()).rejects.toThrow(/401/);
    expect(logger.error).toHaveBeenCalledWith(
      "SurrealDB health check failed",
      expect.objectContaining({
        errCode: "surreal_auth_error",
        retryable: false,
        httpStatus: 401,
      }),
    );
  });
});
