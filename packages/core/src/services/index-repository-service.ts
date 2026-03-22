import type { Chunk, PreparedChunk } from "../domain/chunk.js";
import type { ChunkRepository } from "../contracts/chunk-repository.js";
import type { EmbeddingProvider } from "../contracts/embedding-provider.js";
import { NOOP_LOGGER, type Logger } from "../contracts/logger.js";

/**
 * embedding 批量生成的默认批大小。
 *
 * v1 先使用一个保守默认值，避免单次请求过大；后续可根据 provider 限额、超时和
 * 真实索引吞吐表现再调整。
 */
const DEFAULT_EMBEDDING_BATCH_SIZE = 32;
const DEFAULT_EMBEDDING_CONCURRENCY = 1;

/**
 * 索引写入模式。
 *
 * v1 先只定义全量覆盖语义，后续如需增量索引可在此基础上扩展。
 */
export type IndexRepositoryMode = "full";

/**
 * 单个文件的索引失败信息。
 */
export interface IndexRepositoryFailure {
  /** 失败文件的相对路径。 */
  filePath: string;
  /** 失败原因。 */
  reason: string;
}

/**
 * 仓库 chunk 准备服务输入。
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
  chunks: PreparedChunk[];
  /** 失败文件列表。 */
  failedFiles: IndexRepositoryFailure[];
}

/**
 * 仓库 chunk 准备服务抽象。
 */
export interface RepositoryChunkPreparationService {
  /**
   * 扫描仓库并准备待索引 chunk。
   */
  prepare(
    input: PrepareRepositoryChunksInput,
  ): Promise<PrepareRepositoryChunksResult>;
}

/**
 * 索引服务输入模型。
 */
export interface IndexRepositoryInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 仓库根目录。 */
  rootPath: string;
  /** 当前索引模式。 */
  mode?: IndexRepositoryMode;
  /** embedding 批量大小提示。 */
  embeddingBatchSize?: number;
  /** embedding 批次并发度提示。 */
  embeddingConcurrency?: number;
}

/**
 * 索引服务输出模型。
 */
export interface IndexRepositoryResult {
  /** 扫描到的文件总数。 */
  scannedFileCount: number;
  /** 成功解析的文件数。 */
  parsedFileCount: number;
  /** 被跳过的文件数。 */
  skippedFileCount: number;
  /** 成功生成的 chunk 总数。 */
  preparedChunkCount: number;
  /** 成功生成 embedding 的 chunk 总数。 */
  embeddedChunkCount: number;
  /** 成功写入存储的 chunk 总数。 */
  storedChunkCount: number;
  /** 失败文件数。 */
  failedFileCount: number;
  /** 本次索引失败明细。 */
  failedFiles: IndexRepositoryFailure[];
}

/**
 * 仓库索引服务抽象。
 */
export interface IndexRepositoryService {
  /**
   * 执行一次仓库索引。
   */
  execute(input: IndexRepositoryInput): Promise<IndexRepositoryResult>;
}

/**
 * 已完成 embedding 生成、可写入存储的索引 chunk。
 */
export interface IndexedChunk extends Chunk {
  /** `Chunk` 的语义化别名，表示已完成 embedding 的索引产物。 */
}

/**
 * 默认的仓库索引服务实现。
 *
 * 该实现负责串联：扫描与切块、批量生成 embedding、全量写入 chunk 存储。
 */
export class DefaultIndexRepositoryService implements IndexRepositoryService {
  /** 仓库 chunk 准备服务。 */
  private readonly chunkPreparationService: RepositoryChunkPreparationService;
  /** embedding provider。 */
  private readonly embeddingProvider: EmbeddingProvider;
  /** chunk 存储接口。 */
  private readonly chunkRepository: ChunkRepository;
  /** 结构化日志接口。 */
  private readonly logger: Logger;

  /**
   * 初始化默认索引服务。
   */
  public constructor(
    chunkPreparationService: RepositoryChunkPreparationService,
    embeddingProvider: EmbeddingProvider,
    chunkRepository: ChunkRepository,
    logger: Logger = NOOP_LOGGER,
  ) {
    this.chunkPreparationService = chunkPreparationService;
    this.embeddingProvider = embeddingProvider;
    this.chunkRepository = chunkRepository;
    this.logger = logger.child({
      package: "core",
      module: "index-repository-service",
      component: "DefaultIndexRepositoryService",
    });
  }

  /**
   * 执行一次仓库索引。
   */
  public async execute(
    input: IndexRepositoryInput,
  ): Promise<IndexRepositoryResult> {
    const mode = input.mode ?? "full";
    const batchSize = normalizeEmbeddingBatchSize(input.embeddingBatchSize);
    const embeddingConcurrency = normalizeEmbeddingConcurrency(
      input.embeddingConcurrency,
    );
    const logger = this.logger.child({
      operation: "index-repository",
      repositoryId: input.repositoryId,
      batchSize,
      embeddingConcurrency,
      mode,
    });
    const startedAt = Date.now();

    logger.info("Repository indexing started", {
      rootPath: input.rootPath,
      provider: this.embeddingProvider.provider,
      embeddingModel: this.embeddingProvider.model,
    });

    try {
      const prepared = await this.chunkPreparationService.prepare({
        repositoryId: input.repositoryId,
        rootPath: input.rootPath,
      });

      logger.info("Repository chunk preparation completed", {
        scannedFileCount: prepared.scannedFileCount,
        parsedFileCount: prepared.parsedFileCount,
        skippedFileCount: prepared.skippedFileCount,
        chunkCount: prepared.chunks.length,
        failedFileCount: prepared.failedFiles.length,
      });

      const indexedChunks = await this.generateIndexedChunks(
        prepared.chunks,
        batchSize,
        embeddingConcurrency,
        logger,
      );

      if (mode === "full") {
        logger.debug("Clearing existing repository chunks before full reindex");
        await this.chunkRepository.deleteByRepository(input.repositoryId);
      }

      if (indexedChunks.length > 0) {
        logger.info("Persisting indexed chunks", {
          chunkCount: indexedChunks.length,
        });
        await this.chunkRepository.upsertMany(indexedChunks);
      }

      const result = {
        scannedFileCount: prepared.scannedFileCount,
        parsedFileCount: prepared.parsedFileCount,
        skippedFileCount: prepared.skippedFileCount,
        preparedChunkCount: prepared.chunks.length,
        embeddedChunkCount: indexedChunks.length,
        storedChunkCount: indexedChunks.length,
        failedFileCount: prepared.failedFiles.length,
        failedFiles: prepared.failedFiles.map((failure) => ({ ...failure })),
      };

      logger.info("Repository indexing completed", {
        ...result,
        durationMs: Date.now() - startedAt,
      });

      return result;
    } catch (error) {
      logger.error("Repository indexing failed", {
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * 按批次为 chunk 生成 embedding，并收紧为可写入存储的索引产物。
   */
  private async generateIndexedChunks(
    chunks: PreparedChunk[],
    batchSize: number,
    embeddingConcurrency: number,
    logger: Logger,
  ): Promise<IndexedChunk[]> {
    const indexedChunksByBatch: IndexedChunk[][] = [];
    const totalBatches = Math.ceil(chunks.length / batchSize);
    const totalWorkers = Math.min(embeddingConcurrency, totalBatches);

    if (totalBatches === 0) {
      return [];
    }

    logger.info("Repository embedding worker pool initialized", {
      totalBatches,
      batchSize,
      requestedEmbeddingConcurrency: embeddingConcurrency,
      totalWorkers,
      chunkCount: chunks.length,
    });

    let nextBatchStart = 0;
    let firstError: unknown;

    const runWorker = async (workerIndex: number): Promise<void> => {
      while (true) {
        if (firstError !== undefined) {
          return;
        }

        const start = nextBatchStart;
        nextBatchStart += batchSize;

        if (start >= chunks.length) {
          return;
        }

        const batch = chunks.slice(start, start + batchSize);
        const batchIndex = Math.floor(start / batchSize) + 1;

        if (batch.length === 0) {
          continue;
        }

        logger.info("Repository embedding batch started", {
          batchIndex,
          totalBatches,
          chunkCount: batch.length,
          batchStart: start,
          workerIndex,
          batchFileCount: new Set(batch.map((chunk) => chunk.filePath)).size,
          batchSearchTextTotalLength: batch.reduce(
            (sum, chunk) => sum + chunk.searchText.length,
            0,
          ),
          ...summarizeBatchFilePaths(batch),
        });
        const batchStartedAt = Date.now();

        let embeddings: number[][];

        try {
          embeddings = await this.embeddingProvider.generateEmbeddings({
            values: batch.map((chunk) => chunk.searchText),
            purpose: "document",
          });
        } catch (error) {
          logger.error("Chunk batch embedding failed", {
            batchIndex,
            totalBatches,
            batchStart: start,
            chunkCount: batch.length,
            workerIndex,
            batchFileCount: new Set(batch.map((chunk) => chunk.filePath)).size,
            durationMs: Date.now() - batchStartedAt,
            batchSearchTextTotalLength: batch.reduce(
              (sum, chunk) => sum + chunk.searchText.length,
              0,
            ),
            ...summarizeBatchFilePaths(batch),
            batchEntries: batch.map((chunk) => ({
              id: chunk.id,
              filePath: chunk.filePath,
              language: chunk.language,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              searchTextLength: chunk.searchText.length,
            })),
            error: error instanceof Error ? error : new Error(String(error)),
          });
          firstError = error;
          return;
        }

        if (embeddings.length !== batch.length) {
          firstError = new Error(
            `Embedding result count mismatch: expected ${batch.length}, received ${embeddings.length}`,
          );
          return;
        }

        const indexedBatch = batch.map((chunk, index) => ({
          ...chunk,
          metadata: { ...chunk.metadata },
          embedding: [...(embeddings[index] as number[])],
        }));
        indexedChunksByBatch[batchIndex - 1] = indexedBatch;

        logger.info("Repository embedding batch completed", {
          batchIndex,
          totalBatches,
          batchStart: start,
          chunkCount: batch.length,
          workerIndex,
          batchFileCount: new Set(batch.map((chunk) => chunk.filePath)).size,
          durationMs: Date.now() - batchStartedAt,
          embeddedChunkCount: indexedChunksByBatch.reduce(
            (sum, currentBatch) => sum + (currentBatch?.length ?? 0),
            0,
          ),
          ...summarizeBatchFilePaths(batch),
        });
      }
    };

    await Promise.allSettled(
      Array.from({ length: totalWorkers }, (_, workerOffset) =>
        runWorker(workerOffset + 1),
      ),
    );

    if (firstError !== undefined) {
      throw firstError;
    }

    return indexedChunksByBatch.flat();
  }
}

/**
 * 将 embedding 批量大小归一化为正整数。
 */
function normalizeEmbeddingBatchSize(batchSize?: number): number {
  if (!batchSize || batchSize <= 0) {
    return DEFAULT_EMBEDDING_BATCH_SIZE;
  }

  return Math.floor(batchSize);
}

function normalizeEmbeddingConcurrency(embeddingConcurrency?: number): number {
  if (!embeddingConcurrency || embeddingConcurrency <= 0) {
    return DEFAULT_EMBEDDING_CONCURRENCY;
  }

  return Math.floor(embeddingConcurrency);
}

function summarizeBatchFilePaths(chunks: PreparedChunk[]): {
  batchFilePathsPreview: string[];
  batchFilePathsOmittedCount: number;
} {
  const uniqueFilePaths = Array.from(
    new Set(chunks.map((chunk) => chunk.filePath)),
  );

  return {
    batchFilePathsPreview: uniqueFilePaths.slice(0, 5),
    batchFilePathsOmittedCount: Math.max(0, uniqueFilePaths.length - 5),
  };
}
