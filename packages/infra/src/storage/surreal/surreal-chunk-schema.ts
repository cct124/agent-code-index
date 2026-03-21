/**
 * chunk 表的显式 schema 初始化逻辑。
 */
import type { SurrealClient } from "./surreal-client.js";

/**
 * chunk 表及其字段、索引定义。
 *
 * 当前定义保证：
 * 1. chunk 表结构显式且幂等
 * 2. embedding 字段可被正式持久化
 * 3. repositoryId、filePath、hash 等常用过滤路径具备基础索引
 */
const CHUNK_SCHEMA = `
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
DEFINE FIELD IF NOT EXISTS metadata ON TABLE chunk FLEXIBLE TYPE object;
DEFINE INDEX IF NOT EXISTS chunk_repository_idx ON TABLE chunk FIELDS repositoryId;
DEFINE INDEX IF NOT EXISTS chunk_repository_file_idx ON TABLE chunk FIELDS repositoryId, filePath;
DEFINE INDEX IF NOT EXISTS chunk_repository_hash_idx ON TABLE chunk FIELDS repositoryId, hash;
`;

/**
 * SurrealDB 中 chunk 表的 schema 初始化器。
 *
 * 用于在启动阶段确保 chunk 表及其索引已经准备就绪。
 */
export class SurrealChunkSchema {
  /** 当前使用的 Surreal 客户端。 */
  private readonly client: SurrealClient;

  /**
   * 初始化 chunk schema 初始化器。
   */
  public constructor(client: SurrealClient) {
    this.client = client;
  }

  /**
   * 确保 chunk 表及字段定义已经存在。
   */
  public async ensure(): Promise<void> {
    await this.client.connect();
    await this.client.driver.query(CHUNK_SCHEMA);
  }
}
