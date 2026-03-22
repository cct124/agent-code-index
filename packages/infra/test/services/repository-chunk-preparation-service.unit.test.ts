import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@agent-code-index/core";
import { ParserFactory } from "../../src/parsing/parser-factory.js";
import { LocalFileScanner } from "../../src/scanning/local-file-scanner.js";
import { RepositoryChunkPreparationService } from "../../src/services/repository-chunk-preparation-service.js";

describe("RepositoryChunkPreparationService", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map(async (dirPath) => {
        await rm(dirPath, { recursive: true, force: true });
      }),
    );
  });

  it("scans a repository, parses text files, and skips binary files", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "prepare-chunks-"));
    tempDirectories.push(rootPath);

    await mkdir(path.join(rootPath, "src"), { recursive: true });
    await mkdir(path.join(rootPath, "assets"), { recursive: true });

    await writeFile(
      path.join(rootPath, "src", "index.ts"),
      [
        "export function alpha() {",
        "  return 1;",
        "}",
        "export function beta() {",
        "  return 2;",
        "}",
      ].join("\n"),
    );
    await writeFile(
      path.join(rootPath, "assets", "image.bin"),
      Buffer.from([0, 1, 2, 3]),
    );

    const service = new RepositoryChunkPreparationService(
      new LocalFileScanner(["node_modules", ".git"]),
      new ParserFactory({ maxLinesPerChunk: 4, overlapLines: 1 }),
    );

    const result = await service.prepare({
      repositoryId: "repo-a",
      rootPath,
    });

    expect(result.scannedFileCount).toBe(2);
    expect(result.parsedFileCount).toBe(1);
    expect(result.skippedFileCount).toBe(1);
    expect(result.failedFiles).toEqual([]);
    expect(result.chunks).toEqual([
      expect.objectContaining({
        repositoryId: "repo-a",
        filePath: "src/index.ts",
        startLine: 1,
        endLine: 3,
        metadata: expect.objectContaining({
          symbolName: "alpha",
          symbolKind: "function",
        }),
      }),
      expect.objectContaining({
        repositoryId: "repo-a",
        filePath: "src/index.ts",
        startLine: 4,
        endLine: 6,
        metadata: expect.objectContaining({
          symbolName: "beta",
          symbolKind: "function",
        }),
      }),
    ]);
  });

  it("logs per-file preparation progress", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "prepare-chunks-"));
    tempDirectories.push(rootPath);

    await mkdir(path.join(rootPath, "src"), { recursive: true });
    await writeFile(
      path.join(rootPath, "src", "index.ts"),
      ["export function alpha() {", "  return 1;", "}"].join("\n"),
    );

    const logger = createLogger();
    const service = new RepositoryChunkPreparationService(
      new LocalFileScanner(["node_modules", ".git"]),
      new ParserFactory({ maxLinesPerChunk: 4, overlapLines: 1 }),
      logger,
    );

    await service.prepare({
      repositoryId: "repo-a",
      rootPath,
    });

    expect(logger.info).toHaveBeenCalledWith(
      "Repository file preparation started",
      expect.objectContaining({
        filePath: "src/index.ts",
        fileIndex: 1,
        totalFiles: 1,
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Repository file preparation completed",
      expect.objectContaining({
        filePath: "src/index.ts",
        fileIndex: 1,
        totalFiles: 1,
        chunkCount: 1,
        durationMs: expect.any(Number),
      }),
    );
  });

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
});
