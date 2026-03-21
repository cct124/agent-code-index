import { describe, expect, it, vi } from "vitest";

import type {
  EmbeddingProvider,
  Logger,
  SearchRepository,
  SearchResult,
} from "../../src/index.js";
import { DefaultSearchCodeContextService } from "../../src/index.js";

describe("DefaultSearchCodeContextService", () => {
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

  it("embeds query text and delegates semantic search to the repository", async () => {
    const embeddingProvider: EmbeddingProvider = {
      provider: "openai-compatible",
      model: "Qwen/Qwen3-Embedding-8B",
      vectorDimension: 3,
      generateEmbeddings: vi.fn(async () => [[0.1, 0.2, 0.3]]),
    };
    const expectedResults: SearchResult[] = [
      {
        chunk: {
          id: "chunk-1",
          repositoryId: "repo-a",
          filePath: "src/shipping.ts",
          language: "typescript",
          content: "export class ShippingQuoteService {}",
          searchText: "typescript class ShippingQuoteService",
          startLine: 1,
          endLine: 1,
          hash: "hash-1",
          metadata: {
            symbolName: "ShippingQuoteService",
            symbolKind: "class",
          },
        },
        score: 0.9,
        reason: "cosine similarity",
      },
    ];
    const searchRepository: SearchRepository = {
      semanticSearch: vi.fn(async () => expectedResults),
    };
    const logger = createLogger();

    const service = new DefaultSearchCodeContextService(
      embeddingProvider,
      searchRepository,
      logger,
    );

    const results = await service.execute({
      repositoryId: "repo-a",
      query: "shipping quote factory",
      topK: 5,
      filters: {
        tags: "static",
      },
    });

    expect(embeddingProvider.generateEmbeddings).toHaveBeenCalledWith({
      values: ["shipping quote factory"],
      purpose: "query",
    });
    expect(searchRepository.semanticSearch).toHaveBeenCalledWith({
      repositoryId: "repo-a",
      embedding: [0.1, 0.2, 0.3],
      topK: 5,
      filters: {
        tags: "static",
      },
    });
    expect(results).toEqual(expectedResults);
    expect(logger.info).toHaveBeenCalledWith(
      "Search code context completed",
      expect.objectContaining({
        resultCount: 1,
      }),
    );
  });

  it("returns empty results when query is blank or topK is non-positive", async () => {
    const embeddingProvider: EmbeddingProvider = {
      provider: "openai-compatible",
      model: "Qwen/Qwen3-Embedding-8B",
      vectorDimension: 3,
      generateEmbeddings: vi.fn(async () => [[0.1, 0.2, 0.3]]),
    };
    const searchRepository: SearchRepository = {
      semanticSearch: vi.fn(async () => []),
    };

    const service = new DefaultSearchCodeContextService(
      embeddingProvider,
      searchRepository,
    );

    await expect(
      service.execute({
        repositoryId: "repo-a",
        query: "   ",
        topK: 5,
      }),
    ).resolves.toEqual([]);
    await expect(
      service.execute({
        repositoryId: "repo-a",
        query: "shipping",
        topK: 0,
      }),
    ).resolves.toEqual([]);

    expect(embeddingProvider.generateEmbeddings).not.toHaveBeenCalled();
    expect(searchRepository.semanticSearch).not.toHaveBeenCalled();
  });

  it("fails when the embedding provider returns no query embedding", async () => {
    const embeddingProvider: EmbeddingProvider = {
      provider: "openai-compatible",
      model: "Qwen/Qwen3-Embedding-8B",
      vectorDimension: 3,
      generateEmbeddings: vi.fn(async () => []),
    };
    const searchRepository: SearchRepository = {
      semanticSearch: vi.fn(async () => []),
    };

    const service = new DefaultSearchCodeContextService(
      embeddingProvider,
      searchRepository,
    );

    await expect(
      service.execute({
        repositoryId: "repo-a",
        query: "shipping",
        topK: 3,
      }),
    ).rejects.toThrow(/empty embedding/i);
    expect(searchRepository.semanticSearch).not.toHaveBeenCalled();
  });
});
