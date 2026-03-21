import { describe, expect, it } from "vitest";

import { JavaScriptTreeSitterParser } from "../../src/parsing/tree-sitter/languages/javascript-parser.js";

describe("JavaScriptTreeSitterParser", () => {
  it("extracts classes, methods, functions, and function-valued variables from javascript", async () => {
    const parser = new JavaScriptTreeSitterParser(".js");

    const chunks = await parser.parse({
      repositoryId: "repo-a",
      filePath: "src/example.js",
      content: [
        "export class Greeter {",
        "  greet(name) {",
        "    return `hello ${name}`;",
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
          endLine: 5,
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
          startLine: 7,
          endLine: 9,
          metadata: expect.objectContaining({
            symbolName: "helper",
            symbolKind: "function",
          }),
        }),
        expect.objectContaining({
          startLine: 11,
          endLine: 11,
          metadata: expect.objectContaining({
            symbolName: "compute",
            symbolKind: "function",
          }),
        }),
      ]),
    );
  });

  it("extracts jsx component functions and splits oversized semantic nodes with fallback windows", async () => {
    const parser = new JavaScriptTreeSitterParser(".jsx", {
      maxLinesPerChunk: 3,
      overlapLines: 1,
    });

    const chunks = await parser.parse({
      repositoryId: "repo-a",
      filePath: "src/App.jsx",
      content: [
        "export function App() {",
        "  const title = 'hello';",
        "  const subtitle = 'world';",
        "  return <section><h1>{title}</h1><p>{subtitle}</p></section>;",
        "}",
      ].join("\n"),
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual(
      expect.objectContaining({
        startLine: 1,
        endLine: 3,
        metadata: expect.objectContaining({
          symbolName: "App",
          symbolKind: "function",
        }),
      }),
    );
    expect(chunks[1]).toEqual(
      expect.objectContaining({
        startLine: 3,
        endLine: 5,
        metadata: expect.objectContaining({
          symbolName: "App",
          symbolKind: "function",
        }),
      }),
    );
  });
});
