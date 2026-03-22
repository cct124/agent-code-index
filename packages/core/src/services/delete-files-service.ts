import type { ChunkRepository } from "../contracts/chunk-repository.js";
import { NOOP_LOGGER, type Logger } from "../contracts/logger.js";

export interface DeleteFilesInput {
  repositoryId: string;
  filePaths: string[];
}

export interface DeleteFilesResult {
  requestedFileCount: number;
  deletedFileCount: number;
  deletedChunkCount: number;
}

export interface DeleteFilesService {
  execute(input: DeleteFilesInput): Promise<DeleteFilesResult>;
}

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

function dedupeFilePaths(filePaths: string[]): string[] {
  return Array.from(new Set(filePaths.map((filePath) => filePath.trim()))).filter(
    (filePath) => filePath.length > 0,
  );
}