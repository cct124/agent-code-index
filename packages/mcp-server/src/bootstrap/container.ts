/**
 * 应用依赖容器的最小骨架定义。
 */
import type { ProjectMetadataRepository } from "@agent-code-index/core";
import {
  createSurrealClient,
  SurrealProjectMetadataRepository,
  type SurrealClient,
  type SurrealConnectionConfig,
} from "@agent-code-index/infra";

import type { AppConfig } from "./config.js";

/**
 * 运行时依赖容器。
 */
export interface AppContainer {
  /** 经过校验后的应用配置。 */
  config: AppConfig;
  /** SurrealDB 客户端骨架实例。 */
  surrealClient: SurrealClient;
  /** 项目元数据仓储。 */
  projectMetadataRepository: ProjectMetadataRepository;
}

/**
 * 基于当前配置创建应用依赖容器。
 */
export function createContainer(config: AppConfig): AppContainer {
  const surrealClient = createSurrealClient(toSurrealConnectionConfig(config));

  return {
    config,
    surrealClient,
    projectMetadataRepository: new SurrealProjectMetadataRepository(
      surrealClient,
    ),
  };
}

/**
 * 将应用配置映射为基础设施层的 Surreal 连接配置。
 */
function toSurrealConnectionConfig(config: AppConfig): SurrealConnectionConfig {
  return {
    url: config.surreal.url,
    namespace: config.surreal.namespace,
    database: config.surreal.database,
    username: config.surreal.username,
    password: config.surreal.password,
    token: config.surreal.token,
    useTls: config.surreal.useTls,
    deploymentMode: config.surreal.deploymentMode,
  };
}
