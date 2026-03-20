import type { ProjectMetadata } from "../domain/project-metadata.js";

/**
 * 项目元数据读取参数。
 */
export interface GetProjectMetadataInput {
  /** 逻辑项目空间标识。 */
  projectSpace: string;
}

/**
 * 项目元数据存储接口。
 */
export interface ProjectMetadataRepository {
  /** 读取指定项目空间的元数据；不存在时返回 null。 */
  getByProjectSpace(
    input: GetProjectMetadataInput,
  ): Promise<ProjectMetadata | null>;
  /** 创建或覆盖指定项目空间的元数据。 */
  save(metadata: ProjectMetadata): Promise<ProjectMetadata>;
}
