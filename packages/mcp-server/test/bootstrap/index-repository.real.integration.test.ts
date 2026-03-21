import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { RecordId } from "surrealdb";
import { afterAll, describe, expect, it } from "vitest";

import {
  DefaultIndexRepositoryService,
  type EmbeddingProvider,
} from "../../../core/src/index.js";
import { createSurrealClient } from "../../../infra/src/index.js";

import { createApp, type App } from "../../src/bootstrap/app.js";

const PROJECT_METADATA_TABLE = "project_metadata";
const REAL_TEST_FLAG = "RUN_REAL_SURREAL_INTEGRATION_TESTS";

interface TestContext {
  projectSpace: string;
  namespace: string;
}

const createdProjectSpaces: TestContext[] = [];

if (!isRealSurrealIntegrationEnabled()) {
  describe.skip("DefaultIndexRepositoryService real integration", () => {
    it("requires RUN_REAL_SURREAL_INTEGRATION_TESTS=true", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("DefaultIndexRepositoryService real integration", () => {
    afterAll(async () => {
      await cleanupCreatedData(createdProjectSpaces);
    });

    it("runs prepare -> embed -> upsert -> search against real SurrealDB", async () => {
      const context = createTestContext("index-repository");
      const restoreEnv = applyTestEnv(context);
      const tempRoot = await mkdtemp(
        path.join(os.tmpdir(), "agent-code-index-"),
      );
      let app: App | undefined;

      try {
        await writeFile(
          path.join(tempRoot, "alpha.ts"),
          ["export function alpha() {", "  return 'alpha';", "}"].join("\n"),
          "utf8",
        );
        await writeFile(
          path.join(tempRoot, "beta.ts"),
          ["export function beta() {", "  return 'beta';", "}"].join("\n"),
          "utf8",
        );

        app = await createApp();
        createdProjectSpaces.push(context);

        const embeddingProvider: EmbeddingProvider = {
          provider: "test-provider",
          model: "test-model",
          vectorDimension: 3,
          generateEmbeddings: async ({ values }) =>
            values.map((value) => embeddingForText(value)),
        };
        const indexRepositoryService = new DefaultIndexRepositoryService(
          app.container.chunkPreparationService,
          embeddingProvider,
          app.container.chunkRepository,
        );

        const result = await indexRepositoryService.execute({
          repositoryId: context.projectSpace,
          rootPath: tempRoot,
          embeddingBatchSize: 2,
        });
        const searchResults =
          await app.container.searchRepository.semanticSearch({
            repositoryId: context.projectSpace,
            embedding: embeddingForText("alpha"),
            topK: 2,
          });

        expect(result).toEqual({
          scannedFileCount: 2,
          parsedFileCount: 2,
          skippedFileCount: 0,
          preparedChunkCount: 2,
          embeddedChunkCount: 2,
          storedChunkCount: 2,
          failedFileCount: 0,
          failedFiles: [],
        });
        expect(searchResults).toHaveLength(2);
        expect(searchResults[0]?.chunk.filePath).toBe("alpha.ts");
        expect(searchResults[0]?.score).toBeGreaterThan(
          searchResults[1]?.score ?? 0,
        );
      } finally {
        await app?.container.surrealClient.disconnect();
        await rm(tempRoot, { recursive: true, force: true });
        restoreEnv();
      }
    }, 20000);
  });
}

function embeddingForText(value: string): number[] {
  const normalized = value.toLowerCase();

  if (normalized.includes("alpha")) {
    return [1, 0, 0];
  }

  if (normalized.includes("beta")) {
    return [0, 1, 0];
  }

  return [0, 0, 1];
}

function isRealSurrealIntegrationEnabled(): boolean {
  return process.env[REAL_TEST_FLAG] === "true";
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

function applyTestEnv(
  context: TestContext,
  overrides: Record<string, string> = {},
): () => void {
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
  process.env.EMBEDDING_PROVIDER =
    process.env.EMBEDDING_PROVIDER?.trim() || "voyage";
  process.env.EMBEDDING_MODEL =
    process.env.EMBEDDING_MODEL?.trim() || "voyage-code-3";
  process.env.EMBEDDING_VECTOR_DIMENSION =
    process.env.EMBEDDING_VECTOR_DIMENSION?.trim() || "1024";
  process.env.EMBEDDING_API_KEY =
    process.env.EMBEDDING_API_KEY?.trim() || "real-test-key";
  process.env.DEFAULT_TOP_K = process.env.DEFAULT_TOP_K?.trim() || "10";
  process.env.DEFAULT_SCAN_IGNORE_PATTERNS =
    process.env.DEFAULT_SCAN_IGNORE_PATTERNS?.trim() ||
    "node_modules,.git,dist";

  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }

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
