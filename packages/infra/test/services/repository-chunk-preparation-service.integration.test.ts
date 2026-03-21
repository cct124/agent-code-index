import { copyFile, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ParserFactory } from "../../src/parsing/parser-factory.js";
import { LocalFileScanner } from "../../src/scanning/local-file-scanner.js";
import { RepositoryChunkPreparationService } from "../../src/services/repository-chunk-preparation-service.js";

const TEMPLATE_ROOT = path.resolve(process.cwd(), "test/template");

describe("RepositoryChunkPreparationService integration", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map(async (dirPath) => {
        await rm(dirPath, { recursive: true, force: true });
      }),
    );
  });

  it("parses real template code files semantically and markdown files structurally", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "semantic-chunks-"));
    tempDirectories.push(rootPath);

    await mkdir(path.join(rootPath, "src"), { recursive: true });
    await mkdir(path.join(rootPath, "docs"), { recursive: true });
    await copyFile(
      path.join(TEMPLATE_ROOT, "audit-log.use-cases.ts"),
      path.join(rootPath, "src", "audit-log.use-cases.ts"),
    );
    await copyFile(
      path.join(TEMPLATE_ROOT, "main.py"),
      path.join(rootPath, "src", "main.py"),
    );
    await writeFile(
      path.join(rootPath, "docs", "guide.md"),
      [
        "---",
        "docType: runbook",
        "---",
        "# Overview",
        "System overview.",
        "## Operations",
        "Operational notes.",
      ].join("\n"),
      "utf8",
    );

    const service = new RepositoryChunkPreparationService(
      new LocalFileScanner(["node_modules", ".git"]),
      new ParserFactory({ maxLinesPerChunk: 40, overlapLines: 10 }),
    );

    const result = await service.prepare({
      repositoryId: "repo-template",
      rootPath,
    });

    expect(result.scannedFileCount).toBe(3);
    expect(result.parsedFileCount).toBe(3);
    expect(result.skippedFileCount).toBe(0);
    expect(result.failedFiles).toEqual([]);
    expect(result.chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "src/audit-log.use-cases.ts",
          metadata: expect.objectContaining({
            symbolName: "AuditLogUseCases",
            symbolKind: "class",
          }),
        }),
        expect.objectContaining({
          filePath: "src/audit-log.use-cases.ts",
          metadata: expect.objectContaining({
            symbolName: "listAuditLogs",
            symbolKind: "method",
            parentSymbol: "AuditLogUseCases",
          }),
        }),
        expect.objectContaining({
          filePath: "src/main.py",
          metadata: expect.objectContaining({
            symbolName: "MemoryClient",
            symbolKind: "class",
          }),
        }),
        expect.objectContaining({
          filePath: "src/main.py",
          metadata: expect.objectContaining({
            symbolName: "add",
            symbolKind: "method",
            parentSymbol: "MemoryClient",
          }),
        }),
        expect.objectContaining({
          filePath: "docs/guide.md",
          metadata: expect.objectContaining({
            heading: "Overview",
            headingPath: ["Overview"],
            sectionLevel: 1,
            docType: "runbook",
          }),
        }),
        expect.objectContaining({
          filePath: "docs/guide.md",
          metadata: expect.objectContaining({
            heading: "Operations",
            headingPath: ["Overview", "Operations"],
            sectionLevel: 2,
            docType: "runbook",
          }),
        }),
      ]),
    );
  });
});
