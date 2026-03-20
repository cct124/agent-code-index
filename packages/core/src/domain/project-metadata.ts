/**
 * 项目级元数据模型，用于锁定 PROJECT_SPACE 对应的 embedding 配置。
 */
export interface ProjectMetadata {
  /** 逻辑项目空间标识。 */
  projectSpace: string;
  /** 当前项目使用的 Surreal namespace。 */
  namespace: string;
  /** 当前项目使用的 Surreal database。 */
  database: string;
  /** 当前项目锁定的 embedding provider。 */
  embeddingProvider: string;
  /** 当前项目锁定的 embedding 模型。 */
  embeddingModel: string;
  /** 当前项目锁定的向量维度。 */
  embeddingVectorDimension: number;
  /** 元数据首次创建时间。 */
  createdAt: string;
  /** 元数据最后更新时间。 */
  updatedAt: string;
}
