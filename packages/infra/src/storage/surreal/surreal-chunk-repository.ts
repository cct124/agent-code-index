/**
 * 基于 SurrealDB 的 ChunkRepository 骨架实现。
 */
import { RecordId } from "surrealdb";

import type {
  Chunk,
  ChunkMetadata,
  ChunkRepository,
  FindChunksByFilePathInput,
} from "@agent-code-index/core";

import type { SurrealClient } from "./surreal-client.js";

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
  /** 可选的 embedding 向量。 */
  embedding?: number[];
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

  /**
   * 初始化 SurrealChunkRepository。
   */
  public constructor(client: SurrealClient) {
    this.client = client;
  }

  /**
   * 批量写入或更新 chunk。
   *
   * 当前使用稳定 record id 对每条 chunk 顺序执行 upsert，避免真实数据库环境下的
   * 并发写冲突。
   */
  public async upsertMany(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    await this.client.connect();

    for (const chunk of chunks) {
      await this.client.driver
        .upsert<StoredChunk>(this.recordId(chunk))
        .content(this.toStoredChunk(chunk));
    }
  }

  /**
   * 删除指定仓库的全部 chunk。
   */
  public async deleteByRepository(repositoryId: string): Promise<void> {
    await this.client.connect();

    await this.client.driver.query(
      "DELETE chunk WHERE repositoryId = $repositoryId;",
      {
        repositoryId,
      },
    );
  }

  /**
   * 按文件路径读取 chunk。
   *
   * 返回结果会按 `startLine / endLine` 升序排列，保证上层读取顺序稳定。
   */
  public async findByFilePath(
    input: FindChunksByFilePathInput,
  ): Promise<Chunk[]> {
    await this.client.connect();

    const [records] = await this.client.driver.query<[StoredChunk[]]>(
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

    return (records ?? []).map((record) => this.toChunk(record));
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
      embedding: chunk.embedding ? [...chunk.embedding] : undefined,
      metadata: { ...chunk.metadata },
    };
  }

  /**
   * 将存储层记录映射为领域层 Chunk 对象。
   */
  private toChunk(record: StoredChunk): Chunk {
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
      embedding: Array.isArray(record.embedding)
        ? (record.embedding as number[])
        : undefined,
      metadata: {
        ...record.metadata,
      },
    };
  }
}
