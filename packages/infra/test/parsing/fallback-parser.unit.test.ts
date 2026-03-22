import { describe, expect, it } from "vitest";

import { FallbackParser } from "../../src/parsing/fallback-parser.js";

describe("FallbackParser", () => {
  it("splits content into overlapping line windows and preserves line ranges", async () => {
    const parser = new FallbackParser({
      maxLinesPerChunk: 3,
      overlapLines: 1,
    });

    const chunks = await parser.parse({
      repositoryId: "repo-a",
      filePath: "src/example.ts",
      content: [
        "export function alpha() {",
        "  return 1;",
        "}",
        "export function beta() {",
        "  return 2;",
      ].join("\n"),
    });

    expect(chunks).toEqual([
      expect.objectContaining({
        id: "src/example.ts:1-3",
        repositoryId: "repo-a",
        filePath: "src/example.ts",
        language: "typescript",
        startLine: 1,
        endLine: 3,
        searchText: "typescript export function alpha() { return 1; }",
      }),
      expect.objectContaining({
        id: "src/example.ts:3-5",
        repositoryId: "repo-a",
        filePath: "src/example.ts",
        language: "typescript",
        startLine: 3,
        endLine: 5,
        searchText: "typescript } export function beta() { return 2;",
      }),
    ]);
    expect(chunks[0]?.hash).toMatch(/^[a-f0-9]{40}$/);
    expect(chunks[1]?.hash).toMatch(/^[a-f0-9]{40}$/);
  });

  it("returns no chunks for blank content", async () => {
    const parser = new FallbackParser();

    await expect(
      parser.parse({
        repositoryId: "repo-a",
        filePath: "README.md",
        content: "\n \n",
      }),
    ).resolves.toEqual([]);
  });
});
