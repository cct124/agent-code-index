import { describe, expect, it, vi } from "vitest";

import type {
  ChunkRepository,
  EmbeddingProvider,
  FileChunkPreparationService,
  Logger,
  PrepareFilesResult,
} from "../../src/index.js";
import { DefaultIndexFilesService } from "../../src/index.js";

function createPreparedResult(
  overrides: Partial<PrepareFilesResult> = {},
): PrepareFilesResult {
  return {
    requestedFileCount: 2,
    skippedFileCount: 0,
    files: [
      {
        filePath: "src/a.ts",
        chunks: [
          {
            id: "src/a.ts:1-1",
            repositoryId: "repo-a",
            filePath: "src/a.ts",
            language: "typescript",
            content: "export const a = 1;",
            searchText: "export const a = 1;",
            startLine: 1,
            endLine: 1,
            hash: "hash-a",
            metadata: {},
          },
        ],
      },
      {
        filePath: "src/b.ts",
        chunks: [],
      },
    ],
    failedFiles: [],
    ...overrides,
  };
}

describe("DefaultIndexFilesService", () => {
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

  it("replaces indexed data for successfully prepared files and preserves failed files", async () => {
    const fileChunkPreparationService: FileChunkPreparationService = {
      prepareFiles: vi.fn(async () =>
        createPreparedResult({
          requestedFileCount: 3,
          failedFiles: [{ filePath: "src/c.ts", reason: "read failed" }],
        }),
      ),
    };
    const embeddingProvider: EmbeddingProvider = {
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 3,
      generateEmbeddings: vi.fn(async () => [[1, 0, 0]]),
    };
    const chunkRepository: ChunkRepository = {
      upsertMany: vi.fn(async () => undefined),
      deleteByRepository: vi.fn(async () => undefined),
      deleteByFilePaths: vi.fn(async () => 2),
      findByFilePath: vi.fn(async () => []),
    };

    const service = new DefaultIndexFilesService(
      fileChunkPreparationService,
      embeddingProvider,
      chunkRepository,
      createLogger(),
    );

    const result = await service.execute({
      repositoryId: "repo-a",
      rootPath: "/workspace/repo-a",
      filePaths: ["src/a.ts", "src/b.ts", "src/c.ts"],
    });

    expect(fileChunkPreparationService.prepareFiles).toHaveBeenCalledWith({
      repositoryId: "repo-a",
      rootPath: "/workspace/repo-a",
      filePaths: ["src/a.ts", "src/b.ts", "src/c.ts"],
    });
    expect(chunkRepository.deleteByFilePaths).toHaveBeenCalledWith({
      repositoryId: "repo-a",
      filePaths: ["src/a.ts", "src/b.ts"],
    });
    expect(chunkRepository.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "src/a.ts:1-1",
        embedding: [1, 0, 0],
      }),
    ]);
    expect(result).toEqual({
      requestedFileCount: 3,
      indexedFileCount: 2,
      deletedChunkCount: 2,
      preparedChunkCount: 1,
      embeddedChunkCount: 1,
      storedChunkCount: 1,
      failedFileCount: 1,
      failedFiles: [{ filePath: "src/c.ts", reason: "read failed" }],
    });
  });

  it("skips delete and upsert when no files are prepared successfully", async () => {
    const fileChunkPreparationService: FileChunkPreparationService = {
      prepareFiles: vi.fn(async () =>
        createPreparedResult({
          files: [],
          failedFiles: [{ filePath: "src/a.ts", reason: "boom" }],
        }),
      ),
    };
    const embeddingProvider: EmbeddingProvider = {
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 3,
      generateEmbeddings: vi.fn(async () => []),
    };
    const chunkRepository: ChunkRepository = {
      upsertMany: vi.fn(async () => undefined),
      deleteByRepository: vi.fn(async () => undefined),
      deleteByFilePaths: vi.fn(async () => 0),
      findByFilePath: vi.fn(async () => []),
    };

    const service = new DefaultIndexFilesService(
      fileChunkPreparationService,
      embeddingProvider,
      chunkRepository,
    );

    const result = await service.execute({
      repositoryId: "repo-a",
      rootPath: "/workspace/repo-a",
      filePaths: ["src/a.ts"],
    });

    expect(embeddingProvider.generateEmbeddings).not.toHaveBeenCalled();
    expect(chunkRepository.deleteByFilePaths).not.toHaveBeenCalled();
    expect(chunkRepository.upsertMany).not.toHaveBeenCalled();
    expect(result.failedFileCount).toBe(1);
    expect(result.indexedFileCount).toBe(0);
  });
});
