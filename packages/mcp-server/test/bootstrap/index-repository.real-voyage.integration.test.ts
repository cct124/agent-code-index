import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { RecordId } from "surrealdb";
import { afterAll, describe, expect, it } from "vitest";

import { createSurrealClient } from "../../../infra/src/index.js";
import {
  isRealEmbeddingIntegrationEnabled,
  optionalEmbeddingEnv,
  requireEmbeddingEnv,
} from "../../../infra/test/embedding/real-embedding-test-env.js";
import { createApp, type App } from "../../src/bootstrap/app.js";

const PROJECT_METADATA_TABLE = "project_metadata";
const REAL_SURREAL_TEST_FLAG = "RUN_REAL_SURREAL_INTEGRATION_TESTS";

interface TestContext {
  projectSpace: string;
  namespace: string;
}

const createdProjectSpaces: TestContext[] = [];

if (
  process.env[REAL_SURREAL_TEST_FLAG] !== "true" ||
  !isRealEmbeddingIntegrationEnabled()
) {
  describe.skip("DefaultIndexRepositoryService real Voyage integration", () => {
    it("requires RUN_REAL_SURREAL_INTEGRATION_TESTS=true and RUN_REAL_EMBEDDING_INTEGRATION_TESTS=true", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("DefaultIndexRepositoryService real Voyage integration", () => {
    afterAll(async () => {
      await cleanupCreatedData(createdProjectSpaces);
    });

    it("runs prepare -> real embed -> upsert -> query embed -> search with the Voyage provider", async () => {
      const context = createTestContext("index-repository-real-voyage");
      const restoreEnv = applyVoyageTestEnv(context);
      const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), "agent-code-index-real-voyage-"),
      );
      let app: App | undefined;

      try {
        await writeFile(
          path.join(tempRoot, "payments.ts"),
          [
            "export class PaymentRetryPolicy {",
            "  static createWindow() {",
            "    return 'payment retry window';",
            "  }",
            "}",
          ].join("\n"),
          "utf8",
        );
        await writeFile(
          path.join(tempRoot, "inventory.ts"),
          [
            "export class InventorySnapshot {",
            "  summarizeStock() {",
            "    return 'inventory snapshot summary';",
            "  }",
            "}",
          ].join("\n"),
          "utf8",
        );

        app = await createApp();
        createdProjectSpaces.push(context);

        const indexResult = await app.container.indexRepositoryService.execute({
          repositoryId: context.projectSpace,
          rootPath: tempRoot,
          embeddingBatchSize: 2,
        });
        const searchResults =
          await app.container.searchCodeContextService.execute({
            repositoryId: context.projectSpace,
            query: "payment retry policy create window",
            topK: 2,
          });

        expect(indexResult.scannedFileCount).toBe(2);
        expect(indexResult.parsedFileCount).toBe(2);
        expect(indexResult.embeddedChunkCount).toBeGreaterThan(0);
        expect(indexResult.storedChunkCount).toBe(
          indexResult.embeddedChunkCount,
        );
        expect(searchResults).toHaveLength(2);
        expect(searchResults[0]?.chunk.filePath).toBe("payments.ts");
        expect(searchResults[0]?.chunk.embedding.length).toBe(
          app.container.embeddingProvider.vectorDimension,
        );
        expect(searchResults[0]?.score).toBeGreaterThan(
          searchResults[1]?.score ?? 0,
        );
      } finally {
        await app?.container.surrealClient.disconnect();
        await rm(tempRoot, { recursive: true, force: true });
        restoreEnv();
      }
    }, 120000);
  });
}

function createTestContext(prefix: string): TestContext {
  const projectSpace = `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  return {
    projectSpace,
    namespace: projectSpace.replace(/-/g, "_"),
  };
}

function applyVoyageTestEnv(context: TestContext): () => void {
  const previousEnv = { ...process.env };

  process.env.PROJECT_SPACE = context.projectSpace;
  process.env.SURREAL_URL = requireEnv("SURREAL_URL");
  process.env.SURREAL_DATABASE =
    process.env.SURREAL_DATABASE?.trim() || "default";
  process.env.SURREAL_USERNAME = process.env.SURREAL_USERNAME?.trim() || "";
  process.env.SURREAL_PASSWORD = process.env.SURREAL_PASSWORD?.trim() || "";

  if (process.env.SURREAL_TOKEN?.trim()) {
    process.env.SURREAL_TOKEN = process.env.SURREAL_TOKEN.trim();
  } else {
    delete process.env.SURREAL_TOKEN;
  }

  process.env.SURREAL_USE_TLS = process.env.SURREAL_USE_TLS?.trim() || "false";
  process.env.SURREAL_DEPLOYMENT_MODE =
    process.env.SURREAL_DEPLOYMENT_MODE?.trim() || "local";
  process.env.EMBEDDING_PROVIDER = "voyage";
  process.env.EMBEDDING_MODEL = requireEmbeddingEnv("EMBEDDING_MODEL");
  process.env.EMBEDDING_VECTOR_DIMENSION = requireEmbeddingEnv(
    "EMBEDDING_VECTOR_DIMENSION",
  );
  process.env.EMBEDDING_API_KEY = requireEmbeddingEnv("EMBEDDING_API_KEY");

  const embeddingBaseUrl = optionalEmbeddingEnv("EMBEDDING_BASE_URL");

  if (embeddingBaseUrl) {
    process.env.EMBEDDING_BASE_URL = embeddingBaseUrl;
  } else {
    delete process.env.EMBEDDING_BASE_URL;
  }

  process.env.DEFAULT_TOP_K = process.env.DEFAULT_TOP_K?.trim() || "10";
  process.env.DEFAULT_SCAN_IGNORE_PATTERNS =
    process.env.DEFAULT_SCAN_IGNORE_PATTERNS?.trim() ||
    "node_modules,.git,dist,build,.next";

  return () => {
    process.env = previousEnv;
  };
}

async function cleanupCreatedData(contexts: TestContext[]): Promise<void> {
  const uniqueContexts = deduplicateContexts(contexts);

  await Promise.all(
    uniqueContexts.map(async (context) => {
      const client = createSurrealClient({
        url: requireEnv("SURREAL_URL"),
        namespace: context.namespace,
        database: process.env.SURREAL_DATABASE?.trim() || "default",
        username: process.env.SURREAL_USERNAME?.trim() || undefined,
        password: process.env.SURREAL_PASSWORD?.trim() || undefined,
        token: process.env.SURREAL_TOKEN?.trim() || undefined,
        useTls: (process.env.SURREAL_USE_TLS?.trim() || "false") === "true",
        deploymentMode:
          process.env.SURREAL_DEPLOYMENT_MODE?.trim() === "cloud"
            ? "cloud"
            : "local",
      });

      try {
        await client.connect();
        await client.driver.query(
          "DELETE chunk WHERE repositoryId = $repositoryId;",
          { repositoryId: context.projectSpace },
        );
        await client.driver.delete(
          new RecordId(PROJECT_METADATA_TABLE, context.projectSpace),
        );
      } finally {
        await client.disconnect();
      }
    }),
  );
}

function deduplicateContexts(contexts: TestContext[]): TestContext[] {
  const seen = new Set<string>();

  return contexts.filter((context) => {
    if (seen.has(context.projectSpace)) {
      return false;
    }

    seen.add(context.projectSpace);
    return true;
  });
}

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable for real integration test: ${key}`,
    );
  }

  return value;
}
