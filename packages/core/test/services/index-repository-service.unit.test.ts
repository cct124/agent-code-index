import { describe, expect, it, vi } from "vitest";

import type {
  ChunkRepository,
  EmbeddingProvider,
  Logger,
  PreparedChunk,
  RepositoryChunkPreparationService,
} from "../../src/index.js";
import { DefaultIndexRepositoryService } from "../../src/index.js";

function createChunk(overrides: Partial<PreparedChunk> = {}): PreparedChunk {
  return {
    id: "src/example.ts:1-3",
    repositoryId: "repo-a",
    filePath: "src/example.ts",
    language: "typescript",
    content: "export const alpha = 1;",
    searchText: "export const alpha = 1;",
    startLine: 1,
    endLine: 3,
    hash: "abc123",
    metadata: {},
    ...overrides,
  };
}

describe("DefaultIndexRepositoryService", () => {
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

  it("prepares chunks, batches embeddings, clears existing repository data and stores indexed chunks", async () => {
    const preparedChunks = [
      createChunk({ id: "chunk-1", filePath: "src/a.ts", searchText: "alpha" }),
      createChunk({ id: "chunk-2", filePath: "src/b.ts", searchText: "beta" }),
      createChunk({ id: "chunk-3", filePath: "src/c.ts", searchText: "gamma" }),
    ];

    const chunkPreparationService: RepositoryChunkPreparationService = {
      prepare: vi.fn(async () => ({
        scannedFileCount: 4,
        parsedFileCount: 3,
        skippedFileCount: 1,
        chunks: preparedChunks,
        failedFiles: [],
      })),
    };
    const embeddingProvider: EmbeddingProvider = {
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 3,
      generateEmbeddings: vi
        .fn()
        .mockResolvedValueOnce([
          [1, 0, 0],
          [0, 1, 0],
        ])
        .mockResolvedValueOnce([[0, 0, 1]]),
    };
    const chunkRepository: ChunkRepository = {
      upsertMany: vi.fn(async () => undefined),
      deleteByRepository: vi.fn(async () => undefined),
      deleteByFilePaths: vi.fn(async () => 0),
      findByFilePath: vi.fn(async () => []),
    };
    const logger = createLogger();

    const service = new DefaultIndexRepositoryService(
      chunkPreparationService,
      embeddingProvider,
      chunkRepository,
      logger,
    );

    const result = await service.execute({
      repositoryId: "repo-a",
      rootPath: "/tmp/repo-a",
      embeddingBatchSize: 2,
    });

    expect(chunkPreparationService.prepare).toHaveBeenCalledWith({
      repositoryId: "repo-a",
      rootPath: "/tmp/repo-a",
    });
    expect(embeddingProvider.generateEmbeddings).toHaveBeenNthCalledWith(1, {
      values: ["alpha", "beta"],
      purpose: "document",
    });
    expect(embeddingProvider.generateEmbeddings).toHaveBeenNthCalledWith(2, {
      values: ["gamma"],
      purpose: "document",
    });
    expect(chunkRepository.deleteByRepository).toHaveBeenCalledWith("repo-a");
    expect(chunkRepository.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({ id: "chunk-1", embedding: [1, 0, 0] }),
      expect.objectContaining({ id: "chunk-2", embedding: [0, 1, 0] }),
      expect.objectContaining({ id: "chunk-3", embedding: [0, 0, 1] }),
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      "Repository indexing started",
      expect.objectContaining({
        rootPath: "/tmp/repo-a",
        provider: "voyage",
        embeddingModel: "voyage-code-3",
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Repository indexing completed",
      expect.objectContaining({
        preparedChunkCount: 3,
        storedChunkCount: 3,
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Repository embedding batch started",
      expect.objectContaining({
        batchIndex: 1,
        totalBatches: 2,
        chunkCount: 2,
        batchFilePathsPreview: ["src/a.ts", "src/b.ts"],
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Repository embedding batch completed",
      expect.objectContaining({
        batchIndex: 2,
        totalBatches: 2,
        chunkCount: 1,
        embeddedChunkCount: 3,
        batchFilePathsPreview: ["src/c.ts"],
      }),
    );
    expect(result).toEqual({
      scannedFileCount: 4,
      parsedFileCount: 3,
      skippedFileCount: 1,
      preparedChunkCount: 3,
      embeddedChunkCount: 3,
      storedChunkCount: 3,
      failedFileCount: 0,
      failedFiles: [],
    });
  });

  it("returns preparation failures and skips upsert when no chunks are prepared", async () => {
    const chunkPreparationService: RepositoryChunkPreparationService = {
      prepare: vi.fn(async () => ({
        scannedFileCount: 2,
        parsedFileCount: 0,
        skippedFileCount: 1,
        chunks: [],
        failedFiles: [{ filePath: "README.md", reason: "read failed" }],
      })),
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
    const logger = createLogger();

    const service = new DefaultIndexRepositoryService(
      chunkPreparationService,
      embeddingProvider,
      chunkRepository,
      logger,
    );

    const result = await service.execute({
      repositoryId: "repo-a",
      rootPath: "/tmp/repo-a",
    });

    expect(embeddingProvider.generateEmbeddings).not.toHaveBeenCalled();
    expect(chunkRepository.deleteByRepository).toHaveBeenCalledWith("repo-a");
    expect(chunkRepository.upsertMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      scannedFileCount: 2,
      parsedFileCount: 0,
      skippedFileCount: 1,
      preparedChunkCount: 0,
      embeddedChunkCount: 0,
      storedChunkCount: 0,
      failedFileCount: 1,
      failedFiles: [{ filePath: "README.md", reason: "read failed" }],
    });
    expect(logger.info).toHaveBeenCalledWith(
      "Repository indexing completed",
      expect.objectContaining({
        preparedChunkCount: 0,
        storedChunkCount: 0,
        failedFileCount: 1,
      }),
    );
  });

  it("logs batch chunk details when embedding generation fails", async () => {
    const preparedChunks = [
      createChunk({
        id: "chunk-1",
        filePath: "src/a.ts",
        startLine: 1,
        endLine: 3,
        searchText: "alpha",
      }),
      createChunk({
        id: "chunk-2",
        filePath: "src/b.ts",
        startLine: 10,
        endLine: 20,
        searchText: "beta-gamma",
      }),
    ];

    const chunkPreparationService: RepositoryChunkPreparationService = {
      prepare: vi.fn(async () => ({
        scannedFileCount: 2,
        parsedFileCount: 2,
        skippedFileCount: 0,
        chunks: preparedChunks,
        failedFiles: [],
      })),
    };
    const embeddingProvider: EmbeddingProvider = {
      provider: "openai-compatible",
      model: "Qwen/Qwen3-Embedding-8B",
      vectorDimension: 3,
      generateEmbeddings: vi.fn(async () => {
        throw new Error("status 400");
      }),
    };
    const chunkRepository: ChunkRepository = {
      upsertMany: vi.fn(async () => undefined),
      deleteByRepository: vi.fn(async () => undefined),
      deleteByFilePaths: vi.fn(async () => 0),
      findByFilePath: vi.fn(async () => []),
    };
    const logger = createLogger();

    const service = new DefaultIndexRepositoryService(
      chunkPreparationService,
      embeddingProvider,
      chunkRepository,
      logger,
    );

    await expect(
      service.execute({
        repositoryId: "repo-a",
        rootPath: "/tmp/repo-a",
        embeddingBatchSize: 2,
      }),
    ).rejects.toThrow("status 400");

    expect(logger.error).toHaveBeenCalledWith(
      "Chunk batch embedding failed",
      expect.objectContaining({
        batchIndex: 1,
        totalBatches: 1,
        batchStart: 0,
        chunkCount: 2,
        batchFileCount: 2,
        durationMs: expect.any(Number),
        batchSearchTextTotalLength: 15,
        batchFilePathsPreview: ["src/a.ts", "src/b.ts"],
        batchFilePathsOmittedCount: 0,
        batchEntries: [
          expect.objectContaining({
            id: "chunk-1",
            filePath: "src/a.ts",
            startLine: 1,
            endLine: 3,
            searchTextLength: 5,
          }),
          expect.objectContaining({
            id: "chunk-2",
            filePath: "src/b.ts",
            startLine: 10,
            endLine: 20,
            searchTextLength: 10,
          }),
        ],
        error: expect.any(Error),
      }),
    );
    expect(chunkRepository.deleteByRepository).not.toHaveBeenCalled();
    expect(chunkRepository.upsertMany).not.toHaveBeenCalled();
  });
});
