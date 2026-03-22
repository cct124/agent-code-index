/**
 * app.ts 的单元测试。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ChunkRepository,
  DeleteFilesService,
  EmbeddingProvider,
  FileChunkPreparationService,
  GetFileContextService,
  IndexFilesService,
  IndexRepositoryService,
  Logger,
  RepositoryChunkPreparationService,
  SearchCodeContextService,
  SearchRepository,
} from "@agent-code-index/core";
import type { ProjectMetadata } from "@agent-code-index/core";

import type { AppContainer } from "../../src/bootstrap/container.js";
import type { AppConfig } from "../../src/bootstrap/config.js";
import type { SurrealClientHealthStatus } from "../../../infra/src/index.js";

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
      nativeCandidateMultiplier: 20,
      nativeEfSearchMin: 100,
    },
    mcp: {
      defaultRepositoryId: "repo-a",
      repositoryRoot: "/workspace/repo-a",
    },
    logging: {
      level: "info",
      pretty: true,
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
    logger: createLoggerMock(events),
    embeddingProvider: {
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 1024,
      generateEmbeddings: vi.fn(async () => []),
    } as EmbeddingProvider,
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
    chunkSchema: {
      ensure: vi.fn(async () => {
        events.push("chunkSchemaEnsure");
      }),
    } as unknown as AppContainer["chunkSchema"],
    projectMetadataSchema: {
      ensure: vi.fn(async () => {
        events.push("schemaEnsure");
      }),
    } as unknown as AppContainer["projectMetadataSchema"],
    chunkPreparationService: {
      prepare: vi.fn(async () => ({
        scannedFileCount: 0,
        parsedFileCount: 0,
        skippedFileCount: 0,
        chunks: [],
        failedFiles: [],
      })),
    } as RepositoryChunkPreparationService,
    chunkRepository: {
      upsertMany: vi.fn(async () => undefined),
      deleteByRepository: vi.fn(async () => undefined),
      deleteByFilePaths: vi.fn(async () => 0),
      findByFilePath: vi.fn(async () => []),
    } as ChunkRepository,
    fileChunkPreparationService: {
      prepareFiles: vi.fn(async () => ({
        requestedFileCount: 0,
        skippedFileCount: 0,
        files: [],
        failedFiles: [],
      })),
    } as FileChunkPreparationService,
    searchRepository: {
      semanticSearch: vi.fn(async () => []),
    } as SearchRepository,
    searchCodeContextService: {
      execute: vi.fn(async () => ({
        repositoryId: "repo-a",
        query: "example",
        topK: 10,
        resultCount: 0,
        results: [],
        contextPacket: {
          kind: "search",
          repositoryId: "repo-a",
          query: "example",
          items: [],
          files: [],
          instructions: [],
          deduplication: {
            strategy: "none",
            inputItems: 0,
            removedItems: 0,
          },
          truncation: {
            truncated: false,
            strategy: "none",
            totalItems: 0,
            returnedItems: 0,
            omittedItems: 0,
            limit: 10,
          },
        },
      })),
    } as SearchCodeContextService,
    indexRepositoryService: {
      execute: vi.fn(async () => ({
        scannedFileCount: 0,
        parsedFileCount: 0,
        skippedFileCount: 0,
        preparedChunkCount: 0,
        embeddedChunkCount: 0,
        storedChunkCount: 0,
        failedFileCount: 0,
        failedFiles: [],
      })),
    } as IndexRepositoryService,
    indexFilesService: {
      execute: vi.fn(async () => ({
        requestedFileCount: 0,
        indexedFileCount: 0,
        deletedChunkCount: 0,
        preparedChunkCount: 0,
        embeddedChunkCount: 0,
        storedChunkCount: 0,
        failedFileCount: 0,
        failedFiles: [],
      })),
    } as IndexFilesService,
    deleteFilesService: {
      execute: vi.fn(async () => ({
        requestedFileCount: 0,
        deletedFileCount: 0,
        deletedChunkCount: 0,
      })),
    } as DeleteFilesService,
    getFileContextService: {
      execute: vi.fn(async () => ({
        repositoryId: "repo-a",
        filePath: "src/example.ts",
        chunkCount: 0,
        chunks: [],
        assembledContext: {
          content: "",
          truncated: false,
        },
        contextPacket: {
          kind: "file",
          repositoryId: "repo-a",
          items: [],
          files: [],
          instructions: [],
          deduplication: {
            strategy: "none",
            inputItems: 0,
            removedItems: 0,
          },
          truncation: {
            truncated: false,
            strategy: "none",
            totalItems: 0,
            returnedItems: 0,
            omittedItems: 0,
          },
        },
      })),
    } as GetFileContextService,
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

function createLoggerMock(events: string[]): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn((message: string) => {
      events.push(`log:${message}`);
    }),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(function (this: Logger) {
      return this;
    }),
  };
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
      "log:Application startup started",
      "healthCheck",
      "log:SurrealDB health check completed",
      "chunkSchemaEnsure",
      "log:Chunk schema ensured",
      "schemaEnsure",
      "log:Project metadata schema ensured",
      "getByProjectSpace",
      "log:Project metadata not found, creating initial record",
      "save",
      "log:Application startup completed",
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
      "log:Application startup started",
      "healthCheck",
      "log:SurrealDB health check completed",
      "chunkSchemaEnsure",
      "log:Chunk schema ensured",
      "schemaEnsure",
      "log:Project metadata schema ensured",
      "getByProjectSpace",
      "log:Project metadata matched current configuration",
      "log:Application startup completed",
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
