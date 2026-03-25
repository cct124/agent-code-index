/**
 * project_metadata 表的显式 schema 初始化逻辑。
 */
import type { SurrealClient } from "./surreal-client.js";

/**
 * project_metadata 表及字段定义。
 *
 * 当前定义保证 schema 初始化可幂等执行，适合在应用启动时重复调用。
 */
const PROJECT_METADATA_SCHEMA = `
DEFINE TABLE IF NOT EXISTS project_metadata SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS projectSpace ON TABLE project_metadata TYPE string;
DEFINE FIELD IF NOT EXISTS namespace ON TABLE project_metadata TYPE string;
DEFINE FIELD IF NOT EXISTS database ON TABLE project_metadata TYPE string;
DEFINE FIELD IF NOT EXISTS embeddingProvider ON TABLE project_metadata TYPE string;
DEFINE FIELD IF NOT EXISTS embeddingModel ON TABLE project_metadata TYPE string;
DEFINE FIELD IF NOT EXISTS embeddingVectorDimension ON TABLE project_metadata TYPE int;
DEFINE FIELD IF NOT EXISTS createdAt ON TABLE project_metadata TYPE string;
DEFINE FIELD IF NOT EXISTS updatedAt ON TABLE project_metadata TYPE string;
`;

/**
 * SurrealDB 中 project_metadata 表的 schema 初始化器。
 *
 * 用于在启动阶段确保项目级 embedding 配置锁定所需的表结构存在。
 */
export class SurrealProjectMetadataSchema {
  /** 当前使用的 Surreal 客户端。 */
  private readonly client: SurrealClient;

  /**
   * 初始化 schema 初始化器。
   */
  public constructor(client: SurrealClient) {
    this.client = client;
  }

  /**
   * 确保 project_metadata 表及字段定义已经存在。
   */
  public async ensure(): Promise<void> {
    await this.client.execute("project-metadata-schema-ensure", (driver) =>
      driver.query(PROJECT_METADATA_SCHEMA),
    );
  }
}
