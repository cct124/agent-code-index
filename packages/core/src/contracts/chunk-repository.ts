import type { Chunk } from "../domain/chunk.js";

/**
 * 按文件维度读取 chunk 的输入参数。
 */
export interface FindChunksByFilePathInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 目标文件路径。 */
  filePath: string;
}

/**
 * Chunk 存储接口。
 */
export interface ChunkRepository {
  /** 批量写入或更新 chunk。 */
  upsertMany(chunks: Chunk[]): Promise<void>;
  /** 删除指定仓库的全部 chunk。 */
  deleteByRepository(repositoryId: string): Promise<void>;
  /** 按文件路径读取 chunk。 */
  findByFilePath(input: FindChunksByFilePathInput): Promise<Chunk[]>;
}
