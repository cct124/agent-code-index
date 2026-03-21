import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Chunk, FileScanner } from "@agent-code-index/core";

import { ParserFactory } from "../parsing/parser-factory.js";

/**
 * 仓库 chunk 准备输入。
 */
export interface PrepareRepositoryChunksInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 仓库根目录。 */
  rootPath: string;
}

/**
 * 仓库 chunk 准备结果。
 */
export interface PrepareRepositoryChunksResult {
  /** 扫描到的文件数。 */
  scannedFileCount: number;
  /** 成功解析的文件数。 */
  parsedFileCount: number;
  /** 被跳过的文件数。 */
  skippedFileCount: number;
  /** 解析得到的 chunk。 */
  chunks: Chunk[];
  /** 失败文件列表。 */
  failedFiles: Array<{
    filePath: string;
    reason: string;
  }>;
}

/**
 * 仓库扫描与 chunk 准备服务。
 *
 * 该服务负责串联“扫描目录 -> 读取文件 -> 选择解析器 -> 产出 chunk”这条主流程，
 * 但不负责 embedding 生成与存储写入。
 */
export class RepositoryChunkPreparationService {
  /** 用于枚举候选文件的扫描器。 */
  private readonly fileScanner: FileScanner;
  /** 用于按文件类型选择解析器的工厂。 */
  private readonly parserFactory: ParserFactory;

  /**
   * 初始化仓库 chunk 准备服务。
   */
  public constructor(fileScanner: FileScanner, parserFactory: ParserFactory) {
    this.fileScanner = fileScanner;
    this.parserFactory = parserFactory;
  }

  /**
   * 扫描仓库并产出可供后续索引使用的 chunk 列表与统计结果。
   *
   * 当前行为包括：
   * 1. 扫描候选文件
   * 2. 读取文本内容
   * 3. 跳过包含空字节的二进制文件
   * 4. 选择解析器并生成 chunk
   * 5. 汇总成功、跳过与失败统计
   */
  public async prepare(
    input: PrepareRepositoryChunksInput,
  ): Promise<PrepareRepositoryChunksResult> {
    const files = await this.fileScanner.scan(input.rootPath);
    const chunks: Chunk[] = [];
    const failedFiles: Array<{ filePath: string; reason: string }> = [];
    let parsedFileCount = 0;
    let skippedFileCount = 0;

    for (const absolutePath of files) {
      const relativePath = normalizeRelativePath(
        path.relative(input.rootPath, absolutePath),
      );

      try {
        const content = await readFile(absolutePath, "utf8");

        if (content.includes("\u0000")) {
          skippedFileCount += 1;
          continue;
        }

        const parser = this.parserFactory.getParser(relativePath);
        const parsedChunks = await parser.parse({
          repositoryId: input.repositoryId,
          filePath: relativePath,
          content,
        });

        if (parsedChunks.length === 0) {
          skippedFileCount += 1;
          continue;
        }

        parsedFileCount += 1;
        chunks.push(...parsedChunks);
      } catch (error) {
        failedFiles.push({
          filePath: relativePath,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      scannedFileCount: files.length,
      parsedFileCount,
      skippedFileCount,
      chunks,
      failedFiles,
    };
  }
}

/**
 * 将相对路径统一规范化为 `/` 分隔形式，避免跨平台路径差异泄漏到领域层。
 */
function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
