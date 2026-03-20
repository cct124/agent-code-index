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

const CHUNK_TABLE = "chunk";

interface StoredChunk extends Record<string, unknown> {
  id?: string;
  chunkId: string;
  repositoryId: string;
  filePath: string;
  language: string;
  content: string;
  searchText: string;
  startLine: number;
  endLine: number;
  hash: string;
  embedding?: number[];
  metadata: ChunkMetadata;
}

/**
 * SurrealDB 的 ChunkRepository 默认实现。
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

  private recordId(chunk: Chunk): RecordId {
    return new RecordId(CHUNK_TABLE, `${chunk.repositoryId}:${chunk.id}`);
  }

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
