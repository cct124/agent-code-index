import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_SCAN_IGNORE_PATTERNS,
  LocalFileScanner,
} from "../../src/scanning/local-file-scanner.js";

describe("LocalFileScanner", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map(async (dirPath) => {
        await rm(dirPath, { recursive: true, force: true });
      }),
    );
  });

  it("exposes built-in ignore patterns including git metadata directories", () => {
    expect(DEFAULT_SCAN_IGNORE_PATTERNS).toContain(".git");
    expect(DEFAULT_SCAN_IGNORE_PATTERNS).toContain(".yarn");
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

  it("skips files matched by suffix ignore patterns", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "scanner-test-"));
    tempDirectories.push(rootPath);

    await mkdir(path.join(rootPath, "packages", "demo"), { recursive: true });

    await writeFile(
      path.join(rootPath, "packages", "demo", "tsconfig.tsbuildinfo"),
      "binary-like-build-info\n",
    );
    await writeFile(
      path.join(rootPath, "packages", "demo", "index.ts"),
      "export {};\n",
    );

    const scanner = new LocalFileScanner();
    const scannedFiles = await scanner.scan(rootPath);

    expect(
      scannedFiles.map((filePath) => path.relative(rootPath, filePath)),
    ).toEqual(["packages/demo/index.ts"]);
  });

  it("merges root gitignore rules into scanner exclusions", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "scanner-test-"));
    tempDirectories.push(rootPath);

    await mkdir(path.join(rootPath, "dist"), { recursive: true });
    await mkdir(path.join(rootPath, ".logs"), { recursive: true });

    await writeFile(
      path.join(rootPath, ".gitignore"),
      ["dist/", "*.log", ".env.*", "!.env.example", ".logs/"].join("\n"),
    );
    await writeFile(path.join(rootPath, "src.ts"), "export {};\n");
    await writeFile(
      path.join(rootPath, "dist", "bundle.js"),
      "console.log('x');\n",
    );
    await writeFile(path.join(rootPath, ".logs", "agent.log"), "log\n");
    await writeFile(path.join(rootPath, ".env.local"), "X=1\n");
    await writeFile(path.join(rootPath, ".env.example"), "X=1\n");

    const scanner = new LocalFileScanner(
      undefined,
      path.join(rootPath, ".gitignore"),
    );
    const scannedFiles = await scanner.scan(rootPath);

    expect(
      scannedFiles.map((filePath) => path.relative(rootPath, filePath)),
    ).toEqual([".env.example", ".gitignore", "src.ts"]);
  });

  it("ignores a missing gitignore file path", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "scanner-test-"));
    tempDirectories.push(rootPath);

    await writeFile(path.join(rootPath, "src.ts"), "export {};\n");

    const scanner = new LocalFileScanner(
      undefined,
      path.join(rootPath, ".gitignore"),
    );
    const scannedFiles = await scanner.scan(rootPath);

    expect(
      scannedFiles.map((filePath) => path.relative(rootPath, filePath)),
    ).toEqual(["src.ts"]);
  });

  it("keeps files matched by include patterns even when ignore rules would exclude them", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "scanner-test-"));
    tempDirectories.push(rootPath);

    await mkdir(path.join(rootPath, "dist"), { recursive: true });
    await writeFile(
      path.join(rootPath, ".gitignore"),
      ["dist/", "*.generated.ts"].join("\n"),
    );
    await writeFile(
      path.join(rootPath, "dist", "keep.ts"),
      "export const keep = true;\n",
    );
    await writeFile(
      path.join(rootPath, "dist", "skip.js"),
      "console.log('skip');\n",
    );
    await writeFile(
      path.join(rootPath, "api.generated.ts"),
      "export const generated = true;\n",
    );

    const scanner = new LocalFileScanner(
      ["dist"],
      path.join(rootPath, ".gitignore"),
      ["dist/keep.ts", "*.generated.ts"],
    );
    const scannedFiles = await scanner.scan(rootPath);

    expect(
      scannedFiles.map((filePath) => path.relative(rootPath, filePath)),
    ).toEqual([".gitignore", "api.generated.ts", "dist/keep.ts"]);
  });
});
