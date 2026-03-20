import { RecordId } from "surrealdb";
import { afterAll, describe, expect, it } from "vitest";

import { SurrealSearchRepository } from "../../../src/storage/surreal/surreal-search-repository.js";
import { DefaultSurrealClient } from "../../../src/storage/surreal/surreal-client.js";

import {
  createRealSurrealConnectionConfig,
  createTestProjectSpace,
  isRealSurrealIntegrationEnabled,
  namespaceFromProjectSpace,
} from "./real-surreal-test-env.js";

interface StoredSearchChunk extends Record<string, unknown> {
  chunkId: string;
  repositoryId: string;
  filePath: string;
  language: string;
  content: string;
  searchText: string;
  startLine: number;
  endLine: number;
  hash: string;
  metadata: {
    symbolName?: string;
    symbolKind?: string;
    parentSymbol?: string;
    tags?: string[];
  };
  embedding: number[];
}

if (!isRealSurrealIntegrationEnabled()) {
  describe.skip("SurrealSearchRepository real integration", () => {
    it("requires RUN_REAL_SURREAL_INTEGRATION_TESTS=true", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("SurrealSearchRepository real integration", () => {
    const repositoryId = createTestProjectSpace("search-repository");
    const namespace = namespaceFromProjectSpace(repositoryId);
    const client = new DefaultSurrealClient(
      createRealSurrealConnectionConfig(namespace),
    );
    const repository = new SurrealSearchRepository(client);

    afterAll(async () => {
      try {
        await client.connect();
        await client.driver.query(
          "DELETE chunk WHERE repositoryId = $repositoryId;",
          { repositoryId },
        );
      } finally {
        await client.disconnect();
      }
    });

    it("returns top-k chunks ordered by cosine similarity from real stored embeddings", async () => {
      await client.connect();
      await upsertStoredChunk(client, repositoryId, {
        chunkId: "chunk-1",
        repositoryId,
        filePath: "src/example.ts",
        language: "typescript",
        content: "export function alpha() {}",
        searchText: "export function alpha",
        startLine: 1,
        endLine: 3,
        hash: "hash-1",
        metadata: {
          symbolName: "alpha",
          symbolKind: "function",
        },
        embedding: [1, 0, 0],
      });
      await upsertStoredChunk(client, repositoryId, {
        chunkId: "chunk-2",
        repositoryId,
        filePath: "src/example.ts",
        language: "typescript",
        content: "export function beta() {}",
        searchText: "export function beta",
        startLine: 8,
        endLine: 10,
        hash: "hash-2",
        metadata: {
          symbolName: "beta",
          symbolKind: "function",
        },
        embedding: [0.6, 0.8, 0],
      });
      await upsertStoredChunk(client, repositoryId, {
        chunkId: "chunk-3",
        repositoryId,
        filePath: "src/other.ts",
        language: "typescript",
        content: "export function gamma() {}",
        searchText: "export function gamma",
        startLine: 1,
        endLine: 3,
        hash: "hash-3",
        metadata: {
          symbolName: "gamma",
          symbolKind: "function",
        },
        embedding: [0, 1, 0],
      });

      const results = await repository.semanticSearch({
        repositoryId,
        embedding: [1, 0, 0],
        topK: 2,
        filters: {
          filePath: "src/example.ts",
        },
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.chunk.id).toBe("chunk-1");
      expect(results[1]?.chunk.id).toBe("chunk-2");
      expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
    });
  });
}

async function upsertStoredChunk(
  client: DefaultSurrealClient,
  repositoryId: string,
  chunk: StoredSearchChunk,
): Promise<void> {
  await client.driver
    .upsert<StoredSearchChunk>(
      new RecordId("chunk", `${repositoryId}:${chunk.chunkId}`),
    )
    .content(chunk);
}
