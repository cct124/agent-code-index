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

  it("extracts python decorator semantics, async tags, and instance fields", async () => {
    const parser = new PythonTreeSitterParser();

    const chunks = await parser.parse({
      repositoryId: "repo-a",
      filePath: "src/advanced.py",
      content: [
        "class Memory:",
        "    @property",
        "    def name(self):",
        "        return self._name",
        "",
        "    @name.setter",
        "    def name(self, value):",
        "        self._name = value",
        "",
        "    @classmethod",
        "    def build(cls):",
        "        return cls()",
        "",
        "    @staticmethod",
        "    def parse(value):",
        "        return value",
        "",
        "    async def load(self):",
        "        self.cache = 1",
        "        self._secret = 2",
        "        return self.cache",
        "",
        "async def fetch():",
        "    return 1",
      ].join("\n"),
    });

    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "name",
            symbolKind: "getter",
            parentSymbol: "Memory",
            decorators: ["property"],
            tags: expect.arrayContaining(["property", "getter"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "name",
            symbolKind: "setter",
            parentSymbol: "Memory",
            decorators: ["name.setter"],
            tags: expect.arrayContaining(["property", "setter"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "build",
            symbolKind: "method",
            parentSymbol: "Memory",
            decorators: ["classmethod"],
            tags: expect.arrayContaining(["classmethod"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "parse",
            symbolKind: "method",
            parentSymbol: "Memory",
            decorators: ["staticmethod"],
            tags: expect.arrayContaining(["staticmethod"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "load",
            symbolKind: "method",
            parentSymbol: "Memory",
            isAsync: true,
            tags: expect.arrayContaining(["async"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "cache",
            symbolKind: "field",
            parentSymbol: "Memory",
            definedBy: "load",
            tags: expect.arrayContaining(["instance-field"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "_secret",
            symbolKind: "field",
            parentSymbol: "Memory",
            definedBy: "load",
            tags: expect.arrayContaining(["instance-field", "private"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "fetch",
            symbolKind: "function",
            isAsync: true,
            tags: expect.arrayContaining(["async"]),
          }),
        }),
      ]),
    );
  });
});
