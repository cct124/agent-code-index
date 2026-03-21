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
import { PythonTreeSitterParser } from "./tree-sitter/languages/python-parser.js";
import { TypeScriptTreeSitterParser } from "./tree-sitter/languages/typescript-parser.js";

/**
 * 解析器工厂。
 *
 * 当前第一版统一返回 fallback parser，后续接入 tree-sitter 后可在此处按扩展名
 * 或语言类型分派到更强的语言感知解析器。
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
    case ".py":
      return "python";
    default:
      return "fallback";
  }
}
