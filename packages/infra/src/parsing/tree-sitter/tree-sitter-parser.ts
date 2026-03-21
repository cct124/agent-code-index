import TSParser, { type SyntaxNode } from "tree-sitter";

import type { Chunk, ParseInput, Parser } from "@agent-code-index/core";

import {
  createChunk,
  createLineChunks,
  sortAndDedupeChunks,
} from "../chunk-utils.js";
import {
  FallbackParser,
  type FallbackParserOptions,
} from "../fallback-parser.js";

/**
 * tree-sitter parser 的公共配置。
 */
export interface TreeSitterParserOptions extends FallbackParserOptions {}

/**
 * tree-sitter 语义解析器的公共基类。
 */
export abstract class TreeSitterParser implements Parser {
  /** tree-sitter 原生 parser。 */
  private readonly parser: TSParser;
  /** 语义块过大或解析失败时的 fallback parser。 */
  private readonly fallbackParser: FallbackParser;
  /** 单个 chunk 最大行数。 */
  private readonly maxLinesPerChunk: number;
  /** 相邻 chunk 的重叠行数。 */
  private readonly overlapLines: number;

  /**
   * 初始化 tree-sitter parser。
   */
  protected constructor(
    language: unknown,
    options: TreeSitterParserOptions = {},
  ) {
    this.parser = new TSParser();
    this.parser.setLanguage(language as Parameters<TSParser["setLanguage"]>[0]);
    this.fallbackParser = new FallbackParser(options);
    this.maxLinesPerChunk = options.maxLinesPerChunk ?? 80;
    this.overlapLines = options.overlapLines ?? 20;
  }

  /**
   * 将代码文件解析为语义 chunk；若无法可靠提取则回退到固定窗口切块。
   */
  public async parse(input: ParseInput): Promise<Chunk[]> {
    if (!input.content.trim()) {
      return [];
    }

    const tree = this.parser.parse(input.content);
    const rootNode = tree.rootNode;

    if (hasTreeSitterError(rootNode)) {
      return this.fallbackParser.parse(input);
    }

    const chunks = this.collectChunks(input, rootNode);

    if (chunks.length === 0) {
      return this.fallbackParser.parse(input);
    }

    return sortAndDedupeChunks(chunks);
  }

  /**
   * 由具体语言解析器实现节点提取逻辑。
   */
  protected abstract collectChunks(
    input: ParseInput,
    rootNode: SyntaxNode,
  ): Chunk[];

  /**
   * 基于语义节点生成一个或多个 chunk。
   */
  protected createChunksForNode(
    input: ParseInput,
    node: SyntaxNode,
    metadata: Chunk["metadata"],
  ): Chunk[] {
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const lineCount = endLine - startLine + 1;

    if (lineCount > this.maxLinesPerChunk) {
      return createLineChunks({
        repositoryId: input.repositoryId,
        filePath: input.filePath,
        content: node.text,
        maxLinesPerChunk: this.maxLinesPerChunk,
        overlapLines: this.overlapLines,
        startLineOffset: node.startPosition.row,
        metadata,
      });
    }

    return [
      createChunk({
        repositoryId: input.repositoryId,
        filePath: input.filePath,
        content: node.text,
        startLine,
        endLine,
        metadata,
      }),
    ];
  }
}

/**
 * 判断当前语法树是否存在语法错误节点。
 */
function hasTreeSitterError(rootNode: SyntaxNode): boolean {
  const candidate = rootNode as SyntaxNode & {
    hasError?: boolean | (() => boolean);
  };
  const hasError = candidate.hasError;

  if (typeof hasError === "function") {
    return (hasError as () => boolean)();
  }

  return Boolean(hasError);
}
