import { describe, expect, it, vi } from "vitest";

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
  it("sorts results by cosine similarity and applies exact-match filters", async () => {
    const connect = vi.fn(async () => undefined);
    const query = vi.fn(async () => [
      [
        createStoredChunk({
          chunkId: "chunk-2",
          id: "chunk:repo-a:chunk-2",
          startLine: 8,
          endLine: 10,
          embedding: [0.6, 0.8, 0],
          metadata: { symbolName: "two", symbolKind: "function" },
        }),
        createStoredChunk(),
        createStoredChunk({
          chunkId: "chunk-3",
          id: "chunk:repo-a:chunk-3",
          filePath: "src/other.ts",
          embedding: [0, 1, 0],
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
        language: "typescript",
        filePath: "src/index.ts",
      },
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("AND language = $filter_language"),
      expect.objectContaining({
        repositoryId: "repo-a",
        filter_language: "typescript",
        filter_filePath: "src/index.ts",
      }),
    );
    expect(results).toEqual([
      {
        chunk: {
          id: "chunk-1",
          repositoryId: "repo-a",
          filePath: "src/index.ts",
          language: "typescript",
          content: "export const one = 1;",
          searchText: "export const one = 1",
          startLine: 1,
          endLine: 1,
          hash: "hash-1",
          embedding: [1, 0, 0],
          metadata: {
            symbolName: "one",
            symbolKind: "const",
          },
        },
        score: 1,
        reason: "cosine similarity",
      },
      {
        chunk: {
          id: "chunk-2",
          repositoryId: "repo-a",
          filePath: "src/index.ts",
          language: "typescript",
          content: "export const one = 1;",
          searchText: "export const one = 1",
          startLine: 8,
          endLine: 10,
          hash: "hash-1",
          embedding: [0.6, 0.8, 0],
          metadata: {
            symbolName: "two",
            symbolKind: "function",
          },
        },
        score: 0.6,
        reason: "cosine similarity",
      },
    ]);
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
});
