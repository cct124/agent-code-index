/**
 * project_metadata schema 初始化的轻量集成测试。
 */
import { describe, expect, it, vi } from "vitest";

import { SurrealProjectMetadataSchema } from "../../../src/storage/surreal/surreal-project-metadata-schema.js";

describe("SurrealProjectMetadataSchema", () => {
  it("executes explicit table and field definitions", async () => {
    const connect = vi.fn(async () => undefined);
    const query = vi.fn(async () => []);
    const schema = new SurrealProjectMetadataSchema({
      config: {} as never,
      connect,
      disconnect: vi.fn(async () => undefined),
      driver: {
        query,
      } as never,
      healthCheck: vi.fn(async () => ({}) as never),
    });

    await schema.ensure();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "DEFINE TABLE IF NOT EXISTS project_metadata SCHEMAFULL;",
      ),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "DEFINE FIELD IF NOT EXISTS embeddingVectorDimension ON TABLE project_metadata TYPE int;",
      ),
    );
  });
});
