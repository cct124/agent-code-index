/**
 * infra 包的公共导出入口。
 */
export {
  DefaultSurrealClient,
  createSurrealClient,
} from "./storage/surreal/surreal-client.js";
export { SurrealChunkRepository } from "./storage/surreal/surreal-chunk-repository.js";
export { SurrealChunkSchema } from "./storage/surreal/surreal-chunk-schema.js";
export { SurrealProjectMetadataRepository } from "./storage/surreal/surreal-project-metadata-repository.js";
export { SurrealProjectMetadataSchema } from "./storage/surreal/surreal-project-metadata-schema.js";
export { SurrealSearchRepository } from "./storage/surreal/surreal-search-repository.js";
export type {
  SurrealClient,
  SurrealClientHealthStatus,
  SurrealConnectionConfig,
} from "./storage/surreal/surreal-client.js";

/**
 * 基础设施包的逻辑包名常量。
 */
export const INFRA_PACKAGE_NAME = "@agent-code-index/infra";
