import { describe, expect, it, vi } from "vitest";

import type { ChunkRepository, Logger } from "../../src/index.js";
import { DefaultDeleteFilesService } from "../../src/index.js";

describe("DefaultDeleteFilesService", () => {
  function createLogger(): Logger {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(function (this: Logger) {
        return this;
      }),
    };
  }

  it("deletes chunks for deduplicated file paths", async () => {
    const chunkRepository: ChunkRepository = {
      upsertMany: vi.fn(async () => undefined),
      deleteByRepository: vi.fn(async () => undefined),
      deleteByFilePaths: vi.fn(async () => 3),
      findByFilePath: vi.fn(async () => []),
    };

    const service = new DefaultDeleteFilesService(
      chunkRepository,
      createLogger(),
    );

    const result = await service.execute({
      repositoryId: "repo-a",
      filePaths: ["src/a.ts", "src/a.ts", "src/b.ts"],
    });

    expect(chunkRepository.deleteByFilePaths).toHaveBeenCalledWith({
      repositoryId: "repo-a",
      filePaths: ["src/a.ts", "src/b.ts"],
    });
    expect(result).toEqual({
      requestedFileCount: 2,
      deletedFileCount: 2,
      deletedChunkCount: 3,
    });
  });
});
