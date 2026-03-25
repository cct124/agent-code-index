/**
 * 基于 SurrealDB 的 ChunkRepository 骨架实现。
 */
import { NOOP_LOGGER, type Logger } from "@agent-code-index/core";
import { RecordId } from "surrealdb";

import type {
  Chunk,
  ChunkMetadata,
  ChunkRepository,
  DeleteChunksByFilePathsInput,
  FindChunksByFilePathInput,
} from "@agent-code-index/core";

import type { SurrealClient } from "./surreal-client.js";
import { createSurrealErrorLogFields } from "./surreal-log-utils.js";

/**
 * chunk 表的逻辑表名。
 */
const CHUNK_TABLE = "chunk";

/**
 * chunk 表中单条记录的存储结构。
 *
 * 该结构对应持久化后的 chunk 记录，区分 Surreal 内部 id 与领域层 chunkId。
 */
interface StoredChunk extends Record<string, unknown> {
  /** SurrealDB 内部记录 id。 */
  id?: string;
  /** 领域层 chunk id。 */
  chunkId: string;
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 所属文件路径。 */
  filePath: string;
  /** 代码语言。 */
  language: string;
  /** 原始代码内容。 */
  content: string;
  /** 用于检索的归一化文本。 */
  searchText: string;
  /** 起始行号。 */
  startLine: number;
  /** 结束行号。 */
  endLine: number;
  /** 内容哈希。 */
  hash: string;
  /** 语义检索使用的 embedding 向量。 */
  embedding: number[];
  /** 附加元数据。 */
  metadata: ChunkMetadata;
}

/**
 * SurrealDB 的 ChunkRepository 默认实现。
 *
 * 当前实现负责 chunk 的持久化、按仓库清理以及按文件路径读取。
 */
export class SurrealChunkRepository implements ChunkRepository {
  /** 当前使用的 Surreal 客户端。 */
  private readonly client: SurrealClient;
  /** 结构化日志接口。 */
  private readonly logger: Logger;

  /**
   * 初始化 SurrealChunkRepository。
   */
  public constructor(client: SurrealClient, logger: Logger = NOOP_LOGGER) {
    this.client = client;
    this.logger = logger.child({
      package: "infra",
      module: "surreal-chunk-repository",
      component: "SurrealChunkRepository",
    });
  }

  /**
   * 批量写入或更新 chunk。
   *
   * 当前使用稳定 record id 对每条 chunk 顺序执行 upsert，避免真实数据库环境下的
   * 并发写冲突。
   */
  public async upsertMany(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) {
      this.logger.debug("Chunk upsert skipped because batch is empty");
      return;
    }

    const logger = this.logger.child({
      operation: "chunk-upsert-many",
      repositoryId: chunks[0]?.repositoryId,
      chunkCount: chunks.length,
    });

    logger.info("Chunk upsert started");

    try {
      await this.client.execute("chunk-upsert-many", async (driver) => {
        for (const chunk of chunks) {
          await driver
            .upsert<StoredChunk>(this.recordId(chunk))
            .content(this.toStoredChunk(chunk));
        }
      });

      logger.info("Chunk upsert completed");
    } catch (error) {
      logger.error(
        "Chunk upsert failed",
        createSurrealErrorLogFields(error, {
          repositoryId: chunks[0]?.repositoryId,
          chunkCount: chunks.length,
        }),
      );
      throw error;
    }
  }

  /**
   * 删除指定仓库的全部 chunk。
   */
  public async deleteByRepository(repositoryId: string): Promise<void> {
    const logger = this.logger.child({
      operation: "chunk-delete-by-repository",
      repositoryId,
    });

    logger.info("Deleting repository chunks");

    try {
      await this.client.execute("chunk-delete-by-repository", (driver) =>
        driver.query("DELETE chunk WHERE repositoryId = $repositoryId;", {
          repositoryId,
        }),
      );

      logger.info("Repository chunk deletion completed");
    } catch (error) {
      logger.error(
        "Repository chunk deletion failed",
        createSurrealErrorLogFields(error, { repositoryId }),
      );
      throw error;
    }
  }

  /**
   * 删除指定仓库下文件列表对应的全部 chunk。
   *
   * 当前实现先查询再删除，用于返回稳定的删除数量；后续如数据库侧可直接返回影响行数，
   * 可以再收敛为单条语句。
   */
  public async deleteByFilePaths(
    input: DeleteChunksByFilePathsInput,
  ): Promise<number> {
    const filePaths = Array.from(new Set(input.filePaths));
    const logger = this.logger.child({
      operation: "chunk-delete-by-file-paths",
      repositoryId: input.repositoryId,
      fileCount: filePaths.length,
    });

    if (filePaths.length === 0) {
      logger.debug(
        "Chunk deletion by file paths skipped because file list is empty",
      );
      return 0;
    }

    try {
      const deletedChunkCount = await this.client.execute(
        "chunk-delete-by-file-paths",
        async (driver) => {
          const [records] = await driver.query<[StoredChunk[]]>(
            [
              "SELECT * FROM chunk",
              "WHERE repositoryId = $repositoryId AND filePath INSIDE $filePaths;",
            ].join(" "),
            {
              repositoryId: input.repositoryId,
              filePaths,
            },
          );
          const count = records?.length ?? 0;

          if (count > 0) {
            await driver.query(
              [
                "DELETE chunk",
                "WHERE repositoryId = $repositoryId AND filePath INSIDE $filePaths;",
              ].join(" "),
              {
                repositoryId: input.repositoryId,
                filePaths,
              },
            );
          }

          return count;
        },
      );

      logger.info("File chunk deletion completed", {
        deletedChunkCount,
      });

      return deletedChunkCount;
    } catch (error) {
      logger.error(
        "File chunk deletion failed",
        createSurrealErrorLogFields(error, {
          repositoryId: input.repositoryId,
          fileCount: filePaths.length,
        }),
      );
      throw error;
    }
  }

  /**
   * 按文件路径读取 chunk。
   *
   * 返回结果会按 `startLine / endLine` 升序排列，保证上层读取顺序稳定。
   */
  public async findByFilePath(
    input: FindChunksByFilePathInput,
  ): Promise<Chunk[]> {
    const logger = this.logger.child({
      operation: "chunk-find-by-file-path",
      repositoryId: input.repositoryId,
      filePath: input.filePath,
    });

    try {
      const records = await this.client.execute(
        "chunk-find-by-file-path",
        async (driver) => {
          const [result] = await driver.query<[StoredChunk[]]>(
            [
              "SELECT * FROM chunk",
              "WHERE repositoryId = $repositoryId AND filePath = $filePath",
              "ORDER BY startLine ASC, endLine ASC;",
            ].join(" "),
            {
              repositoryId: input.repositoryId,
              filePath: input.filePath,
            },
          );

          return result ?? [];
        },
      );

      logger.info("Chunk lookup completed", {
        chunkCount: records.length,
      });

      return records.map((record) => this.toChunk(record));
    } catch (error) {
      logger.error(
        "Chunk lookup failed",
        createSurrealErrorLogFields(error, {
          repositoryId: input.repositoryId,
          filePath: input.filePath,
        }),
      );
      throw error;
    }
  }

  /**
   * 为 chunk 生成稳定的 Surreal record id。
   */
  private recordId(chunk: Chunk): RecordId {
    return new RecordId(CHUNK_TABLE, `${chunk.repositoryId}:${chunk.id}`);
  }

  /**
   * 将领域层 Chunk 映射为存储层结构。
   */
  private toStoredChunk(chunk: Chunk): StoredChunk {
    return {
      chunkId: chunk.id,
      repositoryId: chunk.repositoryId,
      filePath: chunk.filePath,
      language: chunk.language,
      content: chunk.content,
      searchText: chunk.searchText,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      hash: chunk.hash,
      embedding: [...chunk.embedding],
      metadata: { ...chunk.metadata },
    };
  }

  /**
   * 将存储层记录映射为领域层 Chunk 对象。
   */
  private toChunk(record: StoredChunk): Chunk {
    if (!Array.isArray(record.embedding)) {
      throw new Error(
        `Stored chunk ${record.chunkId} is missing embedding data`,
      );
    }

    return {
      id: record.chunkId,
      repositoryId: record.repositoryId,
      filePath: record.filePath,
      language: record.language,
      content: record.content,
      searchText: record.searchText,
      startLine: record.startLine,
      endLine: record.endLine,
      hash: record.hash,
      embedding: [...record.embedding],
      metadata: {
        ...record.metadata,
      },
    };
  }
}
