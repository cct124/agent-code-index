/**
 * 应用装配入口，负责连接配置加载与容器初始化。
 */
import type { ProjectMetadata } from "@agent-code-index/core";

import { createContainer, type AppContainer } from "./container.js";
import { loadConfig, type AppConfig } from "./config.js";

/**
 * 完整应用对象。
 */
export interface App {
  /** 运行时配置。 */
  config: AppConfig;
  /** 运行时依赖容器。 */
  container: AppContainer;
}

/**
 * 创建应用实例并完成最小装配。
 */
export async function createApp(): Promise<App> {
  const config = loadConfig();
  const container = createContainer(config);
  const logger = container.logger.child({
    module: "app",
    component: "createApp",
    projectSpace: config.projectSpace,
  });

  logger.info("Application startup started", {
    provider: config.embedding.provider,
    embeddingModel: config.embedding.model,
  });

  const startedAt = Date.now();

  try {
    await container.surrealClient.healthCheck();
    logger.info("SurrealDB health check completed", {
      url: config.surreal.url,
      database: config.surreal.database,
      namespace: config.surreal.namespace,
    });
    await container.chunkSchema.ensure();
    logger.info("Chunk schema ensured");
    await container.projectMetadataSchema.ensure();
    logger.info("Project metadata schema ensured");
    await ensureProjectMetadata(container, logger);

    logger.info("Application startup completed", {
      durationMs: Date.now() - startedAt,
    });

    return {
      config,
      container,
    };
  } catch (error) {
    logger.error("Application startup failed", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    throw error;
  }
}

/**
 * 确保当前 PROJECT_SPACE 的元数据存在且与当前 embedding 配置一致。
 */
async function ensureProjectMetadata(
  container: AppContainer,
  logger: AppContainer["logger"],
): Promise<void> {
  const existing = await container.projectMetadataRepository.getByProjectSpace({
    projectSpace: container.config.projectSpace,
  });

  if (!existing) {
    logger.info("Project metadata not found, creating initial record");
    await container.projectMetadataRepository.save(
      createProjectMetadata(container.config),
    );
    return;
  }

  assertProjectMetadataMatches(container.config, existing);
  logger.info("Project metadata matched current configuration");
}

/**
 * 生成首次初始化时写入数据库的项目元数据。
 */
function createProjectMetadata(config: AppConfig): ProjectMetadata {
  const timestamp = new Date().toISOString();

  return {
    projectSpace: config.projectSpace,
    namespace: config.surreal.namespace,
    database: config.surreal.database,
    embeddingProvider: config.embedding.provider,
    embeddingModel: config.embedding.model,
    embeddingVectorDimension: config.embedding.vectorDimension,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * 校验已存在的项目元数据是否与当前配置一致。
 */
function assertProjectMetadataMatches(
  config: AppConfig,
  metadata: ProjectMetadata,
): void {
  if (metadata.projectSpace !== config.projectSpace) {
    throw new Error(
      `Project metadata mismatch: expected projectSpace ${config.projectSpace}, received ${metadata.projectSpace}`,
    );
  }

  if (metadata.namespace !== config.surreal.namespace) {
    throw new Error(
      `Project metadata mismatch: expected namespace ${config.surreal.namespace}, received ${metadata.namespace}`,
    );
  }

  if (metadata.database !== config.surreal.database) {
    throw new Error(
      `Project metadata mismatch: expected database ${config.surreal.database}, received ${metadata.database}`,
    );
  }

  if (metadata.embeddingProvider !== config.embedding.provider) {
    throw new Error(
      `Project metadata mismatch: expected embedding provider ${config.embedding.provider}, received ${metadata.embeddingProvider}`,
    );
  }

  if (metadata.embeddingModel !== config.embedding.model) {
    throw new Error(
      `Project metadata mismatch: expected embedding model ${config.embedding.model}, received ${metadata.embeddingModel}`,
    );
  }

  if (metadata.embeddingVectorDimension !== config.embedding.vectorDimension) {
    throw new Error(
      `Project metadata mismatch: expected embedding vector dimension ${config.embedding.vectorDimension}, received ${metadata.embeddingVectorDimension}`,
    );
  }
}
