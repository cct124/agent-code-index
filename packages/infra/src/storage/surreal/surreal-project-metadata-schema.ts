/**
 * project_metadata 表的显式 schema 初始化逻辑。
 */
import type { SurrealClient } from "./surreal-client.js";

const PROJECT_METADATA_SCHEMA = `
DEFINE TABLE project_metadata SCHEMAFULL;
DEFINE FIELD projectSpace ON TABLE project_metadata TYPE string;
DEFINE FIELD namespace ON TABLE project_metadata TYPE string;
DEFINE FIELD database ON TABLE project_metadata TYPE string;
DEFINE FIELD embeddingProvider ON TABLE project_metadata TYPE string;
DEFINE FIELD embeddingModel ON TABLE project_metadata TYPE string;
DEFINE FIELD embeddingVectorDimension ON TABLE project_metadata TYPE int;
DEFINE FIELD createdAt ON TABLE project_metadata TYPE string;
DEFINE FIELD updatedAt ON TABLE project_metadata TYPE string;
`;

/**
 * SurrealDB 中 project_metadata 表的 schema 初始化器。
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
    await this.client.connect();
    await this.client.driver.query(PROJECT_METADATA_SCHEMA);
  }
}
