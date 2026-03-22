import { describe, expect, it, vi } from "vitest";

import type { ChunkRepository, Logger } from "../../src/index.js";
import { DefaultGetFileContextService } from "../../src/index.js";

describe("DefaultGetFileContextService", () => {
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

  it("loads file chunks and assembles continuous context text", async () => {
    const chunkRepository: ChunkRepository = {
      upsertMany: vi.fn(async () => undefined),
      deleteByRepository: vi.fn(async () => undefined),
      deleteByFilePaths: vi.fn(async () => 0),
      findByFilePath: vi.fn(async () => [
        {
          id: "chunk-1",
          repositoryId: "repo-a",
          filePath: "src/shipping.ts",
          language: "typescript",
          content: "export class ShippingService {}",
          searchText: "typescript class ShippingService",
          startLine: 1,
          endLine: 1,
          hash: "hash-1",
          embedding: [1, 0, 0],
          metadata: {
            symbolName: "ShippingService",
            symbolKind: "class",
          },
        },
        {
          id: "chunk-2",
          repositoryId: "repo-a",
          filePath: "src/shipping.ts",
          language: "typescript",
          content: "export function createShippingService() {}",
          searchText: "typescript function createShippingService",
          startLine: 3,
          endLine: 3,
          hash: "hash-2",
          embedding: [0, 1, 0],
          metadata: {
            symbolName: "createShippingService",
            symbolKind: "function",
          },
        },
      ]),
    };
    const logger = createLogger();
    const service = new DefaultGetFileContextService(chunkRepository, logger);

    const result = await service.execute({
      repositoryId: "repo-a",
      filePath: " src/shipping.ts ",
    });

    expect(chunkRepository.findByFilePath).toHaveBeenCalledWith({
      repositoryId: "repo-a",
      filePath: "src/shipping.ts",
    });
    expect(result).toEqual({
      repositoryId: "repo-a",
      filePath: "src/shipping.ts",
      chunkCount: 2,
      chunks: [
        {
          id: "chunk-1",
          filePath: "src/shipping.ts",
          language: "typescript",
          content: "export class ShippingService {}",
          startLine: 1,
          endLine: 1,
          metadata: {
            symbolName: "ShippingService",
            symbolKind: "class",
          },
        },
        {
          id: "chunk-2",
          filePath: "src/shipping.ts",
          language: "typescript",
          content: "export function createShippingService() {}",
          startLine: 3,
          endLine: 3,
          metadata: {
            symbolName: "createShippingService",
            symbolKind: "function",
          },
        },
      ],
      assembledContext: {
        content:
          "[chunk 1 | lines 1-1 | class ShippingService]\nexport class ShippingService {}\n\n[chunk 2 | lines 3-3 | function createShippingService]\nexport function createShippingService() {}",
        truncated: false,
      },
    });
    expect(logger.info).toHaveBeenCalledWith(
      "Get file context completed",
      expect.objectContaining({
        chunkCount: 2,
      }),
    );
  });

  it("rejects blank file paths", async () => {
    const chunkRepository: ChunkRepository = {
      upsertMany: vi.fn(async () => undefined),
      deleteByRepository: vi.fn(async () => undefined),
      deleteByFilePaths: vi.fn(async () => 0),
      findByFilePath: vi.fn(async () => []),
    };
    const service = new DefaultGetFileContextService(chunkRepository);

    await expect(
      service.execute({
        repositoryId: "repo-a",
        filePath: "   ",
      }),
    ).rejects.toThrow(/filePath must not be empty/i);
    expect(chunkRepository.findByFilePath).not.toHaveBeenCalled();
  });
});
