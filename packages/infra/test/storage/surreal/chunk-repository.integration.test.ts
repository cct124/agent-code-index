import { describe, expect, it, vi } from "vitest";

import type { Logger } from "../../../../core/src/index.js";
import type { Chunk } from "../../../../core/src/domain/chunk.js";

import {
  DefaultSurrealClient,
  type SurrealConnectionConfig,
} from "../../../src/storage/surreal/surreal-client.js";
import { SurrealChunkRepository } from "../../../src/storage/surreal/surreal-chunk-repository.js";

interface StoredChunkRecord extends Omit<Chunk, "id"> {
  id: string;
  chunkId: string;
}

interface ChunkQueryBindings {
  repositoryId: string;
  filePath?: string;
  filePaths?: string[];
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
    embedding: [1, 0, 0],
    metadata: {
      symbolName: "one",
      symbolKind: "const",
      tags: ["export"],
    },
    ...overrides,
  };
}

function createPassthroughClient(
  driver: Record<string, unknown>,
  connect = vi.fn(async () => undefined),
) {
  return {
    config: {} as never,
    connect,
    disconnect: vi.fn(async () => undefined),
    execute: async <T>(
      _operationName: string,
      operation: (connectedDriver: never) => Promise<T>,
    ) => {
      await connect();
      return operation(driver as never);
    },
    driver: driver as never,
    healthCheck: vi.fn(async () => ({}) as never),
  };
}

function createSurrealConfig(): SurrealConnectionConfig {
  return {
    url: "ws://127.0.0.1:8000/rpc",
    namespace: "demo_project",
    database: "default",
    username: "root",
    password: "root-password",
    useTls: false,
    deploymentMode: "local",
  };
}

function createAnonymousQueryError(): Error {
  return Object.assign(
    new Error(
      "Anonymous access not allowed: Not enough permissions to perform this action",
    ),
    {
      kind: "NotAllowed",
      code: -32002,
      details: {
        kind: "Auth",
        details: {
          kind: "NotAllowed",
          details: {
            action: "process",
            actor: "anonymous",
            resource: "query",
          },
        },
      },
    },
  );
}

describe("SurrealChunkRepository", () => {
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
          embedding: data.embedding,
          metadata: data.metadata,
        };

        store.set(recordId.toString(), stored);

        return store.get(recordId.toString());
      },
    }));
    const query = vi.fn(async (sql: string, bindings: ChunkQueryBindings) => {
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
        if (Array.isArray(bindings.filePaths)) {
          for (const [key, value] of store.entries()) {
            if (
              value.repositoryId === bindings.repositoryId &&
              bindings.filePaths.includes(value.filePath)
            ) {
              store.delete(key);
            }
          }

          return [];
        }

        for (const [key, value] of store.entries()) {
          if (value.repositoryId === bindings.repositoryId) {
            store.delete(key);
          }
        }

        return [];
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const repository = new SurrealChunkRepository(
      createPassthroughClient(
        {
          query,
          upsert,
        },
        connect,
      ),
    );

    const laterChunk = createChunk({
      id: "chunk-2",
      content: "export const two = 2;",
      searchText: "export const two = 2",
      startLine: 5,
      endLine: 5,
      hash: "hash-2",
      embedding: [0.6, 0.8, 0],
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
          embedding: data.embedding,
          metadata: data.metadata,
        };

        store.set(recordId.toString(), stored);

        return store.get(recordId.toString());
      },
    }));
    const query = vi.fn(async (sql: string, bindings: ChunkQueryBindings) => {
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
    });

    const repository = new SurrealChunkRepository(
      createPassthroughClient(
        {
          query,
          upsert,
        },
        connect,
      ),
    );

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

  it("deletes chunks only for the specified file paths", async () => {
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
          embedding: data.embedding,
          metadata: data.metadata,
        };

        store.set(recordId.toString(), stored);

        return store.get(recordId.toString());
      },
    }));
    const query = vi.fn(
      async (sql: string, bindings: Record<string, unknown>) => {
        if (sql.startsWith("SELECT * FROM chunk")) {
          return [
            Array.from(store.values()).filter((chunk) => {
              if (chunk.repositoryId !== bindings.repositoryId) {
                return false;
              }

              if (Array.isArray(bindings.filePaths)) {
                return bindings.filePaths.includes(chunk.filePath);
              }

              return chunk.filePath === bindings.filePath;
            }),
          ];
        }

        if (sql.startsWith("DELETE chunk")) {
          for (const [key, value] of store.entries()) {
            if (
              value.repositoryId === bindings.repositoryId &&
              Array.isArray(bindings.filePaths) &&
              bindings.filePaths.includes(value.filePath)
            ) {
              store.delete(key);
            }
          }

          return [];
        }

        throw new Error(`Unexpected query: ${sql}`);
      },
    );

    const repository = new SurrealChunkRepository(
      createPassthroughClient(
        {
          query,
          upsert,
        },
        connect,
      ),
    );

    await repository.upsertMany([
      createChunk({ filePath: "src/a.ts", id: "chunk-a", hash: "hash-a" }),
      createChunk({ filePath: "src/b.ts", id: "chunk-b", hash: "hash-b" }),
    ]);

    const deletedChunkCount = await repository.deleteByFilePaths({
      repositoryId: "repo-a",
      filePaths: ["src/a.ts"],
    });

    const fileAChunks = await repository.findByFilePath({
      repositoryId: "repo-a",
      filePath: "src/a.ts",
    });
    const fileBChunks = await repository.findByFilePath({
      repositoryId: "repo-a",
      filePath: "src/b.ts",
    });

    expect(deletedChunkCount).toBe(1);
    expect(fileAChunks).toEqual([]);
    expect(fileBChunks).toHaveLength(1);
  });

  it("logs classified error fields when repository deletion fails", async () => {
    const logger = createLogger();
    const repository = new SurrealChunkRepository(
      createPassthroughClient({
        query: vi.fn(async () => {
          throw new Error("ECONNREFUSED while deleting chunk records");
        }),
      }),
      logger,
    );

    await expect(repository.deleteByRepository("repo-a")).rejects.toThrow(
      /ECONNREFUSED/,
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Repository chunk deletion failed",
      expect.objectContaining({
        repositoryId: "repo-a",
        errCode: "surreal_connection_error",
        retryable: true,
      }),
    );
  });

  it("recovers deleteByFilePaths through client execute after an anonymous query error", async () => {
    const store = new Map<string, StoredChunkRecord>([
      [
        "chunk:repo-a:chunk-a",
        {
          id: "chunk:repo-a:chunk-a",
          chunkId: "chunk-a",
          repositoryId: "repo-a",
          filePath: "src/a.ts",
          language: "typescript",
          content: "export const a = 1;",
          searchText: "export const a = 1",
          startLine: 1,
          endLine: 1,
          hash: "hash-a",
          embedding: [1, 0, 0],
          metadata: {},
        },
      ],
      [
        "chunk:repo-a:chunk-b",
        {
          id: "chunk:repo-a:chunk-b",
          chunkId: "chunk-b",
          repositoryId: "repo-a",
          filePath: "src/b.ts",
          language: "typescript",
          content: "export const b = 2;",
          searchText: "export const b = 2",
          startLine: 1,
          endLine: 1,
          hash: "hash-b",
          embedding: [0, 1, 0],
          metadata: {},
        },
      ],
    ]);
    const staleSessionError = createAnonymousQueryError();
    let shouldFailOnce = true;
    const query = vi.fn(
      async (sql: string, bindings: Record<string, unknown>) => {
        if (
          shouldFailOnce &&
          sql.startsWith("SELECT * FROM chunk") &&
          Array.isArray(bindings.filePaths)
        ) {
          shouldFailOnce = false;
          throw staleSessionError;
        }

        if (sql.startsWith("SELECT * FROM chunk")) {
          return [
            Array.from(store.values())
              .filter((chunk) => {
                if (chunk.repositoryId !== bindings.repositoryId) {
                  return false;
                }

                if (Array.isArray(bindings.filePaths)) {
                  return bindings.filePaths.includes(chunk.filePath);
                }

                return chunk.filePath === bindings.filePath;
              })
              .sort(
                (left, right) =>
                  left.startLine - right.startLine ||
                  left.endLine - right.endLine,
              ),
          ];
        }

        if (sql.startsWith("DELETE chunk")) {
          for (const [key, value] of store.entries()) {
            if (
              value.repositoryId === bindings.repositoryId &&
              Array.isArray(bindings.filePaths) &&
              bindings.filePaths.includes(value.filePath)
            ) {
              store.delete(key);
            }
          }

          return [];
        }

        throw new Error(`Unexpected query: ${sql}`);
      },
    );
    const driver = {
      connect: vi.fn(async () => undefined),
      authenticate: vi.fn(async () => undefined),
      signin: vi.fn(async () => undefined),
      use: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      query,
    };
    const client = new DefaultSurrealClient(
      createSurrealConfig(),
      driver as never,
      createLogger(),
    );
    const repository = new SurrealChunkRepository(client);

    const deletedChunkCount = await repository.deleteByFilePaths({
      repositoryId: "repo-a",
      filePaths: ["src/a.ts"],
    });
    const fileAChunks = await repository.findByFilePath({
      repositoryId: "repo-a",
      filePath: "src/a.ts",
    });
    const fileBChunks = await repository.findByFilePath({
      repositoryId: "repo-a",
      filePath: "src/b.ts",
    });

    expect(deletedChunkCount).toBe(1);
    expect(fileAChunks).toEqual([]);
    expect(fileBChunks).toHaveLength(1);
    expect(driver.connect).toHaveBeenCalledTimes(2);
    expect(driver.signin).toHaveBeenCalledTimes(2);
    expect(driver.use).toHaveBeenCalledTimes(2);
    expect(driver.close).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(5);
  });
});
