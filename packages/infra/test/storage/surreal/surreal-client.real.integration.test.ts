import { afterAll, describe, expect, it } from "vitest";

import { DefaultSurrealClient } from "../../../src/storage/surreal/surreal-client.js";

import {
  createRealSurrealConnectionConfig,
  createTestProjectSpace,
  isRealSurrealIntegrationEnabled,
  namespaceFromProjectSpace,
} from "./real-surreal-test-env.js";

if (!isRealSurrealIntegrationEnabled()) {
  describe.skip("DefaultSurrealClient real integration", () => {
    it("requires RUN_REAL_SURREAL_INTEGRATION_TESTS=true", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("DefaultSurrealClient real integration", () => {
    const projectSpace = createTestProjectSpace("surreal-client");
    const namespace = namespaceFromProjectSpace(projectSpace);
    const client = new DefaultSurrealClient(
      createRealSurrealConnectionConfig(namespace),
    );

    afterAll(async () => {
      await client.disconnect();
    });

    it("connects to the local SurrealDB instance and reports health", async () => {
      const health = await client.healthCheck();

      expect(health.ok).toBe(true);
      expect(health.url).toBe(client.config.url);
      expect(health.namespace).toBe(namespace);
      expect(health.database).toBe(client.config.database);
      expect(health.deploymentMode).toBe(client.config.deploymentMode);
    });
  });
}
