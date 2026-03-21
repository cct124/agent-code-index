import { describe, expect, it } from "vitest";

import { PythonTreeSitterParser } from "../../src/parsing/tree-sitter/languages/python-parser.js";

describe("PythonTreeSitterParser", () => {
  it("extracts classes, methods, and top-level functions", async () => {
    const parser = new PythonTreeSitterParser();

    const chunks = await parser.parse({
      repositoryId: "repo-a",
      filePath: "src/example.py",
      content: [
        "class Memory:",
        "    def save(self, value):",
        "        return value",
        "",
        "    async def load(self):",
        "        return 'ok'",
        "",
        "def helper():",
        "    return 1",
      ].join("\n"),
    });

    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          startLine: 1,
          endLine: 6,
          metadata: expect.objectContaining({
            symbolName: "Memory",
            symbolKind: "class",
          }),
        }),
        expect.objectContaining({
          startLine: 2,
          endLine: 3,
          metadata: expect.objectContaining({
            symbolName: "save",
            symbolKind: "method",
            parentSymbol: "Memory",
          }),
        }),
        expect.objectContaining({
          startLine: 5,
          endLine: 6,
          metadata: expect.objectContaining({
            symbolName: "load",
            symbolKind: "method",
            parentSymbol: "Memory",
          }),
        }),
        expect.objectContaining({
          startLine: 8,
          endLine: 9,
          metadata: expect.objectContaining({
            symbolName: "helper",
            symbolKind: "function",
          }),
        }),
      ]),
    );
  });
});
