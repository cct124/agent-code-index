import { describe, expect, it } from "vitest";

import { FallbackParser } from "../../src/parsing/fallback-parser.js";
import { JavaScriptTreeSitterParser } from "../../src/parsing/tree-sitter/languages/javascript-parser.js";
import { MarkdownParser } from "../../src/parsing/markdown/markdown-parser.js";
import { ParserFactory } from "../../src/parsing/parser-factory.js";
import { PythonTreeSitterParser } from "../../src/parsing/tree-sitter/languages/python-parser.js";
import { TypeScriptTreeSitterParser } from "../../src/parsing/tree-sitter/languages/typescript-parser.js";

describe("ParserFactory", () => {
  it("returns language-aware parsers for markdown, typescript, tsx, javascript, jsx, and python", () => {
    const factory = new ParserFactory();

    expect(factory.getParser("README.md")).toBeInstanceOf(MarkdownParser);
    expect(factory.getParser("src/example.ts")).toBeInstanceOf(
      TypeScriptTreeSitterParser,
    );
    expect(factory.getParser("src/example.tsx")).toBeInstanceOf(
      TypeScriptTreeSitterParser,
    );
    expect(factory.getParser("src/example.js")).toBeInstanceOf(
      JavaScriptTreeSitterParser,
    );
    expect(factory.getParser("src/example.jsx")).toBeInstanceOf(
      JavaScriptTreeSitterParser,
    );
    expect(factory.getParser("src/example.py")).toBeInstanceOf(
      PythonTreeSitterParser,
    );
  });

  it("falls back to generic parser for unsupported extensions", () => {
    const factory = new ParserFactory();

    expect(factory.getParser("notes.txt")).toBeInstanceOf(FallbackParser);
    expect(factory.getParser("src/index.rb")).toBeInstanceOf(FallbackParser);
  });
});
