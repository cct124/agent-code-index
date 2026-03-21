import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalFileScanner } from "../../src/scanning/local-file-scanner.js";

describe("LocalFileScanner", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map(async (dirPath) => {
        await rm(dirPath, { recursive: true, force: true });
      }),
    );
  });

  it("scans files recursively and skips ignored directories", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "scanner-test-"));
    tempDirectories.push(rootPath);

    await mkdir(path.join(rootPath, "src"), { recursive: true });
    await mkdir(path.join(rootPath, "docs"), { recursive: true });
    await mkdir(path.join(rootPath, "node_modules", "pkg"), {
      recursive: true,
    });
    await mkdir(path.join(rootPath, ".git"), { recursive: true });

    await writeFile(path.join(rootPath, "src", "index.ts"), "export {};\n");
    await writeFile(path.join(rootPath, "docs", "readme.md"), "# readme\n");
    await writeFile(
      path.join(rootPath, "node_modules", "pkg", "index.js"),
      "module.exports = {}\n",
    );
    await writeFile(path.join(rootPath, ".git", "config"), "[core]\n");

    const scanner = new LocalFileScanner();
    const scannedFiles = await scanner.scan(rootPath);

    expect(
      scannedFiles.map((filePath) => path.relative(rootPath, filePath)),
    ).toEqual(["docs/readme.md", "src/index.ts"]);
  });
});
