import { describe, expect, it, vi } from "vitest";

import type { Chunk } from "../../../../core/src/domain/chunk.js";

import { SurrealChunkRepository } from "../../../src/storage/surreal/surreal-chunk-repository.js";

interface StoredChunkRecord extends Omit<Chunk, "id"> {
  id: string;
  chunkId: string;
}

function createChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: "chunk-1",
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
      tags: ["export"],
    },
    ...overrides,
  };
}

describe("SurrealChunkRepository", () => {
  it("upserts chunks and reads them back by file path ordered by line range", async () => {
    const store = new Map<string, StoredChunkRecord>();
    const connect = vi.fn(async () => undefined);
    const upsert = vi.fn((recordId: { toString(): string }) => ({
      content: async (data: Omit<StoredChunkRecord, "id">) => {
        const stored: StoredChunkRecord = {
          id: recordId.toString(),
          chunkId: data.chunkId,
          repositoryId: data.repositoryId,
          filePath: data.filePath,
          language: data.language,
          content: data.content,
          searchText: data.searchText,
          startLine: data.startLine,
          endLine: data.endLine,
          hash: data.hash,
          metadata: data.metadata,
        };

        store.set(recordId.toString(), stored);

        return store.get(recordId.toString());
      },
    }));
    const query = vi.fn(
      async (
        sql: string,
        bindings: {
          repositoryId: string;
          filePath?: string;
        },
      ) => {
        if (sql.startsWith("SELECT * FROM chunk")) {
          return [
            Array.from(store.values())
              .filter(
                (chunk) =>
                  chunk.repositoryId === bindings.repositoryId &&
                  chunk.filePath === bindings.filePath,
              )
              .sort(
                (left, right) =>
                  left.startLine - right.startLine ||
                  left.endLine - right.endLine,
              ),
          ];
        }

        if (sql.startsWith("DELETE chunk")) {
          for (const [key, value] of store.entries()) {
            if (value.repositoryId === bindings.repositoryId) {
              store.delete(key);
            }
          }

          return [];
        }

        throw new Error(`Unexpected query: ${sql}`);
      },
    );

    const repository = new SurrealChunkRepository({
      config: {} as never,
      connect,
      disconnect: vi.fn(async () => undefined),
      driver: {
        query,
        upsert,
      } as never,
      healthCheck: vi.fn(async () => ({}) as never),
    });

    const laterChunk = createChunk({
      id: "chunk-2",
      content: "export const two = 2;",
      searchText: "export const two = 2",
      startLine: 5,
      endLine: 5,
      hash: "hash-2",
      metadata: {
        symbolName: "two",
        symbolKind: "const",
      },
    });
    const earlierChunk = createChunk();

    await repository.upsertMany([laterChunk, earlierChunk]);

    const loaded = await repository.findByFilePath({
      repositoryId: "repo-a",
      filePath: "src/index.ts",
    });

    expect(connect).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(1);
    expect(loaded).toEqual([earlierChunk, laterChunk]);
  });

  it("deletes only chunks belonging to the specified repository", async () => {
    const store = new Map<string, StoredChunkRecord>();
    const connect = vi.fn(async () => undefined);
    const upsert = vi.fn((recordId: { toString(): string }) => ({
      content: async (data: Omit<StoredChunkRecord, "id">) => {
        const stored: StoredChunkRecord = {
          id: recordId.toString(),
          chunkId: data.chunkId,
          repositoryId: data.repositoryId,
          filePath: data.filePath,
          language: data.language,
          content: data.content,
          searchText: data.searchText,
          startLine: data.startLine,
          endLine: data.endLine,
          hash: data.hash,
          metadata: data.metadata,
        };

        store.set(recordId.toString(), stored);

        return store.get(recordId.toString());
      },
    }));
    const query = vi.fn(
      async (
        sql: string,
        bindings: {
          repositoryId: string;
          filePath?: string;
        },
      ) => {
        if (sql.startsWith("SELECT * FROM chunk")) {
          return [
            Array.from(store.values()).filter(
              (chunk) =>
                chunk.repositoryId === bindings.repositoryId &&
                chunk.filePath === bindings.filePath,
            ),
          ];
        }

        if (sql.startsWith("DELETE chunk")) {
          for (const [key, value] of store.entries()) {
            if (value.repositoryId === bindings.repositoryId) {
              store.delete(key);
            }
          }

          return [];
        }

        throw new Error(`Unexpected query: ${sql}`);
      },
    );

    const repository = new SurrealChunkRepository({
      config: {} as never,
      connect,
      disconnect: vi.fn(async () => undefined),
      driver: {
        query,
        upsert,
      } as never,
      healthCheck: vi.fn(async () => ({}) as never),
    });

    await repository.upsertMany([
      createChunk(),
      createChunk({
        id: "chunk-foreign",
        repositoryId: "repo-b",
        hash: "hash-foreign",
      }),
    ]);

    await repository.deleteByRepository("repo-a");

    const repoAChunks = await repository.findByFilePath({
      repositoryId: "repo-a",
      filePath: "src/index.ts",
    });
    const repoBChunks = await repository.findByFilePath({
      repositoryId: "repo-b",
      filePath: "src/index.ts",
    });

    expect(connect).toHaveBeenCalledTimes(4);
    expect(repoAChunks).toEqual([]);
    expect(repoBChunks).toHaveLength(1);
    expect(repoBChunks[0]?.repositoryId).toBe("repo-b");
  });
});
