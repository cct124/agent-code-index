/**
 * project metadata 仓储的轻量集成测试。
 */
import { describe, expect, it, vi } from "vitest";

import type { ProjectMetadata } from "@agent-code-index/core";

import { SurrealProjectMetadataRepository } from "../../../src/storage/surreal/surreal-project-metadata-repository.js";

function createPassthroughClient(
  driver: Record<string, unknown>,
  connect = vi.fn(async () => undefined),
) {
  return {
    config: {} as never,
    connect,
    disconnect: vi.fn(async () => undefined),
    execute: async <T>(
      _operationName: string,
      operation: (connectedDriver: never) => Promise<T>,
    ) => {
      await connect();
      return operation(driver as never);
    },
    driver: driver as never,
    healthCheck: vi.fn(async () => ({}) as never),
  };
}

function createMetadata(): ProjectMetadata {
  return {
    projectSpace: "demo-project",
    namespace: "demo_project",
    database: "default",
    embeddingProvider: "voyage",
    embeddingModel: "voyage-code-3",
    embeddingVectorDimension: 1024,
    createdAt: "2026-03-20T10:00:00.000Z",
    updatedAt: "2026-03-20T10:00:00.000Z",
  };
}

describe("SurrealProjectMetadataRepository", () => {
  it("saves and reads project metadata using the configured record id", async () => {
    const store = new Map<string, ProjectMetadata & { id: string }>();
    const connect = vi.fn(async () => undefined);
    const select = vi.fn(async (recordId: { toString(): string }) =>
      store.get(recordId.toString()),
    );
    const upsert = vi.fn((recordId: { toString(): string }) => ({
      content: async (data: ProjectMetadata) => {
        const stored = {
          id: recordId.toString(),
          ...data,
        };

        store.set(recordId.toString(), stored);
        return stored;
      },
    }));

    const repository = new SurrealProjectMetadataRepository(
      createPassthroughClient(
        {
          select,
          upsert,
        },
        connect,
      ),
    );

    const metadata = createMetadata();
    await repository.save(metadata);

    const loaded = await repository.getByProjectSpace({
      projectSpace: metadata.projectSpace,
    });

    expect(connect).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
    expect(loaded).toEqual(metadata);
  });
});
