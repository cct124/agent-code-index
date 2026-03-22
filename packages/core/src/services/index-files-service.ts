import type { ChunkRepository } from "../contracts/chunk-repository.js";
import type { EmbeddingProvider } from "../contracts/embedding-provider.js";
import { NOOP_LOGGER, type Logger } from "../contracts/logger.js";
import type { Chunk, PreparedChunk } from "../domain/chunk.js";
import type { IndexRepositoryFailure } from "./index-repository-service.js";

const DEFAULT_EMBEDDING_BATCH_SIZE = 32;

export interface PrepareFilesInput {
  repositoryId: string;
  rootPath: string;
  filePaths: string[];
}

export interface FilePreparationEntry {
  filePath: string;
  chunks: PreparedChunk[];
}

export interface PrepareFilesResult {
  requestedFileCount: number;
  skippedFileCount: number;
  files: FilePreparationEntry[];
  failedFiles: IndexRepositoryFailure[];
}

export interface FileChunkPreparationService {
  prepareFiles(input: PrepareFilesInput): Promise<PrepareFilesResult>;
}

export interface IndexFilesInput {
  repositoryId: string;
  rootPath: string;
  filePaths: string[];
  embeddingBatchSize?: number;
}

export interface IndexFilesResult {
  requestedFileCount: number;
  indexedFileCount: number;
  deletedChunkCount: number;
  preparedChunkCount: number;
  embeddedChunkCount: number;
  storedChunkCount: number;
  failedFileCount: number;
  failedFiles: IndexRepositoryFailure[];
}

export interface IndexFilesService {
  execute(input: IndexFilesInput): Promise<IndexFilesResult>;
}

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

function dedupeFilePaths(filePaths: string[]): string[] {
  return Array.from(new Set(filePaths.map((filePath) => filePath.trim()))).filter(
    (filePath) => filePath.length > 0,
  );
}