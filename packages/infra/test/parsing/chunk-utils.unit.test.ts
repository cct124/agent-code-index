import { describe, expect, it } from "vitest";

import { buildSearchText, createChunk } from "../../src/parsing/chunk-utils.js";

describe("chunk-utils", () => {
  it("keeps plain fallback chunks unchanged when metadata is absent", () => {
    expect(buildSearchText({ content: "export const alpha = 1;" })).toBe(
      "export const alpha = 1;",
    );
  });

  it("injects high-signal semantic metadata into searchText for code chunks", () => {
    const chunk = createChunk({
      repositoryId: "repo-a",
      filePath: "src/greeter.ts",
      content: "static create() { return new Greeter('a'); }",
      startLine: 1,
      endLine: 1,
      metadata: {
        symbolKind: "method",
        symbolName: "create",
        parentSymbol: "Greeter",
        tags: ["static", "async", "private"],
      },
    });

    expect(chunk.searchText).toBe(
      "typescript method create of Greeter static async static create() { return new Greeter('a'); }",
    );
  });

  it("injects document metadata into markdown searchText", () => {
    const chunk = createChunk({
      repositoryId: "repo-a",
      filePath: "docs/design.md",
      content: "## Retrieval\nMetadata improves ranking.",
      startLine: 10,
      endLine: 11,
      metadata: {
        heading: "Retrieval",
        docType: "design",
      },
    });

    expect(chunk.searchText).toBe(
      "markdown design document section Retrieval ## Retrieval Metadata improves ranking.",
    );
  });

  it("normalizes decorator-derived metadata into semantic phrases", () => {
    const chunk = createChunk({
      repositoryId: "repo-a",
      filePath: "src/memory.py",
      content: "def name(self):\n    return self._name",
      startLine: 1,
      endLine: 2,
      metadata: {
        symbolKind: "getter",
        symbolName: "name",
        parentSymbol: "Memory",
        decorators: ["property", "name.setter"],
      },
    });

    expect(chunk.searchText).toBe(
      "python getter name of Memory property property setter def name(self): return self._name",
    );
  });
});
