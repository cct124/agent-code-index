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
          embedding: [0.9, 0.1, 0],
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

    const result = await service.execute({
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
    expect(result).toEqual({
      repositoryId: "repo-a",
      query: "shipping quote factory",
      topK: 5,
      resultCount: 1,
      results: expectedResults,
      contextPacket: {
        kind: "search",
        repositoryId: "repo-a",
        query: "shipping quote factory",
        items: [
          {
            type: "search_match",
            id: "chunk-1",
            filePath: "src/shipping.ts",
            language: "typescript",
            content: "export class ShippingQuoteService {}",
            startLine: 1,
            endLine: 1,
            score: 0.9,
            reason: "cosine similarity",
            metadata: {
              symbolName: "ShippingQuoteService",
              symbolKind: "class",
            },
          },
        ],
        files: [
          {
            filePath: "src/shipping.ts",
            language: "typescript",
            chunkCount: 1,
            startLine: 1,
            endLine: 1,
          },
        ],
        instructions: [
          "Treat this packet as semantic retrieval output ranked by relevance.",
          "Use items for exact excerpts and files for a de-duplicated coverage summary.",
        ],
        deduplication: {
          strategy: "none",
          inputItems: 1,
          removedItems: 0,
        },
        truncation: {
          truncated: false,
          strategy: "none",
          totalItems: 1,
          returnedItems: 1,
          omittedItems: 0,
          limit: 5,
        },
      },
    });
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
    ).resolves.toEqual(
      expect.objectContaining({
        resultCount: 0,
        results: [],
        contextPacket: expect.objectContaining({
          kind: "search",
          items: [],
          deduplication: {
            strategy: "none",
            inputItems: 0,
            removedItems: 0,
          },
        }),
      }),
    );
    await expect(
      service.execute({
        repositoryId: "repo-a",
        query: "shipping",
        topK: 0,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        resultCount: 0,
        results: [],
        contextPacket: expect.objectContaining({
          truncation: expect.objectContaining({
            strategy: "none",
          }),
        }),
      }),
    );

    expect(embeddingProvider.generateEmbeddings).not.toHaveBeenCalled();
    expect(searchRepository.semanticSearch).not.toHaveBeenCalled();
  });

  it("deduplicates repeated chunks and truncates contextPacket items to topK", async () => {
    const embeddingProvider: EmbeddingProvider = {
      provider: "openai-compatible",
      model: "Qwen/Qwen3-Embedding-8B",
      vectorDimension: 3,
      generateEmbeddings: vi.fn(async () => [[0.1, 0.2, 0.3]]),
    };
    const searchRepository: SearchRepository = {
      semanticSearch: vi.fn(async () => [
        {
          chunk: {
            id: "chunk-1",
            repositoryId: "repo-a",
            filePath: "src/a.ts",
            language: "typescript",
            content: "export const a = 1;",
            searchText: "a",
            startLine: 1,
            endLine: 1,
            hash: "hash-1",
            embedding: [1, 0, 0],
            metadata: {},
          },
          score: 0.99,
          reason: "semantic_match",
        },
        {
          chunk: {
            id: "chunk-1",
            repositoryId: "repo-a",
            filePath: "src/a.ts",
            language: "typescript",
            content: "export const a = 1;",
            searchText: "a",
            startLine: 1,
            endLine: 1,
            hash: "hash-1",
            embedding: [1, 0, 0],
            metadata: {},
          },
          score: 0.95,
          reason: "duplicate_match",
        },
        {
          chunk: {
            id: "chunk-2",
            repositoryId: "repo-a",
            filePath: "src/b.ts",
            language: "typescript",
            content: "export const b = 2;",
            searchText: "b",
            startLine: 3,
            endLine: 3,
            hash: "hash-2",
            embedding: [0, 1, 0],
            metadata: {},
          },
          score: 0.8,
        },
      ]),
    };

    const service = new DefaultSearchCodeContextService(
      embeddingProvider,
      searchRepository,
    );

    const result = await service.execute({
      repositoryId: "repo-a",
      query: "find constants",
      topK: 1,
    });

    expect(result.resultCount).toBe(3);
    expect(result.contextPacket.items).toHaveLength(1);
    expect(result.contextPacket.items[0]).toEqual(
      expect.objectContaining({
        id: "chunk-1",
        type: "search_match",
      }),
    );
    expect(result.contextPacket.deduplication).toEqual({
      strategy: "chunk_id",
      inputItems: 3,
      removedItems: 1,
    });
    expect(result.contextPacket.truncation).toEqual({
      truncated: true,
      strategy: "top_k",
      totalItems: 2,
      returnedItems: 1,
      omittedItems: 1,
      limit: 1,
    });
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
