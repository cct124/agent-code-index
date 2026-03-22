import type { ChunkRepository } from "../contracts/chunk-repository.js";
import type { EmbeddingProvider } from "../contracts/embedding-provider.js";
import { NOOP_LOGGER, type Logger } from "../contracts/logger.js";
import type { Chunk, PreparedChunk } from "../domain/chunk.js";
import type { IndexRepositoryFailure } from "./index-repository-service.js";

const DEFAULT_EMBEDDING_BATCH_SIZE = 32;

/**
 * 文件级 chunk 准备输入。
 */
export interface PrepareFilesInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 仓库根目录。 */
  rootPath: string;
  /** 需要处理的相对文件路径列表。 */
  filePaths: string[];
}

/**
 * 单个文件的准备结果。
 */
export interface FilePreparationEntry {
  /** 当前文件的相对路径。 */
  filePath: string;
  /** 当前文件解析得到的 chunk 列表。 */
  chunks: PreparedChunk[];
}

/**
 * 文件级 chunk 准备结果。
 */
export interface PrepareFilesResult {
  /** 请求处理的文件总数。 */
  requestedFileCount: number;
  /** 被跳过的文件数，例如二进制文件或无可索引 chunk 的文件。 */
  skippedFileCount: number;
  /** 成功完成读取与解析的文件结果。 */
  files: FilePreparationEntry[];
  /** 读取或解析失败的文件列表。 */
  failedFiles: IndexRepositoryFailure[];
}

/**
 * 文件级 chunk 准备服务抽象。
 */
export interface FileChunkPreparationService {
  /**
   * 仅准备指定文件的 chunk，不扫描整个仓库。
   */
  prepareFiles(input: PrepareFilesInput): Promise<PrepareFilesResult>;
}

/**
 * 文件级索引输入。
 */
export interface IndexFilesInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 仓库根目录。 */
  rootPath: string;
  /** 需要重建索引的相对文件路径列表。 */
  filePaths: string[];
  /** embedding 批量大小提示。 */
  embeddingBatchSize?: number;
}

/**
 * 文件级索引结果。
 */
export interface IndexFilesResult {
  /** 请求处理的文件总数。 */
  requestedFileCount: number;
  /** 成功完成覆盖式重建的文件数。 */
  indexedFileCount: number;
  /** 删除旧 chunk 的数量。 */
  deletedChunkCount: number;
  /** 解析得到的 chunk 数。 */
  preparedChunkCount: number;
  /** 成功生成 embedding 的 chunk 数。 */
  embeddedChunkCount: number;
  /** 成功写入存储的 chunk 数。 */
  storedChunkCount: number;
  /** 失败文件数。 */
  failedFileCount: number;
  /** 失败文件明细。 */
  failedFiles: IndexRepositoryFailure[];
}

/**
 * 文件级索引服务抽象。
 */
export interface IndexFilesService {
  /**
   * 对指定文件执行覆盖式重建。
   */
  execute(input: IndexFilesInput): Promise<IndexFilesResult>;
}

/**
 * 默认的文件级索引服务实现。
 *
 * 该实现只替换成功准备出的文件，避免单个文件失败时误删旧索引。
 */
export class DefaultIndexFilesService implements IndexFilesService {
  private readonly fileChunkPreparationService: FileChunkPreparationService;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly chunkRepository: ChunkRepository;
  private readonly logger: Logger;

  public constructor(
    fileChunkPreparationService: FileChunkPreparationService,
    embeddingProvider: EmbeddingProvider,
    chunkRepository: ChunkRepository,
    logger: Logger = NOOP_LOGGER,
  ) {
    this.fileChunkPreparationService = fileChunkPreparationService;
    this.embeddingProvider = embeddingProvider;
    this.chunkRepository = chunkRepository;
    this.logger = logger.child({
      package: "core",
      module: "index-files-service",
      component: "DefaultIndexFilesService",
    });
  }

  public async execute(input: IndexFilesInput): Promise<IndexFilesResult> {
    const batchSize = normalizeEmbeddingBatchSize(input.embeddingBatchSize);
    const filePaths = dedupeFilePaths(input.filePaths);
    const logger = this.logger.child({
      operation: "index-files",
      repositoryId: input.repositoryId,
      fileCount: filePaths.length,
      batchSize,
    });
    const startedAt = Date.now();

    logger.info("File indexing started", {
      rootPath: input.rootPath,
      provider: this.embeddingProvider.provider,
      embeddingModel: this.embeddingProvider.model,
    });

    try {
      const prepared = await this.fileChunkPreparationService.prepareFiles({
        repositoryId: input.repositoryId,
        rootPath: input.rootPath,
        filePaths,
      });
      const preparedChunks = prepared.files.flatMap((file) => file.chunks);
      const indexedChunks = await this.generateIndexedChunks(
        preparedChunks,
        batchSize,
        logger,
      );
      const successfulFilePaths = prepared.files.map((file) => file.filePath);

      // 只有成功准备出的文件才会清理旧 chunk，避免失败文件的数据被误删。
      let deletedChunkCount = 0;
      if (successfulFilePaths.length > 0) {
        deletedChunkCount = await this.chunkRepository.deleteByFilePaths({
          repositoryId: input.repositoryId,
          filePaths: successfulFilePaths,
        });
      }

      if (indexedChunks.length > 0) {
        await this.chunkRepository.upsertMany(indexedChunks);
      }

      const result = {
        requestedFileCount: prepared.requestedFileCount,
        indexedFileCount: prepared.files.length,
        deletedChunkCount,
        preparedChunkCount: preparedChunks.length,
        embeddedChunkCount: indexedChunks.length,
        storedChunkCount: indexedChunks.length,
        failedFileCount: prepared.failedFiles.length,
        failedFiles: prepared.failedFiles.map((failure) => ({ ...failure })),
      };

      logger.info("File indexing completed", {
        ...result,
        skippedFileCount: prepared.skippedFileCount,
        durationMs: Date.now() - startedAt,
      });

      return result;
    } catch (error) {
      logger.error("File indexing failed", {
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  private async generateIndexedChunks(
    chunks: PreparedChunk[],
    batchSize: number,
    logger: Logger,
  ): Promise<Chunk[]> {
    const indexedChunks: Chunk[] = [];

    for (let start = 0; start < chunks.length; start += batchSize) {
      const batch = chunks.slice(start, start + batchSize);

      if (batch.length === 0) {
        continue;
      }

      logger.debug("Generating embeddings for file chunk batch", {
        chunkCount: batch.length,
        batchStart: start,
      });

      const embeddings = await this.embeddingProvider.generateEmbeddings({
        values: batch.map((chunk) => chunk.searchText),
        purpose: "document",
      });

      if (embeddings.length !== batch.length) {
        throw new Error(
          `Embedding result count mismatch: expected ${batch.length}, received ${embeddings.length}`,
        );
      }

      indexedChunks.push(
        ...batch.map((chunk, index) => ({
          ...chunk,
          metadata: { ...chunk.metadata },
          embedding: [...(embeddings[index] as number[])],
        })),
      );
    }

    return indexedChunks;
  }
}

function normalizeEmbeddingBatchSize(value?: number): number {
  if (value === undefined) {
    return DEFAULT_EMBEDDING_BATCH_SIZE;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("embeddingBatchSize must be a positive integer");
  }

  return value;
}

/**
 * 去重并清理空文件路径，保证后续删除和索引行为稳定。
 */
function dedupeFilePaths(filePaths: string[]): string[] {
  return Array.from(
    new Set(filePaths.map((filePath) => filePath.trim())),
  ).filter((filePath) => filePath.length > 0);
}
