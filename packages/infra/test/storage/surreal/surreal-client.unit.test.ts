import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../../../core/src/index.js";

import {
  DefaultSurrealClient,
  type SurrealConnectionConfig,
} from "../../../src/storage/surreal/surreal-client.js";

type MockSurrealDriver = {
  connect: ReturnType<typeof vi.fn>;
  authenticate: ReturnType<typeof vi.fn>;
  signin: ReturnType<typeof vi.fn>;
  use: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

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

function asSurrealDriver(driver: MockSurrealDriver): never {
  return driver as never;
}

describe("DefaultSurrealClient", () => {
  it("silently retries retryable connection errors during connect", async () => {
    vi.useFakeTimers();

    const logger = createLogger();
    const driver = {
      connect: vi
        .fn()
        .mockRejectedValueOnce(new Error("ECONNREFUSED websocket closed"))
        .mockResolvedValue(async () => undefined),
      authenticate: vi.fn(async () => undefined),
      signin: vi.fn(async () => undefined),
      use: vi.fn(async () => undefined),
      query: vi.fn(async () => [true]),
      close: vi.fn(async () => undefined),
    };
    const client = new DefaultSurrealClient(
      createConfig(),
      asSurrealDriver(driver),
      logger,
    );

    const promise = client.healthCheck();

    await vi.advanceTimersByTimeAsync(250);

    await expect(promise).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    );
    expect(driver.connect).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      "SurrealDB connection attempt failed, retrying silently",
      expect.objectContaining({
        attempt: 1,
        errCode: "surreal_connection_error",
        retryable: true,
        nextDelayMs: 250,
      }),
    );
  });

  it("honors custom surreal retry configuration", async () => {
    vi.useFakeTimers();

    const logger = createLogger();
    const driver = {
      connect: vi
        .fn()
        .mockRejectedValueOnce(new Error("websocket connection closed"))
        .mockResolvedValue(async () => undefined),
      authenticate: vi.fn(async () => undefined),
      signin: vi.fn(async () => undefined),
      use: vi.fn(async () => undefined),
      query: vi
        .fn<(...args: unknown[]) => Promise<unknown[]>>()
        .mockRejectedValueOnce(new Error("socket connection closed"))
        .mockResolvedValueOnce([true]),
      close: vi.fn(async () => undefined),
    };
    const client = new DefaultSurrealClient(
      {
        ...createConfig(),
        connectRetryAttempts: 2,
        initialConnectRetryDelayMs: 50,
        maxConnectRetryDelayMs: 50,
        operationRetryAttempts: 2,
      },
      asSurrealDriver(driver),
      logger,
    );

    const promise = client.execute("test-query", (connectedDriver) =>
      connectedDriver.query("RETURN true;"),
    );

    await vi.advanceTimersByTimeAsync(50);

    await expect(promise).resolves.toEqual([true]);
    expect(driver.connect).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      "SurrealDB connection attempt failed, retrying silently",
      expect.objectContaining({
        attempt: 1,
        nextDelayMs: 50,
      }),
    );
  });

  it("logs sanitized connection context on successful health check", async () => {
    const logger = createLogger();
    const driver = {
      connect: vi.fn(async () => undefined),
      authenticate: vi.fn(async () => undefined),
      signin: vi.fn(async () => undefined),
      use: vi.fn(async () => undefined),
      query: vi.fn(async () => [true]),
      close: vi.fn(async () => undefined),
    };
    const client = new DefaultSurrealClient(
      createConfig(),
      asSurrealDriver(driver),
      logger,
    );

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
    };
    const client = new DefaultSurrealClient(
      createConfig(),
      asSurrealDriver(driver),
      logger,
    );

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

  it("silently reconnects and retries when an authenticated session becomes anonymous", async () => {
    const logger = createLogger();
    const staleSessionError = Object.assign(
      new Error(
        "Anonymous access not allowed: Not enough permissions to perform this action",
      ),
      {
        kind: "NotAllowed",
        code: -32002,
        details: {
          kind: "Auth",
          details: {
            kind: "NotAllowed",
            details: {
              action: "process",
              actor: "anonymous",
              resource: "query",
            },
          },
        },
      },
    );
    const driver = {
      connect: vi.fn(async () => undefined),
      authenticate: vi.fn(async () => undefined),
      signin: vi.fn(async () => undefined),
      use: vi.fn(async () => undefined),
      query: vi
        .fn<(...args: unknown[]) => Promise<unknown[]>>()
        .mockRejectedValueOnce(staleSessionError)
        .mockResolvedValueOnce([true]),
      close: vi.fn(async () => undefined),
    };
    const client = new DefaultSurrealClient(
      createConfig(),
      asSurrealDriver(driver),
      logger,
    );

    const result = await client.execute("test-query", (connectedDriver) =>
      connectedDriver.query("RETURN true;"),
    );

    expect(result).toEqual([true]);
    expect(driver.connect).toHaveBeenCalledTimes(2);
    expect(driver.authenticate).toHaveBeenCalledTimes(2);
    expect(driver.use).toHaveBeenCalledTimes(2);
    expect(driver.close).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "SurrealDB operation lost authenticated session, reconnecting and retrying silently",
      expect.objectContaining({
        operationName: "test-query",
        errCode: "surreal_auth_error",
      }),
    );
  });

  it("silently reconnects and retries when an operation hits a retryable connection error", async () => {
    const logger = createLogger();
    const driver = {
      connect: vi.fn(async () => undefined),
      authenticate: vi.fn(async () => undefined),
      signin: vi.fn(async () => undefined),
      use: vi.fn(async () => undefined),
      query: vi
        .fn<(...args: unknown[]) => Promise<unknown[]>>()
        .mockRejectedValueOnce(new Error("websocket connection closed"))
        .mockResolvedValueOnce([true]),
      close: vi.fn(async () => undefined),
    };
    const client = new DefaultSurrealClient(
      createConfig(),
      asSurrealDriver(driver),
      logger,
    );

    const result = await client.execute("test-query", (connectedDriver) =>
      connectedDriver.query("RETURN true;"),
    );

    expect(result).toEqual([true]);
    expect(driver.connect).toHaveBeenCalledTimes(2);
    expect(driver.authenticate).toHaveBeenCalledTimes(2);
    expect(driver.use).toHaveBeenCalledTimes(2);
    expect(driver.close).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "SurrealDB operation hit retryable connection error, reconnecting and retrying silently",
      expect.objectContaining({
        operationName: "test-query",
        attempt: 1,
        errCode: "surreal_connection_error",
        retryable: true,
      }),
    );
  });

  it("does not retry non-session auth failures", async () => {
    const logger = createLogger();
    const driver = {
      connect: vi.fn(async () => undefined),
      authenticate: vi.fn(async () => undefined),
      signin: vi.fn(async () => undefined),
      use: vi.fn(async () => undefined),
      query: vi.fn(async () => {
        throw new Error("401 unauthorized");
      }),
      close: vi.fn(async () => undefined),
    };
    const client = new DefaultSurrealClient(
      createConfig(),
      asSurrealDriver(driver),
      logger,
    );

    await expect(
      client.execute("test-query", (connectedDriver) =>
        connectedDriver.query("RETURN true;"),
      ),
    ).rejects.toThrow(/401/);

    expect(driver.connect).toHaveBeenCalledTimes(1);
    expect(driver.authenticate).toHaveBeenCalledTimes(1);
    expect(driver.use).toHaveBeenCalledTimes(1);
    expect(driver.close).not.toHaveBeenCalled();
  });
});
