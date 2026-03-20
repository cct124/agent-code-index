/**
 * infra 包的公共导出入口。
 */
export {
  DefaultSurrealClient,
  createSurrealClient,
} from "./storage/surreal/surreal-client.js";
export type {
  SurrealClient,
  SurrealClientHealthStatus,
  SurrealConnectionConfig,
} from "./storage/surreal/surreal-client.js";

/**
 * 基础设施包的逻辑包名常量。
 */
export const INFRA_PACKAGE_NAME = "@agent-code-index/infra";
