/**
 * 应用依赖容器的最小骨架定义。
 */
import {
  DefaultIndexRepositoryService,
  type ChunkRepository,
  type EmbeddingProvider,
  type IndexRepositoryService,
  type ProjectMetadataRepository,
  type RepositoryChunkPreparationService,
  type SearchRepository,
} from "@agent-code-index/core";
import {
  createEmbeddingProvider,
  createSurrealClient,
  LocalFileScanner,
  ParserFactory,
  RepositoryChunkPreparationService as DefaultRepositoryChunkPreparationService,
  SurrealChunkRepository,
  SurrealChunkSchema,
  SurrealProjectMetadataRepository,
  SurrealProjectMetadataSchema,
  SurrealSearchRepository,
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
  /** 当前项目使用的 embedding provider。 */
  embeddingProvider: EmbeddingProvider;
  /** SurrealDB 客户端骨架实例。 */
  surrealClient: SurrealClient;
  /** chunk 表的 schema 初始化器。 */
  chunkSchema: SurrealChunkSchema;
  /** project_metadata 表的 schema 初始化器。 */
  projectMetadataSchema: SurrealProjectMetadataSchema;
  /** 仓库 chunk 准备服务。 */
  chunkPreparationService: RepositoryChunkPreparationService;
  /** chunk 仓储。 */
  chunkRepository: ChunkRepository;
  /** 语义搜索仓储。 */
  searchRepository: SearchRepository;
  /** 仓库索引服务。 */
  indexRepositoryService: IndexRepositoryService;
  /** 项目元数据仓储。 */
  projectMetadataRepository: ProjectMetadataRepository;
}

/**
 * 基于当前配置创建应用依赖容器。
 */
export function createContainer(config: AppConfig): AppContainer {
  const surrealClient = createSurrealClient(toSurrealConnectionConfig(config));
  const embeddingProvider = createEmbeddingProvider({
    provider: config.embedding.provider,
    model: config.embedding.model,
    vectorDimension: config.embedding.vectorDimension,
    apiKey: config.embedding.apiKey,
    baseUrl: config.embedding.baseUrl,
  });
  const chunkRepository = new SurrealChunkRepository(surrealClient);
  const searchRepository = new SurrealSearchRepository(surrealClient);
  const chunkPreparationService = new DefaultRepositoryChunkPreparationService(
    new LocalFileScanner(config.indexing.ignorePatterns),
    new ParserFactory(),
  );
  const indexRepositoryService = new DefaultIndexRepositoryService(
    chunkPreparationService,
    embeddingProvider,
    chunkRepository,
  );

  return {
    config,
    embeddingProvider,
    surrealClient,
    chunkSchema: new SurrealChunkSchema(surrealClient),
    projectMetadataSchema: new SurrealProjectMetadataSchema(surrealClient),
    chunkPreparationService,
    chunkRepository,
    searchRepository,
    indexRepositoryService,
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
