import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { RecordId } from "surrealdb";
import { afterAll, describe, expect, it } from "vitest";

import { createSurrealClient } from "../../../infra/src/index.js";
import {
  isRealEmbeddingIntegrationEnabled,
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
  describe.skip("DefaultIndexRepositoryService real embedding integration", () => {
    it("requires RUN_REAL_SURREAL_INTEGRATION_TESTS=true and RUN_REAL_EMBEDDING_INTEGRATION_TESTS=true", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("DefaultIndexRepositoryService real embedding integration", () => {
    afterAll(async () => {
      await cleanupCreatedData(createdProjectSpaces);
    });

    it("runs prepare -> real embed -> upsert -> query embed -> search with an OpenAI-compatible provider", async () => {
      const context = createTestContext("index-repository-real-embedding");
      const restoreEnv = applyOpenAICompatibleTestEnv(context);
      const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), "agent-code-index-real-embedding-"),
      );
      let app: App | undefined;

      try {
        await writeFile(
          path.join(tempRoot, "shipping.ts"),
          [
            "export class ShippingQuoteService {",
            "  static create() {",
            "    return new ShippingQuoteService();",
            "  }",
            "",
            "  quoteForOrder(weight: number) {",
            "    return `shipping quote ${weight}`;",
            "  }",
            "}",
          ].join("\n"),
          "utf8",
        );
        await writeFile(
          path.join(tempRoot, "billing.ts"),
          [
            "export class BillingLedger {",
            "  recordInvoice(total: number) {",
            "    return `invoice ledger ${total}`;",
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
        const searchResult =
          await app.container.searchCodeContextService.execute({
            repositoryId: context.projectSpace,
            query: "shipping quote service factory create method",
            topK: 2,
          });

        expect(indexResult.scannedFileCount).toBe(2);
        expect(indexResult.parsedFileCount).toBe(2);
        expect(indexResult.embeddedChunkCount).toBeGreaterThan(0);
        expect(indexResult.storedChunkCount).toBe(
          indexResult.embeddedChunkCount,
        );
        expect(searchResult.results).toHaveLength(2);
        expect(searchResult.contextPacket.kind).toBe("search");
        expect(searchResult.contextPacket.items).toHaveLength(2);
        expect(searchResult.results[0]?.chunk.filePath).toBe("shipping.ts");
        expect(searchResult.results[0]?.chunk.embedding.length).toBe(
          app.container.embeddingProvider.vectorDimension,
        );
        expect(searchResult.results[0]?.score).toBeGreaterThan(
          searchResult.results[1]?.score ?? 0,
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

function applyOpenAICompatibleTestEnv(context: TestContext): () => void {
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
  process.env.EMBEDDING_PROVIDER = "openai-compatible";
  process.env.EMBEDDING_MODEL = requireEmbeddingEnv("EMBEDDING_MODEL");
  process.env.EMBEDDING_VECTOR_DIMENSION = requireEmbeddingEnv(
    "EMBEDDING_VECTOR_DIMENSION",
  );
  process.env.EMBEDDING_API_KEY = requireEmbeddingEnv("EMBEDDING_API_KEY");

  if (process.env.EMBEDDING_BASE_URL?.trim()) {
    process.env.EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL.trim();
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
