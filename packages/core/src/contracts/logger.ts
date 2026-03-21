/**
 * 日志字段允许的基础值类型。
 */
export type LogPrimitive = string | number | boolean | null;

/**
 * 日志字段值。
 *
 * 保持为 JSON 友好结构，并允许直接挂载 Error 以便由具体日志实现统一序列化。
 */
export type LogValue =
  | Error
  | LogPrimitive
  | LogValue[]
  | { [key: string]: LogValue | undefined }
  | undefined;

/**
 * 结构化日志字段集合。
 */
export type LogFields = Record<string, LogValue>;

/**
 * 当前仓库统一推荐使用的结构化日志字段。
 */
export const STANDARD_LOG_FIELDS = {
  package: "package",
  module: "module",
  component: "component",
  operation: "operation",
  requestId: "requestId",
  projectSpace: "projectSpace",
  repositoryId: "repositoryId",
  filePath: "filePath",
  provider: "provider",
  embeddingModel: "embeddingModel",
  batchSize: "batchSize",
  chunkCount: "chunkCount",
  scannedFileCount: "scannedFileCount",
  parsedFileCount: "parsedFileCount",
  skippedFileCount: "skippedFileCount",
  failedFileCount: "failedFileCount",
  durationMs: "durationMs",
} as const;

/**
 * 跨包统一日志抽象。
 */
export interface Logger {
  /** 记录调试级日志。 */
  debug(message: string, fields?: LogFields): void;
  /** 记录信息级日志。 */
  info(message: string, fields?: LogFields): void;
  /** 记录警告级日志。 */
  warn(message: string, fields?: LogFields): void;
  /** 记录错误级日志。 */
  error(message: string, fields?: LogFields): void;
  /** 创建带固定上下文字段的子 logger。 */
  child(bindings: LogFields): Logger;
}

/**
 * 默认空日志实现，便于在未显式接入日志时保持兼容。
 */
export const NOOP_LOGGER: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return NOOP_LOGGER;
  },
};
