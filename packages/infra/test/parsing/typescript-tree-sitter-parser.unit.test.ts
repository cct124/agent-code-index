import { describe, expect, it } from "vitest";

import { TypeScriptTreeSitterParser } from "../../src/parsing/tree-sitter/languages/typescript-parser.js";

describe("TypeScriptTreeSitterParser", () => {
  it("extracts classes, methods, functions, and function-valued variables", async () => {
    const parser = new TypeScriptTreeSitterParser(".ts");

    const chunks = await parser.parse({
      repositoryId: "repo-a",
      filePath: "src/example.ts",
      content: [
        "export class Greeter {",
        "  greet(name: string) {",
        "    return `hello ${name}`;",
        "  }",
        "",
        "  async load() {",
        "    return 'ok';",
        "  }",
        "}",
        "",
        "export function helper() {",
        "  return 1;",
        "}",
        "",
        "export const compute = () => 42;",
      ].join("\n"),
    });

    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          startLine: 1,
          endLine: 9,
          metadata: expect.objectContaining({
            symbolName: "Greeter",
            symbolKind: "class",
          }),
        }),
        expect.objectContaining({
          startLine: 2,
          endLine: 4,
          metadata: expect.objectContaining({
            symbolName: "greet",
            symbolKind: "method",
            parentSymbol: "Greeter",
          }),
        }),
        expect.objectContaining({
          startLine: 6,
          endLine: 8,
          metadata: expect.objectContaining({
            symbolName: "load",
            symbolKind: "method",
            parentSymbol: "Greeter",
          }),
        }),
        expect.objectContaining({
          startLine: 11,
          endLine: 13,
          metadata: expect.objectContaining({
            symbolName: "helper",
            symbolKind: "function",
          }),
        }),
        expect.objectContaining({
          startLine: 15,
          endLine: 15,
          metadata: expect.objectContaining({
            symbolName: "compute",
            symbolKind: "function",
          }),
        }),
      ]),
    );
  });

  it("splits oversized semantic nodes with fallback windows while preserving metadata", async () => {
    const parser = new TypeScriptTreeSitterParser(".ts", {
      maxLinesPerChunk: 3,
      overlapLines: 1,
    });

    const chunks = await parser.parse({
      repositoryId: "repo-a",
      filePath: "src/large.ts",
      content: [
        "export function oversized() {",
        "  const a = 1;",
        "  const b = 2;",
        "  const c = 3;",
        "  return a + b + c;",
        "}",
      ].join("\n"),
    });

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual(
      expect.objectContaining({
        startLine: 1,
        endLine: 3,
        metadata: expect.objectContaining({
          symbolName: "oversized",
          symbolKind: "function",
        }),
      }),
    );
    expect(chunks[1]).toEqual(
      expect.objectContaining({
        startLine: 3,
        endLine: 5,
        metadata: expect.objectContaining({
          symbolName: "oversized",
          symbolKind: "function",
        }),
      }),
    );
    expect(chunks[2]).toEqual(
      expect.objectContaining({
        startLine: 5,
        endLine: 6,
        metadata: expect.objectContaining({
          symbolName: "oversized",
          symbolKind: "function",
        }),
      }),
    );
  });

  it("extracts getter, setter, private field, and export default semantics", async () => {
    const parser = new TypeScriptTreeSitterParser(".ts");

    const chunks = await parser.parse({
      repositoryId: "repo-a",
      filePath: "src/advanced.ts",
      content: [
        "export default class Greeter {",
        "  constructor(private readonly name: string) {}",
        "",
        "  get name(): string {",
        "    return this._name;",
        "  }",
        "",
        "  set name(value: string) {",
        "    this._name = value;",
        "  }",
        "",
        "  static create() {",
        "    return new Greeter('a');",
        "  }",
        "",
        "  async load() {",
        "    return 'ok';",
        "  }",
        "",
        "  #secret = 1;",
        "  private static cache = new Map();",
        "}",
        "",
        "export default function helper() {",
        "  return 1;",
        "}",
        "",
        "const localHelper = async () => 7;",
        "export default localHelper;",
        "",
        "export default () => 42;",
      ].join("\n"),
    });

    expect(chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "Greeter",
            symbolKind: "class",
            tags: expect.arrayContaining(["export", "default"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "constructor",
            symbolKind: "constructor",
            parentSymbol: "Greeter",
            tags: expect.arrayContaining(["constructor"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "name",
            symbolKind: "getter",
            parentSymbol: "Greeter",
            tags: expect.arrayContaining(["getter"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "name",
            symbolKind: "setter",
            parentSymbol: "Greeter",
            tags: expect.arrayContaining(["setter"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "create",
            symbolKind: "method",
            parentSymbol: "Greeter",
            tags: expect.arrayContaining(["static"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "load",
            symbolKind: "method",
            parentSymbol: "Greeter",
            tags: expect.arrayContaining(["async"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "#secret",
            symbolKind: "field",
            parentSymbol: "Greeter",
            tags: expect.arrayContaining(["private"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "cache",
            symbolKind: "field",
            parentSymbol: "Greeter",
            tags: expect.arrayContaining(["private", "static"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "helper",
            symbolKind: "function",
            tags: expect.arrayContaining(["export", "default"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "localHelper",
            symbolKind: "function",
            tags: expect.arrayContaining(["export", "default", "async"]),
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbolName: "default",
            symbolKind: "function",
            tags: expect.arrayContaining(["export", "default"]),
          }),
        }),
      ]),
    );
  });
});
