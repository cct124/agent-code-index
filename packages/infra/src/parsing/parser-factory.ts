import path from "node:path";

import { NOOP_LOGGER, type Logger, type Parser } from "@agent-code-index/core";

import {
  FallbackParser,
  type FallbackParserOptions,
} from "./fallback-parser.js";
import {
  MarkdownParser,
  type MarkdownParserOptions,
} from "./markdown/markdown-parser.js";
import { JavaScriptTreeSitterParser } from "./tree-sitter/languages/javascript-parser.js";
import { PythonTreeSitterParser } from "./tree-sitter/languages/python-parser.js";
import { TypeScriptTreeSitterParser } from "./tree-sitter/languages/typescript-parser.js";

/**
 * 解析器工厂。
 *
 * 当前按扩展名分派到 tree-sitter、Markdown 或 fallback parser，作为各语言
 * 语义切块能力的统一入口。
 */
export class ParserFactory {
  /** 当前默认使用的 fallback parser。 */
  private readonly fallbackParser: Parser;
  /** Markdown 专用解析器。 */
  private readonly markdownParser: Parser;
  /** TypeScript 解析器。 */
  private readonly typeScriptParser: Parser;
  /** TSX 解析器。 */
  private readonly tsxParser: Parser;
  /** JavaScript 解析器。 */
  private readonly javaScriptParser: Parser;
  /** JSX 解析器。 */
  private readonly jsxParser: Parser;
  /** Python 解析器。 */
  private readonly pythonParser: Parser;
  /** 结构化日志接口。 */
  private readonly logger: Logger;

  /**
   * 初始化解析器工厂。
   */
  public constructor(
    options: FallbackParserOptions = {},
    logger: Logger = NOOP_LOGGER,
  ) {
    this.logger = logger.child({
      package: "infra",
      module: "parser-factory",
      component: "ParserFactory",
    });
    this.fallbackParser = new FallbackParser(options);
    this.markdownParser = new MarkdownParser(
      options,
      this.logger.child({
        component: "MarkdownParser",
        parserType: "markdown",
      }),
    );
    this.typeScriptParser = new TypeScriptTreeSitterParser(
      ".ts",
      options,
      this.logger.child({
        component: "TypeScriptTreeSitterParser",
        parserType: "typescript",
      }),
    );
    this.tsxParser = new TypeScriptTreeSitterParser(
      ".tsx",
      options,
      this.logger.child({
        component: "TypeScriptTreeSitterParser",
        parserType: "tsx",
      }),
    );
    this.javaScriptParser = new JavaScriptTreeSitterParser(
      ".js",
      options,
      this.logger.child({
        component: "JavaScriptTreeSitterParser",
        parserType: "javascript",
      }),
    );
    this.jsxParser = new JavaScriptTreeSitterParser(
      ".jsx",
      options,
      this.logger.child({
        component: "JavaScriptTreeSitterParser",
        parserType: "jsx",
      }),
    );
    this.pythonParser = new PythonTreeSitterParser(
      options,
      this.logger.child({
        component: "PythonTreeSitterParser",
        parserType: "python",
      }),
    );
  }

  /**
   * 根据文件路径选择解析器。
   */
  public getParser(_filePath: string): Parser {
    const extension = path.extname(_filePath).toLowerCase();
    const parser = (() => {
      switch (extension) {
        case ".md":
          return this.markdownParser;
        case ".ts":
          return this.typeScriptParser;
        case ".tsx":
          return this.tsxParser;
        case ".js":
          return this.javaScriptParser;
        case ".jsx":
          return this.jsxParser;
        case ".py":
          return this.pythonParser;
        default:
          return this.fallbackParser;
      }
    })();

    this.logger.debug("Selected parser for file", {
      filePath: _filePath,
      extension,
      parserType: parserNameForExtension(extension),
    });

    return parser;
  }
}

function parserNameForExtension(extension: string): string {
  switch (extension) {
    case ".md":
      return "markdown";
    case ".ts":
      return "typescript";
    case ".tsx":
      return "tsx";
    case ".js":
      return "javascript";
    case ".jsx":
      return "jsx";
    case ".py":
      return "python";
    default:
      return "fallback";
  }
}
