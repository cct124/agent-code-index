import { afterAll, describe, expect, it } from "vitest";

import { SurrealChunkRepository } from "../../../src/storage/surreal/surreal-chunk-repository.js";
import { DefaultSurrealClient } from "../../../src/storage/surreal/surreal-client.js";

import {
  createRealSurrealConnectionConfig,
  createTestProjectSpace,
  isRealSurrealIntegrationEnabled,
  namespaceFromProjectSpace,
} from "./real-surreal-test-env.js";

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
  embedding: number[];
  metadata: {
    symbolName?: string;
    symbolKind?: string;
    parentSymbol?: string;
    tags?: string[];
  };
}

if (!isRealSurrealIntegrationEnabled()) {
  describe.skip("SurrealChunkRepository real integration", () => {
    it("requires RUN_REAL_SURREAL_INTEGRATION_TESTS=true", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("SurrealChunkRepository real integration", () => {
    const repositoryId = createTestProjectSpace("chunk-repository");
    const namespace = namespaceFromProjectSpace(repositoryId);
    const client = new DefaultSurrealClient(
      createRealSurrealConnectionConfig(namespace),
    );
    const repository = new SurrealChunkRepository(client);

    afterAll(async () => {
      try {
        await repository.deleteByRepository(repositoryId);
      } finally {
        await client.disconnect();
      }
    });

    it("upserts, reads and deletes chunks against a real SurrealDB instance", async () => {
      const chunks = [
        createChunk(repositoryId, {
          id: "chunk-2",
          startLine: 8,
          endLine: 10,
          content: "export function beta() {}",
          searchText: "export function beta",
          hash: "hash-2",
          embedding: [0.6, 0.8, 0],
          metadata: {
            symbolName: "beta",
            symbolKind: "function",
          },
        }),
        createChunk(repositoryId),
      ];

      await repository.upsertMany(chunks);

      const loaded = await repository.findByFilePath({
        repositoryId,
        filePath: "src/example.ts",
      });

      expect(loaded).toEqual([chunks[1], chunks[0]]);

      await repository.deleteByRepository(repositoryId);

      const afterDelete = await repository.findByFilePath({
        repositoryId,
        filePath: "src/example.ts",
      });

      expect(afterDelete).toEqual([]);
    });

    it("deletes chunks for selected file paths against a real SurrealDB instance", async () => {
      const chunks = [
        createChunk(repositoryId, {
          id: "chunk-a",
          filePath: "src/a.ts",
          hash: "hash-a",
        }),
        createChunk(repositoryId, {
          id: "chunk-b",
          filePath: "src/b.ts",
          hash: "hash-b",
        }),
      ];

      await repository.upsertMany(chunks);

      const deletedChunkCount = await repository.deleteByFilePaths({
        repositoryId,
        filePaths: ["src/a.ts"],
      });

      const fileAChunks = await repository.findByFilePath({
        repositoryId,
        filePath: "src/a.ts",
      });
      const fileBChunks = await repository.findByFilePath({
        repositoryId,
        filePath: "src/b.ts",
      });

      expect(deletedChunkCount).toBe(1);
      expect(fileAChunks).toEqual([]);
      expect(fileBChunks).toHaveLength(1);

      await repository.deleteByRepository(repositoryId);
    });
  });
}

function createChunk(
  repositoryId: string,
  overrides: Partial<Chunk> = {},
): Chunk {
  return {
    id: "chunk-1",
    repositoryId,
    filePath: "src/example.ts",
    language: "typescript",
    content: "export function alpha() {}",
    searchText: "export function alpha",
    startLine: 1,
    endLine: 3,
    hash: "hash-1",
    embedding: [1, 0, 0],
    metadata: {
      symbolName: "alpha",
      symbolKind: "function",
      tags: ["export"],
    },
    ...overrides,
  };
}
