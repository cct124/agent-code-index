import type { Parser } from "@agent-code-index/core";

import {
  FallbackParser,
  type FallbackParserOptions,
} from "./fallback-parser.js";

/**
 * 解析器工厂。
 *
 * 当前第一版统一返回 fallback parser，后续接入 tree-sitter 后可在此处按扩展名
 * 或语言类型分派到更强的语言感知解析器。
 */
export class ParserFactory {
  /** 当前默认使用的 fallback parser。 */
  private readonly fallbackParser: Parser;

  /**
   * 初始化解析器工厂。
   */
  public constructor(options: FallbackParserOptions = {}) {
    this.fallbackParser = new FallbackParser(options);
  }

  /**
   * 根据文件路径选择解析器。
   */
  public getParser(_filePath: string): Parser {
    return this.fallbackParser;
  }
}
