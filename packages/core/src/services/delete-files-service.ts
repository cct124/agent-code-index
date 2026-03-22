import type { ChunkRepository } from "../contracts/chunk-repository.js";
import { NOOP_LOGGER, type Logger } from "../contracts/logger.js";

/**
 * 文件级删除输入。
 */
export interface DeleteFilesInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 需要删除索引的相对文件路径列表。 */
  filePaths: string[];
}

/**
 * 文件级删除结果。
 */
export interface DeleteFilesResult {
  /** 去重后的请求文件数。 */
  requestedFileCount: number;
  /** 实际参与删除的文件数。 */
  deletedFileCount: number;
  /** 删除的 chunk 数量。 */
  deletedChunkCount: number;
}

/**
 * 文件级删除服务抽象。
 */
export interface DeleteFilesService {
  /**
   * 删除指定文件对应的全部 chunk。
   */
  execute(input: DeleteFilesInput): Promise<DeleteFilesResult>;
}

/**
 * 默认的文件级删除服务实现。
 */
export class DefaultDeleteFilesService implements DeleteFilesService {
  private readonly chunkRepository: ChunkRepository;
  private readonly logger: Logger;

  public constructor(
    chunkRepository: ChunkRepository,
    logger: Logger = NOOP_LOGGER,
  ) {
    this.chunkRepository = chunkRepository;
    this.logger = logger.child({
      package: "core",
      module: "delete-files-service",
      component: "DefaultDeleteFilesService",
    });
  }

  public async execute(input: DeleteFilesInput): Promise<DeleteFilesResult> {
    const filePaths = dedupeFilePaths(input.filePaths);
    const logger = this.logger.child({
      operation: "delete-files",
      repositoryId: input.repositoryId,
      fileCount: filePaths.length,
    });

    logger.info("File deletion started");

    const deletedChunkCount = await this.chunkRepository.deleteByFilePaths({
      repositoryId: input.repositoryId,
      filePaths,
    });

    const result = {
      requestedFileCount: filePaths.length,
      deletedFileCount: filePaths.length,
      deletedChunkCount,
    };

    logger.info("File deletion completed", result);

    return result;
  }
}

/**
 * 去重并清理空文件路径，避免重复删除和无效输入污染结果统计。
 */
function dedupeFilePaths(filePaths: string[]): string[] {
  return Array.from(
    new Set(filePaths.map((filePath) => filePath.trim())),
  ).filter((filePath) => filePath.length > 0);
}
