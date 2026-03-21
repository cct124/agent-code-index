import type { Chunk, ParseInput, Parser } from "@agent-code-index/core";

import { createLineChunks, type LineChunkingOptions } from "./chunk-utils.js";

/**
 * fallback parser 配置。
 */
export interface FallbackParserOptions {
  /** 单个 chunk 允许的最大行数。 */
  maxLinesPerChunk?: number;
  /** 相邻 chunk 间的重叠行数。 */
  overlapLines?: number;
}

const DEFAULT_MAX_LINES_PER_CHUNK = 80;
const DEFAULT_OVERLAP_LINES = 20;

/**
 * 通用文本 fallback parser。
 *
 * 当语言暂不支持、AST 解析尚未接入或解析失败时，使用固定行窗口和重叠窗口
 * 将文本切分为可索引 chunk。
 */
export class FallbackParser implements Parser {
  /** 单个 chunk 的最大行数。 */
  private readonly maxLinesPerChunk: number;
  /** 相邻 chunk 的重叠行数。 */
  private readonly overlapLines: number;

  /**
   * 初始化 fallback parser。
   */
  public constructor(options: FallbackParserOptions = {}) {
    this.maxLinesPerChunk =
      options.maxLinesPerChunk ?? DEFAULT_MAX_LINES_PER_CHUNK;
    this.overlapLines = options.overlapLines ?? DEFAULT_OVERLAP_LINES;
  }

  /**
   * 将文件内容按固定行窗口切分为 chunk。
   *
   * 该实现优先保证可用性和稳定的行号范围，不尝试理解语言级语义结构。
   */
  public async parse(input: ParseInput): Promise<Chunk[]> {
    return createLineChunks({
      repositoryId: input.repositoryId,
      filePath: input.filePath,
      content: input.content,
      maxLinesPerChunk: this.maxLinesPerChunk,
      overlapLines: this.overlapLines,
    });
  }
}
