import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../../../core/src/index.js";
import { SurrealSearchRepository } from "../../../src/storage/surreal/surreal-search-repository.js";

interface Chunk {
  id: string;
  repositoryId: string;
  filePath: string;
  language: string;
  content: string;
  searchText: string;
  startLine: number;
  endLine: number;
  hash: string;
  embedding?: number[];
  metadata: {
    symbolName?: string;
    symbolKind?: string;
    parentSymbol?: string;
    tags?: string[];
  };
}

interface StoredSearchChunkRecord extends Record<string, unknown> {
  id: string;
  chunkId: string;
  repositoryId: string;
  filePath: string;
  language: string;
  content: string;
  searchText: string;
  startLine: number;
  endLine: number;
  hash: string;
  metadata: Chunk["metadata"];
  embedding?: number[];
}

function createStoredChunk(
  overrides: Partial<StoredSearchChunkRecord> = {},
): StoredSearchChunkRecord {
  return {
    id: "chunk:repo-a:chunk-1",
    chunkId: "chunk-1",
    repositoryId: "repo-a",
    filePath: "src/index.ts",
    language: "typescript",
    content: "export const one = 1;",
    searchText: "export const one = 1",
    startLine: 1,
    endLine: 1,
    hash: "hash-1",
    metadata: {
      symbolName: "one",
      symbolKind: "const",
    },
    embedding: [1, 0, 0],
    ...overrides,
  };
}

describe("SurrealSearchRepository", () => {
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

  it("uses native HNSW query path and maps distance to sortable scores", async () => {
    const connect = vi.fn(async () => undefined);
    const query = vi.fn(async () => [
      [
        createStoredChunk({
          chunkId: "chunk-3",
          id: "chunk:repo-a:chunk-3",
          filePath: "src/other.ts",
          distance: 1,
        }),
        createStoredChunk({
          chunkId: "chunk-2",
          id: "chunk:repo-a:chunk-2",
          startLine: 8,
          endLine: 10,
          metadata: { symbolName: "two", symbolKind: "function" },
          distance: 0.4,
        }),
        createStoredChunk({ distance: 0 }),
      ],
    ]);

    const repository = new SurrealSearchRepository({
      config: {} as never,
      connect,
      disconnect: vi.fn(async () => undefined),
      driver: {
        query,
      } as never,
      healthCheck: vi.fn(async () => ({}) as never),
    });

    const results = await repository.semanticSearch({
      repositoryId: "repo-a",
      embedding: [1, 0, 0],
      topK: 2,
      filters: {
        language: "typescript",
        filePath: "src/index.ts",
      },
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "WHERE repositoryId = $repositoryId AND language = $filter_language AND filePath = $filter_filePath AND embedding <|40,100|> $embedding ORDER BY distance;",
      ),
      expect.objectContaining({
        repositoryId: "repo-a",
        embedding: [1, 0, 0],
        filter_language: "typescript",
        filter_filePath: "src/index.ts",
      }),
    );
    expect(results).toHaveLength(2);
    expect(results[0]?.chunk.id).toBe("chunk-1");
    expect(results[0]?.score).toBe(1);
    expect(results[0]?.reason).toBe("surreal vector search");
    expect(results[1]?.chunk.id).toBe("chunk-2");
    expect(results[1]?.score).toBeCloseTo(1 / 1.4, 8);
    expect(results[1]?.reason).toBe("surreal vector search");
  });

  it("supports filtering by tags using string and string array values", async () => {
    const connect = vi.fn(async () => undefined);
    const query = vi.fn(async () => [
      [
        createStoredChunk({
          metadata: {
            symbolName: "one",
            symbolKind: "const",
            tags: ["static", "async", "property"],
          },
          distance: 0,
        }),
      ],
    ]);
    const repository = new SurrealSearchRepository({
      config: {} as never,
      connect,
      disconnect: vi.fn(async () => undefined),
      driver: {
        query,
      } as never,
      healthCheck: vi.fn(async () => ({}) as never),
    });

    const arrayTagResults = await repository.semanticSearch({
      repositoryId: "repo-a",
      embedding: [1, 0, 0],
      topK: 2,
      filters: {
        tags: ["static", "async"],
      },
    });

    expect(arrayTagResults).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "WHERE repositoryId = $repositoryId AND metadata.tags CONTAINS $filter_tags_0 AND metadata.tags CONTAINS $filter_tags_1 AND embedding <|40,100|> $embedding ORDER BY distance;",
      ),
      expect.objectContaining({
        repositoryId: "repo-a",
        embedding: [1, 0, 0],
        filter_tags_0: "static",
        filter_tags_1: "async",
      }),
    );

    const singleTagResults = await repository.semanticSearch({
      repositoryId: "repo-a",
      embedding: [1, 0, 0],
      topK: 2,
      filters: {
        tags: "property",
      },
    });

    expect(singleTagResults).toHaveLength(1);
  });

  it("falls back to application cosine search when native vector query is unsupported", async () => {
    const logger = createLogger();
    const connect = vi.fn(async () => undefined);
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error("Parse error: unsupported KNN operator"))
      .mockResolvedValueOnce([
        [
          createStoredChunk(),
          createStoredChunk({
            chunkId: "chunk-2",
            id: "chunk:repo-a:chunk-2",
            startLine: 8,
            endLine: 10,
            embedding: [0.6, 0.8, 0],
            metadata: { symbolName: "two", symbolKind: "function" },
          }),
        ],
      ]);

    const repository = new SurrealSearchRepository(
      {
        config: {} as never,
        connect,
        disconnect: vi.fn(async () => undefined),
        driver: {
          query,
        } as never,
        healthCheck: vi.fn(async () => ({}) as never),
      },
      logger,
    );

    const results = await repository.semanticSearch({
      repositoryId: "repo-a",
      embedding: [1, 0, 0],
      topK: 2,
      filters: {
        filePath: "src/index.ts",
      },
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        "WHERE repositoryId = $repositoryId AND filePath = $filter_filePath AND embedding <|40,100|> $embedding ORDER BY distance;",
      ),
      expect.objectContaining({
        repositoryId: "repo-a",
        embedding: [1, 0, 0],
        filter_filePath: "src/index.ts",
      }),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        "SELECT * FROM chunk WHERE repositoryId = $repositoryId",
      ),
      expect.objectContaining({
        repositoryId: "repo-a",
        filter_filePath: "src/index.ts",
      }),
    );
    expect(results).toHaveLength(2);
    expect(results[0]?.chunk.id).toBe("chunk-1");
    expect(results[0]?.score).toBe(1);
    expect(results[0]?.reason).toBe("application cosine fallback");
    expect(results[1]?.chunk.id).toBe("chunk-2");
    expect(results[1]?.score).toBeCloseTo(0.6, 8);
    expect(results[1]?.reason).toBe("application cosine fallback");
    expect(logger.warn).toHaveBeenCalledWith(
      "Native vector search failed, falling back to application cosine search",
      expect.objectContaining({
        searchStrategy: "application-cosine-fallback",
        repositoryId: "repo-a",
        errCode: "surreal_query_error",
      }),
    );
  });

  it("uses configured native candidate window parameters", async () => {
    const connect = vi.fn(async () => undefined);
    const query = vi.fn(async () => [
      [
        createStoredChunk({
          distance: 0,
        }),
      ],
    ]);

    const repository = new SurrealSearchRepository(
      {
        config: {} as never,
        connect,
        disconnect: vi.fn(async () => undefined),
        driver: {
          query,
        } as never,
        healthCheck: vi.fn(async () => ({}) as never),
      },
      createLogger(),
      {
        nativeCandidateMultiplier: 7,
        nativeEfSearchMin: 55,
      },
    );

    await repository.semanticSearch({
      repositoryId: "repo-a",
      embedding: [1, 0, 0],
      topK: 3,
      filters: {
        filePath: "src/index.ts",
      },
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "WHERE repositoryId = $repositoryId AND filePath = $filter_filePath AND embedding <|21,55|> $embedding ORDER BY distance;",
      ),
      expect.objectContaining({
        repositoryId: "repo-a",
        embedding: [1, 0, 0],
        filter_filePath: "src/index.ts",
      }),
    );
  });

  it("pushes mixed metadata and tag filters into the native query", async () => {
    const connect = vi.fn(async () => undefined);
    const query = vi.fn(async () => [
      [
        createStoredChunk({
          distance: 0,
          filePath: "src/a.ts",
          language: "typescript",
          metadata: {
            symbolName: "alpha",
            symbolKind: "function",
            parentSymbol: "ExampleModule",
            tags: ["export", "public"],
          },
        }),
      ],
    ]);

    const repository = new SurrealSearchRepository({
      config: {} as never,
      connect,
      disconnect: vi.fn(async () => undefined),
      driver: {
        query,
      } as never,
      healthCheck: vi.fn(async () => ({}) as never),
    });

    const results = await repository.semanticSearch({
      repositoryId: "repo-a",
      embedding: [1, 0, 0],
      topK: 2,
      filters: {
        filePath: "src/a.ts",
        language: "typescript",
        symbolName: "alpha",
        parentSymbol: "ExampleModule",
        tags: ["export", "public"],
      },
    });

    expect(results).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "WHERE repositoryId = $repositoryId AND filePath = $filter_filePath AND language = $filter_language AND metadata.symbolName = $filter_symbolName AND metadata.parentSymbol = $filter_parentSymbol AND metadata.tags CONTAINS $filter_tags_0 AND metadata.tags CONTAINS $filter_tags_1 AND embedding <|40,100|> $embedding ORDER BY distance;",
      ),
      expect.objectContaining({
        repositoryId: "repo-a",
        embedding: [1, 0, 0],
        filter_filePath: "src/a.ts",
        filter_language: "typescript",
        filter_symbolName: "alpha",
        filter_parentSymbol: "ExampleModule",
        filter_tags_0: "export",
        filter_tags_1: "public",
      }),
    );
  });

  it("rejects unsupported filters before querying the database", async () => {
    const query = vi.fn(async () => [[]]);
    const repository = new SurrealSearchRepository({
      config: {} as never,
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      driver: {
        query,
      } as never,
      healthCheck: vi.fn(async () => ({}) as never),
    });

    await expect(
      repository.semanticSearch({
        repositoryId: "repo-a",
        embedding: [1, 0, 0],
        topK: 3,
        filters: {
          unknown: "value",
        },
      }),
    ).rejects.toThrow(/Unsupported search filter/);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects invalid tag filters before querying the database", async () => {
    const query = vi.fn(async () => [[]]);
    const repository = new SurrealSearchRepository({
      config: {} as never,
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      driver: {
        query,
      } as never,
      healthCheck: vi.fn(async () => ({}) as never),
    });

    await expect(
      repository.semanticSearch({
        repositoryId: "repo-a",
        embedding: [1, 0, 0],
        topK: 3,
        filters: {
          tags: ["static", 1],
        },
      }),
    ).rejects.toThrow(/tags must be a string or string\[\]/i);
    expect(query).not.toHaveBeenCalled();
  });

  it("logs classified error fields when the database query fails", async () => {
    const logger = createLogger();
    const repository = new SurrealSearchRepository(
      {
        config: {} as never,
        connect: vi.fn(async () => undefined),
        disconnect: vi.fn(async () => undefined),
        driver: {
          query: vi.fn(async () => {
            throw new Error("query failed with status 503");
          }),
        } as never,
        healthCheck: vi.fn(async () => ({}) as never),
      },
      logger,
    );

    await expect(
      repository.semanticSearch({
        repositoryId: "repo-a",
        embedding: [1, 0, 0],
        topK: 3,
        filters: {
          filePath: "src/index.ts",
        },
      }),
    ).rejects.toThrow(/503/);

    expect(logger.error).toHaveBeenCalledWith(
      "Semantic search failed",
      expect.objectContaining({
        repositoryId: "repo-a",
        errCode: "surreal_server_error",
        retryable: true,
        httpStatus: 503,
      }),
    );
  });

  it("rejects invalid native search option values", () => {
    expect(
      () =>
        new SurrealSearchRepository(
          {
            config: {} as never,
            connect: vi.fn(async () => undefined),
            disconnect: vi.fn(async () => undefined),
            driver: {
              query: vi.fn(async () => [[]]),
            } as never,
            healthCheck: vi.fn(async () => ({}) as never),
          },
          createLogger(),
          {
            nativeCandidateMultiplier: 0,
          },
        ),
    ).toThrow(/nativeCandidateMultiplier/);

    expect(
      () =>
        new SurrealSearchRepository(
          {
            config: {} as never,
            connect: vi.fn(async () => undefined),
            disconnect: vi.fn(async () => undefined),
            driver: {
              query: vi.fn(async () => [[]]),
            } as never,
            healthCheck: vi.fn(async () => ({}) as never),
          },
          createLogger(),
          {
            nativeEfSearchMin: 0,
          },
        ),
    ).toThrow(/nativeEfSearchMin/);
  });
});
