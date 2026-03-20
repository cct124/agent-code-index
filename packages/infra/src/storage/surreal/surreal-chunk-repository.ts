/**
 * 基于 SurrealDB 的 ChunkRepository 骨架实现。
 */
import type {
  Chunk,
  ChunkRepository,
  FindChunksByFilePathInput,
} from "@agent-code-index/core";

import type { SurrealClient } from "./surreal-client.js";

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
    await this.client.connect();

    throw new Error(
      `Surreal chunk upsert is not implemented yet. Received ${chunks.length} chunks.`,
    );
  }

  /**
   * 删除指定仓库的全部 chunk。
   */
  public async deleteByRepository(repositoryId: string): Promise<void> {
    await this.client.connect();

    throw new Error(
      `Surreal chunk deletion is not implemented yet for repository ${repositoryId}.`,
    );
  }

  /**
   * 按文件路径读取 chunk。
   */
  public async findByFilePath(
    input: FindChunksByFilePathInput,
  ): Promise<Chunk[]> {
    await this.client.connect();

    throw new Error(
      `Surreal chunk lookup is not implemented yet for file ${input.filePath}.`,
    );
  }
}
