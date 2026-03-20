import { RecordId } from "surrealdb";
import { afterAll, describe, expect, it } from "vitest";

import { createSurrealClient } from "../../../infra/src/index.js";

import { createApp } from "../../src/bootstrap/app.js";

const PROJECT_METADATA_TABLE = "project_metadata";
const REAL_TEST_FLAG = "RUN_REAL_SURREAL_INTEGRATION_TESTS";

interface TestContext {
  projectSpace: string;
  namespace: string;
}

const createdProjectSpaces: TestContext[] = [];

if (!isRealSurrealIntegrationEnabled()) {
  describe.skip("createApp real integration", () => {
    it("requires RUN_REAL_SURREAL_INTEGRATION_TESTS=true", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("createApp real integration", () => {
    afterAll(async () => {
      await cleanupCreatedProjectMetadata(createdProjectSpaces);
    });

    it("initializes project metadata on first startup", async () => {
      const context = createTestContext("create-app-init");
      const restoreEnv = applyTestEnv(context);

      try {
        const app = await createApp();
        const metadata =
          await app.container.projectMetadataRepository.getByProjectSpace({
            projectSpace: context.projectSpace,
          });

        createdProjectSpaces.push(context);

        expect(app.config.projectSpace).toBe(context.projectSpace);
        expect(app.config.surreal.namespace).toBe(context.namespace);
        expect(metadata).toEqual(
          expect.objectContaining({
            projectSpace: context.projectSpace,
            namespace: context.namespace,
            database: "default",
            embeddingProvider: "voyage",
            embeddingModel: "voyage-code-3",
            embeddingVectorDimension: 1024,
          }),
        );

        await app.container.surrealClient.disconnect();
      } finally {
        restoreEnv();
      }
    }, 15000);

    it("starts successfully when existing project metadata matches current config", async () => {
      const context = createTestContext("create-app-match");
      const restoreEnv = applyTestEnv(context);

      try {
        const firstApp = await createApp();
        await firstApp.container.surrealClient.disconnect();

        const secondApp = await createApp();
        createdProjectSpaces.push(context);

        expect(secondApp.config.projectSpace).toBe(context.projectSpace);

        await secondApp.container.surrealClient.disconnect();
      } finally {
        restoreEnv();
      }
    }, 15000);

    it("fails when existing project metadata conflicts with current embedding config", async () => {
      const context = createTestContext("create-app-mismatch");
      const restoreMatchingEnv = applyTestEnv(context);

      try {
        const firstApp = await createApp();
        await firstApp.container.surrealClient.disconnect();
      } finally {
        restoreMatchingEnv();
      }

      createdProjectSpaces.push(context);

      const restoreMismatchedEnv = applyTestEnv(context, {
        EMBEDDING_MODEL: "voyage-3-large",
      });

      try {
        await expect(createApp()).rejects.toThrow(/embedding model/);
      } finally {
        restoreMismatchedEnv();
      }
    }, 15000);
  });
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

async function cleanupCreatedProjectMetadata(
  contexts: TestContext[],
): Promise<void> {
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
