import { createHash } from "node:crypto";
import path from "node:path";

import type { Chunk, ChunkMetadata } from "@agent-code-index/core";

/**
 * 行窗口切块所需参数。
 */
export interface LineChunkingOptions {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 相对仓库根目录的文件路径。 */
  filePath: string;
  /** 待切分内容。 */
  content: string;
  /** 单个 chunk 最大行数。 */
  maxLinesPerChunk: number;
  /** 相邻 chunk 重叠行数。 */
  overlapLines: number;
  /** 行号偏移量，基于 0。 */
  startLineOffset?: number;
  /** 语言名称。 */
  language?: string;
  /** 共享元数据。 */
  metadata?: ChunkMetadata;
}

/**
 * 根据文件路径推断语言名称。
 */
export function languageFromFilePath(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".ts":
      return "typescript";
    case ".tsx":
      return "tsx";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".jsx":
      return "jsx";
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

/**
 * 统一文件路径分隔符，避免平台差异影响 chunk id 与 filePath。
 */
export function normalizeFilePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

/**
 * 将多行文本折叠为便于检索的单行 searchText。
 */
export function normalizeSearchText(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

/**
 * 计算 chunk 内容哈希，用于变更检测与去重。
 */
export function hashChunkContent(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

/**
 * 创建单个 chunk。
 */
export function createChunk(input: {
  repositoryId: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language?: string;
  metadata?: ChunkMetadata;
}): Chunk {
  const normalizedFilePath = normalizeFilePath(input.filePath);

  return {
    id: `${normalizedFilePath}:${input.startLine}-${input.endLine}`,
    repositoryId: input.repositoryId,
    filePath: normalizedFilePath,
    language: input.language ?? languageFromFilePath(input.filePath),
    content: input.content,
    searchText: normalizeSearchText(input.content),
    startLine: input.startLine,
    endLine: input.endLine,
    hash: hashChunkContent(input.content),
    metadata: { ...(input.metadata ?? {}) },
  };
}

/**
 * 按固定行窗口切分文本内容。
 */
export function createLineChunks(options: LineChunkingOptions): Chunk[] {
  if (!options.content.trim()) {
    return [];
  }

  const lines = options.content.split(/\r?\n/);
  const chunks: Chunk[] = [];
  let startIndex = 0;
  const startLineOffset = options.startLineOffset ?? 0;

  while (startIndex < lines.length) {
    const endIndex = Math.min(
      startIndex + options.maxLinesPerChunk,
      lines.length,
    );
    const content = lines.slice(startIndex, endIndex).join("\n").trimEnd();

    if (content.trim()) {
      chunks.push(
        createChunk({
          repositoryId: options.repositoryId,
          filePath: options.filePath,
          content,
          startLine: startLineOffset + startIndex + 1,
          endLine: startLineOffset + endIndex,
          language: options.language,
          metadata: options.metadata,
        }),
      );
    }

    if (endIndex >= lines.length) {
      break;
    }

    startIndex = Math.max(endIndex - options.overlapLines, startIndex + 1);
  }

  return chunks;
}

/**
 * 对 chunk 按行号排序并去重。
 */
export function sortAndDedupeChunks(chunks: Chunk[]): Chunk[] {
  const deduped = new Map<string, Chunk>();

  for (const chunk of chunks) {
    const key = [
      chunk.id,
      chunk.metadata.symbolKind ?? "",
      chunk.metadata.symbolName ?? "",
      chunk.metadata.parentSymbol ?? "",
      chunk.metadata.heading ?? "",
    ].join("|");

    if (!deduped.has(key)) {
      deduped.set(key, chunk);
    }
  }

  return [...deduped.values()].sort(
    (left, right) =>
      left.filePath.localeCompare(right.filePath) ||
      left.startLine - right.startLine ||
      left.endLine - right.endLine ||
      left.id.localeCompare(right.id),
  );
}
