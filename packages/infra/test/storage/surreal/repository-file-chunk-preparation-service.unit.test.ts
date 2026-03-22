import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "../../../../core/src/index.js";

import { ParserFactory } from "../../../src/parsing/parser-factory.js";
import { RepositoryFileChunkPreparationService } from "../../../src/services/repository-file-chunk-preparation-service.js";

describe("RepositoryFileChunkPreparationService", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map(async (dirPath) => {
        await import("node:fs/promises").then(({ rm }) =>
          rm(dirPath, { recursive: true, force: true }),
        );
      }),
    );
    tempDirs.length = 0;
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

  it("prepares selected files and keeps per-file chunk groups", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aci-files-"));
    tempDirs.push(tempDir);
    await mkdir(path.join(tempDir, "src"), { recursive: true });
    await writeFile(path.join(tempDir, "src", "a.ts"), "export const a = 1;\n");
    await writeFile(path.join(tempDir, "src", "b.ts"), "# Title\n\ncontent\n");

    const service = new RepositoryFileChunkPreparationService(
      new ParserFactory({}, createLogger()),
      createLogger(),
    );

    const result = await service.prepareFiles({
      repositoryId: "repo-a",
      rootPath: tempDir,
      filePaths: ["src/a.ts", "src/b.ts"],
    });

    expect(result.requestedFileCount).toBe(2);
    expect(result.failedFiles).toEqual([]);
    expect(result.files).toHaveLength(2);
    expect(result.files.map((file) => file.filePath)).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
  });
});
