import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  FileScanner,
  Logger,
  PreparedChunk,
  PrepareRepositoryChunksInput,
  PrepareRepositoryChunksResult,
  RepositoryChunkPreparationService as RepositoryChunkPreparationServiceContract,
} from "@agent-code-index/core";
import { NOOP_LOGGER } from "@agent-code-index/core";

import { ParserFactory } from "../parsing/parser-factory.js";
export type {
  PrepareRepositoryChunksInput,
  PrepareRepositoryChunksResult,
} from "@agent-code-index/core";

/**
 * 仓库扫描与 chunk 准备服务。
 *
 * 该服务负责串联“扫描目录 -> 读取文件 -> 选择解析器 -> 产出 chunk”这条主流程，
 * 但不负责 embedding 生成与存储写入。
 */
export class RepositoryChunkPreparationService implements RepositoryChunkPreparationServiceContract {
  /** 用于枚举候选文件的扫描器。 */
  private readonly fileScanner: FileScanner;
  /** 用于按文件类型选择解析器的工厂。 */
  private readonly parserFactory: ParserFactory;
  /** 结构化日志接口。 */
  private readonly logger: Logger;

  /**
   * 初始化仓库 chunk 准备服务。
   */
  public constructor(
    fileScanner: FileScanner,
    parserFactory: ParserFactory,
    logger: Logger = NOOP_LOGGER,
  ) {
    this.fileScanner = fileScanner;
    this.parserFactory = parserFactory;
    this.logger = logger.child({
      package: "infra",
      module: "repository-chunk-preparation-service",
      component: "RepositoryChunkPreparationService",
    });
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
    const logger = this.logger.child({
      operation: "prepare-repository-chunks",
      repositoryId: input.repositoryId,
      rootPath: input.rootPath,
    });
    const files = await this.fileScanner.scan(input.rootPath);
    const chunks: PreparedChunk[] = [];
    const failedFiles: Array<{ filePath: string; reason: string }> = [];
    let parsedFileCount = 0;
    let skippedFileCount = 0;

    logger.info("Repository chunk preparation started", {
      scannedFileCount: files.length,
    });

    for (const [index, absolutePath] of files.entries()) {
      const relativePath = normalizeRelativePath(
        path.relative(input.rootPath, absolutePath),
      );
      const fileStartedAt = Date.now();

      logger.info("Repository file preparation started", {
        filePath: relativePath,
        fileIndex: index + 1,
        totalFiles: files.length,
      });

      try {
        const content = await readFile(absolutePath, "utf8");

        if (content.includes("\u0000")) {
          skippedFileCount += 1;
          logger.info("Repository file skipped as binary", {
            filePath: relativePath,
            fileIndex: index + 1,
            totalFiles: files.length,
            durationMs: Date.now() - fileStartedAt,
          });
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
          logger.info("Repository file skipped with no chunks", {
            filePath: relativePath,
            fileIndex: index + 1,
            totalFiles: files.length,
            durationMs: Date.now() - fileStartedAt,
          });
          continue;
        }

        parsedFileCount += 1;
        chunks.push(...parsedChunks);
        logger.info("Repository file preparation completed", {
          filePath: relativePath,
          fileIndex: index + 1,
          totalFiles: files.length,
          chunkCount: parsedChunks.length,
          durationMs: Date.now() - fileStartedAt,
        });
      } catch (error) {
        failedFiles.push({
          filePath: relativePath,
          reason: error instanceof Error ? error.message : String(error),
        });
        logger.warn("Failed to prepare file chunks", {
          filePath: relativePath,
          fileIndex: index + 1,
          totalFiles: files.length,
          durationMs: Date.now() - fileStartedAt,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    logger.info("Repository chunk preparation completed", {
      scannedFileCount: files.length,
      parsedFileCount,
      skippedFileCount,
      chunkCount: chunks.length,
      failedFileCount: failedFiles.length,
    });

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
