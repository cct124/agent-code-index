/**
 * 基于 SurrealDB 的 ProjectMetadataRepository 实现。
 */
import { RecordId } from "surrealdb";

import type {
  GetProjectMetadataInput,
  ProjectMetadata,
  ProjectMetadataRepository,
} from "@agent-code-index/core";

import type { SurrealClient } from "./surreal-client.js";

const PROJECT_METADATA_TABLE = "project_metadata";

/**
 * SurrealDB 中项目元数据记录的存储结构。
 */
interface StoredProjectMetadata extends ProjectMetadata {
  /** SurrealDB 记录 ID。 */
  id?: string;
}

/**
 * SurrealDB 的 ProjectMetadataRepository 默认实现。
 */
export class SurrealProjectMetadataRepository implements ProjectMetadataRepository {
  /** 当前使用的 Surreal 客户端。 */
  private readonly client: SurrealClient;

  /**
   * 初始化 SurrealProjectMetadataRepository。
   */
  public constructor(client: SurrealClient) {
    this.client = client;
  }

  /**
   * 按 PROJECT_SPACE 读取项目元数据。
   */
  public async getByProjectSpace(
    input: GetProjectMetadataInput,
  ): Promise<ProjectMetadata | null> {
    await this.client.connect();

    const record = await this.client.driver.select<StoredProjectMetadata>(
      this.recordId(input.projectSpace),
    );

    return record ? this.toProjectMetadata(record) : null;
  }

  /**
   * 创建或覆盖项目元数据记录。
   */
  public async save(metadata: ProjectMetadata): Promise<ProjectMetadata> {
    await this.client.connect();

    const record = await this.client.driver
      .upsert<StoredProjectMetadata>(this.recordId(metadata.projectSpace))
      .content({ ...metadata });

    return this.toProjectMetadata(record);
  }

  /**
   * 根据 PROJECT_SPACE 生成稳定的 Surreal 记录 ID。
   */
  private recordId(projectSpace: string): RecordId {
    return new RecordId(PROJECT_METADATA_TABLE, projectSpace);
  }

  /**
   * 去除存储层字段，映射为领域对象。
   */
  private toProjectMetadata(record: StoredProjectMetadata): ProjectMetadata {
    return {
      projectSpace: record.projectSpace,
      namespace: record.namespace,
      database: record.database,
      embeddingProvider: record.embeddingProvider,
      embeddingModel: record.embeddingModel,
      embeddingVectorDimension: record.embeddingVectorDimension,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
