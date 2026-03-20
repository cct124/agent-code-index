/**
 * app.ts 的单元测试。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectMetadata } from "@agent-code-index/core";

import type { AppContainer } from "../../src/bootstrap/container.js";
import type { AppConfig } from "../../src/bootstrap/config.js";
import type { SurrealClientHealthStatus } from "@agent-code-index/infra";

const { loadConfigMock, createContainerMock } = vi.hoisted(() => ({
  loadConfigMock: vi.fn(),
  createContainerMock: vi.fn(),
}));

vi.mock("../../src/bootstrap/config.js", () => ({
  loadConfig: loadConfigMock,
}));

vi.mock("../../src/bootstrap/container.js", () => ({
  createContainer: createContainerMock,
}));

import { createApp } from "../../src/bootstrap/app.js";

function createConfig(): AppConfig {
  return {
    projectSpace: "demo-project",
    surreal: {
      url: "ws://127.0.0.1:8000/rpc",
      namespace: "demo_project",
      database: "default",
      username: "root",
      password: "root",
      useTls: false,
      deploymentMode: "local",
    },
    embedding: {
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 1024,
      apiKey: "test-key",
    },
    indexing: {
      defaultTopK: 10,
      ignorePatterns: ["node_modules", ".git"],
    },
  };
}

function createMetadata(
  overrides: Partial<ProjectMetadata> = {},
): ProjectMetadata {
  return {
    projectSpace: "demo-project",
    namespace: "demo_project",
    database: "default",
    embeddingProvider: "voyage",
    embeddingModel: "voyage-code-3",
    embeddingVectorDimension: 1024,
    createdAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:00:00.000Z",
    ...overrides,
  };
}

function createTestContainer(events: string[]): AppContainer {
  const healthStatus: SurrealClientHealthStatus = {
    ok: true,
    url: "ws://127.0.0.1:8000/rpc",
    namespace: "demo_project",
    database: "default",
    deploymentMode: "local",
  };

  return {
    config: createConfig(),
    surrealClient: {
      config: {} as never,
      driver: {} as never,
      connect: vi.fn(async () => {
        events.push("connect");
      }),
      disconnect: vi.fn(async () => {
        events.push("disconnect");
      }),
      healthCheck: vi.fn(async () => {
        events.push("healthCheck");
        return healthStatus;
      }),
    },
    projectMetadataSchema: {
      ensure: vi.fn(async () => {
        events.push("schemaEnsure");
      }),
    } as unknown as AppContainer["projectMetadataSchema"],
    projectMetadataRepository: {
      getByProjectSpace: vi.fn(async () => {
        events.push("getByProjectSpace");
        return null;
      }),
      save: vi.fn(async (metadata: ProjectMetadata) => {
        events.push("save");
        return metadata;
      }),
    },
  } as AppContainer;
}

describe("createApp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("initializes project metadata when none exists", async () => {
    const events: string[] = [];
    const config = createConfig();
    const container = createTestContainer(events);

    loadConfigMock.mockReturnValue(config);
    createContainerMock.mockReturnValue(container);

    const app = await createApp();

    expect(app.config).toBe(config);
    expect(events).toEqual([
      "healthCheck",
      "schemaEnsure",
      "getByProjectSpace",
      "save",
    ]);
    expect(container.projectMetadataRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        projectSpace: "demo-project",
        namespace: "demo_project",
        database: "default",
        embeddingProvider: "voyage",
        embeddingModel: "voyage-code-3",
        embeddingVectorDimension: 1024,
        createdAt: "2026-03-20T10:00:00.000Z",
        updatedAt: "2026-03-20T10:00:00.000Z",
      }),
    );
  });

  it("skips save when project metadata already matches", async () => {
    const events: string[] = [];
    const config = createConfig();
    const container = createTestContainer(events);

    vi.mocked(
      container.projectMetadataRepository.getByProjectSpace,
    ).mockImplementation(async () => {
      events.push("getByProjectSpace");
      return createMetadata();
    });
    loadConfigMock.mockReturnValue(config);
    createContainerMock.mockReturnValue(container);

    await expect(createApp()).resolves.toBeDefined();
    expect(container.projectMetadataRepository.save).not.toHaveBeenCalled();
    expect(events).toEqual([
      "healthCheck",
      "schemaEnsure",
      "getByProjectSpace",
    ]);
  });

  it("fails when existing metadata does not match current embedding config", async () => {
    const config = createConfig();
    const container = createTestContainer([]);

    vi.mocked(
      container.projectMetadataRepository.getByProjectSpace,
    ).mockResolvedValue(createMetadata({ embeddingModel: "voyage-3-large" }));
    loadConfigMock.mockReturnValue(config);
    createContainerMock.mockReturnValue(container);

    await expect(createApp()).rejects.toThrow(/embedding model/);
  });
});
