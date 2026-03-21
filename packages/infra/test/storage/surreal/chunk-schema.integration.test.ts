import { describe, expect, it, vi } from "vitest";

import { SurrealChunkSchema } from "../../../src/storage/surreal/surreal-chunk-schema.js";

describe("SurrealChunkSchema", () => {
  it("executes idempotent chunk table and index definitions", async () => {
    const connect = vi.fn(async () => undefined);
    const query = vi.fn(async () => []);
    const schema = new SurrealChunkSchema(
      {
        config: {} as never,
        connect,
        disconnect: vi.fn(async () => undefined),
        driver: {
          query,
        } as never,
        healthCheck: vi.fn(async () => ({}) as never),
      },
      {
        embeddingVectorDimension: 4096,
      },
    );

    await schema.ensure();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("DEFINE TABLE IF NOT EXISTS chunk SCHEMAFULL;"),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "DEFINE FIELD IF NOT EXISTS embedding ON TABLE chunk TYPE option<array<float>>;",
      ),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "DEFINE INDEX IF NOT EXISTS chunk_repository_file_idx ON TABLE chunk FIELDS repositoryId, filePath;",
      ),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "DEFINE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx ON TABLE chunk FIELDS embedding HNSW DIMENSION 4096 TYPE F32 DIST COSINE;",
      ),
    );
  });
});
