import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  FileChunkPreparationService as FileChunkPreparationServiceContract,
  Logger,
  PrepareFilesInput,
  PrepareFilesResult,
} from "@agent-code-index/core";
import { NOOP_LOGGER } from "@agent-code-index/core";

import { ParserFactory } from "../parsing/parser-factory.js";

/**
 * 基于文件列表的 chunk 准备服务。
 *
 * 与全仓扫描版本不同，这里只读取调用方明确指定的文件，适用于 MCP 的增量更新。
 */
export class RepositoryFileChunkPreparationService implements FileChunkPreparationServiceContract {
  private readonly parserFactory: ParserFactory;
  private readonly logger: Logger;

  public constructor(
    parserFactory: ParserFactory,
    logger: Logger = NOOP_LOGGER,
  ) {
    this.parserFactory = parserFactory;
    this.logger = logger.child({
      package: "infra",
      module: "repository-file-chunk-preparation-service",
      component: "RepositoryFileChunkPreparationService",
    });
  }

  public async prepareFiles(
    input: PrepareFilesInput,
  ): Promise<PrepareFilesResult> {
    const logger = this.logger.child({
      operation: "prepare-files",
      repositoryId: input.repositoryId,
      rootPath: input.rootPath,
      requestedFileCount: input.filePaths.length,
    });
    const files: PrepareFilesResult["files"] = [];
    const failedFiles: PrepareFilesResult["failedFiles"] = [];
    let skippedFileCount = 0;

    for (const relativePath of dedupeFilePaths(input.filePaths)) {
      try {
        const normalizedPath = normalizeRelativePath(relativePath);
        const absolutePath = path.resolve(input.rootPath, normalizedPath);
        const content = await readFile(absolutePath, "utf8");

        // 先用最小代价过滤明显的二进制文件，避免后续 parser 进入无意义处理。
        if (content.includes("\u0000")) {
          skippedFileCount += 1;
          files.push({ filePath: normalizedPath, chunks: [] });
          logger.debug("Skipping binary file during file preparation", {
            filePath: normalizedPath,
          });
          continue;
        }

        const parser = this.parserFactory.getParser(normalizedPath);
        const parsedChunks = await parser.parse({
          repositoryId: input.repositoryId,
          filePath: normalizedPath,
          content,
        });

        if (parsedChunks.length === 0) {
          skippedFileCount += 1;
        }

        files.push({
          filePath: normalizedPath,
          chunks: parsedChunks,
        });
      } catch (error) {
        failedFiles.push({
          filePath: normalizeRelativePath(relativePath),
          reason: error instanceof Error ? error.message : String(error),
        });
        logger.warn("Failed to prepare file chunks", {
          filePath: normalizeRelativePath(relativePath),
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    logger.info("File chunk preparation completed", {
      requestedFileCount: input.filePaths.length,
      preparedFileCount: files.length,
      skippedFileCount,
      failedFileCount: failedFiles.length,
    });

    return {
      requestedFileCount: input.filePaths.length,
      skippedFileCount,
      files,
      failedFiles,
    };
  }
}

/**
 * 去重并清理空文件路径，保证统计和结果集合稳定。
 */
function dedupeFilePaths(filePaths: string[]): string[] {
  return Array.from(
    new Set(filePaths.map((filePath) => filePath.trim())),
  ).filter((filePath) => filePath.length > 0);
}

/**
 * 统一将路径标准化为 `/` 分隔，确保跨平台行为一致。
 */
function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
