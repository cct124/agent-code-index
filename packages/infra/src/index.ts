/**
 * infra 包的公共导出入口。
 */
export {
  createEmbeddingProvider,
  type EmbeddingProviderConfig,
  type EmbeddingProviderName,
} from "./embedding/provider-factory.js";
export {
  VoyageEmbeddingProvider,
  type VoyageEmbeddingProviderConfig,
} from "./embedding/voyage-embedding-provider.js";
export {
  DefaultSurrealClient,
  createSurrealClient,
} from "./storage/surreal/surreal-client.js";
export { FallbackParser } from "./parsing/fallback-parser.js";
export { ParserFactory } from "./parsing/parser-factory.js";
export { RepositoryChunkPreparationService } from "./services/repository-chunk-preparation-service.js";
export { LocalFileScanner } from "./scanning/local-file-scanner.js";
export { SurrealChunkRepository } from "./storage/surreal/surreal-chunk-repository.js";
export { SurrealChunkSchema } from "./storage/surreal/surreal-chunk-schema.js";
export { SurrealProjectMetadataRepository } from "./storage/surreal/surreal-project-metadata-repository.js";
export { SurrealProjectMetadataSchema } from "./storage/surreal/surreal-project-metadata-schema.js";
export { SurrealSearchRepository } from "./storage/surreal/surreal-search-repository.js";
export type {
  PrepareRepositoryChunksInput,
  PrepareRepositoryChunksResult,
} from "@agent-code-index/core";
export type {
  SurrealClient,
  SurrealClientHealthStatus,
  SurrealConnectionConfig,
} from "./storage/surreal/surreal-client.js";

/**
 * 基础设施包的逻辑包名常量。
 */
export const INFRA_PACKAGE_NAME = "@agent-code-index/infra";
