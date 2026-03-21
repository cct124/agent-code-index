import { createHash } from "node:crypto";
import path from "node:path";

import type { Chunk, ParseInput, Parser } from "@agent-code-index/core";

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
    if (!input.content.trim()) {
      return [];
    }

    const lines = input.content.split(/\r?\n/);
    const chunks: Chunk[] = [];
    let startIndex = 0;

    while (startIndex < lines.length) {
      const endIndex = Math.min(
        startIndex + this.maxLinesPerChunk,
        lines.length,
      );
      const chunkLines = lines.slice(startIndex, endIndex);
      const content = chunkLines.join("\n").trimEnd();

      if (content.trim()) {
        const startLine = startIndex + 1;
        const endLine = endIndex;

        chunks.push({
          id: `${normalizeFilePath(input.filePath)}:${startLine}-${endLine}`,
          repositoryId: input.repositoryId,
          filePath: normalizeFilePath(input.filePath),
          language: languageFromFilePath(input.filePath),
          content,
          searchText: normalizeSearchText(content),
          startLine,
          endLine,
          hash: hashChunkContent(content),
          metadata: {},
        });
      }

      if (endIndex >= lines.length) {
        break;
      }

      startIndex = Math.max(endIndex - this.overlapLines, startIndex + 1);
    }

    return chunks;
  }
}

/**
 * 将多行文本折叠为便于检索的单行 searchText。
 */
function normalizeSearchText(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

/**
 * 计算 chunk 内容哈希，用于后续变更检测与去重。
 */
function hashChunkContent(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

/**
 * 统一文件路径分隔符，避免平台差异影响 chunk id 与 filePath。
 */
function normalizeFilePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

/**
 * 根据文件扩展名推断语言名称。
 */
function languageFromFilePath(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".ts":
    case ".tsx":
      return "typescript";
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".py":
      return "python";
    case ".md":
      return "markdown";
    case ".json":
      return "json";
    case ".yml":
    case ".yaml":
      return "yaml";
    default:
      return "text";
  }
}
