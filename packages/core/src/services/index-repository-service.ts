import type { Chunk } from "../domain/chunk.js";

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
  /** 当前 chunk 对应的 embedding 向量。 */
  embedding: number[];
}
