import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DeleteFilesService,
  GetFileContextService,
  IndexFilesService,
  IndexRepositoryService,
  Logger,
  SearchCodeContextService,
} from "../../../core/src/index.js";
import type { SearchResult } from "../../../core/src/domain/search-result.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type { App } from "../../src/bootstrap/app.js";
import type { AppConfig } from "../../src/bootstrap/config.js";
import { createMcpServer } from "../../src/server.js";

describe("registerAgentCodeIndexTools", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("registers all available tools and resolves default repository and root inputs", async () => {
    const app = createTestApp();
    const server = createMcpServer(app);
    const client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
      "delete_files",
      "get_file_context",
      "index_files",
      "index_repository",
      "search_code_context",
    ]);

    const indexFilesResult = await client.callTool({
      name: "index_files",
      arguments: {
        filePaths: [" src/a.ts ", "src/b.ts", "src/a.ts"],
      },
    });

    expect(app.container.indexFilesService.execute).toHaveBeenCalledWith({
      repositoryId: "repo-a",
      rootPath: "/workspace/repo-a",
      filePaths: ["src/a.ts", "src/b.ts"],
      embeddingBatchSize: undefined,
    });
    expect(indexFilesResult.isError).toBeUndefined();
    expect(indexFilesResult.structuredContent).toEqual(
      expect.objectContaining({
        repositoryId: "repo-a",
        requestedFileCount: 2,
        indexedFileCount: 2,
      }),
    );

    const deleteFilesResult = await client.callTool({
      name: "delete_files",
      arguments: {
        repositoryId: "repo-b",
        filePaths: ["src/old.ts", "src/old.ts", " src/new.ts "],
      },
    });

    expect(app.container.deleteFilesService.execute).toHaveBeenCalledWith({
      repositoryId: "repo-b",
      filePaths: ["src/old.ts", "src/new.ts"],
    });
    expect(deleteFilesResult.structuredContent).toEqual(
      expect.objectContaining({
        repositoryId: "repo-b",
        deletedChunkCount: 3,
      }),
    );

    const getFileContextResult = await client.callTool({
      name: "get_file_context",
      arguments: {
        filePath: " src/index.ts ",
      },
    });

    expect(app.container.getFileContextService.execute).toHaveBeenCalledWith({
      repositoryId: "repo-a",
      filePath: "src/index.ts",
    });
    expect(getFileContextResult.structuredContent).toEqual(
      expect.objectContaining({
        repositoryId: "repo-a",
        filePath: "src/index.ts",
        chunkCount: 2,
        assembledContext: {
          content: expect.stringContaining("export const value = 1;"),
          truncated: false,
        },
      }),
    );

    await client.close();
    await server.close();
  });

  it("returns validation errors for unsupported search filters", async () => {
    const app = createTestApp();
    const server = createMcpServer(app);
    const client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: "search_code_context",
      arguments: {
        query: "find parser factory",
        filters: { unsupported: true },
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("Unsupported search filters"),
      }),
    );
    expect(
      app.container.searchCodeContextService.execute,
    ).not.toHaveBeenCalled();

    await client.close();
    await server.close();
  });
});

function createTestApp(): App {
  const logger = createLogger();

  return {
    config: createConfig(),
    container: {
      config: createConfig(),
      logger,
      embeddingProvider: {} as never,
      surrealClient: {} as never,
      chunkSchema: {} as never,
      projectMetadataSchema: {} as never,
      chunkPreparationService: {} as never,
      chunkRepository: {} as never,
      fileChunkPreparationService: {} as never,
      searchRepository: {} as never,
      searchCodeContextService: {
        execute: vi.fn(async () => createSearchResults()),
      } as SearchCodeContextService,
      indexRepositoryService: {
        execute: vi.fn(async () => ({
          scannedFileCount: 10,
          parsedFileCount: 8,
          skippedFileCount: 2,
          preparedChunkCount: 16,
          embeddedChunkCount: 16,
          storedChunkCount: 16,
          failedFileCount: 0,
          failedFiles: [],
        })),
      } as IndexRepositoryService,
      indexFilesService: {
        execute: vi.fn(async () => ({
          requestedFileCount: 2,
          indexedFileCount: 2,
          deletedChunkCount: 5,
          preparedChunkCount: 7,
          embeddedChunkCount: 7,
          storedChunkCount: 7,
          failedFileCount: 0,
          failedFiles: [],
        })),
      } as IndexFilesService,
      deleteFilesService: {
        execute: vi.fn(async () => ({
          requestedFileCount: 2,
          deletedFileCount: 2,
          deletedChunkCount: 3,
        })),
      } as DeleteFilesService,
      getFileContextService: {
        execute: vi.fn(async () => ({
          repositoryId: "repo-a",
          filePath: "src/index.ts",
          chunkCount: 2,
          chunks: [
            {
              id: "chunk-a",
              filePath: "src/index.ts",
              language: "typescript",
              content: "export const value = 1;",
              startLine: 1,
              endLine: 1,
              metadata: {
                symbolName: "value",
              },
            },
            {
              id: "chunk-b",
              filePath: "src/index.ts",
              language: "typescript",
              content: "export function readValue() { return value; }",
              startLine: 3,
              endLine: 3,
              metadata: {
                symbolName: "readValue",
                symbolKind: "function",
              },
            },
          ],
          assembledContext: {
            content:
              "[chunk 1 | lines 1-1 | symbol value]\nexport const value = 1;\n\n[chunk 2 | lines 3-3 | function readValue]\nexport function readValue() { return value; }",
            truncated: false,
          },
        })),
      } as GetFileContextService,
      projectMetadataRepository: {} as never,
    },
  };
}

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
      ignorePatterns: [],
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

function createSearchResults(): SearchResult[] {
  return [
    {
      score: 0.95,
      reason: "semantic_match",
      chunk: {
        id: "chunk-a",
        repositoryId: "repo-a",
        filePath: "src/index.ts",
        language: "typescript",
        content: "export const value = 1;",
        searchText: "typescript const value export",
        startLine: 1,
        endLine: 1,
        hash: "hash-a",
        embedding: [1, 0, 0],
        metadata: {
          symbolName: "value",
        },
      },
    },
  ];
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
