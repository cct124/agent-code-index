import { RecordId } from "surrealdb";
import { afterAll, describe, expect, it } from "vitest";

import { SurrealProjectMetadataRepository } from "../../../src/storage/surreal/surreal-project-metadata-repository.js";
import { SurrealProjectMetadataSchema } from "../../../src/storage/surreal/surreal-project-metadata-schema.js";
import { DefaultSurrealClient } from "../../../src/storage/surreal/surreal-client.js";

import {
  createRealSurrealConnectionConfig,
  createTestProjectSpace,
  isRealSurrealIntegrationEnabled,
  namespaceFromProjectSpace,
} from "./real-surreal-test-env.js";

const PROJECT_METADATA_TABLE = "project_metadata";

interface ProjectMetadata {
  projectSpace: string;
  namespace: string;
  database: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingVectorDimension: number;
  createdAt: string;
  updatedAt: string;
}

if (!isRealSurrealIntegrationEnabled()) {
  describe.skip("Project metadata real integration", () => {
    it("requires RUN_REAL_SURREAL_INTEGRATION_TESTS=true", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("Project metadata real integration", () => {
    const projectSpace = createTestProjectSpace("project-metadata");
    const namespace = namespaceFromProjectSpace(projectSpace);
    const client = new DefaultSurrealClient(
      createRealSurrealConnectionConfig(namespace),
    );
    const schema = new SurrealProjectMetadataSchema(client);
    const repository = new SurrealProjectMetadataRepository(client);

    afterAll(async () => {
      try {
        await client.connect();
        await client.driver.delete(
          new RecordId(PROJECT_METADATA_TABLE, projectSpace),
        );
      } finally {
        await client.disconnect();
      }
    });

    it("ensures schema and persists project metadata in a real SurrealDB instance", async () => {
      await schema.ensure();

      const metadata = createMetadata(
        projectSpace,
        namespace,
        client.config.database,
      );
      const saved = await repository.save(metadata);
      const loaded = await repository.getByProjectSpace({ projectSpace });

      expect(saved).toEqual(metadata);
      expect(loaded).toEqual(metadata);
    });
  });
}

function createMetadata(
  projectSpace: string,
  namespace: string,
  database: string,
): ProjectMetadata {
  return {
    projectSpace,
    namespace,
    database,
    embeddingProvider: "voyage",
    embeddingModel: "voyage-code-3",
    embeddingVectorDimension: 1024,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
