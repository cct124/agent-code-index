/**
 * chunk 表的显式 schema 初始化逻辑。
 */
import type { SurrealClient } from "./surreal-client.js";

export interface SurrealChunkSchemaOptions {
  /** embedding 向量维度，必须与当前项目使用的模型维度一致。 */
  embeddingVectorDimension: number;
}

/**
 * chunk 表及其字段、索引定义。
 *
 * 当前定义保证：
 * 1. chunk 表结构显式且幂等
 * 2. embedding 字段可被正式持久化
 * 3. repositoryId、filePath、hash 等常用过滤路径具备基础索引
 */
function createChunkSchema(embeddingVectorDimension: number): string {
  if (
    !Number.isInteger(embeddingVectorDimension) ||
    embeddingVectorDimension <= 0
  ) {
    throw new Error(
      "embeddingVectorDimension must be a positive integer for SurrealChunkSchema",
    );
  }

  return `
DEFINE TABLE IF NOT EXISTS chunk SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS chunkId ON TABLE chunk TYPE string;
DEFINE FIELD IF NOT EXISTS repositoryId ON TABLE chunk TYPE string;
DEFINE FIELD IF NOT EXISTS filePath ON TABLE chunk TYPE string;
DEFINE FIELD IF NOT EXISTS language ON TABLE chunk TYPE string;
DEFINE FIELD IF NOT EXISTS content ON TABLE chunk TYPE string;
DEFINE FIELD IF NOT EXISTS searchText ON TABLE chunk TYPE string;
DEFINE FIELD IF NOT EXISTS startLine ON TABLE chunk TYPE int;
DEFINE FIELD IF NOT EXISTS endLine ON TABLE chunk TYPE int;
DEFINE FIELD IF NOT EXISTS hash ON TABLE chunk TYPE string;
DEFINE FIELD IF NOT EXISTS embedding ON TABLE chunk TYPE option<array<float>>;
DEFINE FIELD IF NOT EXISTS metadata ON TABLE chunk TYPE object FLEXIBLE;
DEFINE INDEX IF NOT EXISTS chunk_repository_idx ON TABLE chunk FIELDS repositoryId;
DEFINE INDEX IF NOT EXISTS chunk_repository_file_idx ON TABLE chunk FIELDS repositoryId, filePath;
DEFINE INDEX IF NOT EXISTS chunk_repository_hash_idx ON TABLE chunk FIELDS repositoryId, hash;
DEFINE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx ON TABLE chunk FIELDS embedding HNSW DIMENSION ${embeddingVectorDimension} TYPE F32 DIST COSINE;
`;
}

/**
 * SurrealDB 中 chunk 表的 schema 初始化器。
 *
 * 用于在启动阶段确保 chunk 表及其索引已经准备就绪。
 */
export class SurrealChunkSchema {
  /** 当前使用的 Surreal 客户端。 */
  private readonly client: SurrealClient;
  /** 当前 chunk 表使用的 embedding 维度。 */
  private readonly embeddingVectorDimension: number;

  /**
   * 初始化 chunk schema 初始化器。
   */
  public constructor(
    client: SurrealClient,
    options: SurrealChunkSchemaOptions,
  ) {
    this.client = client;
    this.embeddingVectorDimension = options.embeddingVectorDimension;
  }

  /**
   * 确保 chunk 表及字段定义已经存在。
   */
  public async ensure(): Promise<void> {
    await this.client.execute("chunk-schema-ensure", (driver) =>
      driver.query(createChunkSchema(this.embeddingVectorDimension)),
    );
  }
}
