import { describe, expect, it, vi } from "vitest";

import type {
  Chunk,
  ChunkRepository,
  EmbeddingProvider,
  RepositoryChunkPreparationService,
} from "../../src/index.js";
import { DefaultIndexRepositoryService } from "../../src/index.js";

function createChunk(overrides: Partial<Chunk> = {}): Chunk {
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
      findByFilePath: vi.fn(async () => []),
    };

    const service = new DefaultIndexRepositoryService(
      chunkPreparationService,
      embeddingProvider,
      chunkRepository,
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
      findByFilePath: vi.fn(async () => []),
    };

    const service = new DefaultIndexRepositoryService(
      chunkPreparationService,
      embeddingProvider,
      chunkRepository,
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
  });
});
