import { afterAll, describe, expect, it } from "vitest";

import { SurrealChunkRepository } from "../../../src/storage/surreal/surreal-chunk-repository.js";
import { SurrealChunkSchema } from "../../../src/storage/surreal/surreal-chunk-schema.js";
import { SurrealSearchRepository } from "../../../src/storage/surreal/surreal-search-repository.js";
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
  metadata: {
    symbolName?: string;
    symbolKind?: string;
    parentSymbol?: string;
    tags?: string[];
  };
  embedding?: number[];
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
    const chunkSchema = new SurrealChunkSchema(client, {
      embeddingVectorDimension: 3,
    });
    const chunkRepository = new SurrealChunkRepository(client);
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

    it("returns top-k chunks from the native HNSW vector path", async () => {
      await chunkSchema.ensure();
      await chunkRepository.upsertMany([
        createChunk(repositoryId, {
          id: "chunk-1",
          filePath: "src/example.ts",
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
        }),
        createChunk(repositoryId, {
          id: "chunk-2",
          filePath: "src/example.ts",
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
        }),
        createChunk(repositoryId, {
          id: "chunk-3",
          filePath: "src/other.ts",
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
        }),
      ]);

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
      expect(results[0]?.reason).toBe("surreal vector search");
      expect(results[1]?.reason).toBe("surreal vector search");
    });

    it("supports multiple exact-match filters together with native HNSW search", async () => {
      await chunkSchema.ensure();
      await chunkRepository.upsertMany([
        createChunk(repositoryId, {
          id: "chunk-multi-1",
          filePath: "src/example.ts",
          language: "typescript",
          content: "export function alpha() {}",
          searchText: "export function alpha",
          startLine: 1,
          endLine: 3,
          hash: "hash-multi-1",
          metadata: {
            symbolName: "alpha",
            symbolKind: "function",
            parentSymbol: "ExampleModule",
            tags: ["export", "public"],
          },
          embedding: [1, 0, 0],
        }),
        createChunk(repositoryId, {
          id: "chunk-multi-2",
          filePath: "src/example.ts",
          language: "typescript",
          content: "export function alphaHelper() {}",
          searchText: "export function alphaHelper",
          startLine: 8,
          endLine: 10,
          hash: "hash-multi-2",
          metadata: {
            symbolName: "alphaHelper",
            symbolKind: "function",
            parentSymbol: "ExampleModule",
            tags: ["export"],
          },
          embedding: [0.92, 0.08, 0],
        }),
        createChunk(repositoryId, {
          id: "chunk-multi-3",
          filePath: "src/example.ts",
          language: "typescript",
          content: "export function alpha() {}",
          searchText: "export function alpha",
          startLine: 12,
          endLine: 14,
          hash: "hash-multi-3",
          metadata: {
            symbolName: "alpha",
            symbolKind: "function",
            parentSymbol: "OtherModule",
            tags: ["export", "public"],
          },
          embedding: [0.97, 0.03, 0],
        }),
      ]);

      const results = await repository.semanticSearch({
        repositoryId,
        embedding: [1, 0, 0],
        topK: 3,
        filters: {
          filePath: "src/example.ts",
          language: "typescript",
          symbolName: "alpha",
          parentSymbol: "ExampleModule",
          tags: ["export", "public"],
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.chunk.id).toBe("chunk-multi-1");
      expect(results[0]?.chunk.metadata.symbolName).toBe("alpha");
      expect(results[0]?.chunk.metadata.parentSymbol).toBe("ExampleModule");
      expect(results[0]?.reason).toBe("surreal vector search");
    });

    it("shows configured native candidate window values in EXPLAIN FULL output", async () => {
      await chunkSchema.ensure();
      await chunkRepository.upsertMany([
        createChunk(repositoryId, {
          id: "chunk-explain-1",
          filePath: "src/explain.ts",
          content: "export function explainOne() {}",
          searchText: "export function explainOne",
          startLine: 1,
          endLine: 3,
          hash: "hash-explain-1",
          metadata: {
            symbolName: "explainOne",
            symbolKind: "function",
          },
          embedding: [1, 0, 0],
        }),
      ]);

      const topK = 2;
      const nativeCandidateMultiplier = 9;
      const nativeEfSearchMin = 64;
      const candidateK = topK * nativeCandidateMultiplier;
      const efSearch = Math.max(nativeEfSearchMin, candidateK);
      const plan = await client.driver.query<Array<Record<string, unknown>>>(
        [
          "SELECT *, vector::distance::knn() AS distance FROM chunk",
          "WHERE repositoryId = $repositoryId",
          `AND embedding <|${candidateK},${efSearch}|> $embedding`,
          "ORDER BY distance",
          "EXPLAIN FULL;",
        ].join(" "),
        {
          repositoryId,
          embedding: [1, 0, 0],
        },
      );

      const knnScanNode = findExplainOperator(plan, "KnnScan");

      expect(plan.length).toBeGreaterThan(0);
      expect(knnScanNode).toBeDefined();
      expect(knnScanNode?.attributes).toEqual(
        expect.objectContaining({
          index: "chunk_embedding_hnsw_idx",
          k: String(candidateK),
          ef: String(efSearch),
        }),
      );
    });
  });
}

function findExplainOperator(
  nodes: Array<Record<string, unknown>>,
  operator: string,
): Record<string, unknown> | undefined {
  for (const node of nodes) {
    if (node.operator === operator) {
      return node;
    }

    const children = Array.isArray(node.children)
      ? (node.children as Array<Record<string, unknown>>)
      : [];
    const nested = findExplainOperator(children, operator);

    if (nested) {
      return nested;
    }
  }

  return undefined;
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
